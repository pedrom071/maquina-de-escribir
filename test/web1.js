const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(800);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: process.env.SW ? 'allow' : 'block' });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const JSZIP = path.resolve(__dirname, '../node_modules/jszip/dist/jszip.min.js');
  await pg.route(/jszip\.min\.js/, r => r.fulfill({ path: JSZIP, contentType: 'application/javascript' }));
  let apiCalls = [];
  await pg.route('https://api.anthropic.com/v1/messages', async (route) => {
    const req = route.request(); const body = JSON.parse(req.postData()); apiCalls.push({ h: req.headers(), body });
    if (!/^sk-ant-ok/.test(req.headers()['x-api-key'])) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    const prompt = body.messages[body.messages.length - 1].content;
    let out = 'listo';
    if (prompt.includes('PÁRRAFO A REVISAR')) { const para = prompt.split('PÁRRAFO A REVISAR:\n')[1]; const w = para.split(/\s+/); out = JSON.stringify([{ type: 'coh', text: w.slice(w.length - 3).join(' '), note: 'IA: prueba de coherencia.' }]); }
    const ev = (o) => 'event: ' + o.type + '\ndata: ' + JSON.stringify(o) + '\n\n';
    const parts = [ev({ type: 'message_start', message: {} }), ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })];
    for (let i = 0; i < out.length; i += 7) parts.push(ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: out.slice(i, i + 7) } }));
    parts.push(ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }), ev({ type: 'message_stop' }));
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: parts.join('') });
  });
  await pg.goto('http://127.0.0.1:8765/');
  await sleep(1500);
  console.log('A web mode', await pg.evaluate(() => [MDE.RT.web, MDE.RT.local, !!MDE.RT.sample]), 'share hidden', await pg.locator('#btn-share').isHidden(), 'h1', await pg.locator('.home-hero h1').textContent());
  await pg.locator('.home-hero .btn.primary').click(); await sleep(200);
  await pg.locator('#np-title').fill('Prueba web'); await pg.locator('.modal .btn.primary').click(); await sleep(800);
  await pg.keyboard.type('Ella dijo que que no queria venir , pero despues llego tarde.Rosa Maria y Rossa caminaban por el puerto Que hora es? La casa era muy muy grande y la casa tenia una casa.');
  await sleep(3800);
  const marks = await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).map(x => x.m.by + ':' + x.m.rule + ':' + x.m.text + (x.m.fix ? '→' + x.m.fix.to : '')));
  console.log('B local marks', marks.length, marks);
  // al diccionario
  const spellMark = await pg.evaluate(() => (MDE.allMarks(App.ch(App.cid).data).find(x => x.m.rule === 'spell') || {}).m);
  if (spellMark) {
    await pg.evaluate((id) => Editor.setActive(id, true), spellMark.id); await sleep(200);
    const btns = await pg.locator('.note.active .act').allTextContents(); console.log('   note buttons', btns);
    await pg.locator('.note.active [data-a="apply"]').click(); await sleep(300);
    console.log('   applied fix →', await pg.evaluate(() => MDE.parText(App.ch(App.cid).data.paras[0]).slice(0, 40)));
  }
  // IA sin configurar → abre ajustes
  await pg.evaluate(() => { const p = App.ch(App.cid).data.paras[0]; Review.reviewPara(App.cid, p.id, true); }); await sleep(300);
  console.log('C modal', await pg.locator('.modal h3').textContent(), '| pill', await pg.locator('#btn-ai').textContent(), '| banner', await pg.locator('.ai-banner').count());
  await pg.locator('#ai-key').fill('sk-ant-mala-0000000000000000000000'); await sleep(1300);
  console.log('   bad key:', await pg.locator('.ai-status').textContent(), '| provider', await pg.locator('.kopt[aria-checked=true] b').textContent());
  await pg.locator('#ai-key').fill('sk-ant-ok-1234567890abcdefghijklmn'); await sleep(1300);
  console.log('   good key:', await pg.locator('.ai-status').textContent());
  await pg.locator('.modal .btn.primary').click(); await sleep(1200);
  console.log('   saved?', await pg.evaluate(() => [AI.ready(), AI.cfg().model, App.prefs.autoAI]), '| modal open', await pg.locator('.modal').count(), '| pill', await pg.locator('#btn-ai').textContent(), '| banner', await pg.locator('.ai-banner').count());
  await pg.evaluate(() => { const p = App.ch(App.cid).data.paras[0]; Review.reviewPara(App.cid, p.id, true); }); await sleep(1200);
  console.log('D ai marks', await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).filter(x => x.m.by === 'claude').map(x => x.m.text + ': ' + x.m.note)), '| both kept', await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).filter(x => x.m.by === 'revisor').length));
  // informe con streaming
  await pg.evaluate(() => Review.report(App.cid)); await sleep(200);
  await pg.locator('#drawer .df .btn.primary').click(); await sleep(800);
  console.log('E report', (await pg.locator('#report-out').textContent()).slice(0, 30));
  await pg.keyboard.press('Escape');
  // persistencia tras recargar
  await sleep(800);
  await pg.goto('http://127.0.0.1:8765/#'); await pg.reload(); await sleep(1500);
  console.log('F after reload projects', await pg.locator('.pcard:not(.new) h3').allTextContents(), 'ai ready', await pg.evaluate(() => AI.ready()));
  // respaldo completo
  await pg.locator('#btn-me').click(); await sleep(300);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.locator('#drawer .btn', { hasText: 'Descargar respaldo completo' }).click()]);
  console.log('G backup file', dl.suggestedFilename());
  // exportar docx
  await pg.keyboard.press('Escape');
  await pg.locator('.pcard:not(.new)').first().click(); await sleep(800);
  const [dl2] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => IO.doExport('docx', null, true))]);
  console.log('H docx', dl2.suggestedFilename());
  // service worker
  console.log('I sw', await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; }));
  await pg.screenshot({ path: 'test/w-editor.png' });
  console.log('ERR', errs);
  await b.close(); srv.kill();
})();
