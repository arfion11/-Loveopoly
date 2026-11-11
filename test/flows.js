// Uji alur LOVEOPOLY 2.0 di browser: skenario terkontrol (dadu debug + state disiapkan).
// node test/flows.js   (butuh dist/ dari npm run build)
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { serveDist } from './helpers/serve.js';
const OUT = process.env.OUT || path.join(import.meta.dirname, 'out', 'flows');
fs.mkdirSync(OUT, { recursive: true });
const URL = (await serveDist()).url + '/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        'loveopoly.v1.prefs',
        JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast', theme: 'system', autoEnd: false })
      );
      if (!sessionStorage.getItem('tourTest')) localStorage.setItem('loveopoly.v2.tour', '"done"');
      if (!sessionStorage.getItem('passTest') && !localStorage.getItem('loveopoly.v1.profile'))
        localStorage.setItem('loveopoly.v1.profile', JSON.stringify({ skipped: true }));
    } catch (e) {
      /* abaikan */
    }
  });
  await page.goto(URL);
  await page.waitForSelector('#hLocal');

  const results = [];
  const ok = (name, cond, detail) => {
    const line = (cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '');
    results.push(line);
    if (process.env.LIVE) console.log(line);
  };
  const settle = async () => {
    await page.waitForFunction(() => !window.LoveUI.App.animating && !window.LoveUI.App.pending.length, null, { timeout: 20000 });
    await page.waitForTimeout(160);
  };
  const click = async sel => {
    try {
      await page.waitForSelector(sel, { state: 'visible', timeout: 8000 });
    } catch (e) {
      const d = await page.evaluate(() => {
        const A = window.LoveUI.App;
        return {
          pick: !!A.pick,
          modal: A.modal && A.modal.key,
          queue: A.S && A.S.queue,
          turn: A.S && A.S.turn,
          title: (document.querySelector('#mTitle') || {}).textContent,
          bar: (document.getElementById('pickbar') || {}).hidden,
        };
      });
      await page.screenshot({ path: OUT + '/fail-' + sel.replace(/[^a-z0-9]/gi, '') + '.png' });
      throw new Error('tidak terlihat: ' + sel + ' ' + JSON.stringify(d), { cause: e });
    }
    await page.click(sel);
    await settle();
  };
  const S = () => page.evaluate(() => window.LoveUI.App.S);
  const title = () =>
    page.evaluate(() => {
      const h = document.querySelector('#modalRoot:not([hidden]) #mTitle');
      return h ? h.textContent : '';
    });
  const shot = n => page.screenshot({ path: OUT + '/' + n + '.png' });
  const act = async a => {
    const r = await page.evaluate(a => window.LoveUI.act(a), a);
    await settle();
    return r;
  };
  const roll = (p, d) => act({ type: 'ROLL', p, dice: d });
  // kamera 3D bergerak dulu (transisi) sebelum petak diketuk, seperti pemain menunggu papan diam
  const boardStill = () =>
    page.waitForFunction(
      () => !document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.id === 'board'),
      null,
      { timeout: 5000 }
    );
  const tapTile = async i => {
    await boardStill();
    await page.click('#board .tile[data-i="' + i + '"]');
    await page.waitForTimeout(120);
  };
  const HUMANS = [
    { name: 'Arfi', avatar: '🐻', color: '#FF4F8B' },
    { name: 'Nadia', avatar: '🐰', color: '#7B61FF' },
  ];
  // state baru; mut = kode yang memodifikasi S (string)
  const newGame = async (mut, extra, players) => {
    await page.evaluate(
      ([mutSrc, extra, players]) => {
        const E = window.LoveEngine,
          UI = window.LoveUI;
        const S = E.create({ players, settings: Object.assign({ debug: true, roundLimit: 0 }, extra || {}), seed: 4242 });
        const own = (t, o, lv) => {
          S.tiles[t].owner = o;
          S.tiles[t].level = lv || 0;
        };
        if (mutSrc) new Function('S', 'E', 'own', mutSrc)(S, E, own);
        UI.enterGame('local', -1, S);
      },
      [mut || '', extra || null, players || HUMANS]
    );
    await settle();
  };

  // 1. Beli kota + bangun sekaligus
  await newGame('S.players[0].laps = 1;');
  await roll(0, [1, 1]);
  ok('beli: dialog "Beli Bandung?"', (await title()) === 'Beli Bandung?', await title());
  const cost3 = await page.evaluate(() => window.LoveEngine.buyCost(window.LoveUI.App.S, 0, 2, 3));
  await page.click('[data-lv="3"]');
  await page.waitForTimeout(150);
  await shot('01-buy');
  await click('#bBuy');
  let st = await S();
  ok(
    'beli: Bandung jadi Hotel milik Arfi',
    st.tiles[2].owner === 0 && st.tiles[2].level === 3,
    'owner=' + st.tiles[2].owner + ' lv=' + st.tiles[2].level
  );
  ok('beli: uang terpotong sesuai harga', st.players[0].cash === 2500 - cost3, 'cash=' + st.players[0].cash + ' cost=' + cost3);
  ok('beli: dadu kembar memberi lemparan lagi', st.turn.canRollAgain === true);

  // 2. Hotel terkunci sebelum 1 putaran
  await newGame('');
  await roll(0, [1, 1]);
  const hotelLocked = await page.evaluate(() => {
    const b = document.querySelector('[data-lv="3"]');
    return !!b && b.disabled && b.classList.contains('locked');
  });
  ok('beli: Hotel terkunci sebelum lewat START', hotelLocked);
  await click('#bSkip');

  // 3. Mampir ke kota sendiri -> bangun
  await newGame('own(13, 0, 1); S.players[0].pos = 4; S.players[0].laps = 1;');
  await roll(0, [4, 5]);
  ok('bangun: dialog "Bangun di Jeju?"', (await title()) === 'Bangun di Jeju?', await title());
  await page.click('[data-lv="3"]');
  await page.waitForTimeout(120);
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
  if ((await title()) === 'Rebut Bali?') await click('#bTkSkip');

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
  const pickOn = await page.evaluate(
    () => document.getElementById('board').classList.contains('picking') && !document.getElementById('pickbar').hidden
  );
  ok('festival: mode pilih petak aktif', pickOn);
  const pickable = await page.evaluate(() =>
    [...document.querySelectorAll('#board .tile.pickable')]
      .map(t => Number(t.dataset.i))
      .sort((a, b) => a - b)
      .join(',')
  );
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
  const pay = await page.evaluate(() => {
    const p = window.LoveUI.App.S.players[0];
    return window.LoveUI.RULES.salary + window.LoveEngine.tierInfo(p.love).salary;
  });
  await tapTile(9);
  await click('#pbOk');
  st = await S();
  ok(
    'world tour: terbang ke Bali, bayar 100, tetap dapat gaji lewat START',
    st.players[0].pos === 9 && st.players[0].cash === 2500 - 100 + pay && !st.players[0].tour,
    'pos=' + st.players[0].pos + ' cash=' + st.players[0].cash + ' gaji=' + pay
  );
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
  await page.evaluate(() => window.LoveUI.syncModal(true));
  await settle();
  await tapTile(9);
  await click('#pbOk');
  st = await S();
  ok('badai: Bali turun ke Gedung', st.tiles[9].level === 2, 'lv=' + st.tiles[9].level);

  // 13. Kartu aksi: Tukar Kota
  await newGame('own(1, 0, 1); own(9, 1, 2); S.queue.push({ type: "TARGET", p: 0, kind: "swap", src: "card" });');
  await page.evaluate(() => window.LoveUI.syncModal(true));
  await settle();
  await tapTile(1);
  await tapTile(9);
  await click('#pbOk');
  st = await S();
  ok(
    'tukar: kepemilikan Kota Tua & Bali bertukar',
    st.tiles[1].owner === 1 && st.tiles[9].owner === 0,
    'kt=' + st.tiles[1].owner + ' bali=' + st.tiles[9].owner
  );

  // 14. Kartu Cinta dari petak kartu
  await newGame('const d = S.decks.card; d.splice(d.indexOf("K17"), 1); d.unshift("K17");');
  await roll(0, [1, 2]);
  ok('kartu: dialog kartu muncul', (await title()) === 'Transferan Kejutan', await title());
  await page.waitForTimeout(900);
  await shot('14-card');
  await click('#bCard');
  st = await S();
  ok('kartu: hadiah 150 diterima', st.players[0].cash === 2650, 'cash=' + st.players[0].cash);

  // 15. Tantangan terbukti: tidak ada lagi "klik Selesai"; mini-game dinilai engine, duel & foto dinilai lawan
  const jsClick = async sel => {
    await page.waitForSelector(sel, { state: 'visible', timeout: 8000 });
    await page.$eval(sel, e => e.click());
    await page.waitForTimeout(120);
    await settle();
  };
  const chGame = (id, mut) =>
    newGame(
      (mut || '') + 'S.queue.push({ type: "CHALLENGE", p: 0, ch: "' + id + '", cat: "card", source: "card", redraws: 0 }); E.migrate(S);'
    );
  await chGame('tv');
  await page.evaluate(() => window.LoveUI.syncModal(true));
  await settle();
  ok(
    'tantangan: tidak ada tombol "Benar/Selesai" tanpa bukti',
    !(await page.$('#modalRoot #bDone')) && !!(await page.$('#modalRoot #bChGo'))
  );
  await jsClick('#bChGo');
  const sol = await page.evaluate(() => window.LoveEngine.chSolve(window.LoveUI.App.S.queue[0]));
  for (const k of sol) {
    await page.waitForSelector('#modalRoot [data-ans="' + k + '"]', { state: 'visible' });
    await page.$eval('#modalRoot [data-ans="' + k + '"]', e => e.click());
    await page.waitForTimeout(330);
  }
  await settle();
  st = await S();
  ok(
    'kuis: semua jawaban benar lewat klik → lulus + bukti tercatat',
    st.players[0].cash === 2650 && st.proofs.length === 1 && /4\/4 benar/.test(st.proofs[0].proof),
    JSON.stringify(st.proofs[0])
  );
  await shot('15-challenge-proof');
  // jawaban salah → gagal, tanpa hadiah
  await chGame('em');
  await page.evaluate(() => window.LoveUI.syncModal(true));
  await settle();
  await jsClick('#bChGo');
  const sol2 = await page.evaluate(() => window.LoveEngine.chSolve(window.LoveUI.App.S.queue[0]));
  for (const k of sol2) {
    const w = (k + 1) % 4;
    await page.waitForSelector('#modalRoot [data-ans="' + w + '"]', { state: 'visible' });
    await page.$eval('#modalRoot [data-ans="' + w + '"]', e => e.click());
    await page.waitForTimeout(330);
  }
  await settle();
  st = await S();
  ok(
    'tebak emoji: jawaban salah → gagal tanpa hadiah',
    st.players[0].cash === 2500 && st.proofs[0] && !st.proofs[0].ok,
    st.proofs[0] && st.proofs[0].proof
  );
  // Rindu Challenge: gagal = tetap di pulau
  await newGame('S.players[0].pos = 8; S.players[0].island = true;', null, [
    HUMANS[0],
    { name: 'Bot', kind: 'ai', avatar: '🤖', color: '#7B61FF' },
  ]);
  await act({ type: 'ISLAND_CH', p: 0 });
  const rinduType = await page.evaluate(() => {
    const it = window.LoveUI.App.S.queue[0];
    return window.LoveEngine.CH[it.ch].type + (it.isle ? ' (pulau)' : '');
  });
  await act({ type: 'CH_ANSWER', p: 0, answers: [], ms: 1000 });
  st = await S();
  ok(
    'Rindu Challenge: jawaban salah → tetap di Pulau Rindu',
    st.players[0].island && st.players[0].islandCh && !st.queue.length && st.proofs.length === 1 && !st.proofs[0].ok,
    rinduType + ' · ' + (st.proofs[0] && st.proofs[0].proof)
  );
  // duel Tebak Isi Hati (dua pemain satu HP): layar serah-HP, jawaban rahasia, tebakan
  await chGame('hs');
  await page.evaluate(() => window.LoveUI.syncModal(true));
  await settle();
  await jsClick('#bChStep');
  ok('tebak isi hati: layar "Serahkan ke Nadia" sebelum jawaban rahasia', /Serahkan ke Nadia/.test(await title()), await title());
  await jsClick('#bGate');
  for (const q of [0, 1, 2]) {
    await page.$eval('#modalRoot [data-sa="' + q + ':1"]', e => e.click());
    await page.waitForTimeout(60);
  }
  await jsClick('#bChSend');
  await jsClick('#bGate');
  for (const [q, o] of [
    [0, 1],
    [1, 1],
    [2, 3],
  ]) {
    await page.$eval('#modalRoot [data-sa="' + q + ':' + o + '"]', e => e.click());
    await page.waitForTimeout(60);
  }
  await jsClick('#bChSend');
  st = await S();
  ok(
    'tebak isi hati: 2/3 cocok → keduanya dapat hadiah',
    st.players[0].cash > 2500 && st.players[1].love > st.players[0].love - 20 && /2\/3 cocok/.test(st.proofs[0].proof),
    st.proofs[0] && st.proofs[0].proof
  );
  // Dua Fakta Satu Bohong: pernyataan pendek bisa dikirim; tombol memberi tahu langkah yang kurang
  await chGame('bl');
  await page.evaluate(() => window.LoveUI.syncModal(true));
  await settle();
  for (const [i, t] of [
    [0, 'Anak 1'],
    [1, 'Jomblo'],
    [2, 'Suka 🍜'],
  ])
    await page.fill('#bl' + i, t);
  const blLabel = await page.$eval('#bChSend', b => b.disabled + ' ' + b.textContent);
  await page.$eval('[data-lie="2"]', e => e.click());
  await page.waitForTimeout(120);
  await jsClick('#bChSend');
  st = await S();
  ok(
    'dua fakta satu bohong: pernyataan pendek terkirim, tombol menjelaskan langkah kurang',
    /^true Ketuk Bohong dulu$/.test(blLabel) && st.queue[0] && st.queue[0].phase === 'guess',
    blLabel + ' → ' + (st.queue[0] && st.queue[0].phase)
  );

  // 3 pemain di satu HP: Aksi Berani dinilai semua lawan bergantian (layar serah-HP tiap penilai), mayoritas menentukan
  const P3 = [HUMANS[0], HUMANS[1], { name: 'Dimas', avatar: '🦊', color: '#12B5A6' }];
  await newGame('S.queue.push({ type: "CHALLENGE", p: 0, ch: "dr1", cat: "dare", source: "card", redraws: 0 }); E.migrate(S);', null, P3);
  await page.evaluate(() => window.LoveUI.syncModal(true));
  await settle();
  await jsClick('#bChStep');
  const voters = [];
  for (let k = 0; k < 2; k++) {
    voters.push(await title());
    await jsClick('#bGate');
    voters.push(await page.evaluate(() => (document.querySelector('#modalRoot .note.gold') || {}).textContent || ''));
    await jsClick(k === 0 ? '#bJudgeOk' : '#bJudgeNo');
  }
  st = await S();
  ok(
    '3 pemain: Aksi Berani dinilai 2 lawan bergantian, seri = sah',
    /Serahkan ke Nadia/.test(voters[0]) &&
      /Penilai 1 dari 2/.test(voters[1]) &&
      /Serahkan ke Dimas/.test(voters[2]) &&
      /Penilai 2 dari 2/.test(voters[3]) &&
      st.proofs.slice(-1)[0].ok &&
      /1 dari 2 penilai/.test(st.proofs.slice(-1)[0].proof),
    JSON.stringify(voters) + ' ' + st.proofs.slice(-1)[0].proof
  );
  // Momen Berdua: ronde 6 (tanpa batas ronde) → pengumuman, pil, tantangan kerja sama sebelum melempar, hadiah untuk berdua
  await newGame('S.round = 5; S.turn.p = 1; S.turn.rolled = true;');
  await act({ type: 'END_TURN', p: 1 });
  const mom = await page.evaluate(() => ({
    cine: /rotateZ\(/.test(document.querySelector('#board').style.transform),
    banner: (document.querySelector('#boardVP .banner') || {}).textContent || '',
    pill: (document.querySelector('.news-pill.moment') || {}).textContent || '',
    q: window.LoveUI.App.S.queue.map(x => x.type + ':' + x.source),
  }));
  ok(
    'Momen Berdua: pengumuman + pil ronde ini + kamera sinematik + tantangan kerja sama di awal giliran',
    /MOMEN BERDUA/.test(mom.banner) && /Momen Berdua/.test(mom.pill) && mom.q[0] === 'CHALLENGE:moment' && mom.cine,
    JSON.stringify(mom).slice(0, 220)
  );
  await page.evaluate(() => {
    const A = window.LoveUI.App;
    Object.assign(A.S.queue[0], { ch: 'dr1', phase: undefined });
    window.LoveEngine.migrate(A.S);
    window.LoveUI.syncModal(true);
  });
  await settle();
  const momDlg = await page.evaluate(() => ({
    kicker: (document.querySelector('#modalRoot .kicker') || {}).textContent || '',
    chips: (document.querySelector('#modalRoot .reward-row') || {}).textContent || '',
  }));
  await shot('momen-berdua');
  ok(
    'Momen Berdua: dialog berlabel Momen Berdua, hadiah +100 & Love +4 sama untuk pasangan',
    /Momen Berdua/.test(momDlg.kicker) &&
      /\+100/.test(momDlg.chips) &&
      /Love \+4/.test(momDlg.chips) &&
      /Hadiah sama untuk Nadia/.test(momDlg.chips),
    JSON.stringify(momDlg)
  );
  const m0 = await S();
  await jsClick('#bChStep');
  await jsClick('#bGate');
  await jsClick('#bJudgeOk');
  const m1 = await S();
  ok(
    'Momen Berdua: disahkan → Arfi & Nadia sama-sama +100 dan Love +4, lalu Arfi bisa melempar',
    m1.players[0].cash - m0.players[0].cash === 100 &&
      m1.players[1].cash - m0.players[1].cash === 100 &&
      m1.players[0].love - m0.players[0].love === 4 &&
      m1.players[1].love - m0.players[1].love === 4 &&
      !m1.queue.length &&
      m1.turn.p === 0 &&
      !m1.turn.rolled,
    JSON.stringify({
      cash: [m1.players[0].cash - m0.players[0].cash, m1.players[1].cash - m0.players[1].cash],
      love: [m1.players[0].love - m0.players[0].love, m1.players[1].love - m0.players[1].love],
    })
  );

  // 3 pemain: Peragakan! semua lawan menebak, pilih nama penebak, yang benar dapat hadiah
  await newGame(
    'S.queue.push({ type: "CHALLENGE", p: 0, ch: "cr", cat: "charades", source: "card", redraws: 0 }); E.migrate(S);',
    null,
    P3
  );
  await page.evaluate(() => window.LoveUI.syncModal(true));
  await settle();
  const word3 = await page.evaluate(() => window.LoveUI.App.S.queue[0].pz.word);
  await jsClick('#bChStep');
  ok('3 pemain: Peragakan! satu layar "Waktunya menebak!"', /Waktunya menebak/.test(await title()), await title());
  await jsClick('#bGate');
  const gs = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-gsr]')].map(b => b.textContent));
  await page.$eval('#modalRoot [data-gsr]:last-child', b => b.click());
  await page.waitForTimeout(150);
  await page.fill('#chGuess', word3);
  await jsClick('#bChSend');
  st = await S();
  ok(
    '3 pemain: penebak yang dipilih (Dimas) benar → dia & pemilik dapat hadiah',
    gs.length === 2 && !st.queue.length && /Dimas menebak/.test(st.proofs.slice(-1)[0].proof),
    JSON.stringify(gs) + ' ' + (st.proofs.slice(-1)[0] || {}).proof
  );

  // Foto Bukti lewat unggah foto → dinilai lawan → dipajang di papan
  await chGame('ph1');
  await page.evaluate(() => window.LoveUI.syncModal(true));
  await settle();
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAYAAAD+Bd/7AAAAGUlEQVR4nGP4z8Dwn4GBgYGJAQoYRgUAAPMSAv8Wfr4DAAAAAElFTkSuQmCC',
    'base64'
  );
  await page.setInputFiles('#camFile', { name: 'bukti.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(
    () => {
      const b = document.querySelector('#modalRoot #bChSend');
      return b && !b.disabled;
    },
    null,
    { timeout: 5000 }
  );
  await jsClick('#bChSend');
  await jsClick('#bGate');
  ok('foto bukti: penilai melihat fotonya', !!(await page.$('#modalRoot .proof-photo img')));
  await jsClick('#bJudgeOk');
  await page.waitForTimeout(400);
  st = await S();
  ok(
    'foto bukti: disahkan → hadiah + foto dipajang di papan',
    st.players[0].cash > 2500 && st.photos.length === 1 && !!(await page.$('#board #proofPin img')),
    'photos=' + (st.photos || []).length
  );
  await shot('15b-photo-proof');

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
  const payable = await page.evaluate(() => {
    const b = document.getElementById('bPayDebt');
    return b && !b.disabled;
  });
  ok('utang: setelah jual, tombol bayar aktif', payable);
  if (payable) await click('#bPayDebt');
  st = await S();
  ok(
    'utang: lunas, hanya kota yang dijual hilang',
    st.tiles[1].owner === -1 && st.tiles[2].owner === 0 && !st.queue.some(q => q.type === 'DEBT')
  );

  // 18. Bangkrut -> permainan selesai
  await newGame('own(9, 1, 3); S.players[0].pos = 4; S.players[0].cash = 10;');
  await roll(0, [2, 3]);
  await click('#bPay');
  await click('#bBk');
  ok(
    'bangkrut: minta konfirmasi dulu',
    !(await S()).over && /Ya, Bangkrut/.test(await page.evaluate(() => document.getElementById('bBk').textContent))
  );
  await click('#bBk');
  st = await S();
  ok(
    'bangkrut: Nadia menang',
    !!st.over && st.over.winner === 1 && st.over.reason === 'bankrupt',
    JSON.stringify(st.over && st.over.reason)
  );
  await page.waitForTimeout(1200);
  ok('bangkrut: layar menang tampil', await page.evaluate(() => !!document.querySelector('.win') || !!document.querySelector('#wAgain')));

  // 19. Menang instan: Kolektor Wisata
  await newGame('[11, 14, 20, 27].forEach(t => own(t, 0)); S.players[0].pos = 1;', { instantWin: true });
  await roll(0, [1, 3]);
  await click('#bBuy');
  st = await S();
  ok('instan: Kolektor Wisata', !!st.over && st.over.reason === 'spots' && st.over.winner === 0, JSON.stringify(st.over && st.over.reason));

  // 20. Menang instan: Trio Warna (ada grup 3 kota: Jawa)
  await newGame('[1, 2, 4, 6, 7, 9].forEach(t => own(t, 0)); S.players[0].pos = 7; S.players[0].laps = 1;', { instantWin: true });
  // grup kota(1,2) jawa(4,6) tropis(9,10): beli Labuan Bajo (10) -> 3 grup penuh
  await roll(0, [1, 2]);
  if (/Beli/.test(await title())) await click('#bBuy');
  st = await S();
  ok(
    'instan: Trio Warna',
    !!st.over && st.over.reason === 'triple',
    JSON.stringify(st.over && st.over.reason) + ' pos=' + st.players[0].pos
  );

  // 21. START: bangun gratis-lokasi (pilih kota sendiri)
  await newGame('own(1, 0, 1); S.players[0].pos = 30; S.players[0].laps = 1;');
  await roll(0, [1, 1]);
  st = await S();
  const startPick = await page.evaluate(() => !!window.LoveUI.App.pick);
  ok('start: mendarat tepat di START membuka pilih kota', st.players[0].pos === 0 && startPick, 'pos=' + st.players[0].pos);
  if (startPick) {
    await tapTile(1);
    await click('#pbOk');
    await page.waitForTimeout(200);
    if (/Bangun/.test(await title())) {
      await click('#bUp');
    }
    st = await S();
    ok('start: Kota Tua bisa dibangun', st.tiles[1].level >= 2, 'lv=' + st.tiles[1].level);
  }

  // 22. Info petak saat bukan giliran memilih
  await newGame('own(9, 1, 3);');
  await tapTile(9);
  ok('info petak: modal Bali', (await title()) === 'Bali', await title());
  await click('[data-x]');

  // 23. Akhiri giliran otomatis
  await page.evaluate(() => {
    window.LoveUI.App.prefs.autoEnd = true;
  });
  await newGame('');
  await roll(0, [2, 4]);
  if (/Beli/.test(await title())) await click('#bSkip');
  await page.waitForTimeout(3600);
  st = await S();
  ok('auto-end: giliran pindah ke Nadia', st.turn.p === 1, 'turn=' + st.turn.p);
  await page.evaluate(() => {
    window.LoveUI.App.prefs.autoEnd = false;
  });

  // 24. Lawan AI menyelesaikan gilirannya sendiri
  await newGame('S.turn.p = 1;', null, [HUMANS[0], { name: 'Bot', avatar: '🐰', color: '#7B61FF', kind: 'ai', ai: 'hard' }]);
  await page.waitForFunction(() => window.LoveUI.App.S.turn.p === 0, null, { timeout: 30000 }).catch(() => {});
  st = await S();
  ok('AI: menyelesaikan gilirannya', st.turn.p === 0, 'turn=' + st.turn.p);

  // 24a. Beranda: Online jadi kartu utama (paling atas & paling besar)
  await page.evaluate(() => window.LoveUI.exitToHome(true));
  await page.waitForTimeout(300);
  const home = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('.home-actions .mode-card')].map(b => b.id);
    const area = id => {
      const r = document.getElementById(id).getBoundingClientRect();
      return r.width * r.height;
    };
    return { ids, on: area('hOnline'), ai: area('hAI'), local: area('hLocal') };
  });
  ok(
    'beranda: Online pertama & paling besar',
    home.ids[0] === 'hOnline' && home.on > home.ai * 1.5 && home.on > home.local * 1.5,
    JSON.stringify(home)
  );
  await shot('24a-home');
  await page.waitForTimeout(3500);
  const bg = await page.evaluate(() => ({
    three: !!window.THREE,
    canvas: document.querySelectorAll('.page-sky canvas').length,
    blobs: document.querySelectorAll('.page-sky i').length,
    anim: document
      .getAnimations()
      .filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.page-sky')).length,
  }));
  ok('latar: diam & ringan (tanpa Three.js, kanvas, atau animasi)', !bg.three && !bg.canvas && !bg.blobs && !bg.anim, JSON.stringify(bg));
  // suasana Kabar Merpi: lapisan latar bergerak (hanya transform/opacity), kembali diam saat kabar selesai
  await newGame("S.round = 4; S.news = { id: 'love', side: null, from: 4, to: 5 };");
  await page.waitForTimeout(1600);
  const sky = await page.evaluate(() => {
    const an = document
      .getAnimations()
      .filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.page-sky'));
    const props = new Set();
    an.forEach(a =>
      a.effect.getKeyframes().forEach(k =>
        Object.keys(k).forEach(x => {
          if (!['offset', 'easing', 'composite', 'computedOffset'].includes(x)) props.add(x);
        })
      )
    );
    return { n: an.length, props: [...props] };
  });
  ok(
    'latar suasana: bergerak ringan (transform/opacity saja)',
    sky.n >= 2 && sky.props.every(x => x === 'transform' || x === 'opacity'),
    JSON.stringify(sky)
  );
  // kabar selesai: suasana memudar (tidak hilang seketika), lalu dilepas
  await page.evaluate(() => {
    const S = window.LoveUI.App.S;
    S.news = null;
    window.LoveUI.renderAmbience(S);
  });
  await page.waitForTimeout(500);
  const mid = await page.evaluate(() => ({
    amb: document.body.dataset.amb || '',
    leave: document.body.classList.contains('amb-leave'),
    op: +getComputedStyle(document.querySelector('.sky-a')).opacity,
  }));
  await page.waitForTimeout(1300);
  const end = await page.evaluate(() => ({
    amb: document.body.dataset.amb || '',
    op: +getComputedStyle(document.querySelector('.sky-a')).opacity,
  }));
  ok(
    'latar suasana: hilang memudar halus, bukan seketika',
    mid.amb === 'love' && mid.leave && mid.op > 0.05 && mid.op < 0.95 && end.amb === '' && end.op === 0,
    JSON.stringify([mid, end])
  );
  await page.evaluate(() => window.LoveUI.exitToHome(true));
  await page.waitForTimeout(1800); // tunggu pudar-keluar (1,2 dtk)
  const skyOff = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.page-sky')
        ).length
  );
  ok('latar suasana: diam lagi di beranda', skyOff === 0, 'anim=' + skyOff);
  await newGame('');
  const gl = await page.evaluate(() => {
    const g = document.querySelector('#board .center #mascot .ms-body');
    const r = g && g.getBoundingClientRect();
    return { has: !!g, w: r ? Math.round(r.width) : 0, three: !!window.THREE, globe: !!document.querySelector('.globe-2d') };
  });
  ok('tengah papan: Merpi besar tampil (tanpa Three.js)', gl.has && gl.w > 40 && !gl.three && !gl.globe, JSON.stringify(gl));
  // diketuk: Merpi bereaksi (gelembung kata di panel + gerak), menoleh ke pion yang jalan
  await page.$eval('#mascot .ms-body', e => e.click()); // Merpi bergoyang terus (msIdle): klik langsung
  const tap = await page.evaluate(() => ({
    bub: document.getElementById('bubble').classList.contains('show'),
    inVP: document.getElementById('bubble').parentNode.id,
    small: getComputedStyle(document.querySelector('#stage .st-merpi')).display,
    act: [...document.getElementById('mascot').classList].filter(c => c.startsWith('act-')).join(' '),
  }));
  ok(
    'Merpi besar: diketuk menjawab & bergerak (gelembung di papan, Merpi kecil disembunyikan)',
    tap.bub && tap.inVP === 'boardVP' && tap.small === 'none' && /act-spin/.test(tap.act),
    JSON.stringify(tap)
  );
  await page.evaluate(() => window.LoveUI.exitToHome(true));
  await page.waitForTimeout(300);

  // 24b. Mode online: layanan tidak bisa dihubungi → petunjuk + Coba lagi
  await page.evaluate(() => {
    window.LoveUI.exitToHome(true);
    window.LoveBackend = { use: () => Promise.reject({ code: 'sdk-load', message: 'x' }), _reset() {}, _normErr: e => e };
  });
  await page.waitForTimeout(300);
  await page.click('#hOnline');
  await page.waitForSelector('#oRetry', { timeout: 8000 }).catch(() => {});
  const offTxt = await page.evaluate(() => (document.querySelector('#scrOnline') || {}).textContent || '');
  ok(
    'online gagal: pesan koneksi + tombol Coba lagi',
    offTxt.includes('Layanan online tidak bisa dihubungi') && !!(await page.$('#oRetry')),
    offTxt.slice(0, 120)
  );
  await shot('24b-online-off');
  await page.click('#oBack');
  await page.waitForTimeout(300);

  // 25. Buku Panduan & tur
  await page.evaluate(() => window.LoveUI.exitToHome(true));
  await page.waitForTimeout(300);
  await page.click('#hHow');
  await page.waitForSelector('#guideOv');
  const pages = await page.evaluate(() => window.LoveUI.GUIDE_PAGES.length);
  for (let k = 1; k < pages; k++) {
    await page.click('#gNext');
    await page.waitForTimeout(80);
  }
  const lastStep = await page.evaluate(() => document.querySelector('#guideOv .g-step').textContent);
  ok('panduan: semua halaman bisa dibuka', lastStep.includes(pages + ' / ' + pages) || lastStep.includes(pages + '/' + pages), lastStep);
  const cardBox = await page.evaluate(() => {
    const r = document.querySelector('#guideOv .g-card').getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  ok('panduan: kartu panduan berukuran wajar', cardBox.w > 600 && cardBox.h > 300, JSON.stringify(cardBox));
  await page.click('#gNext');
  await page.waitForTimeout(400);
  ok('panduan: tombol terakhir menutup', !(await page.$('#guideOv')));

  await page.evaluate(() => {
    sessionStorage.setItem('tourTest', '1');
    localStorage.removeItem('loveopoly.v2.tour');
  });
  await newGame('');
  await page.waitForSelector('.tour-card', { timeout: 6000 }).catch(() => {});
  ok('tur: kartu tur muncul di game pertama', !!(await page.$('.tour-card')));
  await shot('25-tour');
  await page.evaluate(() => window.LoveUI.endTour(true));
  // tur saat bot jalan duluan: bot menunggu sampai tur selesai, kartu menyorot panel giliran
  await page.evaluate(() => {
    localStorage.removeItem('loveopoly.v2.tour');
    const E = window.LoveEngine;
    const S = E.create({
      players: [
        { name: 'Arfi', avatar: '🐻' },
        { name: 'Bot', avatar: '🐰', kind: 'ai' },
      ],
      settings: { debug: true },
      seed: 3,
      first: 1,
    });
    window.LoveUI.enterGame('local', -1, S);
  });
  await page.waitForSelector('.tour-card', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(2200);
  const tb = await page.evaluate(() => ({
    seq: window.LoveUI.App.S.seq,
    near: (() => {
      const c = document.querySelector('.tour-card'),
        st = document.getElementById('stage');
      if (!c || !st) return false;
      const a = c.getBoundingClientRect(),
        b = st.getBoundingClientRect();
      return Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < innerHeight * 0.6 && a.top > 8;
    })(),
  }));
  ok('tur: bot tidak jalan sebelum tur selesai & kartu dekat panel giliran', tb.seq === 0 && tb.near, JSON.stringify(tb));
  await page.evaluate(() => window.LoveUI.endTour(true));
  await page.waitForFunction(() => window.LoveUI.App.S.seq > 0, null, { timeout: 8000 }).catch(() => {});
  ok('tur: bot jalan setelah tur ditutup', await page.evaluate(() => window.LoveUI.App.S.seq > 0));
  // undian giliran: animasi mengungkap pemenang yang sama dengan engine; bot menunggu undian + tur
  await page.evaluate(() => {
    localStorage.removeItem('loveopoly.v2.tour');
    const E = window.LoveEngine;
    let S,
      sd = 1;
    do {
      S = E.create({
        players: [
          { name: 'Arfi', avatar: '🐻' },
          { name: 'Bot', avatar: '🐰', kind: 'ai' },
        ],
        settings: { debug: true },
        seed: sd++,
        first: 'random',
      });
    } while (S.turn.p !== 1);
    window.LoveUI.enterGame('local', -1, S);
  });
  const tIntro = Date.now();
  // papan muncul dulu (pop-up), siapa yang jalan duluan masih rahasia; undian baru tampil saat kartu sudah berdiri
  await page.waitForTimeout(250);
  const intro = await page.evaluate(() => ({
    draw: !!document.getElementById('drawOv'),
    enter: document.getElementById('board').classList.contains('enter'),
    turn: (document.getElementById('turnLine') || {}).textContent || '',
    active: document.querySelectorAll('.pcard.active, .token.me').length,
    roll: !!document.getElementById('cRoll'),
    news: [...document.querySelectorAll('#ticker, .log-card')].map(e => e.textContent).join(' '),
  }));
  ok(
    'undian menunggu papan selesai muncul; giliran dirahasiakan',
    !intro.draw &&
      intro.enter &&
      /Mengundi giliran/.test(intro.turn) &&
      intro.active === 0 &&
      !intro.roll &&
      !/Undian giliran/.test(intro.news),
    JSON.stringify(intro)
  );
  await page.waitForSelector('#drawOv', { timeout: 4000 });
  const tDraw = Date.now() - tIntro;
  ok('undian tampil saat kartu papan sudah berdiri (±1 dtk), tidak langsung', tDraw >= 1000 && tDraw < 2600, tDraw + ' ms');
  const dr0 = await page.evaluate(() => ({ tour: !!document.getElementById('tourOv'), seq: window.LoveUI.App.S.seq }));
  await page.waitForSelector('#drawOv.dw-done', { timeout: 8000 });
  const dr1 = await page.evaluate(() => ({
    chip: document.querySelector('.draw-p.dp-win b').textContent,
    title: document.getElementById('drawT').textContent,
  }));
  ok(
    'undian: animasi tampil sebelum tur & berhenti di pemain yang jalan duluan',
    !dr0.tour && dr0.seq === 0 && dr1.chip === 'Bot' && /Bot jalan duluan/.test(dr1.title),
    JSON.stringify([dr0, dr1])
  );
  await page.$eval('#drawGo', e => e.click());
  await page.waitForSelector('#tourOv', { timeout: 5000 }).catch(() => {});
  ok(
    'undian → tur: tur muncul setelah undian, bot masih menunggu',
    !!(await page.$('#tourOv')) && (await page.evaluate(() => window.LoveUI.App.S.seq === 0))
  );
  await page.evaluate(() => window.LoveUI.endTour(true));
  await page.waitForFunction(() => window.LoveUI.App.S.seq > 0, null, { timeout: 8000 }).catch(() => {});
  ok('undian → tur → bot jalan', await page.evaluate(() => window.LoveUI.App.S.seq > 0));
  // pemain lain beraksi selama undian (mis. tamu online): bot tetap jalan setelah undian selesai
  await page.evaluate(() => {
    const E = window.LoveEngine;
    let S,
      sd = 1;
    do {
      S = E.create({
        players: [
          { name: 'Arfi', avatar: '🐻' },
          { name: 'Bot', avatar: '🐰', kind: 'ai' },
        ],
        settings: { debug: true },
        seed: sd++,
        first: 'random',
      });
    } while (S.turn.p !== 0);
    window.LoveUI.enterGame('local', -1, S);
  });
  await page.waitForSelector('#drawOv', { timeout: 4000 });
  await page.evaluate(() => window.LoveUI.act({ type: 'ROLL', p: 0, dice: [1, 2] }));
  await settle();
  await page.evaluate(() => {
    const S = window.LoveUI.App.S;
    if (S.queue.length) window.LoveUI.act(window.LoveUI.fallbackAction(S, 0));
  });
  await settle();
  await page.evaluate(() => {
    const S = window.LoveUI.App.S;
    if (!S.queue.length && S.turn.p === 0) window.LoveUI.act({ type: 'END_TURN', p: 0 });
  });
  await page.waitForSelector('#drawOv', { state: 'detached', timeout: 8000 }).catch(() => page.$eval('#drawGo', e => e.click()));
  await page
    .waitForFunction(() => window.LoveUI.App.S.turn.p === 0 && window.LoveUI.App.S.round >= 2, null, { timeout: 15000 })
    .catch(() => {});
  ok(
    'undian: aksi pemain selama undian tidak membuat bot macet',
    await page.evaluate(() => window.LoveUI.App.S.round >= 2 && !window.LoveUI.App.revealing),
    await page.evaluate(() =>
      JSON.stringify({ r: window.LoveUI.App.S.round, t: window.LoveUI.App.S.turn.p, rev: window.LoveUI.App.revealing })
    )
  );
  // pemain terburu-buru: ketuk papan saat masih muncul → langsung undian (ketukan tidak membuka info petak),
  // sekali "Lewati" → langsung main
  await page.evaluate(() => {
    const E = window.LoveEngine;
    let S,
      sd = 1;
    do {
      S = E.create({
        players: [
          { name: 'Arfi', avatar: '🐻' },
          { name: 'Nadia', avatar: '🐰' },
        ],
        settings: { debug: true },
        seed: sd++,
        first: 'random',
      });
    } while (S.turn.p !== 0);
    window.LoveUI.enterGame('local', -1, S);
  });
  const tq0 = Date.now();
  await page.waitForTimeout(200);
  await page.$eval('#board .tile', e => e.click());
  await page.waitForSelector('#drawOv', { timeout: 3000 });
  const tqDraw = Date.now() - tq0;
  const tqModal = !!(await page.$('#modalRoot:not([hidden]) .modal'));
  await page.$eval('#drawGo', e => e.click());
  await page.waitForSelector('#cRoll', { timeout: 5000 }).catch(() => {});
  const tqRoll = Date.now() - tq0;
  ok(
    'undian cepat: ketuk papan saat muncul → undian, sekali Lewati → bisa melempar',
    tqDraw < 1000 && !tqModal && !!(await page.$('#cRoll')) && tqRoll < 3500,
    JSON.stringify({ undian: tqDraw, infoPetak: tqModal, lempar: tqRoll })
  );

  // 26. Paspor Cinta: muncul saat pertama kali, terbit, mengisi Pemain 1, mencatat hasil game
  await page.evaluate(() => {
    sessionStorage.setItem('passTest', '1');
    localStorage.removeItem('loveopoly.v1.profile');
    localStorage.removeItem('loveopoly.v2.save');
  });
  await page.reload();
  await page.waitForSelector('#passOv #ppOpen', { timeout: 6000 });
  ok('paspor: muncul saat pertama kali membuka game', true);
  await page.click('#ppOpen');
  await page.waitForSelector('#ppName', { state: 'visible' });
  ok('paspor: tombol terbit nonaktif sebelum nama diisi', await page.$eval('#ppGo', b => b.disabled));
  await page.fill('#ppName', 'Arfi');
  await page.click('[data-ppav="🦊"]');
  await page.click('#ppGo');
  await page.waitForSelector('#passOv', { state: 'detached', timeout: 5000 });
  const pp = await page.evaluate(() => JSON.parse(localStorage.getItem('loveopoly.v1.profile')));
  ok(
    'paspor: tersimpan & kartu paspor tampil di beranda',
    pp.name === 'Arfi' && pp.avatar === '🦊' && /Halo, Arfi/.test(await page.textContent('#hPass')),
    JSON.stringify(pp)
  );
  await page.click('#hAI');
  await page.waitForSelector('#pn0');
  ok('paspor: Pemain 1 di setup terisi dari paspor', (await page.inputValue('#pn0')) === 'Arfi');
  await page.evaluate(() => {
    const E = window.LoveEngine;
    const S = E.create({
      players: [
        { name: 'Arfi', avatar: '🦊' },
        { name: 'Bot', kind: 'ai' },
      ],
      settings: { debug: true },
      seed: 77,
    });
    S.tiles[1].owner = 0;
    S.tiles[2].owner = 0;
    window.LoveUI.enterGame('local', -1, S);
    window.LoveUI.act({ type: 'FINISH_NOW', p: 0 });
  });
  await page
    .waitForFunction(() => (JSON.parse(localStorage.getItem('loveopoly.v1.profile')) || {}).games === 1, null, { timeout: 10000 })
    .catch(() => {});
  const pp2 = await page.evaluate(() => JSON.parse(localStorage.getItem('loveopoly.v1.profile')));
  ok(
    'paspor: hasil game tercatat (main, menang, cap kota)',
    pp2.games === 1 && pp2.wins === 1 && pp2.stamps.length === 2,
    JSON.stringify({ g: pp2.games, w: pp2.wins, st: pp2.stamps })
  );
  // pesan romantis: diisi sekali di paspor, tidak ada lagi di setup, tampil di layar menang dengan nama penulis
  await page.evaluate(() => window.LoveUI.exitToHome(true));
  await page.waitForTimeout(200);
  await page.click('#hPass');
  await page.waitForSelector('#ppMsg', { state: 'visible', timeout: 6000 });
  await page.fill('#ppMsg', 'Sampai ketemu di Kyoto, sayang!');
  await page.click('#ppGo');
  await page.waitForSelector('#passOv', { state: 'detached', timeout: 5000 });
  ok(
    'pesan romantis: tersimpan di paspor',
    (await page.evaluate(() => JSON.parse(localStorage.getItem('loveopoly.v1.profile')).msg)) === 'Sampai ketemu di Kyoto, sayang!'
  );
  await page.click('#hLocal');
  await page.waitForSelector('#sStart');
  ok('pesan romantis: field lama di setup sudah dihapus', !(await page.$('#sMsg')));
  await page.$eval('#sStart', b => b.click());
  await page
    .waitForFunction(() => window.LoveUI.App.S && window.LoveUI.App.S.players.some(p => p.msg), null, { timeout: 5000 })
    .catch(() => {});
  await page.evaluate(() => {
    const UI = window.LoveUI,
      S = UI.App.S;
    const me = S.players.findIndex(p => p.msg);
    const other = me === 0 ? 1 : 0;
    S.queue = [];
    S.turn.p = other;
    S.turn.rolled = false;
    S.players[other].cash = 99999;
    UI.act({ type: 'FINISH_NOW', p: other });
  });
  await page.waitForSelector('#winOv', { timeout: 8000 }).catch(() => {});
  const wm = await page.evaluate(() => ({
    msg: (document.getElementById('winMsg') || {}).textContent || '',
    edit: !!document.getElementById('winMsgIn'),
  }));
  ok(
    'pesan romantis: tampil di layar menang (walau pasangan yang menang) + nama penulis, tanpa editor',
    /Sampai ketemu di Kyoto, sayang!/.test(wm.msg) && /Arfi/.test(wm.msg) && !wm.edit,
    JSON.stringify(wm)
  );

  // Kartu Kenangan: dari layar menang → gambar 1080×1920 siap disimpan/dibagikan, Escape menutup
  await page.$eval('#wShare', b => b.click());
  await page.waitForSelector('#memOv .mem-prev img', { timeout: 15000 }).catch(() => {});
  const mem = await page.evaluate(async () => {
    const img = document.querySelector('#memOv .mem-prev img');
    if (!img) return { img: false, note: (document.querySelector('#memOv .mem-prev') || {}).textContent };
    await img.decode().catch(() => {});
    const blob = await (await fetch(img.src)).blob();
    return {
      img: true,
      w: img.naturalWidth,
      h: img.naturalHeight,
      kb: Math.round(blob.size / 1024),
      type: blob.type,
      alt: img.alt,
      save: !document.getElementById('memSave').disabled,
    };
  });
  ok(
    'Kartu Kenangan: gambar Story 1080×1920 dibuat dari layar menang',
    mem.img && mem.w === 1080 && mem.h === 1920 && mem.type === 'image/jpeg' && mem.kb > 30 && /Kartu Kenangan/.test(mem.alt) && mem.save,
    JSON.stringify(mem)
  );
  // kartu pribadi: bawaannya pemegang paspor (Arfi, kalah) dengan peringkatnya sendiri; bisa diganti ke pemain lain
  const who = await page.evaluate(() =>
    [...document.querySelectorAll('#memOv [data-mp]')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed'))
  );
  ok(
    'Kartu Kenangan pribadi: bawaan pemegang paspor dengan peringkatnya, ada pilihan pemain',
    /^Kartu Kenangan Arfi: peringkat 2 dari 2/.test(mem.alt) && who.length === 2 && who.some(w => w.endsWith('Arfi:true')),
    mem.alt.slice(0, 60) + ' · ' + who.join(', ')
  );
  await page.$eval('#memOv [data-mp]:not([aria-pressed="true"])', b => b.click());
  await page
    .waitForFunction(() => /: juara/.test((document.querySelector('#memOv .mem-prev img') || {}).alt || ''), null, { timeout: 15000 })
    .catch(() => {});
  const alt2 = await page.evaluate(() => (document.querySelector('#memOv .mem-prev img') || {}).alt || '');
  ok(
    'Kartu Kenangan pribadi: ganti pemain → kartu sang juara',
    /: juara/.test(alt2) && !/Arfi/.test(alt2.split(':')[0]),
    alt2.slice(0, 60)
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(450);
  ok('Kartu Kenangan: Escape menutup pratinjau', !(await page.$('#memOv')) && !!(await page.$('#winOv')));

  // Pasang Aplikasi: tombol di menu beranda muncul saat browser menawarkan pemasangan (beforeinstallprompt)
  await page.evaluate(() => window.LoveUI.exitToHome(true));
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => {
      window.__installPrompted = true;
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.$eval('#hMenu', b => b.click());
  await page.waitForSelector('#modalRoot #mInstall', { timeout: 4000 }).catch(() => {});
  const hasInstall = !!(await page.$('#modalRoot #mInstall'));
  if (hasInstall) await page.$eval('#modalRoot #mInstall', b => b.click());
  await page.waitForTimeout(400);
  const inst = await page.evaluate(() => ({
    prompted: !!window.__installPrompted,
    toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '),
  }));
  ok(
    'Pasang Aplikasi: tombol menu memanggil dialog pasang browser',
    hasInstall && inst.prompted && /layar utama/.test(inst.toast),
    JSON.stringify(inst).slice(0, 160)
  );

  // Progres Paspor: Jam Terbang (XP & level), Api Cinta mingguan + Payung Rindu, lencana, layar perayaan, Merpi kangen
  const weekNow = () =>
    page.evaluate(() => {
      const d = new Date();
      return Math.floor((Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) + 3) / 7);
    });
  const prof = () => page.evaluate(() => JSON.parse(localStorage.getItem('loveopoly.v1.profile')));
  await page.evaluate(() => window.LoveUI.exitToHome(true));
  await page.evaluate(() =>
    localStorage.setItem(
      'loveopoly.v1.profile',
      JSON.stringify({ name: 'Arfi', avatar: '🦊', color: '#FF4F8B', since: 1, games: 4, wins: 2, stamps: [], xp: 50, life: { ch: 9 } })
    )
  );
  await page.evaluate(() => {
    const E = window.LoveEngine;
    const S = E.create({
      players: [
        { name: 'Arfi', avatar: '🦊' },
        { name: 'Bot', kind: 'ai' },
      ],
      settings: { debug: true },
      seed: 91,
    });
    S.tiles[1].owner = 0;
    S.tiles[2].owner = 0;
    S.players[0].stats.challenges = 2;
    window.LoveUI.enterGame('local', -1, S);
    window.LoveUI.act({ type: 'FINISH_NOW', p: 0 });
  });
  await page.waitForSelector('#winOv .panel.jt', { timeout: 8000 }).catch(() => {});
  const jt = await page.evaluate(() => ({
    panel: (document.querySelector('#winOv .panel.jt') || {}).textContent || '',
    winner: window.LoveUI.App.S.over.winner,
  }));
  const pr1 = await prof();
  ok(
    'Jam Terbang: game selesai → +80 XP (selesai, menang, 2 tantangan, 2 cap, Api Cinta) & naik ke Lv 2',
    jt.winner === 0 && /\+80 XP/.test(jt.panel) && /Naik ke Lv 2/.test(jt.panel) && pr1.xp === 130,
    JSON.stringify({ xp: pr1.xp, panel: jt.panel.slice(0, 160) })
  );
  ok(
    'Api Cinta & lencana: minggu ini tercatat, catatan seumur hidup bertambah, lencana baru di panel',
    pr1.wk.n === 1 &&
      pr1.wk.last === (await weekNow()) &&
      pr1.life.ch === 11 &&
      pr1.games === 5 &&
      /Teman Setia/.test(jt.panel) &&
      /Bucin Totalitas/.test(jt.panel),
    JSON.stringify({ wk: pr1.wk, life: pr1.life })
  );
  const yr1 = (pr1.yr || {})[String(new Date().getFullYear())] || {};
  ok(
    'rekap tahunan: game selesai tercatat (main, menang, mode AI, cara menang, 2 kota, tanpa lawan manusia)',
    yr1.g === 1 &&
      yr1.w === 1 &&
      yr1.md &&
      yr1.md.ai === 1 &&
      yr1.city &&
      yr1.city[1] === 1 &&
      yr1.city[2] === 1 &&
      Object.keys(yr1.vs || {}).length === 0,
    JSON.stringify(yr1).slice(0, 200)
  );
  await page.waitForSelector('#celebOv', { timeout: 3000 }).catch(() => {});
  const cb = await page.evaluate(() => (document.querySelector('#celebOv') || {}).textContent || '');
  ok(
    'layar perayaan: naik level + lencana baru tampil di atas layar menang',
    /Naik level/.test(cb) && /Lv 2/.test(cb) && /Sang Juara/.test(cb),
    cb.slice(0, 160)
  );
  await page.click('#celebOv');
  await page.waitForTimeout(450);
  ok(
    'layar perayaan: ketukan menutupnya tanpa mengenai tombol layar menang',
    !(await page.$('#celebOv')) && !!(await page.$('#winOv')),
    JSON.stringify({ celeb: !!(await page.$('#celebOv')), win: !!(await page.$('#winOv')) })
  );
  ok(
    'Jam Terbang: game yang sama tidak dicatat dua kali',
    (await page.evaluate(
      () => window.LoveUI.recordPassport(window.LoveUI.App.S) && JSON.parse(localStorage.getItem('loveopoly.v1.profile')).xp
    )) === 130
  );
  // Api Cinta di tengah game: minggu lalu terakhir main → game baru mencapai ronde 3 → 4 minggu beruntun + Payung Rindu
  const wNow = await weekNow();
  await page.evaluate(w => {
    const p = JSON.parse(localStorage.getItem('loveopoly.v1.profile'));
    p.wk = { n: 3, last: w - 1, best: 3, umb: 0 };
    localStorage.setItem('loveopoly.v1.profile', JSON.stringify(p));
  }, wNow);
  await newGame('S.round = 3;', null, [
    { name: 'Arfi', avatar: '🦊' },
    { name: 'Nadia', avatar: '🐰' },
  ]);
  await page.waitForTimeout(300);
  const toastTxt = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join(' | '));
  const pr2 = await prof();
  ok(
    'Api Cinta: ronde 3 → minggu ini tercatat (4 minggu) + dapat Payung Rindu + 10 XP, dengan kabar',
    pr2.wk.n === 4 && pr2.wk.umb === 1 && pr2.xp === 140 && /4 minggu/.test(toastTxt) && /Payung Rindu/.test(toastTxt),
    JSON.stringify({ wk: pr2.wk, xp: pr2.xp, toast: toastTxt.slice(0, 160) })
  );
  await page.evaluate(() => window.LoveUI.exitToHome(true));
  await page.waitForTimeout(200);
  const card = await page.textContent('#hPass');
  ok(
    'beranda: kartu paspor menampilkan Api Cinta, level & status minggu ini',
    /4\s*minggu/.test(card) && /Lv\s*2/.test(card) && /Minggu ini aman/.test(card),
    card.slice(0, 200)
  );
  // bar XP: beranda digambar ulang (banyak interaksi) tanpa perubahan XP → tidak mengisi ulang dari 0
  await page.evaluate(() => window.LoveUI.renderHome());
  const bar = await page.evaluate(() => {
    const i = document.querySelector('#hPass .pc-xp i');
    return { fill: i.parentElement.classList.contains('fill'), anim: i.getAnimations().length };
  });
  ok(
    'bar XP: beranda digambar ulang tanpa perubahan XP → bar diam (tidak mulai lagi dari 0)',
    !bar.fill && bar.anim === 0,
    JSON.stringify(bar)
  );
  // Main lagi cepat: setelan game lokal terakhir di beranda → satu ketukan mulai game dengan pemain & aturan yang sama
  await page.evaluate(() => {
    localStorage.removeItem('loveopoly.v2.save');
    localStorage.setItem(
      'loveopoly.v2.last',
      JSON.stringify({
        t: Date.now(),
        players: [
          { name: 'Arfi', avatar: '🦊', color: '#FF4F8B', kind: 'human', ai: 'normal' },
          { name: 'Mia', avatar: '🐰', color: '#7B61FF', kind: 'ai', ai: 'hard' },
        ],
        settings: { startCash: 3000, roundLimit: 15, takeover: false, instantWin: true, diceControl: true },
      })
    );
    window.LoveUI.renderHome();
  });
  const qTxt = await page.evaluate(() => (document.querySelector('#scrHome .quick-card') || {}).textContent || '');
  ok(
    'Main lagi: kartu beranda menampilkan pemain & durasi terakhir',
    /Main lagi/.test(qTxt) && /Arfi vs 🐰 Mia \(Hard\)/.test(qTxt) && /15 ronde/.test(qTxt),
    qTxt
  );
  await page.click('#hQuick');
  await page.waitForSelector('#scrGame:not([hidden])', { timeout: 6000 }).catch(() => {});
  const qS = await page.evaluate(() => {
    const S = window.LoveUI.App.S;
    return {
      names: S.players.map(p => p.name + ':' + p.kind + ':' + (p.ai || '')),
      st: S.settings,
      round: S.round,
      mode: window.LoveUI.App.mode,
    };
  });
  ok(
    'Main lagi: satu ketukan → game baru dengan pemain, level AI & aturan yang sama',
    qS.mode === 'local' &&
      qS.round === 1 &&
      qS.names.join() === 'Arfi:human:normal,Mia:ai:hard' &&
      qS.st.startCash === 3000 &&
      qS.st.roundLimit === 15 &&
      qS.st.takeover === false,
    JSON.stringify(qS).slice(0, 200)
  );
  await page.evaluate(() => {
    window.LoveUI.exitToHome(true);
    localStorage.removeItem('loveopoly.v2.save');
    window.LoveUI.renderHome();
  });
  await page.click('#hQuickEdit');
  await page.waitForSelector('#scrSetup:not([hidden])', { timeout: 4000 }).catch(() => {});
  const qSet = await page.evaluate(() => ({
    title: (document.querySelector('#scrSetup h2') || {}).textContent,
    names: [...document.querySelectorAll('#scrSetup input[id^="pn"]')].map(i => i.value),
    rounds: (document.querySelector('[data-seg="rounds"] [aria-pressed="true"]') || {}).textContent,
  }));
  ok(
    'Main lagi: tombol Ubah membuka setup terisi setelan terakhir',
    qSet.title === 'Lawan AI' && qSet.names.join() === 'Arfi,Mia' && /15/.test(qSet.rounds || ''),
    JSON.stringify(qSet)
  );
  const momT = await page.evaluate(() => {
    const before = document.querySelector('#sMoment').getAttribute('aria-checked');
    document.querySelector('#sMoment').click();
    return [before, document.querySelector('#sMoment').getAttribute('aria-checked')];
  });
  ok('setup: sakelar Momen Berdua (bawaan nyala, bisa dimatikan)', momT[0] === 'true' && momT[1] === 'false', JSON.stringify(momT));
  await page.click('#sBack');
  await page.evaluate(() => {
    localStorage.setItem('loveopoly.v2.last', JSON.stringify({ players: [{ name: 'X', avatar: '<b>', color: 'red' }] }));
    window.LoveUI.renderHome();
  });
  ok('Main lagi: setelan rusak → kartu tidak muncul', !(await page.$('#scrHome .quick-card')));
  // transisi layar: kartu mode → setup: isi naik + judul kartu terbang (salinan .title-fly), layar baru langsung bisa
  // diketuk (dulu View Transitions menelan ketukan ±0,45 dtk), semuanya bersih sesudahnya
  await page.click('#hAI');
  const fl1 = await page.evaluate(
    () =>
      new Promise(r =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            r({
              ghost: document.querySelectorAll('.title-fly').length,
              anim: /scr-(in|pre)/.test(document.querySelector('#scrSetup').className),
              text: (document.querySelector('.title-fly') || {}).textContent || '',
            })
          )
        )
      )
  );
  // ketukan cepat di tengah transisi tetap mengenai layar baru (pilih durasi Singkat)
  await page.click('[data-seg="rounds"] [data-v="15"]', { force: true });
  const fastTap = await page.evaluate(() => (document.querySelector('[data-seg="rounds"] [aria-pressed="true"]') || {}).textContent || '');
  await page.waitForFunction(
    () => !document.querySelector('.title-fly') && !/scr-/.test(document.querySelector('#scrSetup').className),
    null,
    {
      timeout: 4000,
    }
  );
  const fl2 = await page.evaluate(() => getComputedStyle(document.querySelector('#scrSetup .setup-head h2')).opacity);
  ok(
    'transisi layar: Lawan AI → setup (judul terbang + isi naik), ketukan cepat tidak tertelan, bersih sesudahnya',
    fl1.ghost === 1 && fl1.anim && /Lawan AI/.test(fl1.text) && /15/.test(fastTap) && fl2 === '1',
    JSON.stringify({ fl1, fastTap, fl2 })
  );
  await page.click('#sBack');
  await page.waitForSelector('#scrHome:not([hidden]) #hAI', { timeout: 4000 });
  // salinan judul & kelas animasi dibuat di frame berikutnya → tunggu sampai animasi beranda benar-benar selesai
  await page.waitForFunction(
    () => !document.querySelector('.title-fly') && !/scr-/.test(document.querySelector('#scrHome').className),
    null,
    {
      timeout: 4000,
    }
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.click('#hAI');
  const vt2 = await page.evaluate(() => ({
    anim: /scr-/.test(document.querySelector('#scrSetup').className),
    ghost: document.querySelectorAll('.title-fly').length,
    shown: !document.querySelector('#scrSetup').hidden,
  }));
  await page.emulateMedia({ reducedMotion: null });
  ok('transisi layar: gerak dikurangi → pindah langsung tanpa animasi', !vt2.anim && !vt2.ghost && vt2.shown, JSON.stringify(vt2));
  await page.click('#sBack');
  await page.waitForSelector('#scrHome:not([hidden]) #hAI', { timeout: 4000 });
  await page.click('#hPass');
  await page.waitForSelector('#passOv .pp-prog', { timeout: 6000 }).catch(() => {});
  const ppTxt = await page.evaluate(() => (document.querySelector('#passOv .pp-prog') || {}).textContent || '');
  ok(
    'paspor: halaman Jam Terbang & lencana (tingkat + progres)',
    /Api Cinta 4 minggu/.test(ppTxt) && /Teman Setia/.test(ppTxt) && /Perunggu/.test(ppTxt),
    ppTxt.slice(0, 200)
  );
  await page.evaluate(() => document.querySelector('#ppCancel') && document.querySelector('#ppCancel').click());
  await page.waitForSelector('#passOv', { state: 'detached', timeout: 5000 }).catch(() => {});
  // Merpi kangen: 9 hari tidak membuka (terakhir main minggu lalu) → pesan sekali di beranda + status Api Cinta,
  // bisa ditutup; kunjungan tercatat
  await page.evaluate(w => {
    const p = JSON.parse(localStorage.getItem('loveopoly.v1.profile'));
    p.seen = Date.now() - 9 * 864e5;
    p.wk = { n: 4, last: w - 1, best: 4, umb: 1 };
    localStorage.setItem('loveopoly.v1.profile', JSON.stringify(p));
  }, wNow);
  await page.reload();
  await page.waitForSelector('#hLocal');
  const note = await page.evaluate(() => (document.querySelector('#scrHome .merpi-note') || {}).textContent || '');
  const seenNow = (await prof()).seen > Date.now() - 60000;
  ok(
    'Merpi kangen: setelah 9 hari muncul pesan rindu + status Api Cinta, kunjungan tercatat',
    /9 hari/.test(note) && /Api Cinta/.test(note) && seenNow,
    note
  );
  await page.click('#hKangenX');
  await page.waitForTimeout(350);
  ok('Merpi kangen: bisa ditutup', !(await page.$('#scrHome .merpi-note')));

  // Tema papan (hadiah Jam Terbang): terkunci sesuai level, hanya mewarnai area permainan, tersimpan
  const setXp = xp =>
    page.evaluate(xp => {
      const p = JSON.parse(localStorage.getItem('loveopoly.v1.profile'));
      p.xp = xp;
      localStorage.setItem('loveopoly.v1.profile', JSON.stringify(p));
    }, xp);
  await setXp(600); // Lv 5
  await page.evaluate(() => window.LoveUI.openSettings());
  await page.waitForSelector('#modalRoot .bt-grid');
  const bts = await page.evaluate(() =>
    [...document.querySelectorAll('#modalRoot [data-board]')].map(b => b.dataset.board + ':' + (b.disabled ? 'kunci' : 'buka')).join(',')
  );
  ok(
    'tema papan: di Lv 5 Klasik, Senja Bali & Paris Malam terbuka, Sakura Kyoto terkunci',
    bts === 'klasik:buka,bali:buka,paris:buka,kyoto:kunci',
    bts
  );
  await page.$eval('#modalRoot [data-board="paris"]', b => b.click());
  await page.evaluate(() => window.LoveUI.closeModal(true));
  await newGame('');
  const thm = await page.evaluate(() => ({
    attr: document.documentElement.dataset.board,
    game: getComputedStyle(document.getElementById('game')).getPropertyValue('--board').trim(),
    root: getComputedStyle(document.documentElement).getPropertyValue('--board').trim(),
    saved: JSON.parse(localStorage.getItem('loveopoly.v1.prefs')).board,
  }));
  ok(
    'tema papan: Paris Malam terpasang di papan saja (token di .game, bukan root/dialog) & tersimpan',
    thm.attr === 'paris' && thm.saved === 'paris' && thm.game.toLowerCase() === '#e4e8f6' && thm.game !== thm.root,
    JSON.stringify(thm)
  );
  await setXp(0);
  await page.evaluate(() => window.LoveUI.applyTheme());
  ok(
    'tema papan: tema yang belum terbuka di level sekarang tidak dipakai (kembali Klasik)',
    await page.evaluate(() => !document.documentElement.dataset.board)
  );
  // Kartu Kenangan Edisi Emas: kartu pemegang paspor Lv 5+ berbingkai emas; kartu pemain lain di HP yang sama tidak
  await setXp(700);
  await page.evaluate(() => {
    window.LoveUI.App.prefs.board = 'klasik';
    window.LoveUI.applyTheme();
    const E = window.LoveEngine;
    const S = E.create({
      players: [
        { name: 'Arfi', avatar: '🦊' },
        { name: 'Nadia', avatar: '🐰' },
      ],
      settings: { debug: true },
      seed: 93,
    });
    S.tiles[1].owner = 0;
    window.LoveUI.enterGame('local', -1, S);
    window.LoveUI.act({ type: 'FINISH_NOW', p: 0 });
  });
  await page.waitForSelector('#winOv #wShare', { timeout: 8000 });
  await page.waitForSelector('#celebOv', { state: 'detached', timeout: 6000 }).catch(() => {});
  await page.$eval('#wShare', b => b.click());
  await page.waitForSelector('#memOv .mem-prev img', { timeout: 15000 });
  const goldMe = await page.evaluate(() => !document.getElementById('memGold').hidden);
  await page.$eval('#memOv [data-mp="1"]', b => b.click());
  await page.waitForFunction(() => /Nadia/.test((document.querySelector('#memOv .mem-prev img') || {}).alt || ''), null, {
    timeout: 15000,
  });
  const goldOther = await page.evaluate(() => !document.getElementById('memGold').hidden);
  ok(
    'Kartu Kenangan Edisi Emas: kartu pemegang paspor Lv 5+ emas, kartu pasangan biasa',
    goldMe && !goldOther,
    JSON.stringify({ goldMe, goldOther })
  );
  await page.keyboard.press('Escape');
  await page.waitForSelector('#memOv', { state: 'detached', timeout: 5000 }).catch(() => {});
  await page.evaluate(() => window.LoveUI.exitToHome(true));

  // Hemat daya: saat diam ±12 dtk semua hiasan berulang dijeda (HP tidak terus menggambar ulang & panas), kecuali
  // latar Kabar Merpi (.sky-fx, penanda acara, hanya GPU); sentuhan membangunkan. Hiasan berulang baru wajib masuk
  // src/styles/power.css.
  await newGame("S.round = 3; S.news = { id: 'bonus', side: 'top', from: 3, to: 6 };");
  await page.waitForTimeout(12800);
  const calmSt = await page.evaluate(() => ({
    calm: document.body.classList.contains('calm'),
    running: document
      .getAnimations()
      .filter(a => a.playState === 'running')
      .map(
        a =>
          (a.animationName || a.transitionProperty) +
          '@' +
          (a.effect.target && a.effect.target.className.baseVal != null
            ? a.effect.target.className.baseVal
            : a.effect.target && a.effect.target.className)
      ),
    smilPaused: [...document.querySelectorAll('svg.cd-map')].every(s => s.animationsPaused()),
  }));
  ok(
    'hemat daya: diam ±12 dtk → hiasan dijeda, hanya latar & properti acara Kabar Merpi yang tetap bergerak',
    calmSt.calm && calmSt.running.length > 0 && calmSt.running.every(x => /sky-fx|fx-|ms-orbit|ms-peak/.test(x)) && calmSt.smilPaused,
    JSON.stringify(calmSt).slice(0, 300)
  );
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(150);
  const woke = await page.evaluate(() => ({
    calm: document.body.classList.contains('calm'),
    running: document.getAnimations().filter(a => a.playState === 'running').length,
  }));
  ok('hemat daya: sentuhan membangunkan hiasan lagi', !woke.calm && woke.running > 0, JSON.stringify(woke));
  // Hemat baterai dari Pengaturan: hiasan diam sejak awal, langkah pion tetap beranimasi
  await page.evaluate(() => window.LoveUI.openSettings());
  await page.waitForSelector('#modalRoot #sPower [data-v="save"]');
  await page.$eval('#modalRoot #sPower [data-v="save"]', b => b.click());
  await page.evaluate(() => window.LoveUI.closeModal(true));
  await page.waitForTimeout(150);
  const lowSt = await page.evaluate(() => ({
    lowp: document.body.classList.contains('lowp'),
    calm: document.body.classList.contains('calm'),
    saved: JSON.parse(localStorage.getItem('loveopoly.v1.prefs')).power,
    // hiasan berulang selain latar Kabar Merpi (.sky-fx, sengaja tetap bergerak pelan)
    loops: document
      .getAnimations()
      .filter(
        a =>
          a.playState === 'running' &&
          a.effect.getTiming().iterations === Infinity &&
          !(a.effect.target && a.effect.target.closest && a.effect.target.closest('.sky-fx'))
      ).length,
  }));
  ok(
    'Hemat baterai: Nyala tersimpan, hiasan berulang diam (kecuali latar Kabar Merpi yang pelan)',
    lowSt.lowp && lowSt.calm && lowSt.saved === 'save' && lowSt.loops === 0,
    JSON.stringify(lowSt)
  );
  await page.evaluate(() => window.LoveUI.act({ type: 'ROLL', p: 0, dice: [2, 2] }));
  const hopOk = await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .some(a => a.playState === 'running' && a.effect.target && a.effect.target.closest && a.effect.target.closest('.token.hop')),
      null,
      { timeout: 4000 }
    )
    .then(() => true)
    .catch(() => false);
  ok('Hemat baterai: pion tetap melangkah dengan animasi', hopOk);
  await settle();
  await newGame("S.round = 3; S.news = { id: 'bonus', side: 'top', from: 3, to: 6 };");
  const skyLow = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.sky-a'));
    return { lowp: document.body.classList.contains('lowp'), dur: cs.animationDuration, play: cs.animationPlayState };
  });
  ok(
    'Hemat baterai: latar Kabar Merpi tetap bergerak, 3× lebih pelan (6 dtk → 18 dtk)',
    skyLow.lowp && skyLow.dur === '18s' && skyLow.play === 'running',
    JSON.stringify(skyLow)
  );
  await page.evaluate(() => {
    window.LoveUI.App.prefs.power = 'auto';
    window.LoveUI.savePrefs();
    window.LoveUI.wakeCalm();
  });
  ok(
    'Hemat baterai otomatis: tanda "HP berat" lama (prefs.powerSlow) tidak dipakai lagi, diukur ulang tiap sesi',
    await page.evaluate(() => {
      window.LoveUI.App.prefs.powerSlow = true;
      const r = window.LoveUI.lowPower();
      delete window.LoveUI.App.prefs.powerSlow;
      return r === false;
    })
  );

  // Aplikasi terpasang di iPhone (jarak aman atas/bawah): layar game pas satu layar, tidak tergulir, kartu pemain
  // tidak masuk ke bawah header (pernah: dokumen 93 px lebih tinggi dari layar → bisa tergulir)
  {
    const sctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    const sp = await sctx.newPage();
    sp.on('pageerror', e => errors.push('iphone pageerror: ' + e.message));
    await sp.addInitScript(() => {
      localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast', autoEnd: false }));
      localStorage.setItem('loveopoly.v2.tour', '"done"');
      localStorage.setItem('loveopoly.v1.profile', JSON.stringify({ skipped: true }));
    });
    const scdp = await sctx.newCDPSession(sp);
    const insetOk = await scdp
      .send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } })
      .then(() => true)
      .catch(() => false);
    await sp.goto(URL);
    await sp.evaluate(() => {
      const E = window.LoveEngine;
      const S = E.create({
        players: [
          { name: 'Arfi', avatar: '🐻', color: '#FF4F8B' },
          { name: 'Bot Rindu', avatar: '🐰', color: '#7B61FF', kind: 'ai' },
          { name: 'Bot Manis', avatar: '🦊', color: '#FF8A3D', kind: 'ai' },
          { name: 'Bot Ceria', avatar: '🐱', color: '#FFC93C', kind: 'ai' },
        ],
        settings: { debug: true, roundLimit: 15 },
        seed: 21,
      });
      window.LoveUI.enterGame('local', -1, S);
    });
    await sp.waitForTimeout(1500);
    await sp.evaluate(() => window.scrollTo(0, 80));
    await sp.waitForTimeout(150);
    const lay = await sp.evaluate(() => {
      const card = document.querySelector('#strip .pcard, #strip > *');
      return {
        inset: getComputedStyle(document.documentElement).paddingTop,
        extra: document.documentElement.scrollHeight - innerHeight,
        scrollY: Math.round(scrollY),
        hdr: Math.round(document.querySelector('.hdr').getBoundingClientRect().bottom),
        card: card ? Math.round(card.getBoundingClientRect().top) : null,
      };
    });
    ok(
      'iPhone terpasang: layar game tidak tergulir, kartu pemain di bawah header',
      insetOk && lay.inset === '59px' && lay.extra <= 0 && lay.scrollY === 0 && lay.card !== null && lay.card >= lay.hdr,
      JSON.stringify(lay)
    );
    // Getar halus: hanya aksi pemain sendiri di layar sentuh (navigator.vibrate dipantau), mati di Hemat baterai
    await sp.evaluate(() => {
      window.__vib = [];
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: p => {
          window.__vib.push(p);
          return true;
        },
      });
    });
    await sp.$eval('#cRoll', b => b.click());
    await sp.waitForTimeout(200);
    const vib1 = await sp.evaluate(() => window.__vib.slice());
    await sp.evaluate(() => {
      window.__vib = [];
      window.LoveUI.App.prefs.power = 'save';
      window.LoveUI.wakeCalm();
      window.LoveUI.buzz('dice');
    });
    const vib2 = await sp.evaluate(() => window.__vib.length);
    ok(
      'getar halus: lempar dadu sendiri → getar singkat, Hemat baterai → tidak',
      vib1.length === 1 && vib1[0] === 14 && vib2 === 0,
      JSON.stringify({ vib1, vib2 })
    );
    await sctx.close();
  }

  // Cadangan Paspor: HP lama → tautan #pulihkan=… → HP baru (konfirmasi) → progres & tema kembali; tempel di Paspor;
  // HP yang sudah punya paspor lain diberi peringatan; persetujuan statistik tidak ikut
  {
    const dev = async (prof, prefs) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      p.on('pageerror', e => errors.push('cadangan pageerror: ' + e.message));
      p.on('console', m => m.type() === 'error' && errors.push('cadangan console: ' + m.text()));
      await p.addInitScript(
        ([pr, ps]) => {
          if (sessionStorage.getItem('bk')) return;
          sessionStorage.setItem('bk', '1');
          localStorage.setItem('loveopoly.v1.prefs', JSON.stringify(Object.assign({ sound: false, speed: 'fast' }, ps || {})));
          localStorage.setItem('loveopoly.v2.tour', '"done"');
          if (pr) localStorage.setItem('loveopoly.v1.profile', JSON.stringify(pr));
        },
        [prof, prefs]
      );
      return { ctx, p };
    };
    // HP lama: tema Paris Malam, gelap, statistik dinyalakan → yang ikut cadangan hanya tampilan, bukan persetujuan statistik
    const OLD = await dev(
      {
        name: 'Arfi',
        avatar: '🦊',
        since: 77,
        games: 9,
        wins: 4,
        stamps: [1, 2, 9],
        xp: 700,
        wk: { n: 3, last: 1, best: 5, umb: 1 },
        seen: Date.now(),
      },
      { board: 'paris', theme: 'dark', analytics: true }
    );
    await OLD.p.goto(URL);
    // Simpan Paspor di HP: tombol di paling bawah → halaman digulir ke cap "DISETUJUI" dulu, baru dicap, lalu tutup
    await OLD.p.click('#hPass');
    await OLD.p.waitForSelector('#ppGo', { state: 'visible', timeout: 6000 });
    await OLD.p.waitForTimeout(900);
    await OLD.p.$eval('#ppGo', b => b.scrollIntoView({ block: 'end' }));
    const stampAway = await OLD.p.$eval('.pp-stamp', e => e.getBoundingClientRect().bottom < 0);
    // seperti iPhone: Safari tidak memindahkan fokus ke tombol saat diketuk → kolom nama masih fokus (keyboard terbuka)
    await OLD.p.focus('#ppName');
    await OLD.p.$eval('#ppForm', f => f.requestSubmit());
    await OLD.p.waitForSelector('.pp-book.done', { timeout: 4000 });
    const stampSeen = await OLD.p.$eval('.pp-stamp', e => {
      const r = e.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    });
    await OLD.p.waitForTimeout(380);
    const stamper = await OLD.p.evaluate(() => {
      const el = document.querySelector('#passOv .pp-stamper'),
        r = el.getBoundingClientRect();
      return {
        op: +getComputedStyle(el).opacity,
        inView: r.bottom > 0 && r.top < innerHeight && r.width > 60,
        typing: /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || ''),
      };
    });
    await OLD.p.waitForSelector('#passOv', { state: 'detached', timeout: 5000 });
    ok(
      'Simpan Paspor di HP (keyboard masih terbuka): keyboard ditutup, gulir ke cap DISETUJUI, stempel karet terlihat menekan, lalu tutup',
      stampAway && stampSeen && stamper.op > 0.5 && stamper.inView && !stamper.typing,
      JSON.stringify({ stampAway, stampSeen, stamper })
    );
    // gerak dikurangi: tanpa stempel karet, cap langsung tampil dan paspor cukup lama terbuka untuk terlihat
    await OLD.p.emulateMedia({ reducedMotion: 'reduce' });
    await OLD.p.click('#hPass');
    await OLD.p.waitForSelector('#ppGo', { state: 'visible', timeout: 6000 });
    await OLD.p.waitForTimeout(400);
    await OLD.p.$eval('#ppForm', f => f.requestSubmit());
    await OLD.p.waitForTimeout(700);
    const rmStamp = await OLD.p.evaluate(() => {
      const c = document.querySelector('#passOv .pp-stamp');
      return { open: !!document.querySelector('#passOv'), op: c ? +getComputedStyle(c).opacity : 0 };
    });
    await OLD.p.waitForSelector('#passOv', { state: 'detached', timeout: 4000 });
    await OLD.p.emulateMedia({ reducedMotion: null });
    ok(
      'Simpan Paspor (gerak dikurangi): cap langsung tampil & paspor masih terbuka ±1 dtk',
      rmStamp.open && rmStamp.op > 0.8,
      JSON.stringify(rmStamp)
    );
    // cadangan sekarang di Pengaturan → Cadangan Paspor (buku paspor tetap ringkas)
    await OLD.p.evaluate(() => window.LoveUI.openSettings());
    await OLD.p.waitForSelector('#modalRoot #sBackupWa', { state: 'attached', timeout: 6000 });
    const inBook = await OLD.p.evaluate(() => !!document.querySelector('#passOv #ppBackupWa, #passOv #ppRestoreIn'));
    const bkHref = await OLD.p.$eval('#modalRoot #sBackupWa', a => a.href);
    ok('cadangan ada di Pengaturan, bukan di buku paspor', !inBook && /#pulihkan=/.test(decodeURIComponent(bkHref)));
    const bkLink = decodeURIComponent(bkHref.split('text=')[1])
      .split(' ')
      .pop()
      .replace(/^https?:\/\/[^/]+\//, URL);
    await OLD.ctx.close();
    const NEW = await dev(null);
    await NEW.p.goto(bkLink);
    await NEW.p.waitForSelector('#modalRoot #bkYes', { timeout: 6000 });
    const sum = (await NEW.p.textContent('#modalRoot .modal')).replace(/\s+/g, ' ');
    const passOv = !!(await NEW.p.$('#passOv'));
    await NEW.p.click('#modalRoot #bkYes');
    await NEW.p.waitForTimeout(400);
    const got = await NEW.p.evaluate(() => ({
      p: JSON.parse(localStorage.getItem('loveopoly.v1.profile')),
      prefs: JSON.parse(localStorage.getItem('loveopoly.v1.prefs')),
      board: document.documentElement.dataset.board,
      card: (document.getElementById('hPass') || {}).textContent || '',
      hash: location.hash,
    }));
    ok(
      'cadangan: tautan dari HP lama → HP baru → konfirmasi → paspor, Jam Terbang, Api Cinta & tema kembali',
      /Arfi/.test(sum) &&
        /Lv 5/.test(sum) &&
        !passOv &&
        got.p.name === 'Arfi' &&
        got.p.xp === 700 &&
        got.p.wk.best === 5 &&
        got.p.stamps.length === 3 &&
        got.board === 'paris' &&
        /Halo, Arfi/.test(got.card) &&
        got.hash === '',
      JSON.stringify({ sum: sum.slice(0, 90), xp: got.p.xp, board: got.board })
    );
    ok(
      'cadangan: persetujuan statistik tidak ikut dipulihkan',
      got.prefs.analytics === undefined || got.prefs.analytics === null,
      JSON.stringify(got.prefs)
    );
    await NEW.ctx.close();
    const OTHER = await dev({ name: 'Nadia', since: 5, games: 3, xp: 200, seen: Date.now() });
    await OTHER.p.goto(URL);
    await OTHER.p.evaluate(() => window.LoveUI.openSettings());
    await OTHER.p.waitForSelector('#sRestoreIn', { state: 'visible', timeout: 6000 });
    await OTHER.p.fill('#sRestoreIn', 'bukan tautan');
    await OTHER.p.click('#sRestoreGo');
    await OTHER.p.waitForTimeout(250);
    const badMsg = /tidak dikenali/.test(await OTHER.p.textContent('#toasts'));
    await OTHER.p.fill('#sRestoreIn', bkLink);
    await OTHER.p.press('#sRestoreIn', 'Enter');
    await OTHER.p.waitForSelector('#modalRoot #bkYes', { timeout: 6000 });
    const warn = (await OTHER.p.textContent('#modalRoot .modal')).replace(/\s+/g, ' ');
    await OTHER.p.click('#modalRoot #bkNo');
    await OTHER.p.waitForTimeout(300);
    const kept = await OTHER.p.evaluate(() => JSON.parse(localStorage.getItem('loveopoly.v1.profile')).name);
    ok(
      'cadangan: tempel di Pengaturan (tautan salah ditolak), HP dengan paspor lain diberi peringatan, Batal tidak mengubah apa pun',
      badMsg && /Nadia, Lv 3\) akan diganti/.test(warn) && kept === 'Nadia',
      warn.slice(-170)
    );
    await OTHER.ctx.close();
  }

  // Pertanyaan Hari Ini: dua perangkat lewat tautan (#tanya=…) + satu HP bergantian + tautan rusak
  {
    const dev = async name => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      p.on('pageerror', e => errors.push(name + ' pageerror: ' + e.message));
      p.on('console', m => m.type() === 'error' && errors.push(name + ' console: ' + m.text()));
      await p.addInitScript(n => {
        if (sessionStorage.getItem('dq')) return;
        sessionStorage.setItem('dq', '1');
        localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, speed: 'fast' }));
        localStorage.setItem('loveopoly.v2.tour', '"done"');
        localStorage.setItem('loveopoly.v1.profile', JSON.stringify(n ? { name: n, xp: 50, seen: Date.now() } : { skipped: true }));
      }, name);
      return { ctx, p };
    };
    const hrefLink = async (p, sel) => {
      const href = await p.$eval(sel, a => a.href);
      return decodeURIComponent(href.split('text=')[1])
        .split(' ')
        .pop()
        .replace(/^https?:\/\/[^/]+\//, URL);
    };
    const A = await dev('Arfi'),
      B = await dev('Nadia');
    await A.p.goto(URL);
    await A.p.click('#hDaily');
    await A.p.click('[data-dqa="1"]');
    await A.p.click('[data-dqg="2"]');
    await A.p.waitForSelector('#dqWa');
    const qLink = await hrefLink(A.p, '#dqWa');
    const stA = await A.p.evaluate(() => JSON.parse(localStorage.getItem('loveopoly.v1.daily')));
    ok(
      'Pertanyaan Hari Ini: jawab & tebak → tersimpan + tautan siap dikirim',
      stA.a === 1 && stA.g === 2 && /#tanya=/.test(qLink),
      JSON.stringify(stA)
    );
    await B.p.goto(qLink);
    await B.p.waitForSelector('[data-dqa]', { timeout: 6000 });
    const bNote = await B.p.textContent('.modal');
    await B.p.click('[data-dqa="2"]');
    await B.p.click('[data-dqg="1"]');
    await B.p.waitForSelector('.dq-res');
    const bRes = (await B.p.textContent('.modal')).replace(/\s+/g, ' ');
    ok(
      'Pertanyaan Hari Ini: pasangan membuka tautan → menjawab → hasil berdua (2/2), alamat dibersihkan',
      /Arfi sudah menjawab/.test(bNote) && /cocok 2\/2/.test(bRes) && (await B.p.evaluate(() => location.hash === '')),
      bRes.slice(0, 200)
    );
    const rLink = await hrefLink(B.p, '#dqBack');
    await A.p.goto(rLink); // tab yang sama, hanya bagian # berganti → tetap terbaca (hashchange)
    await A.p.waitForSelector('.dq-res', { timeout: 6000 });
    await A.p.evaluate(() => window.LoveUI.closeModal(true));
    await A.p.evaluate(() => window.LoveUI.renderHome());
    const aCard = (await A.p.textContent('#hDaily')).replace(/\s+/g, ' ');
    const xps = [
      await A.p.evaluate(() => JSON.parse(localStorage.getItem('loveopoly.v1.profile')).xp),
      await B.p.evaluate(() => JSON.parse(localStorage.getItem('loveopoly.v1.profile')).xp),
    ];
    ok(
      'Pertanyaan Hari Ini: tautan hasil kembali ke pengirim → kartu beranda "cocok 2/2", +5 XP masing-masing',
      /cocok 2\/2/.test(aCard) && xps[0] === 55 && xps[1] === 55,
      JSON.stringify({ aCard, xps })
    );
    await A.ctx.close();
    await B.ctx.close();
    const C = await dev('');
    await C.p.goto(URL);
    await C.p.click('#hDaily');
    // tanpa paspor: pilihan langsung tercatat (dulu harus isi nama dulu → terasa "pilih dua kali"), langkah 2
    // jelas berbeda (ringkasan pilihan + tebakan), nama baru ditanya saat mengirim tautan. Teks pilihan dibaca dari
    // layar: soalnya berganti tiap hari (jangan mengunci teks soal tertentu di uji)
    const opt0 = (await C.p.textContent('[data-dqa="0"] span:last-child')).trim();
    await C.p.click('[data-dqa="0"]');
    await C.p.waitForSelector('.dq-opts.guess [data-dqg]', { timeout: 3000 });
    const step2 = (await C.p.textContent('.modal')).replace(/\s+/g, ' ');
    await C.p.click('[data-dqg="3"]');
    await C.p.waitForSelector('#dqName');
    await C.p.$eval('#dqShare', b => b.click());
    await C.p.waitForTimeout(200);
    const blocked = /Isi namamu/.test(await C.p.textContent('#toasts'));
    await C.p.fill('#dqName', 'Dimas');
    const waName = decodeURIComponent((await C.p.$eval('#dqWa', a => a.href)).split('text=')[1]);
    ok(
      'Pertanyaan Hari Ini: sekali ketuk per langkah (langkah 2 = tebakan, ringkasan pilihan), nama ditanya saat kirim',
      /Langkah 2 dari 2/.test(step2) && step2.includes('Pilihanmu: ' + opt0) && blocked && /#tanya=/.test(waName),
      step2.slice(0, 160)
    );
    await C.p.click('#dqHot');
    await C.p.fill('#dqP2', 'Sinta');
    await C.p.click('#dqP2Go');
    await C.p.click('[data-dqa="3"]');
    await C.p.click('[data-dqg="1"]');
    await C.p.waitForSelector('.dq-res');
    const cRes = (await C.p.textContent('.modal')).replace(/\s+/g, ' ');
    ok(
      'Pertanyaan Hari Ini: satu HP bergantian → hasil (1/2) dengan nama yang diisi',
      /Dimas pilih/.test(cRes) && /Sinta pilih/.test(cRes) && /cocok 1\/2/.test(cRes),
      cRes.slice(0, 160)
    );
    await C.p.goto(URL + '#tanya=bukan-tautan-asli');
    await C.p.waitForTimeout(700);
    ok('Pertanyaan Hari Ini: tautan rusak → pesan jelas, tidak membuka apa pun', /tidak valid/.test(await C.p.textContent('#toasts')));
    await C.ctx.close();
  }

  console.log(results.join('\n'));
  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log(
    '\n' +
      (results.length - fails) +
      '/' +
      results.length +
      ' lulus' +
      (errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nTanpa error konsol.')
  );
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})();
