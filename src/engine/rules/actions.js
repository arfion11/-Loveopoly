/* LOVEOPOLY — engine aturan › handler aksi permainan (dikumpulkan lewat src/engine/engine.js) */
import {
  AIM_LABEL,
  CARD,
  H,
  ISLAND,
  LEVEL_NAME,
  PL,
  RULES,
  TILES,
  TRAVEL,
  buyCost,
  buyLevels,
  cashAdd,
  clampInt,
  ev,
  fail,
  fmt,
  liquidation,
  log,
  loveAdd,
  newsOn,
  qadd,
  r5,
  rint,
  rnd,
  sellValue,
  upgradeCost,
  upgradeLevels,
} from './base.js';
import { canTakeover, offerTakeover, offerUpgrade } from './tolls.js';
import { applyFx, flyTo, land, release, sendToIsland, swapTargets, takePower, targetCandidates, walk } from './move.js';
import { chItem } from './challenges.js';
import { bankrupt, canEnd, canRoll, charge, finish, head, islandPre, nextTurn, resetTile, transfer } from './turns.js';

// ---------- handler aksi ----------
H.PAUSE = (S, a) => {
  S.paused = !S.paused;
  log(S, PL(S, a.p).name + (S.paused ? ' menjeda permainan.' : ' melanjutkan permainan.'), 'pause', a.p);
};

H.ROLL = (S, a) => {
  const i = a.p,
    p = PL(S, i);
  if (!canRoll(S, i)) fail(S.queue.length ? 'Selesaikan dulu keputusan yang ada.' : 'Kamu tidak bisa melempar dadu sekarang.');
  let d1 = 1 + rint(S, 6),
    d2 = 1 + rint(S, 6);
  const aim = S.settings.diceControl && !p.island && typeof a.aim === 'string' && RULES.aimRanges[a.aim] ? a.aim : null;
  if (aim) {
    const [lo, hi] = RULES.aimRanges[aim];
    if (rnd(S) < RULES.aimChance) {
      for (let k = 0; k < 200 && (d1 + d2 < lo || d1 + d2 > hi); k++) {
        d1 = 1 + rint(S, 6);
        d2 = 1 + rint(S, 6);
      }
    }
  }
  if (S.settings.debug && Array.isArray(a.dice) && a.dice.length === 2) {
    d1 = clampInt(a.dice[0], 1, 6);
    d2 = clampInt(a.dice[1], 1, 6);
  }
  const dbl = d1 === d2;
  const hit = !!aim && d1 + d2 >= RULES.aimRanges[aim][0] && d1 + d2 <= RULES.aimRanges[aim][1];
  if (hit) p.stats.aimHits++;
  S.turn.dice = [d1, d2];
  S.turn.rollId++;
  ev(S, { t: 'dice', p: i, d: [d1, d2], dbl, aim, hit });
  if (p.island) {
    S.turn.rolled = true;
    S.turn.canRollAgain = false;
    if (dbl) {
      p.stats.doubles++;
      release(S, i, 'dengan dadu kembar ' + d1 + '-' + d2);
      walk(S, i, d1 + d2);
      land(S, i);
      return;
    }
    p.islandTries++;
    if (p.islandTries >= RULES.islandTurns) {
      release(S, i, 'karena kapal penjemput datang');
      walk(S, i, d1 + d2);
      land(S, i);
    } else {
      log(
        S,
        p.name + ' belum dapat dadu kembar (' + d1 + '-' + d2 + '). Percobaan ' + p.islandTries + '/' + RULES.islandTurns + '.',
        'dice',
        i
      );
    }
    return;
  }
  S.turn.rolled = true;
  log(
    S,
    p.name +
      ' melempar ' +
      d1 +
      ' + ' +
      d2 +
      ' = ' +
      (d1 + d2) +
      (dbl ? ' (kembar!)' : '') +
      (aim ? ' · bidikan ' + AIM_LABEL[aim] + (hit ? ' tepat' : ' meleset') : '') +
      '.',
    'dice',
    i
  );
  if (dbl) {
    S.turn.doubles++;
    p.stats.doubles++;
    loveAdd(S, i, 2);
    if (S.turn.doubles >= 3) {
      S.turn.canRollAgain = false;
      sendToIsland(S, i, '3× dadu kembar');
      return;
    }
    S.turn.canRollAgain = true;
  } else S.turn.canRollAgain = false;
  walk(S, i, d1 + d2);
  land(S, i);
};

