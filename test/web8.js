// Herramienta de diálogos y atajos. Texto de prueba inventado.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8773', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.goto('http://127.0.0.1:8773/'); await sleep(1200);
  await pg.evaluate(() => { App.prefs.autoAI = false; App.prefs.autoLocal = false; });
  await pg.evaluate(() => App.createProject('Diálogos', 'novela', 0, null, 'mine')); await sleep(900);
  const text = () => pg.evaluate(() => App.ch(App.cid).data.paras.map(p => MDE.parText(p)).join(' ¶ '));
  // atajos: Alt + guion y Alt + I
  await pg.evaluate(() => Editor.focusStart());
  await pg.keyboard.press('Alt+Minus'); await pg.keyboard.type('Hola'); await pg.keyboard.press('Alt+KeyI'); await pg.keyboard.type('dijo Ana'); await pg.keyboard.press('Alt+KeyI'); await pg.keyboard.type('. ¿Vienes?');
  await sleep(400);
  ok(await text() === '—Hola —dijo Ana—. ¿Vienes?', 'atajos escriben «' + await text() + '»');
  await pg.keyboard.press('Alt+Minus'); await pg.keyboard.type('Ya voy'); await sleep(400);
  ok(await text() === '—Hola —dijo Ana—. ¿Vienes? ¶ —Ya voy', 'Alt + guion en un párrafo con texto abre uno nuevo: ' + await text());
  // revisión a pedido
  const lines = ['— Hola, —dijo Pedro—.', '—Ya voy —Dijo Ana.', '—Bueno - dijo él —y salió.', '—Pasa —dijo ella—.', '—Todo bien —respondió—gracias.'];
  await pg.evaluate((L) => App.ch(App.cid).update(x => { x.paras = L.map((t, i) => ({ id: 'd' + i, segs: [{ t: t }] })); }, { now: true }), lines);
  await pg.evaluate(() => Editor.render()); await sleep(200);
  await pg.evaluate(() => Dialogo.check()); await sleep(400);
  const marks = await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).filter(x => x.m.rule === 'dlg').map(x => x.m.text + ' → ' + (x.m.fix ? x.m.fix.to : '') + ' | ' + x.m.note.split('.')[0]));
  marks.forEach(m => console.log('     ', m));
  const has = (re) => marks.some(m => re.test(m));
  ok(has(/^— Hola → —Hola/), 'espacio tras la raya de apertura');
  ok(has(/coma|signo/), 'coma antes del inciso');
  ok(has(/^—Dijo → —dijo/), 'verbo del inciso en minúscula');
  ok(has(/raya \(—\), no guion/), 'guion en vez de raya en el inciso');
  ok(has(/termina el párrafo/), 'raya de cierre al final del párrafo');
  ok(has(/después de la raya que cierra/), 'falta espacio tras cerrar el inciso');
  ok(await pg.evaluate(() => { const d = App.ch(App.cid).data; return MDE.allMarks(d).filter(x => x.m.rule === 'dlg').every(x => x.m.by === 'revisor'); }), 'solo señala (marcas del revisor, nada se cambia solo)');
  const fine = await pg.evaluate(() => Dialogo.analyze('—Hola —dijo Ana—. ¿Vienes? —preguntó luego.').length + Dialogo.analyze('—Ya voy —dijo.').length + Dialogo.analyze('Texto sin diálogo, con una raya—así—en medio.').length);
  ok(fine === 0, 'diálogos correctos no se marcan (' + fine + ')');
  // atajos e indicaciones
  const menu = await pg.evaluate(() => { Editor.reviewMenu(document.querySelector('.wbar .btn')); const t = document.querySelector('.menu').innerText; return t; }); await pg.keyboard.press('Escape');
  ok(/Alt \+ - \(guion\)/.test(menu) && /Alt \+ I/.test(menu), 'el menú muestra los atajos de diálogo');
  const vmenu = await pg.evaluate(() => { Editor.moreMenu(document.querySelector('.wbar .ibtn')); const t = document.querySelector('.menu').innerText; return t; }); await pg.keyboard.press('Escape');
  ok(/Ctrl \+ K/.test(vmenu) && /Ctrl \+ S/.test(vmenu), 'menú Más con atajos legibles');
  await pg.keyboard.press('Control+Period'); await sleep(300);
  ok(await pg.evaluate(() => document.body.classList.contains('focus')), 'Ctrl + . (punto) activa el modo foco');
  await pg.keyboard.press('Escape'); await sleep(200);
  await pg.evaluate(() => App.help()); await sleep(200);
  const help = await pg.evaluate(() => document.querySelector('.keys').innerText);
  ok(/Ctrl \+ \. \(punto\)/.test(help) && /Ctrl \+ K/.test(help) && /Alt \+ - \(guion\)/.test(help), 'ayuda de atajos actualizada');
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
