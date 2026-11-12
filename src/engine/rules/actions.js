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
  tx,
  sub,
} from './base.js';
import { canTakeover, offerTakeover, offerUpgrade } from './tolls.js';
import { applyFx, flyTo, land, release, sendToIsland, swapTargets, takePower, targetCandidates, walk } from './move.js';
import { chItem } from './challenges.js';
import { bankrupt, canEnd, canRoll, charge, finish, head, islandPre, nextTurn, resetTile, transfer } from './turns.js';

// ---------- handler aksi ----------
H.PAUSE = (S, a) => {
  S.paused = !S.paused;
  log(S, tx(S.paused ? '{n} menjeda permainan.' : '{n} melanjutkan permainan.', { n: PL(S, a.p).name }), 'pause', a.p);
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
      release(S, i, tx('dengan dadu kembar {a}-{b}', { a: d1, b: d2 }));
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
        tx('{n} belum dapat dadu kembar ({a}-{b}). Percobaan {c}/{m}.', {
          n: p.name,
          a: d1,
          b: d2,
          c: p.islandTries,
          m: RULES.islandTurns,
        }),
        'dice',
        i
      );
    }
    return;
  }
  S.turn.rolled = true;
  log(
    S,
    tx('{n} melempar {a} + {b} = {s}{d}{m}.', {
      n: p.name,
      a: d1,
      b: d2,
      s: d1 + d2,
      d: dbl ? { t: ' (kembar!)' } : '',
      m: aim ? { t: hit ? ' · bidikan {x} tepat' : ' · bidikan {x} meleset', p: { x: { t: AIM_LABEL[aim] } } } : '',
    }),
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
  if (p.cash < cost) fail(tx('Uang tidak cukup (butuh {n}).', { n: cost }));
  S.queue.shift();
  if (cost) cashAdd(S, a.p, -cost);
  if (p.discount) {
    p.discount = 0;
  }
  S.tiles[it.tile].owner = a.p;
  S.tiles[it.tile].level = level;
  p.stats.bought++;
  if (level > 0) p.stats.built += level;
  log(
    S,
    tx('{n} membeli {k}{l} seharga {a}.', {
      n: p.name,
      k: { tile: t.i },
      l: level > 0 ? { t: ' + {x}', p: { x: { t: LEVEL_NAME[level] } } } : '',
      a: cost,
    }),
    'flag',
    a.p
  );
  ev(S, { t: 'buy', p: a.p, tile: it.tile, level });
};
H.BUY_SKIP = (S, a) => {
  const it = head(S, 'BUY', a.p);
  S.queue.shift();
  log(S, tx('{n} tidak membeli {k}.', { n: PL(S, a.p).name, k: { tile: it.tile } }), 'dot', a.p);
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
    tx('{n} membangun {l} di {k}{c}{w}.', {
      n: p.name,
      l: { t: LEVEL_NAME[level] },
      k: { tile: ti },
      c: cost ? { t: ' ({a})', p: { a: cost } } : { t: ' (gratis)' },
      w: why ? { t: ' · {x}', p: { x: sub(why) } } : '',
    }),
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
  if (p.cash < cost) fail(tx('Uang tidak cukup (butuh {n}).', { n: cost }));
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
    log(S, tx('Pemilik sudah berubah, tol dibatalkan.'), 'dot', a.p);
    return;
  }
  if (p.cash >= it.amount) {
    transfer(S, a.p, it.to, it.amount, { rent: true });
    log(S, tx('{n} membayar tol {a} ke {o} di {k}.', { n: p.name, a: it.amount, o: to.name, k: { tile: it.tile } }), 'coins', a.p);
    ev(S, { t: 'rent', p: a.p, to: it.to, amount: it.amount, tile: it.tile });
    offerTakeover(S, a.p, it.tile);
  } else {
    charge(S, a.p, it.amount, it.to, tx('tol {k}', { k: { tile: it.tile } }), { rent: true, tile: it.tile });
  }
};
H.USE_ANGEL = (S, a) => {
  const it = head(S, 'RENT', a.p);
  const p = PL(S, a.p);
  if (!takePower(S, a.p, 'angel')) fail('Kamu tidak punya Malaikat Cinta.');
  S.queue.shift();
  p.stats.angels++;
  log(S, tx('{n} memakai Malaikat Cinta: tol {a} di {k} jadi 0.', { n: p.name, a: it.amount, k: { tile: it.tile } }), 'angel', a.p);
  offerTakeover(S, a.p, it.tile);
};
H.USE_DISCOUNT = (S, a) => {
  const it = head(S, 'RENT', a.p);
  if (it.discountUsed) fail('Kupon sudah dipakai untuk tol ini.');
  if (!takePower(S, a.p, 'discount')) fail('Kamu tidak punya Kupon Tol 50%.');
  it.discountUsed = true;
  it.amount = r5(it.amount / 2);
  log(S, tx('{n} memakai Kupon Tol 50%: tol jadi {a}.', { n: PL(S, a.p).name, a: it.amount }), 'ticket', a.p);
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
  log(S, tx('{n} mengambil alih {k} dari {o} seharga {a}!', { n: p.name, k: { tile: it.tile }, o: o.name, a: c.price }), 'swap', a.p);
  ev(S, { t: 'takeover', p: a.p, from: it.owner, tile: it.tile, price: c.price });
  if (TILES[it.tile].type === 'city') offerUpgrade(S, a.p, it.tile, 'takeover');
};
H.TAKEOVER_SKIP = (S, a) => {
  const it = head(S, 'TAKEOVER', a.p);
  S.queue.shift();
  log(S, tx('{n} tidak mengambil alih {k}.', { n: PL(S, a.p).name, k: { tile: it.tile } }), 'dot', a.p);
};
H.PAY_TAX = (S, a) => {
  const it = head(S, 'TAX', a.p);
  S.queue.shift();
  const ok = charge(S, a.p, it.amount, -1, tx('Pajak Rindu'));
  if (ok) {
    log(S, tx('{n} membayar Pajak Rindu {a}.', { n: PL(S, a.p).name, a: it.amount }), 'tax', a.p);
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
  log(S, tx('{n} menjual {k} ke bank (+{a}).', { n: PL(S, a.p).name, k: { tile: ti }, a: v }), 'bank', a.p);
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
  log(S, tx('{n} melunasi {r} ({a}).', { n: p.name, r: sub(it.reason), a: it.amount }), 'check', a.p);
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
  log(S, tx('{n} menyerah.', { n: PL(S, a.p).name }), 'flag', a.p);
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
  log(S, tx('{n} membuka Kartu Cinta "{c}".', { n: p.name, c: { t: c.title } }), 'letter', a.p);
  if (c.power) {
    p.cards.push(c.id);
    log(S, tx('{n} menyimpan kartu {c}.', { n: p.name, c: { t: c.title } }), 'bolt', a.p);
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
  log(S, tx('{n} membuka "{c}" dan memilih: {o}.', { n: PL(S, a.p).name, c: { t: c.title }, o: { t: opt.label } }), 'letter', a.p);
  applyFx(S, a.p, opt.fx);
};

// --- pilih petak (festival, bangun dari START, kartu aksi) ---
function hostFestival(S, i, ti, why) {
  const p = PL(S, i);
  if (S.festival.tile === ti) S.festival.mult = Math.min(RULES.festivalMax, S.festival.mult + 1);
  else S.festival = { tile: ti, mult: 2 };
  p.stats.festivals++;
  loveAdd(S, i, 3);
  log(
    S,
    tx('Festival Cinta di {k}! Tol kota ini ×{m}{w}.', {
      k: { tile: ti },
      m: S.festival.mult,
      w: why ? { t: ' ({x})', p: { x: sub(why) } } : '',
    }),
    'party',
    i
  );
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
    log(S, tx('{n} menukar {a} dengan {b} milik {o}.', { n: p.name, a: { tile: ti }, b: { tile: t2 }, o: PL(S, other).name }), 'swap', a.p);
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
      tx('Badai Rindu menerjang {k} milik {o}: {a} turun jadi {b}.', {
        k: { tile: ti },
        o: PL(S, o).name,
        a: { t: LEVEL_NAME[from] },
        b: { t: LEVEL_NAME[st.level] },
      }),
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
    tx('{n} melewatkan {x}.', {
      n: PL(S, a.p).name,
      x: {
        t:
          { festival: 'Festival Cinta', build: 'kesempatan membangun', renov: 'renovasi', storm: 'Badai Rindu', swap: 'Tukar Kota' }[
            it.kind
          ] || 'pilihan',
      },
    }),
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
  if (p.cash < fee) fail(tx('Uang kurang untuk tiket ({n}).', { n: fee }));
  S.queue.shift();
  p.tour = false;
  cashAdd(S, a.p, -fee);
  p.stats.travels++;
  S.turn.rolled = true;
  S.turn.canRollAgain = false;
  log(
    S,
    tx(fee ? '{n} terbang ke {k} (tiket {f}).' : '{n} terbang ke {k} gratis berkat Promo Maskapai!', {
      n: p.name,
      k: { tile: ti },
      f: fee,
    }),
    'plane',
    a.p
  );
  flyTo(S, a.p, ti, 'fly');
  land(S, a.p);
};
H.TOUR_SKIP = (S, a) => {
  head(S, 'TOUR', a.p);
  S.queue.shift();
  PL(S, a.p).tour = false;
  log(S, tx('{n} memilih lempar dadu biasa.', { n: PL(S, a.p).name }), 'dice', a.p);
};

// --- Pulau Rindu ---
H.ISLAND_PAY = (S, a) => {
  if (!islandPre(S, a.p)) fail('Bayar hanya bisa sebelum melempar dadu saat di Pulau Rindu.');
  const p = PL(S, a.p);
  if (p.cash < RULES.islandFee) fail(tx('Uang tidak cukup ({n}).', { n: RULES.islandFee }));
  cashAdd(S, a.p, -RULES.islandFee);
  release(S, a.p, tx('dengan membayar perahu {n}', { n: RULES.islandFee }));
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