H.END_TURN = (S, a) => {
  if (!canEnd(S, a.p)) fail(S.turn.canRollAgain ? 'Kamu dapat dadu kembar: lempar lagi dulu.' : 'Belum bisa mengakhiri giliran.');
  nextTurn(S);
};

// --- beli kota / wisata (tanah + bangunan sekaligus) ---
H.BUY = (S, a) => {
  const it = head(S, 'BUY', a.p);
  const p = PL(S, a.p),
    t = TILES[it.tile];
  const level = clampInt(a.level || 0, 0, 4);
  if (S.tiles[it.tile].owner !== -1) fail('Petak ini sudah dimiliki.');
  if (!buyLevels(S, a.p, it.tile).includes(level))
    fail(level === 3 ? 'Hotel baru bisa dibangun setelah 1 putaran (lewat START).' : 'Tingkat bangunan tidak valid.');
  const cost = buyCost(S, a.p, it.tile, level);
  if (p.cash < cost) fail('Uang tidak cukup (butuh ' + fmt(cost) + ').');
  S.queue.shift();
  if (cost) cashAdd(S, a.p, -cost);
  if (p.discount) {
    p.discount = 0;
  }
  S.tiles[it.tile].owner = a.p;
  S.tiles[it.tile].level = level;
  p.stats.bought++;
  if (level > 0) p.stats.built += level;
  log(S, p.name + ' membeli ' + t.name + (level > 0 ? ' + ' + LEVEL_NAME[level] : '') + ' seharga ' + fmt(cost) + '.', 'flag', a.p);
  ev(S, { t: 'buy', p: a.p, tile: it.tile, level });
};
H.BUY_SKIP = (S, a) => {
  const it = head(S, 'BUY', a.p);
  S.queue.shift();
  log(S, PL(S, a.p).name + ' tidak membeli ' + TILES[it.tile].name + '.', 'dot', a.p);
};

// --- bangun di kota sendiri ---
function applyLevel(S, i, ti, level, cost, why) {
  const st = S.tiles[ti],
    p = PL(S, i),
    from = st.level;
  if (cost) cashAdd(S, i, -cost);
  st.level = level;
  p.stats.built += level - from;
  if (level === 4) p.stats.landmarks++;
  log(
    S,
    p.name +
      ' membangun ' +
      LEVEL_NAME[level] +
      ' di ' +
      TILES[ti].name +
      (cost ? ' (' + fmt(cost) + ')' : ' (gratis)') +
      (why ? ' · ' + why : '') +
      '.',
    level === 4 ? 'crown' : 'build',
    i
  );
  ev(S, { t: 'build', p: i, tile: ti, level, from });
}
H.UPGRADE = (S, a) => {
  const it = head(S, 'UPGRADE', a.p);
  const p = PL(S, a.p);
  const level = clampInt(a.level, 0, 4);
  const ok = upgradeLevels(S, a.p, it.tile);
  if (!ok.includes(level))
    fail(
      level === 4
        ? 'Landmark hanya bisa dibangun di kota yang sudah punya Hotel.'
        : level === 3
          ? 'Hotel baru bisa dibangun setelah 1 putaran (lewat START).'
          : 'Tingkat bangunan tidak valid.'
    );
  const cost = upgradeCost(S, a.p, it.tile, level);
  if (p.cash < cost) fail('Uang tidak cukup (butuh ' + fmt(cost) + ').');
  S.queue.shift();
  if (p.discount) p.discount = 0;
  applyLevel(S, a.p, it.tile, level, cost);
};
H.UPGRADE_SKIP = (S, a) => {
  head(S, 'UPGRADE', a.p);
  S.queue.shift();
};

