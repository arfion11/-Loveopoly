/* LOVEOPOLY — engine aturan › pembayaran & utang, giliran & ronde, aktor (dikumpulkan lewat src/engine/engine.js) */
import { D } from '../data.js';
import {
  ACH,
  PL,
  RULES,
  SIDES,
  SIDE_TILES,
  activeIdx,
  cashAdd,
  citiesOf,
  ev,
  fail,
  fullGroups,
  log,
  momentGap,
  momentRound,
  netWorth,
  newsGap,
  ownedBy,
  peakOn,
  qadd,
  rint,
  sellValue,
  spotsOf,
  tx,
  sub,
} from './base.js';
import { returnPowerCard } from './move.js';
import { chItem } from './challenges.js';

// ---------- pembayaran & utang ----------
function charge(S, i, amt, to, reason, opts) {
  opts = opts || {};
  amt = Math.round(amt);
  if (amt <= 0) return true;
  const p = PL(S, i);
  if (to >= 0 && PL(S, to).bankrupt) to = -1;
  if (p.cash >= amt) {
    transfer(S, i, to, amt, opts);
    return true;
  }
  qadd(S, { type: 'DEBT', p: i, to, amount: amt, reason, rent: !!opts.rent, tile: opts.tile == null ? -1 : opts.tile });
  p.stats.debts++;
  log(S, tx('{n} kekurangan uang untuk {r} ({a}).', { n: p.name, r: sub(reason), a: amt }), 'alert', i);
  return false;
}
function transfer(S, from, to, amt, opts) {
  opts = opts || {};
  cashAdd(S, from, -amt);
  if (to >= 0) cashAdd(S, to, amt);
  if (opts.rent && to >= 0) {
    PL(S, from).stats.tollOut += amt;
    PL(S, to).stats.tollIn += amt;
  }
}
function resetTile(S, ti) {
  const st = S.tiles[ti];
  st.owner = -1;
  st.level = 0;
  if (S.festival.tile === ti) S.festival = { tile: -1, mult: 1 };
}

function bankrupt(S, i, creditor) {
  const p = PL(S, i);
  let total = p.cash;
  ownedBy(S, i).forEach(t => {
    total += sellValue(S, t);
    resetTile(S, t);
  });
  if (p.cash) cashAdd(S, i, -p.cash);
  const cr = creditor >= 0 && !PL(S, creditor).bankrupt && creditor !== i ? creditor : -1;
  if (cr >= 0 && total > 0) cashAdd(S, cr, total);
  p.cards.forEach(id => returnPowerCard(S, id));
  p.cards = [];
  p.bankrupt = true;
  p.island = false;
  p.tour = false;
  p.skip = 0;
  p.discount = 0;
  p.stats.bankruptRound = S.round;
  log(
    S,
    tx('{n} bangkrut! Semua kotanya dijual ke bank{x}.', {
      n: p.name,
      x: cr >= 0 ? { t: ' dan hasilnya ({a}) untuk {c}', p: { a: total, c: PL(S, cr).name } } : '',
    }),
    'alert',
    i
  );
  const keep = it => !(it.p === i || (it.type === 'TAKEOVER' && it.owner === i));
  const fix = it => {
    if ((it.type === 'DEBT' || it.type === 'RENT') && it.to === i) it.to = -1;
    return it;
  };
  S.queue = S.queue.filter(keep).map(fix);
  S._new = S._new.filter(keep).map(fix);
  // tol ke pemain yang bangkrut tidak perlu dibayar lagi
  S.queue = S.queue.filter(it => !(it.type === 'RENT' && it.to === -1));
  S._new = S._new.filter(it => !(it.type === 'RENT' && it.to === -1));
  ev(S, { t: 'bankrupt', p: i });
  const act = activeIdx(S);
  if (act.length <= 1) {
    finish(S, 'bankrupt', act[0]);
    return;
  }
  if (S.turn.p === i) nextTurn(S);
}

