/* LOVEOPOLY — engine aturan › gerak, mendarat, kartu (dikumpulkan lewat src/engine/engine.js) */
import {
  CARD,
  CITIES,
  ISLAND,
  N,
  PL,
  RULES,
  TILES,
  activeIdx,
  buildingLevels,
  buyCost,
  cashAdd,
  citiesOf,
  ev,
  log,
  loveAdd,
  netWorth,
  newsOn,
  qadd,
  tierInfo,
  upgradeCost,
  upgradeLevels,
  tx,
  sub,
} from './base.js';
import { offerTakeover, offerUpgrade, rentFor } from './tolls.js';
import { chItem } from './challenges.js';
import { charge } from './turns.js';

// ---------- gerak ----------
function passStart(S, i) {
  const p = PL(S, i);
  const pay = RULES.salary + tierInfo(p.love).salary + (newsOn(S, 'bonus') ? RULES.newsBonus : 0);
  p.laps++;
  p.stats.starts++;
  cashAdd(S, i, pay);
  loveAdd(S, i, newsOn(S, 'love') ? 5 : 1);
  ev(S, { t: 'salary', p: i, amount: pay, laps: p.laps });
  log(
    S,
    tx('{n} melewati START: gaji {g}.{x}', {
      n: p.name,
      g: pay,
      x: p.laps === RULES.hotelLaps ? { t: ' Hotel sekarang bisa dibangun!' } : '',
    }),
    'coins',
    i
  );
}
function walk(S, i, steps) {
  const p = PL(S, i),
    from = p.pos;
  ev(S, { t: 'move', p: i, from, to: (from + steps) % N, steps, kind: 'walk' });
  for (let k = 0; k < steps; k++) {
    p.pos = (p.pos + 1) % N;
    if (p.pos === 0) passStart(S, i);
  }
}
function walkBack(S, i, steps) {
  const p = PL(S, i),
    from = p.pos;
  p.pos = (p.pos - steps + N) % N;
  ev(S, { t: 'move', p: i, from, to: p.pos, steps: -steps, kind: 'walk' });
}
function advanceTo(S, i, target) {
  const steps = (target - PL(S, i).pos + N) % N;
  if (steps > 0) walk(S, i, steps);
}
function flyTo(S, i, target, kind) {
  const p = PL(S, i),
    from = p.pos;
  if (target === from) return;
  ev(S, { t: 'move', p: i, from, to: target, steps: 0, kind: kind || 'jump' });
  if (target < from || target === 0) passStart(S, i);
  p.pos = target;
}
function sendToIsland(S, i, why) {
  const p = PL(S, i),
    from = p.pos;
  p.pos = ISLAND;
  p.island = true;
  p.islandTries = 0;
  p.islandCh = false;
  p.tour = false;
  p.stats.islands++;
  if (S.turn.p === i) {
    S.turn.canRollAgain = false;
    S.turn.doubles = 0;
  }
  loveAdd(S, i, -3);
  if (from !== ISLAND) ev(S, { t: 'move', p: i, from, to: ISLAND, steps: 0, kind: 'jump' });
  ev(S, { t: 'island', p: i });
  log(S, tx('{n} terdampar di Pulau Rindu{w}.', { n: p.name, w: why ? { t: ' ({x})', p: { x: sub(why) } } : '' }), 'island', i);
}
function release(S, i, how) {
  const p = PL(S, i);
  p.island = false;
  p.islandTries = 0;
  log(S, tx('{n} meninggalkan Pulau Rindu {h}.', { n: p.name, h: sub(how) }), 'boat', i);
  ev(S, { t: 'free', p: i });
}
function nearestTile(pos, kind) {
  for (let k = 1; k <= N; k++) {
    const t = TILES[(pos + k) % N];
    if (t.type === kind) return t.i;
  }
  return pos;
}