// --- tol & ambil alih ---
H.PAY_RENT = (S, a) => {
  const it = head(S, 'RENT', a.p);
  S.queue.shift();
  const p = PL(S, a.p);
  const to = PL(S, it.to);
  if (to.bankrupt || S.tiles[it.tile].owner !== it.to) {
    log(S, 'Pemilik sudah berubah, tol dibatalkan.', 'dot', a.p);
    return;
  }
  if (p.cash >= it.amount) {
    transfer(S, a.p, it.to, it.amount, { rent: true });
    log(S, p.name + ' membayar tol ' + fmt(it.amount) + ' ke ' + to.name + ' di ' + TILES[it.tile].name + '.', 'coins', a.p);
    ev(S, { t: 'rent', p: a.p, to: it.to, amount: it.amount, tile: it.tile });
    offerTakeover(S, a.p, it.tile);
  } else {
    charge(S, a.p, it.amount, it.to, 'tol ' + TILES[it.tile].name, { rent: true, tile: it.tile });
  }
};
H.USE_ANGEL = (S, a) => {
  const it = head(S, 'RENT', a.p);
  const p = PL(S, a.p);
  if (!takePower(S, a.p, 'angel')) fail('Kamu tidak punya Malaikat Cinta.');
  S.queue.shift();
  p.stats.angels++;
  log(S, p.name + ' memakai Malaikat Cinta: tol ' + fmt(it.amount) + ' di ' + TILES[it.tile].name + ' jadi 0.', 'angel', a.p);
  offerTakeover(S, a.p, it.tile);
};
H.USE_DISCOUNT = (S, a) => {
  const it = head(S, 'RENT', a.p);
  if (it.discountUsed) fail('Kupon sudah dipakai untuk tol ini.');
  if (!takePower(S, a.p, 'discount')) fail('Kamu tidak punya Kupon Tol 50%.');
  it.discountUsed = true;
  it.amount = r5(it.amount / 2);
  log(S, PL(S, a.p).name + ' memakai Kupon Tol 50%: tol jadi ' + fmt(it.amount) + '.', 'ticket', a.p);
};
H.TAKEOVER_BUY = (S, a) => {
  const it = head(S, 'TAKEOVER', a.p);
  if (S.tiles[it.tile].owner !== it.owner) fail('Pemilik kota sudah berubah.');
  const c = canTakeover(S, a.p, it.tile);
  if (!c.ok) fail(c.reason);
  S.queue.shift();
  const p = PL(S, a.p),
    o = PL(S, it.owner);
  transfer(S, a.p, it.owner, c.price, {});
  S.tiles[it.tile].owner = a.p;
  p.stats.takeovers++;
  o.stats.takenFrom++;
  p.stats.bought++;
  log(S, p.name + ' mengambil alih ' + TILES[it.tile].name + ' dari ' + o.name + ' seharga ' + fmt(c.price) + '!', 'swap', a.p);
  ev(S, { t: 'takeover', p: a.p, from: it.owner, tile: it.tile, price: c.price });
  if (TILES[it.tile].type === 'city') offerUpgrade(S, a.p, it.tile, 'takeover');
};
H.TAKEOVER_SKIP = (S, a) => {
  const it = head(S, 'TAKEOVER', a.p);
  S.queue.shift();
  log(S, PL(S, a.p).name + ' tidak mengambil alih ' + TILES[it.tile].name + '.', 'dot', a.p);
};
H.PAY_TAX = (S, a) => {
  const it = head(S, 'TAX', a.p);
  S.queue.shift();
  const ok = charge(S, a.p, it.amount, -1, 'Pajak Rindu');
  if (ok) {
    log(S, PL(S, a.p).name + ' membayar Pajak Rindu ' + fmt(it.amount) + '.', 'tax', a.p);
    ev(S, { t: 'tax', p: a.p, amount: it.amount });
  }
};

