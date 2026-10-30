// Páginas, saltos de página, navegación y secciones especiales. Texto de prueba inventado.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8772', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.goto('http://127.0.0.1:8772/'); await sleep(1200);
  await pg.evaluate(() => { App.prefs.autoAI = false; App.prefs.autoLocal = false; });
  await pg.evaluate(() => App.createProject('Libro', 'novela', 0, null, 'mine')); await sleep(900);
  await pg.evaluate(() => App.addChapter()); await sleep(600);
  await pg.evaluate(() => App.go(App.chHash(App.chapterList()[0].id))); await sleep(700);
  const frase = 'La lluvia caía sobre el techo de zinc mientras el pueblo dormía y nadie, ni siquiera el perro del almacén, se atrevía a cruzar la calle principal. ';
  await pg.evaluate((f) => App.ch(App.cid).update(x => { x.paras = Array.from({ length: 40 }, (_, i) => ({ id: 'p' + i, segs: [{ t: (i + 1) + '. ' + f.repeat(2 + (i % 3)) }] })); }, { now: true }), frase);
  await pg.evaluate(() => Editor.render()); await sleep(700);
  ok(await pg.evaluate(() => Pages.pages.length > 3), 'calcula páginas también en hoja continua (' + await pg.evaluate(() => Pages.pages.length) + ')');
  ok(await pg.evaluate(() => !document.querySelector('.paper.paged')), 'por defecto, hoja continua');
  await pg.evaluate(() => Pages.setMode('paginas')); await sleep(500);
  const seps = await pg.evaluate(() => document.querySelectorAll('#doc > p.pg-start').length);
  ok(seps === (await pg.evaluate(() => Pages.pages.length)) - 1, 'vista de páginas con separadores (' + seps + ')');
  ok(/Pág\. 1 de/.test(await pg.evaluate(() => document.querySelector('#status').innerText)), 'indicador de página en la barra');
  // salto de página manual
  await pg.evaluate(() => { Editor.setCaret({ pid: 'p3', off: 0 }); Editor.lastCaret = { pid: 'p3', off: 0 }; Pages.toggleBreak(); }); await sleep(600);
  ok(await pg.evaluate(() => App.ch(App.cid).data.paras[3].pb === true && Pages.pages[1].pids[0] === 'p3'), 'salto de página: p4 empieza la página 2');
  // escribir no borra el salto
  await pg.evaluate(() => { Editor.root.focus(); Editor.setCaret({ pid: 'p3', off: 3 }); }); await pg.keyboard.type('xx'); await sleep(500);
  ok(await pg.evaluate(() => App.ch(App.cid).data.paras[3].pb === true && /xx/.test(MDE.parText(App.ch(App.cid).data.paras[3]))), 'el salto se mantiene al editar');
  // revisar solo una página
  ok(await pg.evaluate(() => Pages.pagePids(2).length > 0 && Pages.pagePids(2)[0] === 'p3'), 'párrafos de la página 2');
  // secciones especiales
  await pg.evaluate(() => { Pages.addSpecial('epilogo'); }); await sleep(500);
  await pg.evaluate(() => { Pages.addSpecial('prologo'); }); await sleep(500);
  await pg.evaluate(() => { Pages.addSpecial('dedicatoria'); }); await sleep(500);
  await pg.evaluate(() => { Pages.addSpecial('agradecimientos'); }); await sleep(500);
  await pg.evaluate(() => App.addChapter()); await sleep(500);
  const order = await pg.evaluate(() => App.chapterList().map(c => (c.role || 'cap') + ':' + c.title).join(' | '));
  console.log('    ', order);
  ok(order === 'dedicatoria:Dedicatoria | prologo:Prólogo | cap:Capítulo 1 | cap:Capítulo 2 | cap:Capítulo 3 | epilogo:Epílogo | agradecimientos:Agradecimientos', 'orden del libro');
  const side = await pg.evaluate(() => Array.from(document.querySelectorAll('.chlist .go')).map(b => b.querySelector('.n').textContent + ' ' + b.querySelector('.t').textContent).join(' | '));
  ok(/§ Prólogo/.test(side) && /01 Capítulo 1/.test(side) && /03 Capítulo 3/.test(side), 'índice: especiales sin número ' + side);
  // navegación
  const c1 = await pg.evaluate(() => App.chapterList()[2].id);
  await pg.evaluate((id) => App.go(App.chHash(id)), c1); await sleep(700);
  ok(/Capítulo 1 de 3/.test(await pg.evaluate(() => document.querySelector('#ch-eyebrow').textContent)), 'encabezado «Capítulo 1 de 3»');
  const nav = await pg.evaluate(() => document.querySelector('.ch-nav').innerText.replace(/\s+/g, ' '));
  ok(/Anterior/i.test(nav) && /Prólogo/.test(nav) && /Siguiente/i.test(nav) && /Capítulo 2/.test(nav), 'navegación anterior/siguiente: ' + nav);
  await pg.keyboard.press('Alt+PageDown'); await sleep(600);
  ok(await pg.evaluate(() => App.cid === App.chapterList()[3].id), 'Alt+AvPág va al siguiente');
  await pg.keyboard.press('Control+j'); await sleep(300);
  ok(await pg.evaluate(() => !!document.querySelector('.pal')), 'paleta Ir a… con Ctrl+J');
  await pg.keyboard.type('epil'); await pg.keyboard.press('Enter'); await sleep(600);
  ok(await pg.evaluate(() => (App.chapterList().find(c => c.id === App.cid) || {}).role === 'epilogo'), 'Ir a… lleva al epílogo');
  ok(/Epílogo/.test(await pg.evaluate(() => document.querySelector('#ch-eyebrow').textContent)), 'encabezado de sección especial');
  // exportación con salto de página
  const html = await pg.evaluate(() => { const r = IO.collect(App.pid); return IO.toHtml(r.P, r.chapters, false, false); });
  ok(/break-before:page/.test(html), 'exportación respeta el salto de página');
  await pg.evaluate((id) => App.go(App.chHash(id)), c1); await sleep(700);
  await pg.evaluate(() => { const p = document.querySelector('#doc > p.pg-start'); p.scrollIntoView({ block: 'center' }); }); await sleep(300);
  await pg.screenshot({ path: path.resolve(__dirname, '_pages.png') });
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
