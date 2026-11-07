// Uji statistik anonim (GA4): event tercatat tanpa data pribadi, error dilaporkan, sakelar Pengaturan menghentikan
// pengiriman, dan Analytics tidak dimuat saat uji biasa. Skrip Google dicegat (tidak ada data uji yang terkirim).
// npm run test:analytics   (butuh dist/ dari npm run build)
import { chromium } from 'playwright';
import { serveDist } from './helpers/serve.js';

const srv = await serveDist(8136);
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, detail) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
const SECRET_NAME = 'Rahasia Banget',
  SECRET_MSG = 'Pesan cinta super pribadi';

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const gtm = [];
  await ctx.route('https://www.googletagmanager.com/**', r => {
    gtm.push(r.request().url());
    r.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
  });
  await ctx.addInitScript(() => {
    localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, speed: 'fast' }));
    localStorage.setItem('loveopoly.v1.profile', JSON.stringify({ skipped: true }));
    localStorage.setItem('loveopoly.v2.tour', '"done"');
  });
  const page = await ctx.newPage();
  return { ctx, page, gtm };
}
const events = page =>
  page.evaluate(() =>
    (window.dataLayer || [])
      .map(a => Array.from(a))
      .filter(a => a[0] === 'event')
      .map(a => ({ name: a[1], params: a[2] }))
  );

try {
  // 1) uji biasa (navigator.webdriver, tanpa ?uji-ga): Analytics tidak dimuat
  {
    const { ctx, page, gtm } = await newPage();
    await page.goto(srv.url + '/');
    await page.waitForSelector('#hLocal');
    await page.waitForTimeout(2000);
    ok('uji biasa: Analytics tidak dimuat', gtm.length === 0 && !(await page.evaluate(() => window.dataLayer)), gtm.length + ' permintaan');
    await ctx.close();
  }
  // 2) ?uji-ga: dimuat setelah halaman siap, event tanpa data pribadi
  const { ctx, page, gtm } = await newPage();
  await page.goto(srv.url + '/?uji-ga');
  await page.waitForSelector('#hLocal');
  await page.waitForTimeout(2000);
  ok(
    'Analytics dimuat dengan ID pengukuran',
    gtm.some(u => u.includes('id=G-E5VSWC5YXW')),
    gtm[0] || '-'
  );
  const cfg = await page.evaluate(() => (window.dataLayer || []).map(a => Array.from(a)).find(a => a[0] === 'config'));
  ok(
    'fitur iklan & Google Signals dimatikan',
    cfg && cfg[2].allow_google_signals === false && cfg[2].allow_ad_personalization_signals === false,
    JSON.stringify(cfg)
  );

  await page.evaluate(
    ([name, msg]) => {
      const E = window.LoveEngine;
      const S = E.create({
        players: [
          { name, avatar: '🐻', color: '#FF4F8B', msg },
          { name: 'Bot', avatar: '🐰', color: '#7B61FF', kind: 'ai' },
        ],
        settings: { debug: true, roundLimit: 15 },
        seed: 9,
      });
      window.LoveUI.enterGame('local', -1, S);
    },
    [SECRET_NAME, SECRET_MSG]
  );
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.LoveUI.act({ type: 'FINISH_NOW', p: 0 }));
  await page.waitForSelector('#wShare', { timeout: 10000 });
  await page.$eval('#wShare', b => b.click());
  await page.waitForTimeout(800);
  // error yang tidak tertangkap → event exception
  await page.evaluate(() =>
    setTimeout(() => {
      throw new Error('uji error analitik 123');
    }, 0)
  );
  await page.waitForTimeout(300);

  const ev = await events(page);
  const names = ev.map(e => e.name);
  const start = ev.find(e => e.name === 'game_start');
  ok(
    'event game_start, game_end, memory_card tercatat',
    start &&
      start.params.players === 2 &&
      start.params.ai_players === 1 &&
      start.params.rounds === 15 &&
      names.includes('game_end') &&
      names.includes('memory_card'),
    names.join(', ')
  );
  const dump = await page.evaluate(() => JSON.stringify((window.dataLayer || []).map(a => Array.from(a))));
  ok('tidak ada nama/pesan pemain yang terkirim', !dump.includes(SECRET_NAME) && !dump.includes(SECRET_MSG));
  const exc = ev.find(e => e.name === 'exception');
  ok(
    'error tak tertangkap dilaporkan (exception)',
    exc && /uji error analitik 123/.test(exc.params.description) && exc.params.fatal === false,
    exc && exc.params.description
  );

  // 3) sakelar Pengaturan: matikan → berhenti mengirim
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.LoveUI.exitToHome(true));
  await page.evaluate(() => window.LoveUI.openSettings());
  await page.waitForSelector('#modalRoot #sStats');
  const before = await page.$eval('#modalRoot #sStats', b => b.getAttribute('aria-checked'));
  await page.$eval('#modalRoot #sStats', b => b.click());
  await page.waitForTimeout(150);
  const after = await page.$eval('#modalRoot #sStats', b => b.getAttribute('aria-checked'));
  const n0 = (await events(page)).length;
  await page.evaluate(() => {
    const E = window.LoveEngine;
    window.LoveUI.enterGame(
      'local',
      -1,
      E.create({
        players: [
          { name: 'A', avatar: '🐻', color: '#FF4F8B' },
          { name: 'B', avatar: '🐰', color: '#7B61FF' },
        ],
        settings: {},
        seed: 3,
      })
    );
  });
  await page.waitForTimeout(500);
  const off = await page.evaluate(() => ({
    disabled: window['ga-disable-G-E5VSWC5YXW'] === true,
    pref: JSON.parse(localStorage.getItem('loveopoly.v1.prefs')).analytics,
  }));
  ok(
    'sakelar dimatikan: tidak ada event baru & opt-out resmi aktif',
    before === 'true' && after === 'false' && off.disabled && off.pref === false && (await events(page)).length === n0,
    JSON.stringify({ before, after, ...off })
  );
  await ctx.close();
} catch (e) {
  results.push('FAIL uji analitik berhenti — ' + e.message.split('\n')[0]);
}
console.log(results.join('\n'));
await browser.close();
srv.close();
const fails = results.filter(r => r.startsWith('FAIL')).length;
console.log('\n' + (results.length - fails) + '/' + results.length + ' lulus');
process.exit(fails ? 1 : 0);
