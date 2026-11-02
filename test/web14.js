// Consistencia de la revisión con IA: huella por párrafo, observaciones anteriores y lo que el autor borró. IA simulada.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8779', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 860 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const calls = [];
  let reply = () => '[]';
  await pg.route('https://api.anthropic.com/v1/messages', async (route) => {
    const body = JSON.parse(route.request().postData()); const prompt = body.messages[body.messages.length - 1].content;
    calls.push({ prompt: prompt, temperature: body.temperature });
    const out = reply(prompt);
    const ev = (o) => 'event: ' + o.type + '\ndata: ' + JSON.stringify(o) + '\n\n';
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: out } }) + ev({ type: 'message_stop' }) });
  });
  await pg.goto('http://127.0.0.1:8779/'); await sleep(1200);
  await pg.evaluate(() => { localStorage.setItem('mde-ai-v1', JSON.stringify({ provider: 'anthropic', key: 'sk-ant-ok', model: 'claude-sonnet-5-5', base: '' })); App.prefs.autoAI = false; App.prefs.autoLocal = false; });
  await pg.evaluate(() => App.createProject('Consistencia', 'novela', 0, null, 'mine')); await sleep(900);
  await pg.evaluate(() => App.ch(App.cid).update(x => { x.paras = [
    { id: 'a', segs: [{ t: 'La casa estaba vacía desde el invierno pasado.' }] },
    { id: 'b', segs: [{ t: 'Marta abrió la ventana y el viento entró de golpe.' }] },
    { id: 'c', segs: [{ t: 'Nadie sabía quién había dejado la carta sobre la mesa.' }] }]; }, { now: true }));
  await pg.evaluate(() => Editor.render()); await sleep(200);
  // 1) primera revisión del capítulo
  reply = () => JSON.stringify([{ p: 'P1', type: 'dud', text: 'desde el invierno pasado', note: '¿Qué invierno? Puede confundir.' }, { p: 'P2', type: 'rep', text: 'de golpe', note: 'Expresión muy usada.' }]);
  await pg.evaluate(() => Review.reviewChapter(App.cid)); await sleep(1200);
  const n1 = await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).filter(x => x.m.by === 'claude').length);
  ok(n1 === 2 && calls.length === 1, 'primera revisión: 2 marcas');
  ok(calls[0].temperature === 0, 'la IA se llama con temperatura 0 (mismas frases, misma respuesta)');
  // 2) sin cambios: no vuelve a llamar ni cambia las marcas
  await pg.evaluate(() => Review.reviewChapter(App.cid)); await sleep(600);
  ok(calls.length === 1 && /Nada cambió/.test(await pg.evaluate(() => document.querySelector('#toast').innerText)), 'sin cambios: no se vuelve a revisar y las marcas se conservan');
  // 3) cambio leve en el párrafo 2: solo ese va con sus observaciones anteriores
  await pg.evaluate(() => { Editor.root.focus(); Editor.setCaret({ pid: 'b', off: 5 }); }); await pg.keyboard.type(' ya'); await sleep(400);
  reply = (p) => { const m = p.match(/(P\d+\.R\d+) · rep/); return JSON.stringify(m ? [{ prev: m[1], text: 'de golpe' }] : []); };
  await pg.evaluate(() => Review.reviewChapter(App.cid)); await sleep(1200);
  const pr = calls[calls.length - 1].prompt;
  ok(/\[P1\] Marta ya abrió/.test(pr) && /contexto, ya revisado/.test(pr) && !/\[P2\]/.test(pr), 'solo va el párrafo cambiado (y el resto como contexto)');
  ok(/Observaciones anteriores/.test(pr) && /Sé consistente/.test(pr), 'la IA recibe sus observaciones anteriores para no cambiar de criterio');
  const marks = await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).filter(x => x.m.by === 'claude').map(x => x.m.text + ' | ' + x.m.note));
  ok(marks.includes('de golpe | Expresión muy usada.') && marks.some(m => /invierno pasado/.test(m)), 'la observación válida se mantiene igual y las demás se conservan');
  // 4) lo que el autor borra no vuelve
  await pg.evaluate(() => { const m = MDE.allMarks(App.ch(App.cid).data).find(x => x.m.text === 'de golpe'); Editor.noteAction('del', m.m.id); Editor.noteAction('del', m.m.id); }); await sleep(300);
  await pg.evaluate(() => { Editor.root.focus(); Editor.setCaret({ pid: 'b', off: 0 }); }); await pg.keyboard.type('Y '); await sleep(400);
  reply = () => JSON.stringify([{ p: 'P1', type: 'rep', text: 'de golpe', note: 'Expresión muy usada.' }]);
  await pg.evaluate(() => Review.reviewChapter(App.cid)); await sleep(1200);
  const pr2 = calls[calls.length - 1].prompt;
  ok(/ya revisó y borró/.test(pr2) && /de golpe/.test(pr2), 'la IA sabe qué observaciones borraste');
  ok(await pg.evaluate(() => !MDE.allMarks(App.ch(App.cid).data).some(x => x.m.text === 'de golpe')), 'y aunque la repita, no vuelve a aparecer');
  // 5) «Revisar todo de nuevo» manda todo
  reply = () => '[]';
  await pg.evaluate(() => Review.reviewChapter(App.cid, true)); await sleep(1200);
  ok(/\[P3\]/.test(calls[calls.length - 1].prompt), '«Revisar todo de nuevo» revisa todos los párrafos');
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
