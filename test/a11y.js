// Uji aksesibilitas (axe-core, WCAG 2.1 A/AA) di layar & dialog utama, tema terang & gelap, desktop & HP.
// npm run test:a11y   — gagal bila ada pelanggaran.
const { chromium } = require('playwright');
const path = require('path');
const URL = require('url').pathToFileURL(path.resolve(__dirname, '../dist/test.html')).href;
const AXE = require.resolve('axe-core/axe.min.js');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const PLAYERS = [{ name: 'Arfi', avatar: '🐻', color: '#FF4F8B' }, { name: 'Nadia', avatar: '🐰', color: '#7B61FF' }];

(async () => {
  const browser = await chromium.launch();
  const found = [];
  const errors = [];
  let checked = 0;

  async function page(viewport, scheme, profile, motion) {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: motion || 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(scheme + ' ' + viewport.width + ' pageerror: ' + e.message));
    await p.addInitScript(pr => {
      localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast', autoEnd: false }));
      localStorage.setItem('loveopoly.v2.tour', '"done"');
      if (pr) localStorage.setItem('loveopoly.v1.profile', JSON.stringify(pr));
    }, profile || { skipped: true });
    await p.goto(URL);
    await p.addScriptTag({ path: AXE });
    return p;
  }
  // animasi dimatikan (reducedMotion) supaya warna yang diukur adalah warna akhir
  async function audit(p, label, include) {
    await p.waitForTimeout(350);
    const res = await p.evaluate(async ([tags, inc]) => {
      const r = await window.axe.run(inc ? { include: [inc] } : document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
      return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map(n => n.target.join(' ') + (n.failureSummary ? ' — ' + n.failureSummary.split('\n').slice(1, 2).join(' ').trim() : '')) , count: v.nodes.length }));
    }, [TAGS, include || null]);
    checked++;
    res.forEach(v => found.push(Object.assign({ where: label }, v)));
  }
  const newGame = (p, mut) => p.evaluate(m => {
    const E = window.LoveEngine, S = E.create({ players: [{ name: 'Arfi', avatar: '🐻', color: '#FF4F8B' }, { name: 'Nadia', avatar: '🐰', color: '#7B61FF' }], settings: { debug: true, roundLimit: 10 }, seed: 21 });
    if (m) (new Function('S', 'E', m))(S, E);
    window.LoveUI.enterGame('local', -1, S);
  }, mut || '');
  const settle = p => p.waitForFunction(() => !window.LoveUI.App.animating && !window.LoveUI.App.pending.length, null, { timeout: 15000 }).then(() => p.waitForTimeout(250));
  const click = (p, sel) => p.$eval(sel, e => e.click());

  for (const scheme of ['light', 'dark']) {
    for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
      const tag = scheme + ' ' + vp.width;
      // paspor (pertama kali) — sampul & halaman isian
      let p = await page(vp, scheme, {}, 'no-preference');
      await p.waitForSelector('#passOv #ppOpen'); await p.waitForTimeout(900);
      await audit(p, tag + ' paspor: sampul', '#passOv');
      await click(p, '#ppOpen'); await p.waitForTimeout(1300);
      await audit(p, tag + ' paspor: isian', '#passOv');
      await p.close();

      // beranda dengan kartu paspor, setup, panduan, privasi, pengaturan
      p = await page(vp, scheme, { name: 'Arfi', avatar: '🐻', color: '#FF4F8B', since: 1, games: 3, wins: 2, stamps: [1, 2, 9] });
      await p.waitForSelector('#hPass');
      await audit(p, tag + ' beranda');
      await click(p, '#hAI'); await p.waitForSelector('#pn0');
      await audit(p, tag + ' setup lawan AI');
      await click(p, '#sBack');
      await p.evaluate(() => window.LoveUI.openGuide(0)); await p.waitForSelector('#guideOv');
      await audit(p, tag + ' panduan', '#guideOv');
      await p.evaluate(() => window.LoveUI.closeGuide());
      await click(p, '#hMenu'); await p.waitForSelector('#modalRoot:not([hidden]) #mSound');
      await audit(p, tag + ' menu beranda', '#modalRoot');
      await p.evaluate(() => window.LoveUI.closeModal(true));
      await click(p, '#hPrivacy'); await p.waitForSelector('#modalRoot:not([hidden]) #pvOk');
      await audit(p, tag + ' privasi', '#modalRoot');
      await p.evaluate(() => window.LoveUI.closeModal(true));

      // papan + panel aksi (Kabar Merpi & Musim Puncak aktif), palet reaksi
      await newGame(p, "S.round = 9; S.news = { id: 'holiday', side: 'top', from: 9, to: 10 }; [1, 2].forEach(t => { S.tiles[t].owner = 1; S.tiles[t].level = 2; });");
      await settle(p);
      await audit(p, tag + ' papan');
      await click(p, '#hMenu'); await p.waitForSelector('#modalRoot:not([hidden]) #mHist');
      await audit(p, tag + ' menu permainan', '#modalRoot');
      await p.evaluate(() => window.LoveUI.closeModal(true));
      await click(p, '#emoteBtn');
      await audit(p, tag + ' palet reaksi', '#emote');
      await click(p, '#emoteBtn');
      // dialog beli kota
      await p.evaluate(() => window.LoveUI.act({ type: 'ROLL', p: 0, dice: [2, 2] })); await settle(p);
      await p.waitForSelector('#modalRoot:not([hidden]) .modal', { timeout: 8000 }).catch(() => {});
      await audit(p, tag + ' dialog keputusan', '#modalRoot');
      // tantangan: kuis (berjalan) & foto bukti (penilai)
      await newGame(p, 'S.queue.push({ type: "CHALLENGE", p: 0, ch: "tv", cat: "card", source: "card", redraws: 0 }); E.migrate(S);');
      await settle(p); await p.evaluate(() => window.LoveUI.syncModal(true)); await p.waitForTimeout(200);
      await audit(p, tag + ' tantangan: pembuka', '#modalRoot');
      await click(p, '#bChGo'); await p.waitForTimeout(200);
      await audit(p, tag + ' tantangan: kuis berjalan', '#modalRoot');
      await newGame(p, 'S.queue.push({ type: "CHALLENGE", p: 0, ch: "ph1", cat: "card", source: "card", redraws: 0 }); E.migrate(S); S.queue[0].pz = { photo: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=" }; S.queue[0].phase = "judge"; S.queue[0].who = 1;');
      await settle(p); await p.evaluate(() => window.LoveUI.syncModal(true)); await p.waitForTimeout(200);
      if (await p.$('#modalRoot #bGate')) { await click(p, '#bGate'); await p.waitForTimeout(150); }
      await audit(p, tag + ' tantangan: penilai foto', '#modalRoot');
      // pengaturan & layar menang
      await p.evaluate(() => window.LoveUI.closeModal(true));
      await newGame(p, '[1, 2].forEach(t => { S.tiles[t].owner = 0; });');
      await settle(p);
      await p.evaluate(() => window.LoveUI.act({ type: 'FINISH_NOW', p: 0 }));
      await p.waitForSelector('#winOv', { timeout: 10000 }).catch(() => {});
      await audit(p, tag + ' layar menang', '#winOv');
      await p.close();
    }
  }

  if (found.length) {
    console.log('PELANGGARAN (' + found.length + '):');
    found.forEach(v => console.log('- [' + v.impact + '] ' + v.id + ' @ ' + v.where + ' (' + v.count + '×): ' + v.help + '\n    ' + v.nodes.join('\n    ')));
  }
  console.log('\naxe WCAG 2.1 AA: ' + checked + ' tampilan diperiksa, ' + found.length + ' pelanggaran.' + (errors.length ? '\nERRORS:\n' + errors.join('\n') : ''));
  await browser.close();
  process.exit(found.length || errors.length ? 1 : 0);
})();