// ---------- mendarat ----------
// Ketemuan! pion berhenti di petak yang sama dengan pemain lain: keduanya dapat Love & uang jajan (sekali per giliran)
function meetUp(S, i) {
  const p = PL(S, i);
  if (S.turn.p !== i || S.turn.met) return;
  const others = S.players.filter(q => q.i !== i && !q.bankrupt && q.pos === p.pos);
  if (!others.length) return;
  S.turn.met = true;
  const k = newsOn(S, 'love') ? 2 : 1;
  [p].concat(others).forEach(q => {
    loveAdd(S, q.i, RULES.meetLove * k);
    cashAdd(S, q.i, RULES.meetCash * k);
    q.stats.meets = (q.stats.meets || 0) + 1;
  });
  log(
    S,
    tx('Ketemuan! {n} bertemu {o} di {k}: masing-masing +{c} dan Love +{l}.', {
      n: p.name,
      o: others.map(q => q.name).join(' & '),
      k: { tile: p.pos },
      c: RULES.meetCash * k,
      l: RULES.meetLove * k,
    }),
    'heart',
    i
  );
  ev(S, { t: 'meet', p: i, with: others.map(q => q.i), tile: p.pos, cash: RULES.meetCash * k, love: RULES.meetLove * k });
}
function land(S, i) {
  meetUp(S, i);
  const p = PL(S, i);
  const t = TILES[p.pos];
  switch (t.type) {
    case 'city':
    case 'spot':
      landOwnable(S, i, t);
      break;
    case 'card':
      drawCard(S, i);
      break;
    case 'tax': {
      const amt = Math.round((netWorth(S, i) * RULES.taxRate) / 10) * 10;
      if (amt > 0) qadd(S, { type: 'TAX', p: i, amount: amt });
      else log(S, tx('{n} bebas Pajak Rindu (aset kosong).', { n: p.name }), 'dot', i);
      break;
    }
    case 'start':
      offerTarget(S, i, 'build', 'start');
      break;
    case 'island':
      sendToIsland(S, i, '');
      break;
    case 'fest':
      offerTarget(S, i, 'festival', 'corner');
      break;
    case 'travel':
      p.tour = true;
      if (S.turn.p === i) {
        S.turn.canRollAgain = false;
      }
      log(S, tx('{n} tiba di World Tour. Giliran depan bisa terbang ke mana saja!', { n: p.name }), 'plane', i);
      ev(S, { t: 'tour', p: i });
      break;
    default:
      break;
  }
}
function landOwnable(S, i, t) {
  const st = S.tiles[t.i];
  const p = PL(S, i);
  if (st.owner === -1) {
    if (p.cash < buyCost(S, i, t.i, 0)) {
      log(S, tx('{n} belum cukup uang untuk membeli {k}.', { n: p.name, k: { tile: t.i } }), 'dot', i);
      return;
    }
    qadd(S, { type: 'BUY', p: i, tile: t.i });
    return;
  }
  if (st.owner === i) {
    if (t.type === 'city') offerUpgrade(S, i, t.i, 'visit');
    return;
  }
  const amount = rentFor(S, t.i, i);
  if (amount <= 0) {
    offerTakeover(S, i, t.i);
    return;
  }
  qadd(S, { type: 'RENT', p: i, to: st.owner, tile: t.i, amount, base: amount, discountUsed: false });
}
// pilihan petak di papan (festival, bangun dari START, kartu aksi)
function targetCandidates(S, i, kind) {
  const p = PL(S, i);
  if (kind === 'festival') return citiesOf(S, i);
  if (kind === 'build')
    return citiesOf(S, i).filter(t => {
      const lv = upgradeLevels(S, i, t);
      return lv.length && p.cash >= upgradeCost(S, i, t, lv[0]);
    });
  if (kind === 'renov') return citiesOf(S, i).filter(t => upgradeLevels(S, i, t).length);
  if (kind === 'storm')
    return CITIES.filter(t => {
      const st = S.tiles[t];
      return st.owner >= 0 && st.owner !== i && !PL(S, st.owner).bankrupt && st.level >= 1 && st.level < 4;
    });
  if (kind === 'swap') return citiesOf(S, i).filter(t => S.tiles[t].level < 4);
  return [];
}
function swapTargets(S, i) {
  return CITIES.filter(t => {
    const st = S.tiles[t];
    return st.owner >= 0 && st.owner !== i && !PL(S, st.owner).bankrupt && st.level < 4;
  });
}
const TARGET_NONE = {
  festival: 'belum punya kota untuk festival',
  build: 'belum ada kota yang bisa dibangun',
  renov: 'belum ada kota yang bisa direnovasi',
  storm: 'tidak ada kota lawan yang terkena badai',
  swap: 'belum ada kota yang bisa ditukar',
};
function offerTarget(S, i, kind, src) {
  const c = targetCandidates(S, i, kind);
  if (!c.length || (kind === 'swap' && !swapTargets(S, i).length)) {
    log(S, tx('{n} {x}.', { n: PL(S, i).name, x: { t: TARGET_NONE[kind] } }), 'dot', i);
    return false;
  }
  qadd(S, { type: 'TARGET', p: i, kind, src: src || 'card' });
  return true;
}