// --- utang ---
H.SELL = (S, a) => {
  const it = head(S, 'DEBT', a.p);
  const ti = Math.round(Number(a.tile));
  if (!TILES[ti] || !TILES[ti].price || S.tiles[ti].owner !== a.p) fail('Pilih kota milikmu.');
  const v = sellValue(S, ti);
  resetTile(S, ti);
  cashAdd(S, a.p, v);
  PL(S, a.p).stats.sold++;
  log(S, PL(S, a.p).name + ' menjual ' + TILES[ti].name + ' ke bank (+' + fmt(v) + ').', 'bank', a.p);
  ev(S, { t: 'sell', p: a.p, tile: ti, value: v });
  void it;
};
H.PAY_DEBT = (S, a) => {
  const it = head(S, 'DEBT', a.p);
  const p = PL(S, a.p);
  if (p.cash < it.amount) fail('Uang belum cukup. Jual kota dulu.');
  S.queue.shift();
  const to = it.to >= 0 && !PL(S, it.to).bankrupt ? it.to : -1;
  transfer(S, a.p, to, it.amount, { rent: it.rent && to >= 0 });
  p.stats.survived++;
  log(S, p.name + ' melunasi ' + it.reason + ' (' + fmt(it.amount) + ').', 'check', a.p);
  if (it.rent && to >= 0) {
    ev(S, { t: 'rent', p: a.p, to, amount: it.amount, tile: it.tile });
    if (it.tile >= 0 && S.tiles[it.tile].owner === to) offerTakeover(S, a.p, it.tile);
  }
};
H.BANKRUPT = (S, a) => {
  const it = head(S, 'DEBT', a.p);
  if (liquidation(S, a.p) >= it.amount) fail('Asetmu masih cukup. Jual kota untuk melunasi.');
  S.queue.shift();
  bankrupt(S, a.p, it.to);
};
H.RESIGN = (S, a) => {
  if (S.queue.length || S.turn.p !== a.p) fail('Menyerah hanya bisa di giliranmu tanpa keputusan tertunda.');
  log(S, PL(S, a.p).name + ' menyerah.', 'flag', a.p);
  bankrupt(S, a.p, -1);
  if (S.over && S.over.reason === 'bankrupt') S.over.reason = 'resign';
};
H.FINISH_NOW = (S, a) => {
  if (S.queue.length || S.turn.p !== a.p) fail('Hanya bisa di giliranmu tanpa keputusan tertunda.');
  finish(S, 'manual');
};

// --- kartu ---
H.CARD_OK = (S, a) => {
  const it = head(S, 'CARD', a.p);
  const c = CARD[it.card];
  if (c.choice) fail('Pilih salah satu opsi kartu.');
  S.queue.shift();
  const p = PL(S, a.p);
  log(S, p.name + ' membuka Kartu Cinta "' + c.title + '".', 'letter', a.p);
  if (c.power) {
    p.cards.push(c.id);
    log(S, p.name + ' menyimpan kartu ' + c.title + '.', 'bolt', a.p);
    return;
  }
  applyFx(S, a.p, c.fx || []);
};
H.CARD_CHOOSE = (S, a) => {
  const it = head(S, 'CARD', a.p);
  const c = CARD[it.card];
  if (!c.choice) fail('Kartu ini tidak punya pilihan.');
  const opt = c.choice[a.choice];
  if (!opt) fail('Pilihan tidak valid.');
  S.queue.shift();
  log(S, PL(S, a.p).name + ' membuka "' + c.title + '" dan memilih: ' + opt.label + '.', 'letter', a.p);
  applyFx(S, a.p, opt.fx);
};

