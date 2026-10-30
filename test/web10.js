// Modo lectura (una o dos páginas) y navegación entre capítulos. Texto inventado.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8775', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1360, height: 860 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.goto('http://127.0.0.1:8775/'); await sleep(1200);
  await pg.evaluate(() => { App.prefs.autoAI = false; App.prefs.autoLocal = false; });
  await pg.evaluate(() => App.createProject('Libro de prueba', 'novela', 0, null, 'mine')); await sleep(900);
  const f = 'El viento venía del sur y traía olor a algas, a sal y a madera mojada; en el puerto nadie hablaba de otra cosa que del barco que no había vuelto. ';
  const fill = (n) => pg.evaluate(([f, n]) => App.ch(App.cid).update(x => { x.paras = Array.from({ length: n }, (_, i) => ({ id: 'q' + i + Math.random().toString(36).slice(2, 6), segs: [{ t: f.repeat(1 + (i % 3)) }] })); }, { now: true }), [f, n]);
  await fill(14);
  await pg.evaluate(() => App.addChapter()); await sleep(600); await fill(10);
  await pg.evaluate(() => Pages.addSpecial('prologo')); await sleep(600); await fill(3);
  const c1 = await pg.evaluate(() => App.chapterList()[1].id);
  await pg.evaluate((id) => App.go(App.chHash(id)), c1); await sleep(700);
  // navegación discreta
  const nav = await pg.evaluate(() => { const n = document.querySelector('.ch-nav'); return { links: n.querySelectorAll('.cn-link').length, icons: n.querySelectorAll('.cn-ico').length, text: n.innerText.replace(/\s+/g, ' ') }; });
  ok(nav.links === 2 && nav.icons === 3, 'navegación: anterior, siguiente y tres íconos (' + nav.text + ')');
  await pg.evaluate(() => document.querySelector('.ch-nav').scrollIntoView({ block: 'center' })); await sleep(200);
  await pg.screenshot({ path: path.resolve(__dirname, '_nav.png') });
  // lectura
  await pg.keyboard.press('Control+Shift+L'); await sleep(900);
  ok(await pg.evaluate(() => !!document.querySelector('.reader')), 'Ctrl + Shift + L abre el modo lectura');
  const st = await pg.evaluate(() => ({ spread: Lectura.spread, total: Lectura.total, idx: Lectura.idx, nums: document.querySelector('.rd-nums').innerText.replace(/\s+/g, ' ') }));
  console.log('    ', JSON.stringify(st));
  ok(st.spread === 2 && st.total > 4, 'doble página en pantalla ancha y varias páginas');
  ok(await pg.evaluate((id) => { const br = document.querySelector('.rd-book').getBoundingClientRect(); const r = document.querySelector('.rd-flow section[data-cid="' + id + '"] h2').getBoundingClientRect(); return r.left >= br.left - 2 && r.right <= br.right + 2; }, c1), 'abre en el capítulo actual (después del prólogo)');
  ok(await pg.evaluate(() => Math.abs(parseFloat(getComputedStyle(document.querySelector('.rd-flow')).fontSize) - 19 * Lectura.scale) < 0.6 && Lectura.scale > 0.7), 'letra y hoja proporcionales a tu apariencia (escala ' + await pg.evaluate(() => Lectura.scale.toFixed(2)) + ')');
  await pg.screenshot({ path: path.resolve(__dirname, '_lectura2.png') });
  await pg.keyboard.press('ArrowRight'); await sleep(700);
  ok(await pg.evaluate((i) => Lectura.idx === i + 2, st.idx), 'flecha derecha pasa a la doble página siguiente');
  ok(await pg.evaluate(() => Lectura.prefs().anim === true), 'animación activada por defecto');
  await pg.evaluate(() => Array.from(document.querySelectorAll('.rd-seg button')).find(b => /^1 pág/.test(b.textContent)).click()); await sleep(500);
  ok(await pg.evaluate(() => Lectura.spread === 1 && !document.querySelector('.reader.spread')), 'cambia a una página');
  await pg.screenshot({ path: path.resolve(__dirname, '_lectura1.png') });
  await pg.evaluate(() => document.querySelector('.rd-tog').click());
  ok(await pg.evaluate(() => Lectura.prefs().anim === false), 'se puede quitar la animación');
  await pg.keyboard.press('End'); await sleep(300);
  ok(await pg.evaluate(() => Lectura.idx === Lectura.total - 1), 'Fin va a la última página');
  // última página debe mostrar texto (no quedar en blanco)
  ok(await pg.evaluate(() => { const br = document.querySelector('.rd-book').getBoundingClientRect(); return Array.from(document.querySelectorAll('.rd-flow p')).some(p => { const r = p.getBoundingClientRect(); return r.left >= br.left - 2 && r.left < br.right; }); }), 'la última página tiene texto');
  // doble clic para editar
  const target = await pg.evaluate(() => { const br = document.querySelector('.rd-book').getBoundingClientRect(); const p = Array.from(document.querySelectorAll('.rd-flow p[data-pid]')).find(p => { const r = p.getBoundingClientRect(); return r.left >= br.left && r.left < br.right && r.top > br.top; }); const r = p.getBoundingClientRect(); return { pid: p.dataset.pid, x: r.left + 30, y: r.top + 8 }; });
  await pg.mouse.dblclick(target.x, target.y); await sleep(900);
  ok(await pg.evaluate((pid) => !document.querySelector('.reader') && !!Editor.root && !!Editor.root.querySelector('p[data-id="' + pid + '"]'), target.pid), 'doble clic lleva a editar ese párrafo');
  await pg.keyboard.press('Control+Shift+L'); await sleep(600);
  await pg.keyboard.press('Escape'); await sleep(300);
  ok(await pg.evaluate(() => !document.querySelector('.reader')), 'Esc cierra la lectura');
  await pg.setViewportSize({ width: 390, height: 800 }); await sleep(300);
  await pg.evaluate(() => Lectura.open()); await sleep(700);
  ok(await pg.evaluate(() => Lectura.spread === 1 && document.querySelector('.rd-book').getBoundingClientRect().width <= 390), 'en el celular, una página que cabe');
  await pg.screenshot({ path: path.resolve(__dirname, '_lectura-movil.png') });
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
