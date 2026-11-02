// Conversación en las notas: el autor responde y la IA contesta en el mismo hilo. IA simulada.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8780', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 860 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const calls = []; let reply = () => '';
  await pg.route('https://api.anthropic.com/v1/messages', async (route) => {
    const body = JSON.parse(route.request().postData()); const prompt = body.messages[body.messages.length - 1].content;
    calls.push(prompt);
    const out = reply(prompt);
    const ev = (o) => 'event: ' + o.type + '\ndata: ' + JSON.stringify(o) + '\n\n';
    const parts = [out.slice(0, 12), out.slice(12)].filter(Boolean);
    await sleep(250);
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: parts.map(t => ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })).join('') + ev({ type: 'message_stop' }) });
  });
  await pg.goto('http://127.0.0.1:8780/'); await sleep(1200);
  await pg.evaluate(() => { localStorage.setItem('mde-ai-v1', JSON.stringify({ provider: 'anthropic', key: 'sk-ant-ok', model: 'claude-sonnet-5-5', base: '' })); App.prefs.autoAI = false; App.prefs.autoLocal = false; });
  await pg.evaluate(() => App.createProject('Hilo', 'novela', 0, null, 'mine')); await sleep(900);
  await pg.evaluate(() => App.ch(App.cid).update(x => { x.paras = [
    { id: 'a', segs: [{ t: 'La casa estaba vacía ' }, { m: { id: 'm1', type: 'rep', text: 'de golpe', note: 'Se repite cerca.', by: 'claude', at: 1 } }, { t: ' y la puerta se cerró de golpe.' }] },
    { id: 'b', segs: [{ t: 'Marta ' }, { m: { id: 'm2', type: 'ort', text: 'avia', note: 'Falta la hache y la be.', by: 'claude', at: 1 } }, { t: ' llegado tarde.' }] }]; }, { now: true }));
  await pg.evaluate(() => Editor.render()); await sleep(200);
  const send = async (id, text) => {
    await pg.evaluate((id) => { Editor.setActive(id); Editor.noteAction('reply', id); }, id); await sleep(100);
    await pg.fill('textarea[data-k="r-' + id + '"]', text);
    await pg.click('.note[data-id="' + id + '"] [data-a="send-reply"]');
  };
  // 1) el autor pregunta; la IA explica (y se ve mientras escribe)
  reply = () => 'Aparece dos veces en la misma frase: «de golpe» al inicio y al final. Mira si quieres el eco.';
  await send('m1', '¿Dónde se repite?');
  await sleep(80);
  ok(await pg.evaluate(() => !!document.querySelector('.note[data-id="m1"] .rep-live')), 'mientras contesta se ve en la nota');
  await sleep(700);
  const p1 = calls[0] || '';
  ok(/El autor respondió a una observación/.test(p1) && /Autor: ¿Dónde se repite\?/.test(p1) && /Se repite cerca/.test(p1), 'la IA recibe la observación, la conversación y el párrafo');
  ok(/sin escribir la frase por él ni proponer trama/.test(p1) && /solo señalas/.test(p1), 'se mantiene la regla: señala, no reescribe');
  let m1 = await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).find(x => x.m.id === 'm1').m);
  ok(m1.replies.length === 2 && m1.replies[1].by === 'claude' && /dos veces/.test(m1.replies[1].text) && !m1.done, 'la respuesta queda en el hilo y la nota sigue abierta');
  ok(await pg.evaluate(() => /dos veces/.test(document.querySelector('.note[data-id="m1"]').innerText)), 'la respuesta se ve en la nota');
  // 2) el autor explica que es intencional; la IA la cierra y no vuelve
  reply = () => 'Entendido, es un eco buscado. La doy por resuelta.\nCERRAR';
  await send('m1', 'Es intencional, quiero el eco.');
  await sleep(900);
  m1 = await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).find(x => x.m.id === 'm1').m);
  ok(m1.done && !/CERRAR/.test(m1.replies[3].text), 'si el autor tiene razón, la nota queda resuelta');
  ok(await pg.evaluate(() => (App.ch(App.cid).data.rejected || []).some(r => r.x === 'de golpe')), 'y queda recordada para que no vuelva a aparecer');
  // 3) ortografía: la IA da la forma correcta y aparece «Aplicar»
  reply = () => 'Es «había», del verbo haber.\nFIX: había';
  await send('m2', '¿Cómo se escribe?');
  await sleep(900);
  const m2 = await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).find(x => x.m.id === 'm2').m);
  ok(m2.fix && m2.fix.to === 'había' && !/FIX/.test(m2.replies[1].text), 'en ortografía deja la corrección lista para aplicar');
  ok(await pg.evaluate(() => !!document.querySelector('.note[data-id="m2"] [data-a="apply"]')), 'botón Aplicar visible');
  // 4) la conversación acompaña las revisiones siguientes
  reply = () => '[]';
  await pg.evaluate(() => { Editor.root.focus(); Editor.setCaret({ pid: 'b', off: 0 }); }); await pg.keyboard.type('Y '); await sleep(300);
  await pg.evaluate(() => Review.reviewChapter(App.cid)); await sleep(900);
  ok(/conversación: Autor: ¿Cómo se escribe\?/.test(calls[calls.length - 1]), 'la próxima revisión ve lo conversado');
  // 5) se puede apagar
  const n = calls.length;
  await pg.evaluate(() => { App.prefs.replyAI = false; }); await send('m2', 'Gracias.'); await sleep(500);
  ok(calls.length === n, 'con la opción apagada, la IA no contesta');
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