// --- pilih petak (festival, bangun dari START, kartu aksi) ---
function hostFestival(S, i, ti, why) {
  const p = PL(S, i);
  if (S.festival.tile === ti) S.festival.mult = Math.min(RULES.festivalMax, S.festival.mult + 1);
  else S.festival = { tile: ti, mult: 2 };
  p.stats.festivals++;
  loveAdd(S, i, 3);
  log(S, 'Festival Cinta di ' + TILES[ti].name + '! Tol kota ini ×' + S.festival.mult + (why ? ' (' + why + ')' : '') + '.', 'party', i);
  ev(S, { t: 'festival', p: i, tile: ti, mult: S.festival.mult });
}
H.TARGET_PICK = (S, a) => {
  const it = head(S, 'TARGET', a.p);
  const ti = Math.round(Number(a.tile));
  const cand = targetCandidates(S, a.p, it.kind);
  if (!cand.includes(ti)) fail('Pilih petak yang menyala.');
  const p = PL(S, a.p);
  if (it.kind === 'swap') {
    const t2 = Math.round(Number(a.tile2));
    if (!swapTargets(S, a.p).includes(t2)) fail('Pilih kota lawan yang mau ditukar.');
    S.queue.shift();
    const other = S.tiles[t2].owner;
    S.tiles[ti].owner = other;
    S.tiles[t2].owner = a.p;
    log(S, p.name + ' menukar ' + TILES[ti].name + ' dengan ' + TILES[t2].name + ' milik ' + PL(S, other).name + '.', 'swap', a.p);
    ev(S, { t: 'swap', p: a.p, a: ti, b: t2, other });
    return;
  }
  S.queue.shift();
  if (it.kind === 'festival') hostFestival(S, a.p, ti, it.src === 'card' ? 'Festival Kilat' : '');
  else if (it.kind === 'build') {
    if (!offerUpgrade(S, a.p, ti, 'start')) fail('Kota ini belum bisa dibangun.');
  } else if (it.kind === 'renov') {
    const lv = upgradeLevels(S, a.p, ti)[0];
    applyLevel(S, a.p, ti, lv, 0, 'Renovasi Gratis');
  } else if (it.kind === 'storm') {
    const st = S.tiles[ti],
      o = st.owner,
      from = st.level;
    st.level = from - 1;
    log(
      S,
      'Badai Rindu menerjang ' +
        TILES[ti].name +
        ' milik ' +
        PL(S, o).name +
        ': ' +
        LEVEL_NAME[from] +
        ' turun jadi ' +
        LEVEL_NAME[st.level] +
        '.',
      'storm',
      a.p
    );
    ev(S, { t: 'storm', p: a.p, tile: ti, level: st.level, from, owner: o });
  }
};
H.TARGET_SKIP = (S, a) => {
  const it = head(S, 'TARGET', a.p);
  S.queue.shift();
  log(
    S,
    PL(S, a.p).name +
      ' melewatkan ' +
      ({ festival: 'Festival Cinta', build: 'kesempatan membangun', renov: 'renovasi', storm: 'Badai Rindu', swap: 'Tukar Kota' }[
        it.kind
      ] || 'pilihan') +
      '.',
    'dot',
    a.p
  );
};

// --- World Tour ---
H.TOUR_GO = (S, a) => {
  head(S, 'TOUR', a.p);
  const ti = Math.round(Number(a.tile));
  const p = PL(S, a.p);
  if (!TILES[ti] || ti === TRAVEL || ti === ISLAND) fail('Pilih tujuan lain.');
  const fee = newsOn(S, 'promo') ? 0 : RULES.travelFee;
  if (p.cash < fee) fail('Uang kurang untuk tiket (' + fee + ').');
  S.queue.shift();
  p.tour = false;
  cashAdd(S, a.p, -fee);
  p.stats.travels++;
  S.turn.rolled = true;
  S.turn.canRollAgain = false;
  log(S, p.name + ' terbang ke ' + TILES[ti].name + (fee ? ' (tiket ' + fee + ').' : ' gratis berkat Promo Maskapai!'), 'plane', a.p);
  flyTo(S, a.p, ti, 'fly');
  land(S, a.p);
};
H.TOUR_SKIP = (S, a) => {
  head(S, 'TOUR', a.p);
  S.queue.shift();
  PL(S, a.p).tour = false;
  log(S, PL(S, a.p).name + ' memilih lempar dadu biasa.', 'dice', a.p);
};

// --- Pulau Rindu ---
H.ISLAND_PAY = (S, a) => {
  if (!islandPre(S, a.p)) fail('Bayar hanya bisa sebelum melempar dadu saat di Pulau Rindu.');
  const p = PL(S, a.p);
  if (p.cash < RULES.islandFee) fail('Uang tidak cukup (' + RULES.islandFee + ').');
  cashAdd(S, a.p, -RULES.islandFee);
  release(S, a.p, 'dengan membayar perahu ' + RULES.islandFee);
};
H.ISLAND_CARD = (S, a) => {
  if (!islandPre(S, a.p)) fail('Tiket hanya bisa dipakai sebelum melempar dadu saat di Pulau Rindu.');
  if (!takePower(S, a.p, 'escape')) fail('Kamu tidak punya Tiket Pulang.');
  release(S, a.p, 'dengan Tiket Pulang');
};
H.ISLAND_CH = (S, a) => {
  if (!islandPre(S, a.p)) fail('Rindu Challenge hanya sebelum melempar dadu saat di Pulau Rindu.');
  const p = PL(S, a.p);
  if (p.islandCh) fail('Rindu Challenge sudah dipakai selama terdampar kali ini.');
  p.islandCh = true;
  qadd(S, chItem(S, a.p, 'rindu', 'island'));
};
