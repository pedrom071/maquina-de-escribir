// Cambiar el nombre de un proyecto: desde la barra lateral y desde el menú del proyecto en el inicio.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FALLA ') + msg); if (!c) fails++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8784', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  const pg = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 860 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.goto('http://127.0.0.1:8784/'); await sleep(1200);
  await pg.evaluate(() => App.createProject('Borrador', 'novela', 0, null, 'mine')); await sleep(900);
  // 1) en la barra lateral, con un clic
  await pg.click('.side .ptitle'); await sleep(100);
  ok(await pg.evaluate(() => document.activeElement && document.activeElement.classList.contains('ptitle-inp')), 'un clic en el título lo vuelve editable');
  await pg.keyboard.press('Control+a'); await pg.keyboard.type('La última carta'); await pg.keyboard.press('Enter'); await sleep(300);
  ok(await pg.evaluate(() => App.P().title === 'La última carta' && document.querySelector('.side .ptitle').textContent === 'La última carta'), 'Enter guarda el nuevo nombre');
  ok(await pg.evaluate(() => /La última carta/.test(document.querySelector('#crumbs, .crumbs, header').innerText)), 'se actualiza también arriba');
  await pg.click('.side .ptitle'); await pg.keyboard.type('xxx'); await pg.keyboard.press('Escape'); await sleep(200);
  ok(await pg.evaluate(() => App.P().title === 'La última carta' && App.focus !== true), 'Esc cancela sin cambiar nada');
  // 2) desde el inicio, en el menú del proyecto
  await pg.evaluate(() => App.go('')); await sleep(700);
  await pg.click('.ibtn.more'); await sleep(150);
  await pg.click('text=Cambiar nombre…'); await sleep(200);
  await pg.keyboard.press('Control+a'); await pg.keyboard.type('Cartas del puerto'); await pg.keyboard.press('Enter'); await sleep(500);
  ok(await pg.evaluate(() => Array.from(App.colls.mine.docs ? App.colls.mine.docs.values() : []).some(d => d.data && d.data.title === 'Cartas del puerto') || /Cartas del puerto/.test(document.body.innerText)), 'desde el inicio también se puede cambiar');
  ok(/Cartas del puerto/.test(await pg.evaluate(() => document.body.innerText)), 'la tarjeta muestra el nombre nuevo');
  ok(!errs.length, 'sin errores de página ' + errs.join(' | '));
  await b.close(); srv.kill();
  process.exit(fails ? 1 : 0);
})();
