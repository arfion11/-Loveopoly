// Uji alur LOVEOPOLY 2.0 di browser: skenario terkontrol (dadu debug + state disiapkan).
// node test/flows.js   (butuh dist/test.html dari npm run build)
const { chromium } = require('playwright');
const THREE_LOCAL = require('path').resolve(__dirname, 'vendor/three.min.js');
const routeThree = ctx => ctx.route(/three(\.min)?\.js$/, r => r.fulfill({ path: THREE_LOCAL, contentType: 'application/javascript' }));
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'out', 'flows');
fs.mkdirSync(OUT, { recursive: true });
const URL = require('url').pathToFileURL(path.resolve(__dirname, '../dist/test.html')).href;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await routeThree(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast', theme: 'system', autoEnd: false }));
      if (!sessionStorage.getItem('tourTest')) localStorage.setItem('loveopoly.v2.tour', '"done"');
    } catch (e) { /* abaikan */ }
  });
  await page.goto(URL);
  await page.waitForSelector('#hLocal');

  const results = [];
  const ok = (name, cond, detail) => { const line = (cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''); results.push(line); if (process.env.LIVE) console.log(line); };
  const settle = async () => {
    await page.waitForFunction(() => !window.LoveUI.App.animating && !window.LoveUI.App.pending.length, null, { timeout: 20000 });
    await page.waitForTimeout(160);
  };
  const click = async sel => {
    try { await page.waitForSelector(sel, { state: 'visible', timeout: 8000 }); }
    catch (e) {
      const d = await page.evaluate(() => { const A = window.LoveUI.App; return { pick: !!A.pick, modal: A.modal && A.modal.key, queue: A.S && A.S.queue, turn: A.S && A.S.turn, title: (document.querySelector('#mTitle') || {}).textContent, bar: (document.getElementById('pickbar') || {}).hidden }; });
      await page.screenshot({ path: OUT + '/fail-' + sel.replace(/[^a-z0-9]/gi, '') + '.png' });
      throw new Error('tidak terlihat: ' + sel + ' ' + JSON.stringify(d));
    }
    await page.click(sel); await settle();
  };
  const S = () => page.evaluate(() => window.LoveUI.App.S);
  const title = () => page.evaluate(() => { const h = document.querySelector('#modalRoot:not([hidden]) #mTitle'); return h ? h.textContent : ''; });
  const shot = n => page.screenshot({ path: OUT + '/' + n + '.png' });
  const act = async a => { const r = await page.evaluate(a => window.LoveUI.act(a), a); await settle(); return r; };
  const roll = (p, d) => act({ type: 'ROLL', p, dice: d });
  // kamera 3D bergerak dulu (transisi) sebelum petak diketuk, seperti pemain menunggu papan diam
  const boardStill = () => page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.id === 'board'), null, { timeout: 5000 });
  const tapTile = async i => { await boardStill(); await page.click('#board .tile[data-i="' + i + '"]'); await page.waitForTimeout(120); };
  const HUMANS = [{ name: 'Arfi', avatar: '🐻', color: '#FF4F8B' }, { name: 'Nadia', avatar: '🐰', color: '#7B61FF' }];
  // state baru; mut = kode yang memodifikasi S (string)
  const newGame = async (mut, extra, players) => {
    await page.evaluate(([mutSrc, extra, players]) => {
      const E = window.LoveEngine, UI = window.LoveUI;
      const S = E.create({ players, settings: Object.assign({ debug: true, roundLimit: 0 }, extra || {}), seed: 4242 });
      const own = (t, o, lv) => { S.tiles[t].owner = o; S.tiles[t].level = lv || 0; };
      if (mutSrc) (new Function('S', 'E', 'own', mutSrc))(S, E, own);
      UI.enterGame('local', -1, S);
    }, [mut || '', extra || null, players || HUMANS]);
    await settle();
  };

  // 1. Beli kota + bangun sekaligus
  await newGame('S.players[0].laps = 1;');
  await roll(0, [1, 1]);
  ok('beli: dialog "Beli Bandung?"', (await title()) === 'Beli Bandung?', await title());
  const cost3 = await page.evaluate(() => window.LoveEngine.buyCost(window.LoveUI.App.S, 0, 2, 3));
  await page.click('[data-lv="3"]'); await page.waitForTimeout(150);
  await shot('01-buy');
  await click('#bBuy');
  let st = await S();
  ok('beli: Bandung jadi Hotel milik Arfi', st.tiles[2].owner === 0 && st.tiles[2].level === 3, 'owner=' + st.tiles[2].owner + ' lv=' + st.tiles[2].level);
  ok('beli: uang terpotong sesuai harga', st.players[0].cash === 2500 - cost3, 'cash=' + st.players[0].cash + ' cost=' + cost3);
  ok('beli: dadu kembar memberi lemparan lagi', st.turn.canRollAgain === true);

  // 2. Hotel terkunci sebelum 1 putaran
  await newGame('');
  await roll(0, [1, 1]);
  const hotelLocked = await page.evaluate(() => { const b = document.querySelector('[data-lv="3"]'); return !!b && b.disabled && b.classList.contains('locked'); });
  ok('beli: Hotel terkunci sebelum lewat START', hotelLocked);
  await click('#bSkip');

  // 3. Mampir ke kota sendiri -> bangun
  await newGame('own(13, 0, 1); S.players[0].pos = 4; S.players[0].laps = 1;');
  await roll(0, [4, 5]);
  ok('bangun: dialog "Bangun di Jeju?"', (await title()) === 'Bangun di Jeju?', await title());
  await page.click('[data-lv="3"]'); await page.waitForTimeout(120);
  await click('#bUp');
  st = await S();
  ok('bangun: Jeju naik ke Hotel', st.tiles[13].level === 3, 'lv=' + st.tiles[13].level);

  // 4. Bayar tol -> ambil alih -> tawaran bangun
  await newGame('own(9, 1, 1); S.players[0].pos = 4;');
  await roll(0, [2, 3]);
  ok('tol: dialog "Bayar Tol"', (await title()) === 'Bayar Tol', await title());
  const toll = await page.evaluate(() => window.LoveUI.App.S.queue[0].amount);
  await shot('04-rent');
  await click('#bPay');
  st = await S();
  ok('tol: uang pindah ke Nadia', st.players[0].cash === 2500 - toll && st.players[1].cash === 2500 + toll, 'toll=' + toll);
  ok('ambil alih: dialog "Rebut Bali?"', (await title()) === 'Rebut Bali?', await title());
  const price = await page.evaluate(() => window.LoveEngine.takeoverPrice(window.LoveUI.App.S, 9));
  await click('#bTkBuy');
  st = await S();
  ok('ambil alih: Bali milik Arfi, Nadia dibayar', st.tiles[9].owner === 0 && st.players[1].cash === 2500 + toll + price, 'price=' + price);
  ok('ambil alih: lanjut tawaran bangun', /Bangun di Bali\?/.test(await title()), await title());
  await click('#bSkip');

  // 5. Kartu Malaikat Cinta membebaskan tol
  await newGame('own(9, 1, 2); S.players[0].pos = 4; S.players[0].cards = ["K01"];');
  await roll(0, [2, 3]);
  await click('#bAngel');
  st = await S();
  ok('malaikat: tol 0 dan kartu terpakai', st.players[0].cash === 2500 && !st.players[0].cards.length, 'cash=' + st.players[0].cash);
  if (await title() === 'Rebut Bali?') await click('#bTkSkip');

  // 6. Landmark kebal ambil alih
  await newGame('own(9, 1, 4); S.players[0].pos = 4;');
  await roll(0, [2, 3]);
  await click('#bPay');
  ok('landmark: tidak ada tawaran ambil alih', (await title()) !== 'Rebut Bali?', await title());

  // 7. Wisata kebal ambil alih
  await newGame('own(5, 1); S.players[0].pos = 1;');
  await roll(0, [1, 3]);
  await click('#bPay');
  ok('wisata: tidak ada tawaran ambil alih', (await title()) !== 'Rebut Bianglala?', await title());

  // 8. Festival Cinta lewat pilih petak di papan
  await newGame('own(1, 0, 1); own(2, 0, 2); S.players[0].pos = 12;');
  await roll(0, [1, 3]);
  const pickOn = await page.evaluate(() => document.getElementById('board').classList.contains('picking') && !document.getElementById('pickbar').hidden);
  ok('festival: mode pilih petak aktif', pickOn);
  const pickable = await page.evaluate(() => [...document.querySelectorAll('#board .tile.pickable')].map(t => Number(t.dataset.i)).sort((a, b) => a - b).join(','));
  ok('festival: hanya kota milik sendiri yang bisa dipilih', pickable === '1,2', pickable);
  await tapTile(2);
  await shot('08-festival');
  await click('#pbOk');
  st = await S();
  ok('festival: Bandung jadi tuan rumah ×2', st.festival.tile === 2 && st.festival.mult === 2, JSON.stringify(st.festival));

  // 9. World Tour: terbang ke tujuan pilihan
  await newGame('S.players[0].pos = 20;');
  await roll(0, [1, 3]);
  st = await S();
  ok('world tour: tiba & dapat tiket', st.players[0].pos === 24 && st.players[0].tour === true);
  await click('#cEnd');
  await roll(1, [3, 4]); // Nadia ke Lombok (kosong)
  if (/Beli/.test(await title())) await click('#bSkip');
  await act({ type: 'END_TURN', p: 1 });
  const tourPick = await page.evaluate(() => !!window.LoveUI.App.pick);
  ok('world tour: giliran berikut membuka pilih tujuan', tourPick);
  const pay = await page.evaluate(() => { const p = window.LoveUI.App.S.players[0]; return window.LoveUI.RULES.salary + window.LoveEngine.tierInfo(p.love).salary; });
  await tapTile(9);
  await click('#pbOk');
  st = await S();
  ok('world tour: terbang ke Bali, bayar 100, tetap dapat gaji lewat START', st.players[0].pos === 9 && st.players[0].cash === 2500 - 100 + pay && !st.players[0].tour, 'pos=' + st.players[0].pos + ' cash=' + st.players[0].cash + ' gaji=' + pay);
  if (/Beli Bali/.test(await title())) await click('#bSkip');

  // 10. Pulau Rindu: bayar perahu
  await newGame('S.players[0].pos = 8; S.players[0].island = true; S.players[0].islandTries = 0;');
  const isleBtns = await page.evaluate(() => ['cRoll', 'cIslePay', 'cIsleCh'].every(id => !!document.getElementById(id)));
  ok('pulau: tiga cara keluar tersedia', isleBtns);
  await shot('10-island');
  await click('#cIslePay');
  st = await S();
  ok('pulau: bayar 100 lalu bebas', !st.players[0].island && st.players[0].cash === 2400, 'cash=' + st.players[0].cash);

  // 11. Pulau: dadu kembar = keluar dan jalan
  await newGame('S.players[0].pos = 8; S.players[0].island = true; S.players[0].islandTries = 0;');
  await roll(0, [2, 2]);
  st = await S();
  ok('pulau: kembar langsung keluar & jalan 4', !st.players[0].island && st.players[0].pos === 12, 'pos=' + st.players[0].pos);

  // 12. Kartu aksi: Badai Rindu menurunkan bangunan lawan
  await newGame('own(9, 1, 3); S.queue.push({ type: "TARGET", p: 0, kind: "storm", src: "card" });');
  await page.evaluate(() => window.LoveUI.syncModal(true)); await settle();
  await tapTile(9);
  await click('#pbOk');
  st = await S();
  ok('badai: Bali turun ke Gedung', st.tiles[9].level === 2, 'lv=' + st.tiles[9].level);

  // 13. Kartu aksi: Tukar Kota
  await newGame('own(1, 0, 1); own(9, 1, 2); S.queue.push({ type: "TARGET", p: 0, kind: "swap", src: "card" });');
  await page.evaluate(() => window.LoveUI.syncModal(true)); await settle();
  await tapTile(1);
  await tapTile(9);
  await click('#pbOk');
  st = await S();
  ok('tukar: kepemilikan Kota Tua & Bali bertukar', st.tiles[1].owner === 1 && st.tiles[9].owner === 0, 'kt=' + st.tiles[1].owner + ' bali=' + st.tiles[9].owner);

  // 14. Kartu Cinta dari petak kartu
  await newGame('const d = S.decks.card; d.splice(d.indexOf("K17"), 1); d.unshift("K17");');
  await roll(0, [1, 2]);
  ok('kartu: dialog kartu muncul', (await title()) === 'Transferan Kejutan', await title());
  await page.waitForTimeout(900);
  await shot('14-card');
  await click('#bCard');
  st = await S();
  ok('kartu: hadiah 150 diterima', st.players[0].cash === 2650, 'cash=' + st.players[0].cash);

  // 15. Tantangan pasangan (kuis) -> jawaban benar
  await newGame('S.queue.push({ type: "CHALLENGE", p: 0, ch: window.LOVE_DATA.CHALLENGES.find(c => c.type === "quiz").id, cat: "quiz", source: "card", redraws: 0 });');
  await page.evaluate(() => window.LoveUI.syncModal(true)); await settle();
  const chTitle = await title();
  await click('#bDone');
  st = await S();
  ok('tantangan: hadiah diterima', st.players[0].cash > 2500, chTitle + ' cash=' + st.players[0].cash);

  // 16. Pajak Rindu
  await newGame('own(1, 0, 2); S.players[0].pos = 28;');
  await roll(0, [1, 1]);
  ok('pajak: dialog pajak', /Pajak/.test(await title()), await title());
  const taxAmt = await page.evaluate(() => window.LoveUI.App.S.queue[0].amount);
  await click('#bTax');
  st = await S();
  ok('pajak: 10% aset dibayar', st.players[0].cash === 2500 - taxAmt && taxAmt > 0, 'tax=' + taxAmt);

  // 17. Utang: jual kota ke bank lalu bayar
  await newGame('own(1, 0, 2); own(2, 0, 2); own(9, 1, 1); S.players[0].pos = 4; S.players[0].cash = 50;');
  await roll(0, [2, 3]);
  await click('#bPay');
  ok('utang: dialog cari dana', /Cari Dana/.test(await title()), await title());
  await click('[data-sell="1"]');
  const payable = await page.evaluate(() => { const b = document.getElementById('bPayDebt'); return b && !b.disabled; });
  ok('utang: setelah jual, tombol bayar aktif', payable);
  if (payable) await click('#bPayDebt');
  st = await S();
  ok('utang: lunas, hanya kota yang dijual hilang', st.tiles[1].owner === -1 && st.tiles[2].owner === 0 && !st.queue.some(q => q.type === 'DEBT'));

  // 18. Bangkrut -> permainan selesai
  await newGame('own(9, 1, 3); S.players[0].pos = 4; S.players[0].cash = 10;');
  await roll(0, [2, 3]);
  await click('#bPay');
  await click('#bBk');
  ok('bangkrut: minta konfirmasi dulu', !(await S()).over && /Ya, Bangkrut/.test(await page.evaluate(() => document.getElementById('bBk').textContent)));
  await click('#bBk');
  st = await S();
  ok('bangkrut: Nadia menang', !!st.over && st.over.winner === 1 && st.over.reason === 'bankrupt', JSON.stringify(st.over && st.over.reason));
  await page.waitForTimeout(1200);
  ok('bangkrut: layar menang tampil', await page.evaluate(() => !!document.querySelector('.win') || !!document.querySelector('#wAgain')));

  // 19. Menang instan: monopoli wisata
  await newGame('[11, 14, 20, 27].forEach(t => own(t, 0)); S.players[0].pos = 1;', { instantWin: true });
  await roll(0, [1, 3]);
  await click('#bBuy');
  st = await S();
  ok('instan: Monopoli Wisata', !!st.over && st.over.reason === 'spots' && st.over.winner === 0, JSON.stringify(st.over && st.over.reason));

  // 20. Menang instan: triple monopoli
  await newGame('[1, 2, 4, 6, 7, 9].forEach(t => own(t, 0)); S.players[0].pos = 7; S.players[0].laps = 1;', { instantWin: true });
  // grup kota(1,2) jawa(4,6) tropis(9,10): beli Labuan Bajo (10) -> 3 grup penuh
  await roll(0, [1, 2]);
  if (/Beli/.test(await title())) await click('#bBuy');
  st = await S();
  ok('instan: Triple Monopoli', !!st.over && st.over.reason === 'triple', JSON.stringify(st.over && st.over.reason) + ' pos=' + st.players[0].pos);

  // 21. START: bangun gratis-lokasi (pilih kota sendiri)
  await newGame('own(1, 0, 1); S.players[0].pos = 30; S.players[0].laps = 1;');
  await roll(0, [1, 1]);
  st = await S();
  const startPick = await page.evaluate(() => !!window.LoveUI.App.pick);
  ok('start: mendarat tepat di START membuka pilih kota', st.players[0].pos === 0 && startPick, 'pos=' + st.players[0].pos);
  if (startPick) { await tapTile(1); await click('#pbOk'); await page.waitForTimeout(200); if (/Bangun/.test(await title())) { await click('#bUp'); } st = await S(); ok('start: Kota Tua bisa dibangun', st.tiles[1].level >= 2, 'lv=' + st.tiles[1].level); }

  // 22. Info petak saat bukan giliran memilih
  await newGame('own(9, 1, 3);');
  await tapTile(9);
  ok('info petak: modal Bali', (await title()) === 'Bali', await title());
  await click('[data-x]');

  // 23. Akhiri giliran otomatis
  await page.evaluate(() => { window.LoveUI.App.prefs.autoEnd = true; });
  await newGame('');
  await roll(0, [2, 4]);
  if (/Beli/.test(await title())) await click('#bSkip');
  await page.waitForTimeout(3600);
  st = await S();
  ok('auto-end: giliran pindah ke Nadia', st.turn.p === 1, 'turn=' + st.turn.p);
  await page.evaluate(() => { window.LoveUI.App.prefs.autoEnd = false; });

  // 24. Lawan AI menyelesaikan gilirannya sendiri
  await newGame('S.turn.p = 1;', null, [HUMANS[0], { name: 'Bot', avatar: '🐰', color: '#7B61FF', kind: 'ai', ai: 'hard' }]);
  await page.waitForFunction(() => window.LoveUI.App.S.turn.p === 0, null, { timeout: 30000 }).catch(() => {});
  st = await S();
  ok('AI: menyelesaikan gilirannya', st.turn.p === 0, 'turn=' + st.turn.p);

  // 25. Buku Panduan & tur
  await page.evaluate(() => window.LoveUI.exitToHome(true)); await page.waitForTimeout(300);
  await page.click('#hHow');
  await page.waitForSelector('#guideOv');
  const pages = await page.evaluate(() => window.LoveUI.GUIDE_PAGES.length);
  for (let k = 1; k < pages; k++) { await page.click('#gNext'); await page.waitForTimeout(80); }
  const lastStep = await page.evaluate(() => document.querySelector('#guideOv .g-step').textContent);
  ok('panduan: semua halaman bisa dibuka', lastStep.includes(pages + ' / ' + pages) || lastStep.includes(pages + '/' + pages), lastStep);
  const cardBox = await page.evaluate(() => { const r = document.querySelector('#guideOv .g-card').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  ok('panduan: kartu panduan berukuran wajar', cardBox.w > 600 && cardBox.h > 300, JSON.stringify(cardBox));
  await page.click('#gNext');
  await page.waitForTimeout(400);
  ok('panduan: tombol terakhir menutup', !(await page.$('#guideOv')));

  await page.evaluate(() => { sessionStorage.setItem('tourTest', '1'); localStorage.removeItem('loveopoly.v2.tour'); });
  await newGame('');
  await page.waitForSelector('.tour-card', { timeout: 6000 }).catch(() => {});
  ok('tur: kartu tur muncul di game pertama', !!(await page.$('.tour-card')));
  await shot('25-tour');

  console.log(results.join('\n'));
  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (results.length - fails) + '/' + results.length + ' lulus' + (errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nTanpa error konsol.'));
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})();
