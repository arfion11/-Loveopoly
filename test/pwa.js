// Uji PWA: manifest & ikon valid, service worker terpasang, game tetap terbuka & bisa dimainkan tanpa internet.
// npm run test:pwa   (butuh dist/ dari npm run build)
import { chromium } from 'playwright';
import { serveDist } from './helpers/serve.js';

const srv = await serveDist(8135);
const URL = srv.url + '/?uji-sw';
const browser = await chromium.launch();
const results = [];
const errors = [];
const ok = (name, cond, detail) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast' }));
    localStorage.setItem('loveopoly.v1.profile', JSON.stringify({ skipped: true }));
    localStorage.setItem('loveopoly.v2.tour', '"done"');
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push('console: ' + m.text());
  });
  await page.goto(URL);
  await page.waitForSelector('#hLocal');

  const man = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    const m = await (await fetch(href)).json();
    const icons = await Promise.all(m.icons.map(async i => ({ src: i.src, purpose: i.purpose, ok: (await fetch(i.src)).ok })));
    return { name: m.name, short: m.short_name, start: m.start_url, display: m.display, icons };
  });
  ok(
    'manifest: nama, standalone, ikon 192/512/maskable bisa diunduh',
    man.short === 'Loveopoly' &&
      man.display === 'standalone' &&
      man.icons.every(i => i.ok) &&
      man.icons.some(i => i.purpose === 'maskable') &&
      man.icons.some(i => i.src.includes('512')),
    JSON.stringify(man).slice(0, 200)
  );

  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    const keys = await caches.keys();
    const cached = keys.length ? (await (await caches.open(keys[0])).keys()).map(r => new URL(r.url).pathname) : [];
    return { scope: new URL(reg.scope).pathname, controlled: !!navigator.serviceWorker.controller, caches: keys, cached };
  });
  ok(
    'service worker aktif & menyimpan halaman, JS, CSS, font',
    sw.controlled &&
      sw.caches.length === 1 &&
      sw.cached.includes('/') &&
      ['.js', '.css', '.woff2'].every(ext => sw.cached.some(p => p.startsWith('/assets/') && p.endsWith(ext))),
    sw.caches.join() + ' · ' + sw.cached.length + ' berkas'
  );

  // Chrome sendiri menilai situs bisa dipasang (tanpa error installability)
  const cdp = await ctx.newCDPSession(page);
  const inst = await cdp.send('Page.getInstallabilityErrors');
  ok(
    'Chrome: situs bisa dipasang sebagai aplikasi',
    inst.installabilityErrors.length === 0,
    JSON.stringify(inst.installabilityErrors).slice(0, 200)
  );

  // tanpa internet: muat ulang, mulai game lawan AI, lempar dadu
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('#hLocal', { timeout: 10000 });
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, ''));
  });
  ok('offline: halaman terbuka dari cache (font ikut)', fonts.includes('Fredoka') && fonts.includes('Nunito'), fonts.join(', '));
  await page.evaluate(() => {
    const E = window.LoveEngine;
    const S = E.create({
      players: [
        { name: 'Arfi', avatar: '🐻', color: '#FF4F8B' },
        { name: 'Bot', avatar: '🐰', color: '#7B61FF', kind: 'ai' },
      ],
      settings: {},
      seed: 4,
    });
    window.LoveUI.enterGame('local', -1, S);
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.LoveUI.act({ type: 'ROLL', p: 0 }));
  await page.waitForFunction(() => window.LoveUI.App.S && window.LoveUI.App.S.turn.rolled, null, { timeout: 8000 }).catch(() => {});
  const played = await page.evaluate(() => ({
    board: document.querySelectorAll('#board .tile').length,
    rolled: window.LoveUI.App.S.turn.rolled,
  }));
  ok('offline: main lawan AI tetap jalan (papan & dadu)', played.board === 32 && played.rolled, JSON.stringify(played));
  await ctx.setOffline(false);
} catch (e) {
  results.push('FAIL uji PWA berhenti — ' + e.message.split('\n')[0]);
}
console.log(results.join('\n'));
console.log('ERRORS (' + errors.length + '):', errors.slice(0, 8).join('\n'));
await browser.close();
srv.close();
const fails = results.filter(r => r.startsWith('FAIL')).length;
console.log('\n' + (results.length - fails) + '/' + results.length + ' lulus');
process.exit(fails || errors.length ? 1 : 0);
