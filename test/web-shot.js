const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8768', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../docs'), stdio: 'ignore' });
  await sleep(700);
  const b = await chromium.launch();
  for (const vp of [{ width: 1280, height: 820 }, { width: 390, height: 844 }]) {
    const pg = await (await b.newContext({ viewport: vp, serviceWorkers: 'block' })).newPage();
    await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await pg.goto('http://127.0.0.1:8768/'); await sleep(1000);
    await pg.evaluate(() => App.createProject('Mi novela', 'novela', 0, null, 'mine')); await sleep(900);
    await pg.screenshot({ path: 'test/s-banner-' + vp.width + '.png' });
    await pg.locator('#btn-ai').click(); await sleep(300);
    await pg.screenshot({ path: 'test/s-ai-' + vp.width + '.png' });
    console.log(vp.width, 'overflow', await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  }
  await b.close(); srv.kill();
})();
