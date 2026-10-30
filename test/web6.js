// Métrica de poemas. Usa un soneto de Garcilaso (dominio público) y un romance anónimo.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
const SONETO = `En tanto que de rosa y azucena
se muestra la color en vuestro gesto,
y que vuestro mirar ardiente, honesto,
con clara luz la tempestad serena;

y en tanto que el cabello, que en la vena
del oro se escogió, con vuelo presto
por el hermoso cuello blanco, enhiesto,
el viento mueve, esparce y desordena:

coged de vuestra alegre primavera
el dulce fruto antes que el tiempo airado
cubra de nieve la hermosa cumbre.

Marchitará la rosa el viento helado,
todo lo mudará la edad ligera
por no hacer mudanza en su costumbre.`;
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8771', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.goto('http://127.0.0.1:8771/'); await sleep(1200);
  await pg.evaluate(() => { App.prefs.autoAI = false; App.prefs.autoLocal = false; });
  // medición de versos sueltos
  const cases = { 'En tanto que de rosa y azucena': 11, 'Cuando me paro a contemplar mi estado': 11, 'Del salón en el ángulo oscuro': 10, 'Verde que te quiero verde': 8, 'y el corazón': 5, 'Volverán las oscuras golondrinas': 11, 'Juventud, divino tesoro': 9, 'Ahora estoy en el prohibido río': 11 };
  const got = await pg.evaluate((c) => Object.keys(c).map(t => [t, Metrica.verse(t).count]), cases);
  got.forEach(([t, n]) => ok(n === cases[t], t + ' → ' + n));
  ok(await pg.evaluate(() => Metrica.verse('el cántaro').adj === -1 && Metrica.verse('la canción').adj === 1), 'ley del acento final');
  await pg.evaluate(() => App.createProject('Poemas', 'poesia', 0, null, 'mine')); await sleep(900);
  await pg.evaluate((t) => App.ch(App.cid).update(x => { x.paras = t.split('\n').map((l, i) => ({ id: 'p' + i, segs: l ? [{ t: l }] : [] })); }, { now: true }), SONETO);
  await pg.evaluate(() => Editor.render()); await sleep(600);
  const r = await pg.evaluate(() => { const x = Metrica.poem(App.ch(App.cid).data.paras.map(p => ({ pid: p.id, text: MDE.parText ? MDE.parText(p) : p.segs.map(s => s.t || '').join('') }))); return { whole: x.whole.name, why: x.whole.why, scheme: x.stanzas.map(s => s.map(v => v.letter).join('')).join(' '), lic: x.verses.filter(v => v.lic).map(v => v.lic.join()) }; });
  console.log('    ', JSON.stringify(r));
  ok(r.whole === 'Soneto' && r.scheme === 'ABBA ABBA CDE DCE', 'reconoce el soneto y su rima');
  ok(r.lic.length === 2 && /hiato/.test(r.lic[0]), 'sugiere hiato donde Garcilaso lo usa');
  const gutter = await pg.evaluate(() => Array.from(document.querySelectorAll('#doc > p[data-met]')).slice(0, 4).map(p => p.dataset.met));
  ok(gutter.join('|') === '11 A|11 B|11 B|11 A', 'sílabas y rima al margen: ' + gutter.join('|'));
  ok(await pg.evaluate(() => !!Array.from(document.querySelectorAll('.tools button')).find(b => /Métrica/.test(b.textContent))), 'botón Métrica en poesía');
  await pg.evaluate(() => Metrica.open()); await sleep(400);
  const panel = await pg.evaluate(() => document.querySelector('.met-panel').innerText);
  ok(/Soneto/.test(panel) && /heroico/.test(panel) && /hiato en «la her»/.test(panel), 'panel con forma, ritmo y licencias');
  await pg.screenshot({ path: path.resolve(__dirname, '_metrica.png') });
  // revisión rápida marca los versos que se apartan
  await pg.evaluate(() => Checker.run(App.cid)); await sleep(400);
  const metro = await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).filter(x => x.m.rule === 'metro').map(x => x.m.note));
  ok(metro.length === 2 && /mide 10/.test(metro[0]), 'revisión rápida señala versos fuera de medida (' + metro.length + ')');
  // poema breve en tetrasílabos (ejemplo inventado): esdrújula final resta una sílaba y asonancia común
  const tet = await pg.evaluate(() => { const L = ['se respira', 'como sábanas', 'que transpiran', 'medicina', 'sin bencina', 'quién diría', 'algún día', 'una esquina', 'se avecina']; const x = Metrica.poem(L.map((t, i) => ({ pid: 'x' + i, text: t }))); return { name: x.whole.name, counts: x.verses.map(v => v.count).join('') }; });
  ok(tet.counts === '444444444' && /tetrasílabos/.test(tet.name), 'tetrasílabos, con «como sábanas» = 5 − 1 = 4 (' + tet.counts + ')');
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
