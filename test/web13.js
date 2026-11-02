// Maqueta de libro: tamaños, márgenes, letra, páginas, índice y exportación. Texto inventado.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8778', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1400, height: 900 }, acceptDownloads: true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.route(/jszip/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: require('fs').readFileSync(require.resolve('jszip/dist/jszip.min.js')) }));
  await pg.goto('http://127.0.0.1:8778/'); await sleep(1200);
  await pg.evaluate(() => { App.prefs.autoAI = false; App.prefs.autoLocal = false; });
  await pg.evaluate(() => App.createProject('El puerto', 'novela', 0, null, 'mine')); await sleep(900);
  const f = 'El viento venía del sur y traía olor a algas, a sal y a madera mojada; en el puerto nadie hablaba de otra cosa que del barco que no había vuelto. ';
  const fill = (n) => pg.evaluate(([f, n]) => App.ch(App.cid).update(x => { x.paras = Array.from({ length: n }, (_, i) => ({ id: 'q' + i + Math.random().toString(36).slice(2, 6), segs: [{ t: f.repeat(1 + (i % 3)) }] })); }, { now: true }), [f, n]);
  await fill(20);
  await pg.evaluate(() => App.addChapter()); await sleep(600); await fill(12);
  await pg.evaluate(() => Pages.addSpecial('dedicatoria')); await sleep(600);
  await pg.evaluate(() => App.ch(App.cid).update(x => { x.paras = [{ id: 'd', segs: [{ t: 'A quienes esperan en los muelles.' }] }]; }, { now: true }));
  await pg.evaluate(() => Maqueta.open()); await sleep(1200);
  const st = await pg.evaluate(() => ({ total: Maqueta.total, W: Math.round(Maqueta.dims.W), H: Math.round(Maqueta.dims.H), pages: document.querySelectorAll('.mq-spread .mq-page').length, info: document.querySelector('.mq-info').innerText.replace(/\s+/g, ' ') }));
  console.log('    ', JSON.stringify(st));
  ok(st.W === Math.round(15 * 96 / 2.54) && st.H === Math.round(23 * 96 / 2.54), 'tamaño novela 15 × 23 cm');
  ok(st.total >= 10 && st.pages === 2, 'paginado en pliegos (' + st.total + ' páginas)');
  ok(/palabras por página/.test(st.info) && /Lomo/.test(st.info) && /cuadernillos de 16/.test(st.info), 'datos para imprenta');
  // capítulos en página impar e índice con números
  const meta = await pg.evaluate(() => { const starts = []; Maqueta.meta.forEach((m, i) => { if (m.start && m.cid) starts.push(i + 1); }); const toc = Array.from(Maqueta.flow.querySelectorAll('.mq-toc-l b')).map(b => b.textContent); return { starts, toc }; });
  console.log('    ', JSON.stringify(meta));
  ok(meta.starts.every(n => n % 2 === 1), 'cada capítulo empieza en página impar');
  ok(meta.toc.length >= 2 && meta.toc.every(n => +n > 0), 'índice con números de página');
  await pg.screenshot({ path: path.resolve(__dirname, '_maqueta.png') });
  // cambiar a bolsillo y letra más grande → más páginas
  const before = await pg.evaluate(() => Maqueta.total);
  await pg.selectOption('.mq-panel section:nth-of-type(1) select', 'bolsillo'); await sleep(900);
  const after = await pg.evaluate(() => [Maqueta.total, Math.round(Maqueta.dims.W)]);
  ok(after[0] > before && after[1] === Math.round(11 * 96 / 2.54), 'formato bolsillo: más páginas (' + before + ' → ' + after[0] + ')');
  ok(await pg.evaluate(() => App.P().maqueta.size === 'bolsillo'), 'la configuración queda guardada en el proyecto');
  // ir a una página con texto y verificar número y cornisa
  await pg.evaluate(() => { const i = Maqueta.meta.findIndex((m, k) => !m.blank && !m.front && !m.start && k > 6); Maqueta.idx = i; Maqueta.show(); }); await sleep(300);
  ok(await pg.evaluate(() => document.querySelectorAll('.mq-num-p').length >= 1 && document.querySelectorAll('.mq-run').length >= 1), 'números de página y cornisa');
  await pg.screenshot({ path: path.resolve(__dirname, '_maqueta2.png') });
  // exportación PDF: HTML de impresión con @page
  const html = await pg.evaluate(() => Maqueta.printHtml());
  ok(/@page\{size:11cm 18cm/.test(html) && /@page :left/.test(html) && /break-before:right/.test(html), 'HTML de impresión con tamaño, márgenes espejo y capítulos a la derecha');
  // Word con el formato del libro
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }).catch(() => null), pg.evaluate(() => Maqueta.exportDocx())]);
  if (dl) {
    const p = await dl.path(); const JSZip = require('jszip'); const z = await JSZip.loadAsync(require('fs').readFileSync(p));
    const doc = await z.file('word/document.xml').async('string'); const set = z.file('word/settings.xml') ? await z.file('word/settings.xml').async('string') : '';
    ok(/w:pgSz w:w="6237" w:h="10206"/.test(doc) && /mirrorMargins/.test(set), 'Word con tamaño de bolsillo y márgenes espejo');
  } else { console.log('     aviso:', await pg.evaluate(() => document.querySelector('#toast').innerText)); ok(false, 'Word con el formato del libro (no se descargó)'); }
  await pg.keyboard.press('Escape'); await sleep(200);
  ok(await pg.evaluate(() => !document.querySelector('.maqueta')), 'Esc cierra la maqueta');
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