// ---------- giliran & ronde ----------
function beginTurn(S, p) {
  S.turn = { p, rolled: false, doubles: 0, canRollAgain: false, dice: [0, 0], rollId: S.turn.rollId };
  const pl = PL(S, p);
  if (pl.skip > 0) {
    pl.skip--;
    log(S, tx('{n} kehilangan giliran ini.', { n: pl.name }), 'pause', p);
    ev(S, { t: 'skip', p });
    nextTurn(S);
    return;
  }
  // Momen Berdua: tantangan kerja sama dulu, baru melempar dadu (semua pemain di ronde itu, jadi adil)
  if (S.moment === S.round) qadd(S, chItem(S, p, 'duo', 'moment'));
  if (pl.tour && !pl.island) qadd(S, { type: 'TOUR', p });
}
function nextTurn(S) {
  if (S.over) return;
  const n = S.players.length,
    cur = S.turn.p,
    st = S.start || 0;
  let next = -1,
    newRound = false;
  // ronde baru saat giliran kembali melewati pemain pertama (S.start), supaya semua dapat jumlah giliran sama
  const rel = i => (i - st + n) % n;
  for (let k = 1; k <= n; k++) {
    const c = (cur + k) % n;
    if (!S.players[c].bankrupt) {
      next = c;
      newRound = rel(c) <= rel(cur);
      break;
    }
  }
  if (next < 0) return;
  if (newRound) {
    S.round++;
    if (startRound(S)) return;
  }
  beginTurn(S, next);
}
function startRound(S) {
  if ((S.settings.roundLimit && S.round > S.settings.roundLimit) || S.round > RULES.maxRounds) {
    S.round = Math.min(S.round, S.settings.roundLimit || S.round);
    finish(S, 'rounds');
    return true;
  }
  if (S.news && S.round > S.news.to) {
    log(S, tx('Kabar Merpi "{x}" selesai.', { x: { t: NEWS_LABEL[S.news.id] } }), 'dot');
    S.news = null;
  }
  const gap = newsGap(S);
  if (S.settings.news !== false && S.round >= gap && S.round % gap === 0 && !peakOn(S)) drawNews(S);
  if (S.settings.roundLimit && S.round === S.settings.roundLimit - RULES.peakRounds + 1) {
    log(S, tx('Musim Puncak! {r} ronde terakhir: semua tol ×{m}.', { r: RULES.peakRounds, m: RULES.peakMult }), 'bolt');
    ev(S, { t: 'peak', rounds: RULES.peakRounds, mult: RULES.peakMult });
  }
  if (momentRound(S)) {
    S.moment = S.round;
    log(
      S,
      tx('Momen Berdua! Ronde ini tiap pemain dapat satu tantangan kerja sama sebelum melempar dadu. Berhasil = hadiah untuk berdua.'),
      'heart'
    );
    ev(S, { t: 'moment' });
  }
  return false;
}
// Momen Berdua untuk UI: { now: ronde ini, next: ronde Momen berikutnya atau null }
function momentInfo(S) {
  const on = S.settings.moment !== false && S.players.filter(p => p.kind === 'human' && !p.bankrupt).length >= 2;
  const L = S.settings.roundLimit,
    g = momentGap(S);
  let next = null;
  if (on)
    for (let r = S.round + 1; r <= (L ? L - RULES.peakRounds : S.round + g); r++)
      if (r >= g && r % g === 0) {
        next = r;
        break;
      }
  return { now: S.moment === S.round && !S.over, next };
}
// Kabar Merpi: event dunia berlaku 2 ronde, diundi tiap beberapa ronde (tidak sama dengan event sebelumnya)
const NEWS_LABEL = {
  rain: 'Musim Hujan',
  holiday: 'Musim Liburan',
  sale: 'Diskon Properti',
  promo: 'Promo Maskapai',
  bonus: 'Bonus Tahunan',
  love: 'Pekan Kasih Sayang',
};
const NEWS_TEXT = {
  rain: 'tol semua kota di {s} ×0,5',
  holiday: 'tol semua kota di {s} ×1,5',
  sale: 'beli & bangun diskon 20%',
  promo: 'tiket World Tour gratis',
  bonus: 'gaji START +100',
  love: 'Ketemuan & lewat START bonus Love berlipat',
};
const NEWS_CAP = Object.fromEntries(Object.entries(NEWS_TEXT).map(([k, v]) => [k, v.charAt(0).toUpperCase() + v.slice(1)]));
function drawNews(S) {
  const ids = Object.keys(NEWS_LABEL).filter(id => !S.news || id !== S.news.id);
  const id = ids[rint(S, ids.length)];
  const side = id === 'rain' || id === 'holiday' ? SIDES[rint(S, SIDES.length)].id : null;
  S.news = { id, side, from: S.round, to: S.round + RULES.newsLasts - 1 };
  const text = NEWS_TEXT[id].replace('{s}', side ? sideName(side) : '');
  const sp = { s: side ? { t: sideName(side) } : '' };
  log(
    S,
    tx('Kabar Merpi: {l}! {x} selama {r} ronde.', { l: { t: NEWS_LABEL[id] }, x: { t: NEWS_CAP[id], p: sp }, r: RULES.newsLasts }),
    'sparkle'
  );
  ev(S, { t: 'news', id, side, label: NEWS_LABEL[id], text, rounds: RULES.newsLasts });
}
function newsInfo(S) {
  if (!S.news || S.round > S.news.to) return null;
  return {
    id: S.news.id,
    side: S.news.side,
    label: NEWS_LABEL[S.news.id],
    text: NEWS_TEXT[S.news.id].replace('{s}', S.news.side ? sideName(S.news.side) : ''),
    // untuk UI: templat + data supaya bisa diterjemahkan (t(tpl, tp))
    tpl: NEWS_TEXT[S.news.id],
    tp: { s: S.news.side ? { t: sideName(S.news.side) } : '' },
    left: S.news.to - S.round + 1,
  };
}

