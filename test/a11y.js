// Uji aksesibilitas (axe-core, WCAG 2.1 A/AA) di layar & dialog utama, tema terang & gelap, desktop & HP.
// npm run test:a11y   — gagal bila ada pelanggaran.
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { serveDist } from './helpers/serve.js';
const URL = (await serveDist()).url + '/';
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

(async () => {
  const browser = await chromium.launch();
  const found = [];
  const errors = [];
  let checked = 0;

  async function page(viewport, scheme, profile, motion) {
    const ctx = await browser.newContext({ locale: 'id-ID', viewport, colorScheme: scheme, reducedMotion: motion || 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(scheme + ' ' + viewport.width + ' pageerror: ' + e.message));
    await p.addInitScript(
      pr => {
        localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast', autoEnd: false }));
        localStorage.setItem('loveopoly.v2.tour', '"done"');
        if (pr) localStorage.setItem('loveopoly.v1.profile', JSON.stringify(pr));
      },
      profile || { skipped: true }
    );
    await p.goto(URL);
    await p.addScriptTag({ path: AXE });
    return p;
  }
  // animasi dimatikan (reducedMotion) supaya warna yang diukur adalah warna akhir
  async function audit(p, label, include) {
    await p.waitForTimeout(350);
    const res = await p.evaluate(
      async ([tags, inc]) => {
        const r = await window.axe.run(inc ? { include: [inc] } : document, {
          runOnly: { type: 'tag', values: tags },
          resultTypes: ['violations'],
        });
        return r.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes
            .slice(0, 4)
            .map(n => n.target.join(' ') + (n.failureSummary ? ' — ' + n.failureSummary.split('\n').slice(1, 2).join(' ').trim() : '')),
          count: v.nodes.length,
        }));
      },
      [TAGS, include || null]
    );
    checked++;
    res.forEach(v => found.push(Object.assign({ where: label }, v)));
  }
  const P4 = [
    { name: 'Arfi', avatar: '🐻', color: '#FF4F8B' },
    { name: 'Nadia', avatar: '🐰', color: '#7B61FF' },
    { name: 'Dimas', avatar: '🦊', color: '#12B5A6' },
    { name: 'Sinta', avatar: '🐱', color: '#FF8A3D' },
  ];
  const newGame = (p, mut, n) =>
    p.evaluate(
      ([m, n, P4]) => {
        const E = window.LoveEngine,
          S = E.create({ players: P4.slice(0, n), settings: { debug: true, roundLimit: 10 }, seed: 21 });
        if (m) new Function('S', 'E', m)(S, E);
        window.LoveUI.enterGame('local', -1, S);
      },
      [mut || '', n || 2, P4]
    );
  const settle = p =>
    p
      .waitForFunction(() => !window.LoveUI.App.animating && !window.LoveUI.App.pending.length, null, { timeout: 15000 })
      .then(() => p.waitForTimeout(250));
  const click = (p, sel) => p.$eval(sel, e => e.click());

  for (const scheme of ['light', 'dark']) {
    for (const vp of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const tag = scheme + ' ' + vp.width;
      // paspor (pertama kali) — sampul & halaman isian
      let p = await page(vp, scheme, {}, 'no-preference');
      await p.waitForSelector('#passOv #ppOpen');
      await p.waitForTimeout(900);
      await audit(p, tag + ' paspor: sampul', '#passOv');
      await click(p, '#ppOpen');
      await p.waitForTimeout(1300);
      await audit(p, tag + ' paspor: isian', '#passOv');
      await p.close();

      // beranda dengan kartu paspor, setup, panduan, privasi, pengaturan
      // + progres paspor (Jam Terbang, Api Cinta minggu lalu, lencana) & terakhir dibuka 9 hari lalu → Merpi kangen
      const d0 = new Date(),
        wk0 = Math.floor((Math.floor(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()) / 864e5) + 3) / 7);
      p = await page(vp, scheme, {
        name: 'Arfi',
        avatar: '🐻',
        color: '#FF4F8B',
        since: 1,
        games: 3,
        wins: 2,
        stamps: [1, 2, 9],
        xp: 250,
        wk: { n: 3, last: wk0 - 1, best: 5, umb: 1 },
        life: { ch: 12, lm: 4, lt: 3, sm: 1 },
        seen: Date.now() - 9 * 864e5,
      });
      await p.waitForSelector('#hPass');
      await p.waitForSelector('#scrHome .merpi-note');
      await audit(p, tag + ' beranda');
      // beranda + kartu Main lagi (setelan game lokal terakhir)
      await p.evaluate(() => {
        localStorage.setItem(
          'loveopoly.v2.last',
          JSON.stringify({
            players: [
              { name: 'Arfi', avatar: '🐻', color: '#FF4F8B', kind: 'human' },
              { name: 'Nadia', avatar: '🐰', color: '#7B61FF', kind: 'human' },
            ],
            settings: { roundLimit: 25 },
          })
        );
        window.LoveUI.renderHome();
      });
      await p.waitForSelector('#scrHome .quick-card');
      await audit(p, tag + ' beranda: Main lagi');
      await click(p, '#hPass');
      await p.waitForSelector('#passOv .pp-prog');
      await p.waitForTimeout(900);
      await audit(p, tag + ' paspor: Jam Terbang & lencana', '#passOv');
      await click(p, '#ppCancel');
      await p.waitForSelector('#passOv', { state: 'detached' });
      await p.evaluate(() => window.LoveUI.openSettings());
      await p.waitForSelector('#modalRoot #sBackupWa', { state: 'attached' });
      const bkHash = await p.$eval(
        '#modalRoot #sBackupWa',
        a => decodeURIComponent(a.href.split('text=')[1]).split(' ').pop().split('#')[1]
      );
      await p.evaluate(() => window.LoveUI.closeModal(true));
      // konfirmasi pulihkan dari tautan cadangan (dibatalkan)
      await p.evaluate(h => (location.hash = h), bkHash);
      await p.waitForSelector('#modalRoot #bkYes');
      await audit(p, tag + ' pulihkan paspor', '#modalRoot');
      await click(p, '#modalRoot #bkNo');
      // Pengaturan: tema papan (Lv 3: Klasik & Senja Bali terbuka, sisanya terkunci)
      await p.evaluate(() => window.LoveUI.openSettings());
      await p.waitForSelector('#modalRoot .bt-grid');
      await audit(p, tag + ' pengaturan', '#modalRoot');
      await p.evaluate(() => window.LoveUI.closeModal(true));
      // Pertanyaan Hari Ini: pilih → kirim → satu HP bergantian → hasil
      await click(p, '#hDaily');
      await p.waitForSelector('#modalRoot [data-dqa]');
      await audit(p, tag + ' pertanyaan hari ini: pilih', '#modalRoot');
      await click(p, '#modalRoot [data-dqa="0"]');
      await p.waitForSelector('#modalRoot [data-dqg]');
      await click(p, '#modalRoot [data-dqg="1"]');
      await p.waitForSelector('#modalRoot #dqHot');
      await audit(p, tag + ' pertanyaan hari ini: kirim', '#modalRoot');
      await click(p, '#modalRoot #dqHot');
      await p.waitForSelector('#modalRoot #dqP2Go');
      await click(p, '#modalRoot #dqP2Go');
      await click(p, '#modalRoot [data-dqa="1"]');
      await p.waitForSelector('#modalRoot [data-dqg]');
      await click(p, '#modalRoot [data-dqg="0"]');
      await p.waitForSelector('#modalRoot .dq-res');
      await audit(p, tag + ' pertanyaan hari ini: hasil', '#modalRoot');
      await p.evaluate(() => window.LoveUI.closeModal(true));
      // papan dengan tiap tema (kontras teks petak di atas warna tema)
      for (const th of ['bali', 'paris', 'kyoto']) {
        await p.evaluate(th => {
          const pr = JSON.parse(localStorage.getItem('loveopoly.v1.profile'));
          pr.xp = 2000;
          localStorage.setItem('loveopoly.v1.profile', JSON.stringify(pr));
          window.LoveUI.App.prefs.board = th;
          window.LoveUI.applyTheme();
        }, th);
        await newGame(p, '[1, 2].forEach(t => { S.tiles[t].owner = 1; S.tiles[t].level = 2; });');
        await settle(p);
        await audit(p, tag + ' papan tema ' + th, '#game');
      }
      await p.evaluate(() => {
        const pr = JSON.parse(localStorage.getItem('loveopoly.v1.profile'));
        pr.xp = 250;
        localStorage.setItem('loveopoly.v1.profile', JSON.stringify(pr));
        window.LoveUI.App.prefs.board = 'klasik';
        window.LoveUI.applyTheme();
        window.LoveUI.exitToHome(true);
      });
      await p.waitForSelector('#hAI');
      await click(p, '#hAI');
      await p.waitForSelector('#pn0');
      await audit(p, tag + ' setup lawan AI');
      await click(p, '#sBack');
      await p.evaluate(() => window.LoveUI.openGuide(0));
      await p.waitForSelector('#guideOv');
      await audit(p, tag + ' panduan', '#guideOv');
      await p.evaluate(() => window.LoveUI.closeGuide());
      await click(p, '#hMenu');
      await p.waitForSelector('#modalRoot:not([hidden]) #mSound');
      await audit(p, tag + ' menu beranda', '#modalRoot');
      await p.evaluate(() => window.LoveUI.closeModal(true));
      await click(p, '#hPrivacy');
      await p.waitForSelector('#modalRoot:not([hidden]) #pvOk');
      await audit(p, tag + ' privasi', '#modalRoot');
      await p.evaluate(() => window.LoveUI.closeModal(true));

      // papan + panel aksi (Kabar Merpi & Musim Puncak aktif), palet reaksi
      await newGame(
        p,
        "S.round = 9; S.news = { id: 'holiday', side: 'top', from: 9, to: 10 }; [1, 2].forEach(t => { S.tiles[t].owner = 1; S.tiles[t].level = 2; });"
      );
      await settle(p);
      await audit(p, tag + ' papan');
      await click(p, '#hMenu');
      await p.waitForSelector('#modalRoot:not([hidden]) #mHist');
      await audit(p, tag + ' menu permainan', '#modalRoot');
      await p.evaluate(() => window.LoveUI.closeModal(true));
      await click(p, '#emoteBtn');
      await audit(p, tag + ' palet reaksi', '#emote');
      await click(p, '#emoteBtn');
      // undian giliran (hasil)
      await p.evaluate(() => {
        const E = window.LoveEngine;
        const S = E.create({
          players: [
            { name: 'Arfi', avatar: '🐻', color: '#FF4F8B' },
            { name: 'Nadia', avatar: '🐰', color: '#7B61FF' },
            { name: 'Dimas', avatar: '🦊', color: '#FF8A3D' },
          ],
          settings: { debug: true },
          seed: 9,
          first: 'random',
        });
        window.LoveUI.enterGame('local', -1, S);
      });
      await p.waitForSelector('#drawOv.dw-done', { timeout: 9000 });
      await audit(p, tag + ' undian giliran', '#drawOv');
      // undian menutup sendiri ±1,6 dtk setelah hasil; tombol bisa sudah hilang
      await p.$eval('#drawGo', e => e.click()).catch(() => {});
      await p.waitForSelector('#drawOv', { state: 'detached' });
      await newGame(
        p,
        "S.round = 9; S.news = { id: 'holiday', side: 'top', from: 9, to: 10 }; [1, 2].forEach(t => { S.tiles[t].owner = 1; S.tiles[t].level = 2; });"
      );
      await settle(p);
      // dialog beli kota
      await p.evaluate(() => window.LoveUI.act({ type: 'ROLL', p: 0, dice: [2, 2] }));
      await settle(p);
      await p.waitForSelector('#modalRoot:not([hidden]) .modal', { timeout: 8000 }).catch(() => {});
      await audit(p, tag + ' dialog keputusan', '#modalRoot');
      // tantangan: kuis (berjalan) & foto bukti (penilai)
      await newGame(p, 'S.queue.push({ type: "CHALLENGE", p: 0, ch: "tv", cat: "card", source: "card", redraws: 0 }); E.migrate(S);');
      await settle(p);
      await p.evaluate(() => window.LoveUI.syncModal(true));
      await p.waitForTimeout(200);
      await audit(p, tag + ' tantangan: pembuka', '#modalRoot');
      await click(p, '#bChGo');
      await p.waitForTimeout(200);
      await audit(p, tag + ' tantangan: kuis berjalan', '#modalRoot');
      await newGame(p, 'S.queue.push({ type: "CHALLENGE", p: 0, ch: "bl", cat: "card", source: "card", redraws: 0 }); E.migrate(S);');
      await settle(p);
      await p.evaluate(() => window.LoveUI.syncModal(true));
      await p.waitForTimeout(200);
      await audit(p, tag + ' tantangan: dua fakta satu bohong', '#modalRoot');
      // Momen Berdua: papan dengan pil & suasana, lalu dialog tantangan kerja sama (Singkat → ronde 5)
      await newGame(p, 'S.round = 5; S.moment = 5;');
      await settle(p);
      await p.waitForTimeout(1300);
      await audit(p, tag + ' papan: Momen Berdua');
      await newGame(
        p,
        'S.round = 5; S.moment = 5; S.queue.push({ type: "CHALLENGE", p: 0, ch: "dr1", cat: "duo", source: "moment", redraws: 0 }); E.migrate(S);'
      );
      await settle(p);
      await p.evaluate(() => window.LoveUI.syncModal(true));
      await p.waitForTimeout(200);
      await audit(p, tag + ' tantangan: Momen Berdua', '#modalRoot');
      await newGame(
        p,
        'S.queue.push({ type: "CHALLENGE", p: 0, ch: "ph1", cat: "card", source: "card", redraws: 0 }); E.migrate(S); S.queue[0].pz = { photo: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=" }; S.queue[0].phase = "judge"; S.queue[0].who = 1;'
      );
      await settle(p);
      await p.evaluate(() => window.LoveUI.syncModal(true));
      await p.waitForTimeout(200);
      if (await p.$('#modalRoot #bGate')) {
        await click(p, '#bGate');
        await p.waitForTimeout(150);
      }
      await audit(p, tag + ' tantangan: penilai foto', '#modalRoot');
      // 4 pemain + 4 foto bukti: polaroid di papan, "Kabar terbaru" di tengah kolom kiri, penampil satu foto
      await newGame(
        p,
        'S.photos = []; for (let k = 0; k < 4; k++) S.photos.push({ p: k, img: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=", text: "Foto", ok: k !== 1, r: k + 1, ch: "ph1", judge: (k + 1) % 4 });',
        4
      );
      await settle(p);
      await p.evaluate(() => window.LoveUI.closeModal(true));
      await audit(p, tag + ' papan 4P: polaroid & kabar terbaru', '#game');
      await p.evaluate(() => window.LoveUI.openProofs(1));
      await p.waitForSelector('#modalRoot .proof-big');
      await audit(p, tag + ' foto bukti: penampil satu foto', '#modalRoot');
      await p.evaluate(() => window.LoveUI.closeModal(true));
      // tantangan 4 pemain: voting penilai, tebak bersama (pilih penebak), dua fakta satu bohong banyak penebak
      const gate = async () => {
        if (await p.$('#modalRoot #bGate')) {
          await click(p, '#bGate');
          await p.waitForTimeout(150);
        }
      };
      await newGame(
        p,
        'S.queue.push({ type: "CHALLENGE", p: 0, ch: "dr2", cat: "card", source: "card", redraws: 0 }); E.migrate(S); S.queue[0].phase = "judge"; S.queue[0].pz = { votes: { 1: true } }; S.queue[0].who = S.queue[0].judges[1];',
        4
      );
      await settle(p);
      await p.evaluate(() => window.LoveUI.syncModal(true));
      await p.waitForTimeout(200);
      await gate();
      await p.waitForSelector('#modalRoot .note.gold >> text=Penilai 2 dari 3', { timeout: 4000 });
      await p.waitForSelector('#modalRoot #bJudgeOk');
      await audit(p, tag + ' tantangan 4P: voting penilai', '#modalRoot');
      await newGame(p, 'S.queue.push({ type: "CHALLENGE", p: 0, ch: "cr", cat: "card", source: "card", redraws: 0 }); E.migrate(S);', 4);
      await settle(p);
      await p.evaluate(() => window.LoveUI.syncModal(true));
      await p.waitForTimeout(200);
      await click(p, '#bChStep');
      await p.waitForTimeout(200);
      await p.waitForSelector('#modalRoot >> text=Waktunya menebak!', { timeout: 4000 });
      await audit(p, tag + ' tantangan 4P: gerbang tebak bersama', '#modalRoot');
      await gate();
      await p.waitForSelector('#modalRoot [data-gsr]', { timeout: 4000 });
      await audit(p, tag + ' tantangan 4P: pilih penebak', '#modalRoot');
      await newGame(p, 'S.queue.push({ type: "CHALLENGE", p: 0, ch: "bl", cat: "card", source: "card", redraws: 0 }); E.migrate(S);', 4);
      await settle(p);
      await p.evaluate(() =>
        window.LoveUI.act({ type: 'CH_ANSWER', p: 0, lines: ['Aku pernah ke Bali', 'Aku takut kucing', 'Aku bisa main gitar'], lie: 1 })
      );
      await settle(p);
      await p.evaluate(() => window.LoveUI.syncModal(true));
      await p.waitForTimeout(200);
      await gate();
      await p.waitForSelector('#modalRoot [data-pick] >> nth=2', { timeout: 4000 });
      await p.waitForSelector('#modalRoot .note.gold >> text=Penebak 1 dari 3');
      await audit(p, tag + ' tantangan 4P: tebak bohong', '#modalRoot');
      // pengaturan & layar menang
      await p.evaluate(() => window.LoveUI.closeModal(true));
      await newGame(p, '[1, 2].forEach(t => { S.tiles[t].owner = 0; });');
      await settle(p);
      await p.evaluate(() => window.LoveUI.act({ type: 'FINISH_NOW', p: 0 }));
      await p.waitForSelector('#winOv', { timeout: 10000 }).catch(() => {});
      await p.waitForSelector('#winOv .panel.jt');
      await audit(p, tag + ' layar menang', '#winOv');
      // lencana Sang Juara (3 kemenangan) naik tingkat → layar perayaan singkat
      await p.waitForSelector('#celebOv', { timeout: 4000 });
      await audit(p, tag + ' layar perayaan', '#celebOv');
      await p.waitForSelector('#celebOv', { state: 'detached', timeout: 6000 });
      await click(p, '#wShare');
      await p.waitForSelector('#memOv .mem-prev img', { timeout: 15000 });
      await p.waitForTimeout(500);
      await audit(p, tag + ' Kartu Kenangan', '#memOv');
      await p.close();
    }
  }

  if (found.length) {
    console.log('PELANGGARAN (' + found.length + '):');
    found.forEach(v =>
      console.log('- [' + v.impact + '] ' + v.id + ' @ ' + v.where + ' (' + v.count + '×): ' + v.help + '\n    ' + v.nodes.join('\n    '))
    );
  }
  console.log(
    '\naxe WCAG 2.1 AA: ' +
      checked +
      ' tampilan diperiksa, ' +
      found.length +
      ' pelanggaran.' +
      (errors.length ? '\nERRORS:\n' + errors.join('\n') : '')
  );
  await browser.close();
  process.exit(found.length || errors.length ? 1 : 0);
})();
