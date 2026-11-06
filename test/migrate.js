// Uji pindah alamat: halaman pengalih alamat lama (legacy/index.html) membawa data perangkat ke alamat baru.
// Kedua origin disimulasikan dengan page.route (tanpa jaringan): lama = https://loveopoly-5b227.web.app,
// baru = https://loveopoly.web.app (melayani dist/test.html). node test/migrate.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OLD = 'https://loveopoly-5b227.web.app', NEW = 'https://loveopoly.web.app';
const legacyHtml = fs.readFileSync(path.resolve(__dirname, '../legacy/index.html'), 'utf8');
const gameHtml = fs.readFileSync(path.resolve(__dirname, '../dist/test.html'), 'utf8');

(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const ok = (n, c, d) => results.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(OLD + '/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: legacyHtml }));
  await ctx.route(NEW + '/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: gameHtml }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/firebase|gstatic|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });

  // 1) isi data di alamat lama (tanpa menjalankan skrip pengalih: blokir sementara)
  await ctx.unroute(OLD + '/**');
  await ctx.route(OLD + '/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>lama</title>' }));
  await page.goto(OLD + '/');
  await page.evaluate(() => {
    localStorage.setItem('loveopoly.v1.profile', JSON.stringify({ name: 'Arfi', avatar: '🦊', color: '#12B5A6', since: 5, games: 4, wins: 3, stamps: [1, 9] }));
    localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, theme: 'dark' }));
    localStorage.setItem('loveopoly.v2.tour', '"done"');
    localStorage.setItem('loveopoly.v2.online', JSON.stringify({ code: 'ABC123' }));
    localStorage.setItem('lain.kunci', '"jangan"');
  });
  // 2) buka alamat lama sungguhan (pengalih) → harus mendarat di alamat baru dengan data terbawa
  await ctx.unroute(OLD + '/**');
  await ctx.route(OLD + '/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: legacyHtml }));
  await page.goto(OLD + '/?dari=wa');
  await page.waitForURL(u => u.href.startsWith(NEW), { timeout: 10000 });
  await page.waitForSelector('#hPass', { timeout: 10000 });
  const st = await page.evaluate(() => ({
    url: location.href, profile: JSON.parse(localStorage.getItem('loveopoly.v1.profile') || 'null'),
    prefs: JSON.parse(localStorage.getItem('loveopoly.v1.prefs') || 'null'), online: localStorage.getItem('loveopoly.v2.online'),
    other: localStorage.getItem('lain.kunci'), card: document.getElementById('hPass').textContent, passOv: !!document.getElementById('passOv')
  }));
  ok('pengalih: mendarat di alamat baru, query terbawa, hash dibersihkan', st.url === NEW + '/?dari=wa', st.url);
  ok('paspor & pengaturan ikut pindah', st.profile && st.profile.name === 'Arfi' && st.profile.stamps.length === 2 && st.prefs.theme === 'dark' && /Halo, Arfi/.test(st.card) && !st.passOv, JSON.stringify(st.profile));
  ok('room online & kunci lain tidak dibawa', st.online === null && st.other === null);
  await page.waitForSelector('.toast', { timeout: 4000 }).catch(() => {});
  ok('sapaan "Alamat baru" tampil', /Alamat baru|pindah ke/.test(await page.evaluate(() => document.getElementById('toasts').textContent)));

  // 3) impor tidak menimpa data yang sudah ada di alamat baru & menolak kunci asing
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await page.goto(NEW + '/#lv-import=' + enc({ 'loveopoly.v1.profile': JSON.stringify({ name: 'Penyusup' }), 'evil.key': '"x"', 'loveopoly.v1.ok': 'bukan json{' }));
  await page.waitForSelector('#hPass');
  const st2 = await page.evaluate(() => ({ name: JSON.parse(localStorage.getItem('loveopoly.v1.profile')).name, evil: localStorage.getItem('evil.key'), bad: localStorage.getItem('loveopoly.v1.ok') }));
  ok('impor tidak menimpa, kunci asing & nilai rusak ditolak', st2.name === 'Arfi' && st2.evil === null && st2.bad === null, JSON.stringify(st2));

  // 4) foto berbahaya di game tersimpan dibuang (bukan disisipkan ke HTML)
  await page.evaluate(() => {
    const E = window.LoveEngine; const S = E.create({ players: [{ name: 'Arfi' }, { name: 'Nadia' }], settings: {}, seed: 3 });
    S.photos = [{ p: 0, img: 'x" onerror="window.__xss=1', ok: true, judge: 1, r: 1, text: 'a' }, { p: 1, img: 'data:image/jpeg;base64,/9j/AA==', ok: true, judge: 0, r: 1, text: 'b' }];
    window.LoveUI.enterGame('local', -1, S);
  });
  await page.waitForTimeout(1500);
  const st3 = await page.evaluate(() => ({ xss: !!window.__xss, photos: window.LoveUI.App.S.photos.length, pin: !!document.querySelector('#proofPin img') }));
  ok('foto bukan data URI gambar dibuang', !st3.xss && st3.photos === 1 && st3.pin, JSON.stringify(st3));

  console.log(results.join('\n'));
  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (results.length - fails) + '/' + results.length + ' lulus' + (errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nTanpa error konsol.'));
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})();