function finish(S, reason, winner, detail) {
  if (S.over) return;
  const ranking = S.players
    .map(p => p.i)
    .sort((a, b) => {
      const A = PL(S, a),
        B = PL(S, b);
      if (A.bankrupt !== B.bankrupt) return A.bankrupt ? 1 : -1;
      if (A.bankrupt && B.bankrupt) return B.stats.bankruptRound - A.stats.bankruptRound;
      return netWorth(S, b) - netWorth(S, a);
    });
  if (winner == null || winner < 0) winner = ranking[0];
  else (ranking.splice(ranking.indexOf(winner), 1), ranking.unshift(winner));
  S.players.forEach(p => {
    if (!p.bankrupt) p.stats.maxNet = Math.max(p.stats.maxNet, netWorth(S, p.i));
  });
  checkAchievements(S);
  S.over = {
    winner,
    reason,
    detail: detail || null,
    ranking,
    round: S.round,
    worth: S.players.map(p => netWorth(S, p.i)),
    titles: computeTitles(S, ranking, winner),
  };
  S.queue = [];
  S._new = [];
  log(S, tx('{n} menang ({r})!', { n: PL(S, winner).name, r: sub(winReasonTx(S.over)) }), 'trophy', winner);
  ev(S, { t: 'gameover', winner, reason });
}
function sideName(id) {
  return (SIDE_TILES.find(x => x.id === id) || {}).name || 'satu jalur';
}
// alasan menang sebagai tx (untuk riwayat & UI yang diterjemahkan)
function winReasonTx(o) {
  if (o.reason === 'line') return o.detail ? tx('Raja {s}', { s: { t: sideName(o.detail.side) } }) : tx('Raja Jalur');
  return tx(winReason(o));
}
function winReason(o) {
  return (
    {
      bankrupt: 'semua lawan bangkrut',
      rounds: 'aset terbesar saat batas ronde',
      manual: 'aset terbesar saat permainan diakhiri',
      resign: 'lawan menyerah',
      triple: 'Trio Warna',
      line: 'Raja ' + (o.detail ? sideName(o.detail.side) : 'Jalur'),
      spots: 'Kolektor Wisata',
    }[o.reason] || o.reason
  );
}
function computeTitles(S, ranking, winner) {
  const titles = {};
  const used = new Set();
  titles[winner] = D.TITLES.winner[rint(S, D.TITLES.winner.length)];
  /** @type {Array<[string, (p: any) => number]>} */
  const cats = [
    ['rent', p => p.stats.tollIn],
    ['landmarks', p => p.stats.landmarks],
    ['takeovers', p => p.stats.takeovers],
    ['challenges', p => p.stats.challenges],
    ['love', p => p.love],
    ['travels', p => p.stats.travels],
    ['doubles', p => p.stats.doubles],
    ['island', p => p.stats.islands],
  ];
  S.players.forEach(p => {
    if (p.i === winner) return;
    for (const [k, f] of cats) {
      if (used.has(k)) continue;
      const v = f(p);
      if (v > 0 && S.players.every(q => q.i === p.i || f(q) < v)) {
        titles[p.i] = D.TITLES[k];
        used.add(k);
        break;
      }
    }
    if (!titles[p.i]) titles[p.i] = D.TITLES.default[p.i % D.TITLES.default.length];
  });
  return titles;
}