// ---------- kartu ----------
function drawCard(S, i) {
  const d = S.decks.card;
  if (!d.length) {
    log(S, tx('Tumpukan Kartu Cinta sedang kosong.'), 'dot', i);
    return;
  }
  const id = d.shift();
  if (!CARD[id].power) d.push(id);
  qadd(S, { type: 'CARD', p: i, card: id });
  ev(S, { t: 'card', p: i, card: id });
}
function returnPowerCard(S, id) {
  if (CARD[id]) S.decks.card.push(id);
}
function takePower(S, i, kind) {
  const p = PL(S, i);
  const id = p.cards.find(c => CARD[c].power === kind);
  if (!id) return null;
  p.cards.splice(p.cards.indexOf(id), 1);
  returnPowerCard(S, id);
  ev(S, { t: 'power', p: i, power: kind });
  return id;
}

function applyFx(S, i, fx) {
  const p = PL(S, i);
  for (const e of fx) {
    if (e.gain != null) cashAdd(S, i, e.gain);
    if (e.pay != null) charge(S, i, e.pay, -1, tx('biaya kartu'));
    if (e.love != null) loveAdd(S, i, e.love);
    if (e.collectEach != null)
      activeIdx(S).forEach(j => {
        if (j !== i) charge(S, j, e.collectEach, i, tx('hadiah untuk {n}', { n: p.name }));
      });
    if (e.payEach != null)
      activeIdx(S).forEach(j => {
        if (j !== i) charge(S, i, e.payEach, j, tx('traktiran untuk {n}', { n: PL(S, j).name }));
      });
    if (e.repairs != null) {
      const n = buildingLevels(S, i);
      if (n) charge(S, i, n * e.repairs, -1, tx('servis bangunan'));
      else log(S, tx('{n} belum punya bangunan. Aman!', { n: p.name }), 'dot', i);
    }
    if (e.moveTo != null) {
      advanceTo(S, i, e.moveTo);
      land(S, i);
    }
    if (e.moveBack != null) {
      walkBack(S, i, e.moveBack);
      land(S, i);
    }
    if (e.nearest) {
      advanceTo(S, i, nearestTile(p.pos, e.nearest));
      land(S, i);
    }
    if (e.goIsland) sendToIsland(S, i, 'kartu');
    if (e.skipTurn) {
      p.skip += e.skipTurn;
      log(S, tx('{n} akan kehilangan giliran berikutnya.', { n: p.name }), 'pause', i);
    }
    if (e.discount) {
      p.discount = Math.max(p.discount, e.discount);
      log(
        S,
        tx('{n} punya voucher diskon {d}% untuk beli/bangun berikutnya.', { n: p.name, d: Math.round(e.discount * 100) }),
        'ticket',
        i
      );
    }
    if (e.target) offerTarget(S, i, e.target, 'card');
    if (e.challenge) qadd(S, chItem(S, i, e.challenge, 'card'));
    if (e.richToPoor != null) {
      const act = activeIdx(S)
        .slice()
        .sort((a, b) => PL(S, b).cash - PL(S, a).cash);
      const rich = act[0],
        poor = act[act.length - 1];
      if (rich !== poor && PL(S, rich).cash > PL(S, poor).cash) {
        charge(S, rich, e.richToPoor, poor, tx('traktiran untuk {n}', { n: PL(S, poor).name }));
        log(S, tx('{a} (uang terbanyak) mentraktir {b}.', { a: PL(S, rich).name, b: PL(S, poor).name }), 'coins', rich);
      } else log(S, tx('Uang semua pemain setara. Tidak ada traktiran.'), 'dot', i);
    }
  }
}

export { applyFx, flyTo, land, nearestTile, release, returnPowerCard, sendToIsland, swapTargets, takePower, targetCandidates, walk };
