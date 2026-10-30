// Revisión automática más completa e integración con la IA.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8769', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  let lastPrompt = '';
  await pg.route('https://api.anthropic.com/v1/messages', async (route) => {
    const body = JSON.parse(route.request().postData()); lastPrompt = body.messages[body.messages.length - 1].content;
    let out = 'listo';
    if (lastPrompt.includes('PÁRRAFO A REVISAR')) {
      const lines = lastPrompt.split('\n').filter(l => /^A\d+ · /.test(l));
      // confirma solo la primera observación automática (mejorando la nota) y agrega una propia
      const first = lines[0] ? lines[0].split(' · ')[0] : null;
      out = JSON.stringify([first ? { auto: first, note: 'IA: confirmada y mejor explicada.' } : null, { type: 'coh', text: 'Juan', note: 'IA: ¿Juan o Joan?' }].filter(Boolean));
    }
    const ev = (o) => 'event: ' + o.type + '\ndata: ' + JSON.stringify(o) + '\n\n';
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: out } }) + ev({ type: 'message_stop' }) });
  });
  await pg.goto('http://127.0.0.1:8769/'); await sleep(1200);
  await pg.evaluate(() => { localStorage.setItem('mde-ai-v1', JSON.stringify({ provider: 'anthropic', key: 'sk-ant-ok', model: 'claude-sonnet-5-5', base: '' })); App.prefs.autoAI = false; });
  await pg.evaluate(() => App.createProject('Reglas', 'novela', 0, null, 'mine')); await sleep(900);
  const sample = '- Hola dijo Juan. ¿que hora es? el dijo que no se si venir. Pienso de que me di cuenta que es tarde. Ella caminaba. Ella miraba. Ella esperaba. tenía miedo «de todo.';
  await pg.evaluate((t) => { Editor.root.focus(); document.execCommand('insertText', false, t); }, sample);
  await sleep(2500);
  const marks = () => pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).map(x => x.m.by + ':' + (x.m.rule || x.m.type) + ':' + x.m.text + (x.m.fix ? '→' + x.m.fix.to : '')));
  const before = await marks();
  console.log('A automáticas', before.length); before.forEach(x => console.log('   ', x));
  await pg.evaluate(() => Review.reviewPara(App.cid, App.ch(App.cid).data.paras[0].id, true)); await sleep(1500);
  console.log('B prompt incluye observaciones', /Observaciones automáticas:\nA1 · /.test(lastPrompt));
  const after = await marks();
  console.log('C después de la IA', after);
  console.log('   descartadas guardadas', await pg.evaluate(() => (App.ch(App.cid).data.dismiss || {})[App.ch(App.cid).data.paras[0].id].length));
  // editar de nuevo el párrafo: la revisión automática no debe volver a poner lo descartado
  await pg.evaluate(() => { const pe = document.querySelector('#doc > p'); Editor.root.focus(); Editor.setCaret({ pid: pe.dataset.id, off: 1e9 }); });
  await pg.keyboard.type(' Fin.'); await sleep(2500);
  const again = await marks();
  console.log('D tras editar', again);
  console.log('ERR', errs);
  await b.close(); srv.kill();
})();
