// Carpetas, partes y juntar proyectos (un poemario a partir de poemas sueltos). Textos inventados.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8774', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.goto('http://127.0.0.1:8774/'); await sleep(1200);
  await pg.evaluate(() => { App.prefs.autoAI = false; App.prefs.autoLocal = false; });
  const poems = { 'Faro': 'La luz que gira sobre el agua\nno sabe a quién le habla', 'Muelle': 'Las cuerdas duermen en el muelle\ncomo perros cansados', 'Niebla': 'La niebla borra los cerros\ny deja solo el ruido' };
  for (const [t, body] of Object.entries(poems)) {
    await pg.evaluate(([t, body]) => { App.createProject(t, 'poesia', 0, null, 'mine'); }, [t, body]); await sleep(800);
    await pg.evaluate((body) => App.ch(App.cid).update(x => { x.paras = body.split('\n').map((l, i) => ({ id: 'v' + i, segs: [{ t: l }] })); }, { now: true }), body); await sleep(200);
  }
  await pg.evaluate(() => App.go('')); await sleep(600);
  // carpetas
  await pg.evaluate(() => App.allProjects().forEach(x => Collections.setFolder(x.doc, 'Poemas del puerto'))); await sleep(500);
  ok(await pg.evaluate(() => Collections.folders().join() === 'Poemas del puerto'), 'carpeta creada');
  ok(await pg.evaluate(() => !!document.querySelector('.fbar') && /Poemas del puerto/.test(document.querySelector('.fbar').innerText)), 'barra de carpetas en el inicio');
  await pg.evaluate(() => Array.from(document.querySelectorAll('.fchip')).find(b => /Poemas del puerto/.test(b.textContent)).click()); await sleep(400);
  ok(await pg.evaluate(() => /Juntar en un libro/.test(document.querySelector('.fbar').innerText)), 'botón «Juntar en un libro» en la carpeta');
  // juntar
  await pg.evaluate(() => Array.from(document.querySelectorAll('.fbar .btn')).find(b => /Juntar/.test(b.textContent)).click()); await sleep(300);
  ok(await pg.evaluate(() => document.querySelectorAll('.join-it input:checked').length === 3), 'los tres proyectos marcados');
  await pg.evaluate(() => { const i = document.querySelector('.join input.inp'); i.value = 'Poemario del puerto'; }); 
  await pg.evaluate(() => Array.from(document.querySelectorAll('.modal .foot .btn')).find(b => /Juntar/.test(b.textContent)).click()); await sleep(1500);
  const r = await pg.evaluate(() => ({ title: App.P().title, kind: App.P().kind, ch: App.chapterList().map(c => c.title), text: MDE.parText(App.ch(App.chapterList()[0].id).data.paras[0]) }));
  console.log('    ', JSON.stringify(r));
  ok(r.title === 'Poemario del puerto' && r.kind === 'poesia', 'poemario nuevo de poesía');
  ok(r.ch.length === 3 && r.ch.every(t => ['Faro', 'Muelle', 'Niebla'].includes(t)), 'cada poema con su título');
  ok(/La luz que gira|Las cuerdas|La niebla/.test(r.text), 'se copian los versos');
  ok(await pg.evaluate(() => App.allProjects().filter(x => !x.doc.data.trashed).length === 4), 'originales intactos');
  // partes
  await pg.evaluate(() => Collections.addPart()); await sleep(600);
  await pg.evaluate(() => { const p = App.chapterList().find(c => c.role === 'parte'); App.proj().update(x => { x.chapters.find(c => c.id === p.id).title = 'Mar'; }, { now: true }); }); await sleep(200);
  await pg.evaluate(() => { const p = App.chapterList().find(c => c.role === 'parte'); const faro = App.chapterList().find(c => c.title === 'Faro'); Collections.moveToPart(faro.id, p.id); }); await sleep(400);
  const order = await pg.evaluate(() => App.chapterList().map(c => (c.role === 'parte' ? '[' + c.title + ']' : c.title)).join(' '));
  ok(/\[Mar\] Faro$/.test(order), 'poema movido dentro de la parte: ' + order);
  await pg.evaluate(() => App.renderSide()); await sleep(200);
  const side = await pg.evaluate(() => document.querySelector('.chlist').innerText.replace(/\s+/g, ' '));
  ok(/MAR|Mar/.test(side) && await pg.evaluate(() => !!document.querySelector('.chi.in-part')), 'índice con la parte y su poema adentro');
  ok(await pg.evaluate(() => Pages.number(App.chapterList().find(c => c.title === 'Faro').id) === 3), 'las partes no cuentan en la numeración');
  await pg.evaluate(() => Collections.toggleCollapse(App.chapterList().find(c => c.role === 'parte').id)); await sleep(200);
  ok(await pg.evaluate(() => !document.querySelector('.chi.in-part')), 'la parte se puede plegar');
  const faroId = await pg.evaluate(() => App.chapterList().find(c => c.title === 'Faro').id);
  await pg.evaluate((id) => App.go(App.chHash(id)), faroId); await sleep(600);
  ok(/Parte I/.test(await pg.evaluate(() => document.querySelector('#ch-eyebrow').textContent)), 'encabezado indica la parte');
  const md = await pg.evaluate(() => { const c = IO.collect(App.pid); return IO.toMarkdown(c.P, c.chapters, false, false); });
  ok(/## Mar\n\n### Faro/.test(md), 'exportación con la parte como título mayor');
  // copiar un poema a otro proyecto
  await pg.evaluate(() => { const target = App.allProjects().find(x => x.doc.data.title === 'Muelle'); Collections.projectPicker = (ex, fn) => fn(target.doc.id); Collections.chapterTo(App.cid, false); }); await sleep(800);
  ok(await pg.evaluate(() => (App.allProjects().find(x => x.doc.data.title === 'Muelle').doc.data.chapters || []).length === 2), 'copiar un poema a otro proyecto');
  await pg.evaluate(() => App.go('')); await sleep(500);
  await pg.screenshot({ path: path.resolve(__dirname, '_folders.png') });
  // aviso de respaldo cuando hay bastante texto solo en el navegador
  await pg.evaluate(() => { App.allProjects()[0].doc.update(x => { x.stats = Object.assign({}, x.stats, { words: 2000 }); }, { now: true }); App.prefs.lastBackup = 0; App.prefs.backupSnooze = 0; App.renderHome(); }); await sleep(300);
  ok(await pg.evaluate(() => !!document.querySelector('.backup-note')), 'aviso de respaldo en el inicio');
  await pg.evaluate(() => Array.from(document.querySelectorAll('.backup-note .btn')).find(b => /Más tarde/.test(b.textContent)).click()); await sleep(200);
  ok(await pg.evaluate(() => !document.querySelector('.backup-note') && App.prefs.backupSnooze > 0), '«Más tarde» lo oculta por unos días');
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
