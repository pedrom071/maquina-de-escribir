// Motor de coherencia sin IA y métricas de estilo. Texto de prueba inventado.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8770', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.goto('http://127.0.0.1:8770/'); await sleep(1200);
  await pg.evaluate(() => { App.prefs.autoAI = false; App.prefs.autoLocal = false; });
  await pg.evaluate(() => App.createProject('Coherencia', 'novela', 0, null, 'mine')); await sleep(900);
  await pg.evaluate(() => App.proj().update(x => {
    const s = x.bible.sections.find(z => z.graph);
    s.items.push({ id: 'i1', title: 'Elena', fields: { Edad: '34', 'También llamado': 'Lena' }, body: '' });
    s.items.push({ id: 'i2', title: 'Tomás', fields: { Estado: 'Muerto antes de la historia' }, body: '' });
    s.items.push({ id: 'i3', title: 'Rosa María', fields: {}, body: '' });
  }, { now: true }));
  const paras = [
    'Elena, de cuarenta años, cruzó la plaza. Tomás dijo que la esperaría en el puerto.',
    'Rosamaría llegó tarde, como siempre. Hacía tres años que no veía a Elena.',
    'En el muelle estaba Bruno. La tarde olía a sal y Bruno fumaba sin apuro.',
    'Hablaron de los cuarenta y dos meses que llevaban sin verse. Bruno no dijo nada más.',
    'Todo pasó el jueves 3 de marzo de 2025, cuando cerró el astillero. Elena tiene 34 años y Lena lo sabe.'
  ];
  await pg.evaluate((ps) => App.ch(App.cid).update(x => { x.paras = ps.map((t, i) => ({ id: 'p' + i, segs: [{ t: t }] })); }, { now: true }), paras);
  await sleep(300);
  await pg.evaluate(() => { Editor.render(); return Checker.run(App.cid); }); await sleep(400);
  const marks = await pg.evaluate(() => MDE.allMarks(App.ch(App.cid).data).filter(x => x.m.type === 'coh').map(x => ({ rule: x.m.rule, text: x.m.text, note: x.m.note, fix: x.m.fix && x.m.fix.to })));
  marks.forEach(m => console.log('    ', m.rule, '|', m.text, '|', m.note));
  const has = (r, t) => marks.some(m => m.rule === r && m.text === t);
  ok(has('age', 'Elena, de cuarenta años'), 'edad distinta a la biblia');
  ok(!marks.some(m => m.rule === 'age' && /34/.test(m.text)), 'edad correcta no se marca');
  ok(has('dead', 'Tomás dijo'), 'personaje muerto que habla');
  ok(marks.some(m => m.rule === 'name' && m.text === 'Rosamaría' && m.fix === 'Rosa María'), 'variante de nombre junta/separada');
  ok(has('noficha', 'Bruno'), 'nombre frecuente sin ficha');
  ok(marks.filter(m => m.rule === 'noficha').length === 1, 'solo una marca por nombre sin ficha');
  ok(marks.some(m => m.rule === 'dur' && /cuarenta y dos meses/.test(m.text)), 'duraciones que no coinciden');
  ok(marks.some(m => m.rule === 'date' && /jueves 3 de marzo de 2025/.test(m.text) && /fue lunes/.test(m.note)), 'día de la semana incorrecto');
  // crear ficha desde la nota
  await pg.evaluate(() => { const m = MDE.allMarks(App.ch(App.cid).data).find(x => x.m.rule === 'noficha'); Editor.noteAction('ficha', m.m.id); }); await sleep(300);
  ok(await pg.evaluate(() => App.P().bible.sections.find(z => z.graph).items.some(i => i.title === 'Bruno')), 'ficha creada en Personajes');
  ok(await pg.evaluate(() => !MDE.allMarks(App.ch(App.cid).data).some(x => x.m.rule === 'noficha')), 'la marca desaparece al crear la ficha');
  await pg.evaluate(() => Checker.run(App.cid)); await sleep(300);
  ok(await pg.evaluate(() => !MDE.allMarks(App.ch(App.cid).data).some(x => x.m.rule === 'noficha')), 'no vuelve a aparecer');
  // estadísticas con métricas de estilo
  await pg.evaluate(() => App.go('p-' + App.pid + '-estadisticas')); await sleep(800);
  const st = await pg.evaluate(() => { const e = document.querySelector('.style-panel'); return e ? e.innerText : ''; });
  console.log(st.split('\n').slice(0, 30).map(x => '     ' + x).join('\n'));
  ok(/Legibilidad/i.test(st), 'panel de estilo con legibilidad');
  ok(/Riqueza léxica/i.test(st), 'riqueza léxica');
  // explicaciones al pasar el cursor y guía
  await pg.locator('.style-cell').first().scrollIntoViewIfNeeded(); await sleep(100);
  let cellBox = await pg.locator('.style-cell').first().boundingBox();
  await pg.mouse.move(cellBox.x + 20, cellBox.y + 20); await sleep(250);
  const tipVis = await pg.evaluate(() => { const t = document.querySelector('.style-cell .tip'); const cs = getComputedStyle(t); return cs.visibility === 'visible' && +cs.opacity > 0.9 ? t.textContent : ''; });
  ok(/Fernández Huerta/.test(tipVis), 'al pasar el cursor se explica la legibilidad');
  await pg.evaluate(() => { document.querySelector('.style-guide').open = true; document.querySelector('.style-guide').scrollIntoView(); }); await sleep(150);
  const guide = await pg.evaluate(() => document.querySelector('.style-guide').innerText);
  ok(/1959/.test(guide) && /206,84/.test(guide) && /tu texto/.test(guide), 'guía con Fernández Huerta, fórmula y escala');
  await pg.locator('.style-cell').nth(4).scrollIntoViewIfNeeded(); await sleep(100);
  cellBox = await pg.locator('.style-cell').nth(4).boundingBox();
  await pg.mouse.move(cellBox.x + 20, cellBox.y + 20); await sleep(250);
  await pg.screenshot({ path: path.resolve(__dirname, '_tips.png'), fullPage: false });
  await pg.screenshot({ path: path.resolve(__dirname, '_style.png'), fullPage: true });
  const syl = await pg.evaluate(() => ['camión', 'poeta', 'ciudad', 'oído', 'aéreo', 'queso', 'guerra', 'pingüino', 'murciélago'].map(w => w + '=' + syllables(w)).join(' '));
  ok(syl === 'camión=2 poeta=3 ciudad=2 oído=3 aéreo=4 queso=2 guerra=2 pingüino=3 murciélago=4', 'sílabas: ' + syl);
  const lg = await pg.evaluate(() => { const a = Style.compute(['El sol sale. La casa es azul. Mi gato come pan.']); const b = Style.compute(['La institucionalización progresiva de los procedimientos administrativos contemporáneos determinó, inevitablemente, consecuencias organizacionales extraordinariamente complejas e imprevisibles para la ciudadanía.']); return [a.legib, b.legib]; });
  ok(lg[0] > 80 && lg[1] < 30, 'legibilidad distingue texto simple de complejo ' + lg.map(Math.round).join(' / '));
  await pg.evaluate(() => App.proj().update(x => {
    x.days = {}; const put = (ago, w, hr) => { const d = new Date(); d.setDate(d.getDate() - ago); x.days[(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))] = { s: 0, e: w, h: { [hr]: w } }; };
    for (let i = 0; i < 5; i++) put(i, 300 + i * 50, 22);
    for (let i = 10; i < 18; i++) put(i, 200, 9);
  }, { now: true }));
  const hs = await pg.evaluate(() => { const m = Habit.merge([{ days: App.P().days }]); return Object.assign(Habit.streaks(m), Habit.summary(m)); });
  ok(hs.cur === 5 && hs.best === 8 && hs.todayHit, 'racha actual 5 y mejor 8 (' + hs.cur + ', ' + hs.best + ')');
  ok(hs.days30 === 13, 'días escritos en 30: ' + hs.days30);
  await pg.evaluate(() => { App.prefs.dailyGoal = 350; });
  const hg = await pg.evaluate(() => Habit.streaks(Habit.merge([{ days: App.P().days }])));
  ok(hg.cur === 4, 'con meta diaria de 350, la racha cuenta solo los días que la cumplen (' + hg.cur + ')');
  await pg.evaluate(() => { App.prefs.dailyGoal = 0; });
  await pg.evaluate(() => App.createProject('Otro', 'cuento', 0, null, 'mine')); await sleep(700);
  await pg.evaluate(() => App.proj().update(x => { const d = new Date(); d.setDate(d.getDate() - 1); x.days = { [(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))]: { s: 0, e: 120, h: { 15: 120 } } }; }, { now: true }));
  await pg.evaluate(() => App.go('')); await sleep(800);
  const home = await pg.evaluate(() => { const e = document.querySelector('.habit'); return e ? e.innerText : ''; });
  console.log(home.split('\n').slice(0, 14).map(x => '     ' + x).join('\n'));
  ok(/Rachas y ritmo/i.test(home) && /Por proyecto/i.test(home) && /Coherencia/.test(home) && /Otro/.test(home), 'inicio muestra rachas con desglose por proyecto');
  ok(await pg.evaluate(() => document.querySelectorAll('.habit .heat rect').length > 150), 'calendario dibujado');
  await pg.evaluate(() => { const s = document.querySelector('.habit select'); s.value = s.options[2].value; s.dispatchEvent(new Event('change')); }); await sleep(100);
  ok(await pg.evaluate(() => !/Por proyecto/i.test(document.querySelector('.habit').innerText)), 'filtro por un proyecto');
  await pg.screenshot({ path: path.resolve(__dirname, '_habit.png'), fullPage: true });
  // en proyectos compartidos solo cuenta lo tuyo
  const shared = await pg.evaluate(() => { const k = '2026-01-05'; const L = [{ shared: true, days: { [k]: { s: 0, e: 900, by: { yo: 300, otra: 600 }, h: { 10: 900 } } } }]; const a = Habit.merge(L, { who: 'yo' }).get(k); const b = Habit.merge(L).get(k); return [a.w, Math.round(a.h[10]), b.w]; });
  ok(shared.join() === '300,300,900', 'compartido: tus palabras ' + shared.join());
  await pg.evaluate(() => Profile.open()); await sleep(300);
  const prof = await pg.evaluate(() => { const e = document.querySelector('.habit-mini'); return e ? e.innerText : ''; });
  ok(/racha/i.test(prof) && /palabras en 30/i.test(prof), 'perfil muestra el resumen general');
  await pg.keyboard.press('Escape'); await sleep(200);
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
