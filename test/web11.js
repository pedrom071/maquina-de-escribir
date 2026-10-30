// Ideas (notas, imágenes, garabatos) y estructura al escribir (huecos, separadores, saltos). Textos inventados.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8776', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 860 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.goto('http://127.0.0.1:8776/'); await sleep(1200);
  await pg.evaluate(() => { App.prefs.autoAI = false; App.prefs.autoLocal = false; });
  await pg.evaluate(() => App.createProject('Puerto', 'novela', 0, null, 'mine')); await sleep(900);
  await pg.evaluate(() => App.proj().update(x => { const s = x.bible.sections.find(z => z.graph); s.items.push({ id: 'i1', title: 'Marta', fields: {}, body: '' }); const l = x.bible.sections.find(z => /Lugar/.test(z.label)); l.items.push({ id: 'i2', title: 'Valparaíso', fields: {}, body: '' }); }, { now: true }));
  // estructura al escribir
  await pg.evaluate(() => Editor.focusStart()); await pg.keyboard.type('Primera escena en el muelle.'); await sleep(200);
  await pg.keyboard.press('Alt+KeyH'); await sleep(400);
  await pg.keyboard.type('Después vuelve a casa.'); await pg.keyboard.press('Alt+KeyS'); await sleep(400);
  await pg.keyboard.type('Segunda parte del día.'); await sleep(300);
  const paras = await pg.evaluate(() => App.ch(App.cid).data.paras.map(p => MDE.parText(p)));
  ok(JSON.stringify(paras) === JSON.stringify(['Primera escena en el muelle.', '[por escribir]', 'Después vuelve a casa.', '* * *', 'Segunda parte del día.']), 'hueco y separador mientras escribes: ' + JSON.stringify(paras));
  ok(await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).some(x => x.m.type === 'pend' && x.m.gap)), 'el hueco queda como pendiente');
  ok(await pg.evaluate(() => !!document.querySelector('#doc > p.sep')), 'el separador se ve centrado');
  await pg.keyboard.press('Alt+Enter'); await sleep(400);
  ok(await pg.evaluate(() => App.ch(App.cid).data.paras[4].pb === true), 'Alt + Enter pone un salto de página');
  await pg.keyboard.press('Control+k'); await sleep(300);
  ok(await pg.evaluate(() => /Por escribir/i.test(document.querySelector('.pal').innerText)), '«Ir a…» lista los huecos por escribir');
  await pg.keyboard.press('Escape'); await sleep(200);
  // ideas
  await pg.evaluate(() => App.go('p-' + App.pid + '-ideas')); await sleep(600);
  const add = async (t) => { await pg.fill('#idea-in', t); await pg.keyboard.press('Control+Enter'); await sleep(350); };
  await add('Marta guarda una llave que nadie sabe de dónde salió');
  await add('—No vuelvas a preguntarme por él.');
  await add('Investigar cómo funcionaban los ascensores de Valparaíso en los ochenta?');
  await add('Al final ella descubre que la carta era falsa');
  await add('La memoria como una casa con puertas cerradas');
  const cats = await pg.evaluate(() => Ideas.list().map(x => x.cat).sort().join(','));
  ok(cats === ['dialogo', 'investigar', 'personaje', 'tema', 'trama'].sort().join(','), 'clasificación sin IA: ' + cats);
  // imagen (simulada con un lienzo) y garabato
  await pg.evaluate(async () => { const c = document.createElement('canvas'); c.width = 2000; c.height = 1200; const x = c.getContext('2d'); x.fillStyle = '#336'; x.fillRect(0, 0, 2000, 1200); const url = await Ideas.compress(c.toDataURL('image/png')); Ideas.add({ text: '', img: url, kind: 'imagen' }); }); await sleep(400);
  ok(await pg.evaluate(() => { const i = Ideas.list().find(x => x.kind === 'imagen'); return i && i.cat === 'imagen' && i.img.length < 900000; }), 'imagen comprimida y clasificada');
  await pg.evaluate(() => Array.from(document.querySelectorAll('.idea-cap .btn')).find(b => /Garabato/.test(b.textContent)).click()); await sleep(400);
  const cv = await pg.locator('.sk-canvas').boundingBox();
  await pg.mouse.move(cv.x + 50, cv.y + 50); await pg.mouse.down(); await pg.mouse.move(cv.x + 300, cv.y + 200, { steps: 8 }); await pg.mouse.up();
  await pg.evaluate(() => Array.from(document.querySelectorAll('.modal .foot .btn')).find(b => /Guardar garabato/.test(b.textContent)).click()); await sleep(400);
  ok(await pg.evaluate(() => Ideas.list().some(x => x.kind === 'garabato' && /^data:image\/png/.test(x.img))), 'garabato guardado');
  ok(await pg.evaluate(() => document.querySelectorAll('.idea').length === 7), 'siete tarjetas');
  await pg.evaluate(() => Array.from(document.querySelectorAll('.fchip')).find(b => /Personajes/.test(b.textContent)).click()); await sleep(300);
  ok(await pg.evaluate(() => document.querySelectorAll('.idea').length === 1 && /Marta/.test(document.querySelector('.idea').innerText)), 'filtro por categoría y nombre de la biblia');
  await pg.screenshot({ path: path.resolve(__dirname, '_ideas-f.png') });
  // asignar a capítulo y ver el aviso en el editor
  await pg.evaluate(() => { const x = Ideas.list().find(z => z.cat === 'personaje'); Ideas.update(x.id, z => { z.cid = App.chapterList()[0].id; }); }); await sleep(300);
  await pg.evaluate(() => { Ideas.filter = 'todas'; App.go(App.chHash(App.chapterList()[0].id)); }); await sleep(700);
  ok(await pg.evaluate(() => /1 idea para este capítulo/.test((document.querySelector('#idea-badge') || {}).textContent || '')), 'aviso de ideas en el capítulo');
  // captura rápida con Alt + N
  await pg.keyboard.press('Alt+KeyN'); await sleep(300);
  await pg.keyboard.type('Una gaviota con un ala rota'); await pg.keyboard.press('Control+Enter'); await sleep(400);
  ok(await pg.evaluate(() => Ideas.list().some(x => /gaviota/.test(x.text))), 'Alt + N guarda una idea desde el editor');
  // pasar a la biblia
  await pg.evaluate(() => { const x = Ideas.list().find(z => z.cat === 'personaje'); Ideas.toBible(x); }); await sleep(300);
  ok(await pg.evaluate(() => { const it = App.P().bible.sections.find(z => z.graph).items; return it.length === 1 && /llave/.test(it[0].body); }), 'la idea sobre Marta va a las notas de su ficha');
  // persistencia
  await pg.evaluate(() => App.go('')); await sleep(800);
  await pg.reload(); await sleep(1500);
  await pg.evaluate(() => App.go('p-' + App.allProjects()[0].doc.id + '-ideas')); await sleep(1000);
  ok(await pg.evaluate(() => Ideas.list().length === 8), 'las ideas siguen ahí al recargar (' + await pg.evaluate(() => Ideas.list().length) + ')');
  await pg.screenshot({ path: path.resolve(__dirname, '_ideas.png') });
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