function checkAchievements(S) {
  S.players.forEach(p => {
    if (p.bankrupt) return;
    const s = p.stats;
    const cond = {
      landmark: s.landmarks >= 1,
      tycoon: citiesOf(S, p.i).length >= 8,
      monopoly2: fullGroups(S, p.i).length >= 2,
      festival: s.festivals >= 1,
      globe: s.travels >= 1,
      takeover: s.takeovers >= 1,
      tourist: spotsOf(S, p.i).length >= 3,
      rentking: s.tollIn >= 3000,
      romantic: s.challenges >= 5,
      escape: s.escapes >= 1,
      angel: s.angels >= 1,
      goals: p.love >= 100,
      doubles5: s.doubles >= 5,
      writer: s.letters >= 3,
      survivor: s.survived >= 1,
    };
    Object.keys(cond).forEach(id => {
      if (cond[id] && !p.achievements.includes(id)) {
        p.achievements.push(id);
        log(S, tx('Achievement: {n} membuka "{a}".', { n: p.name, a: { t: ACH[id].name } }), 'trophy', p.i);
        ev(S, { t: 'achievement', p: p.i, id });
      }
    });
  });
}

// ---------- aktor & ketersediaan aksi ----------
function actor(S) {
  if (S.over) return -1;
  const it = S.queue[0];
  if (it && it.type === 'CHALLENGE' && it.who != null) return it.who;
  return it ? it.p : S.turn.p;
}
function head(S, type, p) {
  const it = S.queue[0];
  if (!it || it.type !== type) fail('Tidak ada keputusan yang menunggu untuk aksi ini.');
  if (p != null && actor(S) !== p) fail('Bukan giliranmu untuk keputusan ini.');
  return it;
}
function canRoll(S, i) {
  if (S.over || S.paused || S.queue.length || S.turn.p !== i) return false;
  const p = PL(S, i);
  if (p.island) return !S.turn.rolled;
  return !S.turn.rolled || S.turn.canRollAgain;
}
function canEnd(S, i) {
  if (S.over || S.paused || S.queue.length || S.turn.p !== i) return false;
  return S.turn.rolled && !S.turn.canRollAgain;
}
const islandPre = (S, i) => {
  const p = PL(S, i);
  return p.island && S.turn.p === i && !S.turn.rolled && !S.queue.length && !S.over && !S.paused;
};

export {
  NEWS_LABEL,
  actor,
  bankrupt,
  canEnd,
  canRoll,
  charge,
  checkAchievements,
  finish,
  head,
  islandPre,
  momentInfo,
  newsInfo,
  nextTurn,
  resetTile,
  sideName,
  transfer,
  winReason,
  winReasonTx,
};
