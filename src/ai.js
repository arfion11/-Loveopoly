/* LOVEOPOLY 2.0 — AI lawan (Easy / Normal / Hard). Murni fungsi dari state → aksi valid. */
(function (G) {
  'use strict';
  const D = G.LOVE_DATA, E = G.LoveEngine;
  const { TILES, RULES } = D;
  const GT = E.GROUP_TILES;
  const N = E.N;

  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function aiRand(S, p, salt) {
    let h = (Math.imul(S.seq + 1, 2654435761) ^ S.rng ^ Math.imul(p + 7, 40503) ^ hashStr(String(salt))) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const PSUM = s => (6 - Math.abs(7 - s)) / 36;
  const opponents = (S, p) => S.players.filter(q => !q.bankrupt && q.i !== p).map(q => q.i);

  // ---------- cadangan uang: tol terbesar lawan dalam jangkauan dadu ----------
  function dangerAhead(S, p, from) {
    let worst = 0, exp = 0;
    for (let s = 2; s <= 12; s++) {
      const ti = (from + s) % N;
      const r = E.rentFor(S, ti, p);
      worst = Math.max(worst, r);
      exp += PSUM(s) * r;
    }
    return { worst, exp };
  }
  function reserve(S, p, lvl) {
    if (lvl === 'easy') return 80;
    const P = S.players[p];
    const d = dangerAhead(S, p, P.pos);
    let maxToll = 0;
    E.OWNABLE.forEach(t => { const o = S.tiles[t].owner; if (o >= 0 && o !== p) maxToll = Math.max(maxToll, E.rentFor(S, t, p)); });
    const base = 100;
    return Math.round(Math.min(1400, base + d.exp * 1.6 + maxToll * (lvl === 'hard' ? 0.3 : 0.25)));
  }

  // ---------- nilai strategis ----------
  function ownerAfter(S, ti, owner) { return Object.assign({}, S, { tiles: S.tiles.map((x, k) => (k === ti ? Object.assign({}, x, { owner }) : x)) }); }
  // jarak menuju menang instan (0 = sudah menang)
  function winDist(S, i) {
    if (!S.settings.instantWin) return 9;
    let best = 9;
    const groupsMissing = E.GROUP_IDS.map(g => GT[g].filter(t => S.tiles[t].owner !== i).length).sort((a, b) => a - b);
    const triple = groupsMissing.slice(0, RULES.tripleGroups).reduce((s, x) => s + x, 0);
    best = Math.min(best, triple);
    E.SIDE_TILES.forEach(sd => { best = Math.min(best, sd.tiles.filter(t => S.tiles[t].owner !== i).length); });
    best = Math.min(best, E.SPOTS.filter(t => S.tiles[t].owner !== i).length);
    return best;
  }
  const DIST_VAL = [1e6, 1200, 420, 160, 60, 20, 8, 3, 1, 0];
  const AWARE = { easy: 0, normal: 0.5, hard: 1 };
  // perubahan "nilai menang" bila kepemilikan ti berpindah ke p (positif = bagus untuk p)
  function winSwing(S, p, ti, lvl) {
    if (!S.settings.instantWin) return 0;
    const before = S, after = ownerAfter(S, ti, p);
    let v = DIST_VAL[Math.min(9, winDist(after, p))] - DIST_VAL[Math.min(9, winDist(before, p))];
    opponents(S, p).forEach(q => { v += DIST_VAL[Math.min(9, winDist(before, q))] - DIST_VAL[Math.min(9, winDist(after, q))]; });
    return v * AWARE[lvl];
  }
  function groupBonus(S, p, ti) {
    const t = TILES[ti];
    if (t.type === 'spot') {
      const mine = E.SPOTS.filter(x => x !== ti && S.tiles[x].owner === p).length;
      return 25 + mine * 35;
    }
    const tiles = GT[t.group];
    const mine = tiles.filter(x => x !== ti && S.tiles[x].owner === p).length;
    const opp = tiles.filter(x => x !== ti && S.tiles[x].owner >= 0 && S.tiles[x].owner !== p).length;
    if (opp) return 10;
    if (mine === tiles.length - 1) return 160 + t.price * 0.6;
    return 25 + mine * 45;
  }
  // nilai tol per kunjungan lawan untuk petak ti bila dimiliki p pada tingkat level
  function tollAt(S, p, ti, level) {
    const t = TILES[ti];
    if (t.type === 'spot') { const n = E.SPOTS.filter(x => x === ti || S.tiles[x].owner === p).length; return RULES.spotRent[n - 1]; }
    let r = t.price * RULES.rentMult[level];
    const full = GT[t.group].every(x => x === ti || S.tiles[x].owner === p);
    if (full) r *= RULES.groupMult;
    if (S.festival.tile === ti) r *= S.festival.mult;
    return r;
  }
  // perkiraan berapa kali lawan mendarat di petak ini sampai akhir permainan
  function visitsLeft(S, p) {
    const left = S.settings.roundLimit ? Math.max(1, S.settings.roundLimit - S.round + 1) : 20;
    return Math.min(20, left) * opponents(S, p).length / N * 1.05;
  }

  // ---------- keputusan beli ----------
  function decideBuy(S, p, it, lvl) {
    const P = S.players[p], ti = it.tile;
    const levels = E.buyLevels(S, p, ti);
    const res = reserve(S, p, lvl);
    const swing = winSwing(S, p, ti, lvl);
    const strat = groupBonus(S, p, ti) + swing;
    const r = aiRand(S, p, 'buy' + ti);
    // tingkat tertinggi yang terjangkau dengan cadangan
    let best = -1;
    for (const k of levels) {
      const cost = E.buyCost(S, p, ti, k);
      if (cost > P.cash) break;
      const left = P.cash - cost;
      if (k === 0) {
        if (left >= res || strat >= 150 || (lvl === 'easy' && r < 0.85) || swing >= 400) best = 0;
        else if (left >= res * 0.5 && strat >= 80) best = 0;
        continue;
      }
      if (best < k - 1) break;
      const visits = visitsLeft(S, p);
      const gain = (tollAt(S, p, ti, k) - tollAt(S, p, ti, k - 1)) * visits;
      const lc = E.buyCost(S, p, ti, k) - E.buyCost(S, p, ti, k - 1);
      const need = lvl === 'easy' ? 80 : res;
      if (left >= need && (gain >= lc * (lvl === 'hard' ? 0.4 : 0.5) || lvl === 'easy')) best = k;
    }
    if (best < 0) return { type: 'BUY_SKIP', p };
    if (lvl === 'easy' && best > 0 && r < 0.35) best = Math.max(0, best - 1);
    return { type: 'BUY', p, level: best };
  }

  // ---------- bangun ----------
  function bestUpgrade(S, p, ti, lvl, cashAvail) {
    const levels = E.upgradeLevels(S, p, ti);
    if (!levels.length) return -1;
    const res = reserve(S, p, lvl);
    const visits = visitsLeft(S, p);
    let best = -1;
    for (const k of levels) {
      const cost = E.upgradeCost(S, p, ti, k);
      if (cost > cashAvail) break;
      const left = cashAvail - cost;
      if (k === 4) {
        // landmark: kebal ambil alih + tol besar
        const threat = S.settings.takeover ? 1.25 : 1;
        const gain = (tollAt(S, p, ti, 4) - tollAt(S, p, ti, 3)) * visits * threat;
        if (left >= res * (lvl === 'hard' ? 0.8 : 1) && (gain >= cost * 0.4 || lvl === 'easy')) best = 4;
        break;
      }
      const prev = Math.max(S.tiles[ti].level, k - 1);
      const gain = (tollAt(S, p, ti, k) - tollAt(S, p, ti, prev)) * visits;
      const lc = E.levelCost(ti, k);
      const need = lvl === 'easy' ? 80 : res;
      if (left >= need && (gain >= lc * (lvl === 'hard' ? 0.4 : 0.5) || lvl === 'easy')) best = k;
      else break;
    }
    return best;
  }
  function decideUpgrade(S, p, it, lvl) {
    const best = bestUpgrade(S, p, it.tile, lvl, S.players[p].cash);
    if (best < 0) return { type: 'UPGRADE_SKIP', p };
    return { type: 'UPGRADE', p, level: best };
  }

  // ---------- tol & ambil alih ----------
  function decideRent(S, p, it, lvl) {
    const P = S.players[p];
    const hasAngel = P.cards.some(c => E.CARD[c].power === 'angel');
    const hasDisc = P.cards.some(c => E.CARD[c].power === 'discount');
    const short = P.cash < it.amount;
    if (hasAngel && (short || it.amount >= (lvl === 'easy' ? 60 : 180) || it.amount > P.cash * 0.3)) return { type: 'USE_ANGEL', p };
    if (hasDisc && !it.discountUsed && (short || it.amount >= (lvl === 'easy' ? 60 : 140))) return { type: 'USE_DISCOUNT', p };
    return { type: 'PAY_RENT', p };
  }
  function decideTakeover(S, p, it, lvl) {
    const P = S.players[p];
    const left = P.cash - it.price;
    const swing = winSwing(S, p, it.tile, lvl);
    if (swing >= 5e5) return { type: 'TAKEOVER_BUY', p };
    if (left < 0) return { type: 'TAKEOVER_SKIP', p };
    const res = reserve(S, p, lvl);
    if (lvl === 'easy') return { type: aiRand(S, p, 'tk' + it.tile) < 0.2 && left > 700 ? 'TAKEOVER_BUY' : 'TAKEOVER_SKIP', p };
    const t = TILES[it.tile];
    const visits = visitsLeft(S, p);
    const level = S.tiles[it.tile].level;
    // keuntungan: tol yang kini kita terima + tol yang tidak lagi kita bayar + strategi
    const tollMine = tollAt(S, p, it.tile, level) * visits;
    const tollAvoid = E.rentFor(S, it.tile, p) * visits / Math.max(1, opponents(S, p).length) * 0.9;
    const strat = groupBonus(S, p, it.tile) * 1.5 + swing + (t.type === 'city' && GT[t.group].every(x => x === it.tile || S.tiles[x].owner === p) ? 260 : 0);
    const gain = tollMine + tollAvoid + strat;
    const need = lvl === 'hard' ? res * 0.9 : res * 1.1;
    const ratio = lvl === 'hard' ? 1.05 : 1.3;
    if (left >= need && gain >= it.price * ratio) return { type: 'TAKEOVER_BUY', p };
    if (left >= need * 0.6 && swing >= 900) return { type: 'TAKEOVER_BUY', p };
    return { type: 'TAKEOVER_SKIP', p };
  }

  // ---------- pilih petak ----------
  function landingOdds(S, p, ti) {
    // peluang lawan mendarat di petak ini dalam satu putaran giliran berikutnya
    let pr = 0;
    opponents(S, p).forEach(q => {
      const d = (ti - S.players[q].pos + N) % N;
      if (d >= 2 && d <= 12) pr += PSUM(d);
      else pr += 0.03;
    });
    return pr;
  }
  function decideTarget(S, p, it, lvl) {
    const cand = E.targetCandidates(S, p, it.kind);
    if (!cand.length) return { type: 'TARGET_SKIP', p };
    const easy = lvl === 'easy';
    const pickBy = f => { let b = cand[0], bv = -Infinity; cand.forEach(t => { const v = f(t); if (v > bv) { bv = v; b = t; } }); return { b, bv }; };
    if (it.kind === 'festival') {
      const { b } = pickBy(t => tollAt(S, p, t, S.tiles[t].level) * (easy ? 1 : (0.6 + landingOdds(S, p, t) * 3)) + (S.festival.tile === t ? 30 : 0));
      return { type: 'TARGET_PICK', p, tile: b };
    }
    if (it.kind === 'build') {
      let best = -1, bestV = -Infinity;
      cand.forEach(t => {
        const k = bestUpgrade(S, p, t, lvl, S.players[p].cash);
        if (k < 0) return;
        const v = tollAt(S, p, t, k) - tollAt(S, p, t, S.tiles[t].level) + (k === 4 ? 200 : 0);
        if (v > bestV) { bestV = v; best = t; }
      });
      return best >= 0 ? { type: 'TARGET_PICK', p, tile: best } : { type: 'TARGET_SKIP', p };
    }
    if (it.kind === 'renov') {
      const { b } = pickBy(t => { const k = E.upgradeLevels(S, p, t)[0]; return tollAt(S, p, t, k) - tollAt(S, p, t, S.tiles[t].level) + E.levelCost(t, k) * 0.3; });
      return { type: 'TARGET_PICK', p, tile: b };
    }
    if (it.kind === 'storm') {
      const lead = opponents(S, p).sort((a, b) => E.netWorth(S, b) - E.netWorth(S, a))[0];
      const { b } = pickBy(t => { const st = S.tiles[t]; return E.rentFor(S, t, p) * (1 + landingOdds(S, p, t)) + (st.owner === lead ? 60 : 0) + st.level * 20; });
      return { type: 'TARGET_PICK', p, tile: b };
    }
    if (it.kind === 'swap') {
      const theirs = E.swapTargets(S, p);
      let best = null, bestV = 40;
      cand.forEach(mine => {
        theirs.forEach(th => {
          const after = Object.assign({}, S, { tiles: S.tiles.map((x, k) => (k === mine ? Object.assign({}, x, { owner: S.tiles[th].owner }) : k === th ? Object.assign({}, x, { owner: p }) : x)) });
          let v = E.tileValue(S, th) - E.tileValue(S, mine);
          v += (DIST_VAL[Math.min(9, winDist(after, p))] - DIST_VAL[Math.min(9, winDist(S, p))]) * (easy ? 0.2 : 1);
          v += E.fullGroups(after, p).length * 150 - E.fullGroups(S, p).length * 150;
          if (v > bestV) { bestV = v; best = [mine, th]; }
        });
      });
      return best ? { type: 'TARGET_PICK', p, tile: best[0], tile2: best[1] } : { type: 'TARGET_SKIP', p };
    }
    return { type: 'TARGET_SKIP', p };
  }

  // ---------- nilai mendarat (untuk bidik dadu & World Tour) ----------
  function landValue(S, p, ti, lvl) {
    const t = TILES[ti], P = S.players[p];
    switch (t.type) {
      case 'city': case 'spot': {
        const st = S.tiles[ti];
        if (st.owner < 0) return P.cash >= E.buyCost(S, p, ti, 0) + 60 ? 45 + groupBonus(S, p, ti) * 0.5 + winSwing(S, p, ti, lvl) * 0.4 : 0;
        if (st.owner === p) return E.upgradeLevels(S, p, ti).length && P.cash > E.upgradeCost(S, p, ti, E.upgradeLevels(S, p, ti)[0]) + 80 ? 55 : 5;
        const toll = E.rentFor(S, ti, p);
        return -toll + (toll < P.cash * 0.25 ? Math.max(0, winSwing(S, p, ti, lvl) * 0.2) : 0);
      }
      case 'card': return 15;
      case 'tax': return -Math.round(E.netWorth(S, p) * RULES.taxRate);
      case 'island': return lateGame(S) ? 30 : -90;
      case 'fest': return E.citiesOf(S, p).length ? 70 : 0;
      case 'travel': return 40;
      case 'start': return 60;
      default: return 0;
    }
  }
  function lateGame(S) {
    const free = E.OWNABLE.filter(t => S.tiles[t].owner < 0).length;
    return free <= 4 || (S.settings.roundLimit && S.round >= S.settings.roundLimit - 6);
  }
  function decideAim(S, p, lvl) {
    if (!S.settings.diceControl || lvl === 'easy') return null;
    if (lvl === 'normal' && aiRand(S, p, 'aimN' + S.turn.rollId) < 0.6) return null;
    const P = S.players[p];
    const vals = {};
    for (let s = 2; s <= 12; s++) vals[s] = landValue(S, p, (P.pos + s) % N, lvl) + (P.pos + s >= N ? RULES.salary : 0);
    let ev0 = 0;
    for (let s = 2; s <= 12; s++) ev0 += PSUM(s) * vals[s];
    let best = null, bestEv = ev0 + 1;
    const c = RULES.aimChance;
    Object.keys(RULES.aimRanges).forEach(aim => {
      const [lo, hi] = RULES.aimRanges[aim];
      let pr = 0;
      for (let s = lo; s <= hi; s++) pr += PSUM(s);
      let ev = 0;
      for (let s = 2; s <= 12; s++) ev += ((s >= lo && s <= hi ? c * PSUM(s) / pr : 0) + (1 - c) * PSUM(s)) * vals[s];
      if (ev > bestEv) { bestEv = ev; best = aim; }
    });
    return best;
  }

  // ---------- World Tour ----------
  function decideTour(S, p, lvl) {
    const P = S.players[p];
    if (P.cash < RULES.travelFee + 40) return { type: 'TOUR_SKIP', p };
    if (lvl === 'easy' && aiRand(S, p, 'tour') < 0.4) return { type: 'TOUR_SKIP', p };
    const cash = P.cash - RULES.travelFee;
    let best = -1, bestV = 60;
    TILES.forEach(t => {
      if (t.i === E.TRAVEL || t.i === E.ISLAND) return;
      let v = landValue(S, p, t.i, lvl);
      const st = S.tiles[t.i];
      if (t.type === 'city' && st.owner === p) {
        const k = bestUpgrade(S, p, t.i, lvl, cash);
        v = k < 0 ? 0 : (tollAt(S, p, t.i, k) - tollAt(S, p, t.i, st.level)) * 2 + (k === 4 ? 260 : 0);
      } else if (t.price && st.owner < 0) {
        v = cash >= E.buyCost(S, p, t.i, 0) + reserve(S, p, lvl) * 0.6 ? 70 + groupBonus(S, p, t.i) + winSwing(S, p, t.i, lvl) * 0.6 : 0;
      } else if (t.type === 'start') {
        v = 80 + (E.targetCandidates(S, p, 'build').length ? 90 : 0);
      } else if (t.type === 'fest') v = E.citiesOf(S, p).length ? 90 : 0;
      if (t.i < P.pos && t.type !== 'start') v += RULES.salary * 0.4;
      if (v > bestV) { bestV = v; best = t.i; }
    });
    return best >= 0 ? { type: 'TOUR_GO', p, tile: best } : { type: 'TOUR_SKIP', p };
  }

  // ---------- Pulau Rindu ----------
  function decideIsland(S, p, lvl) {
    const P = S.players[p];
    const wantOut = !lateGame(S) || dangerAhead(S, p, E.ISLAND).exp < 40;
    if (!wantOut) return { type: 'ROLL', p };
    if (P.cards.some(c => E.CARD[c].power === 'escape')) return { type: 'ISLAND_CARD', p };
    if (!P.islandCh && lvl !== 'easy') return { type: 'ISLAND_CH', p };
    const res = reserve(S, p, lvl);
    if (lvl !== 'easy' && P.cash - RULES.islandFee >= res + 150) return { type: 'ISLAND_PAY', p };
    return { type: 'ROLL', p };
  }

  // ---------- kartu & tantangan ----------
  function fxScore(S, p, fx, lvl) {
    let s = 0;
    const P = S.players[p];
    fx.forEach(e => {
      if (e.gain) s += e.gain;
      if (e.pay) s -= e.pay * (P.cash < e.pay + 200 ? 2 : 1);
      if (e.love) s += e.love * (lvl === 'hard' ? 4 : 3);
      if (e.moveBack) s -= 15;
      if (e.skipTurn) s -= 90;
      if (e.discount) s += 50 * e.discount * 2;
      if (e.nearest) s += 20;
      if (e.target === 'renov') s += E.targetCandidates(S, p, 'renov').length ? 140 : 0;
    });
    return s;
  }
  function decideCardChoice(S, p, c, lvl) {
    let best = 0, bestS = -Infinity;
    c.choice.forEach((o, i) => { const sc = fxScore(S, p, o.fx, lvl) + (lvl === 'easy' ? aiRand(S, p, 'cc' + i) * 60 : 0); if (sc > bestS) { bestS = sc; best = i; } });
    return { type: 'CARD_CHOOSE', p, choice: best };
  }
  function decideChallenge(S, p, it, lvl) {
    const ch = E.CH[it.ch];
    if (ch.type === 'dilemma') {
      let best = 0, bestS = -Infinity;
      ch.options.forEach((o, i) => { const sc = fxScore(S, p, o.fx, lvl); if (sc > bestS) { bestS = sc; best = i; } });
      return { type: 'CH_RESOLVE', p, result: 'choice', choice: best };
    }
    const prob = lvl === 'easy' ? 0.55 : lvl === 'normal' ? 0.75 : 0.9;
    const r = aiRand(S, p, 'ch' + it.ch + it.redraws);
    if (ch.type === 'message') {
      const txt = D.AI_LETTERS[Math.floor(aiRand(S, p, 'letter') * D.AI_LETTERS.length)];
      return r < prob ? { type: 'CH_RESOLVE', p, result: 'complete', text: txt } : { type: 'CH_RESOLVE', p, result: 'skip' };
    }
    if (ch.type === 'guess' || ch.type === 'minigame') return { type: 'CH_RESOLVE', p, result: r < prob ? 'complete' : 'fail' };
    if (r < prob) return { type: 'CH_RESOLVE', p, result: 'complete' };
    if (it.redraws < RULES.maxRedraws && r < prob + 0.12) return { type: 'CH_REDRAW', p };
    return { type: 'CH_RESOLVE', p, result: 'skip' };
  }

  // ---------- utang ----------
  function decideDebt(S, p, it, lvl) {
    const P = S.players[p];
    if (P.cash >= it.amount) return { type: 'PAY_DEBT', p };
    if (E.liquidation(S, p) < it.amount) return { type: 'BANKRUPT', p };
    // jual yang paling sedikit merugikan: bukan grup penuh, bukan landmark, nilai strategis kecil
    const owned = E.ownedBy(S, p);
    let best = owned[0], bestScore = Infinity;
    const need = it.amount - P.cash;
    owned.forEach(t => {
      const tl = TILES[t], st = S.tiles[t];
      let sc = E.tileValue(S, t) * 0.3 + tollAt(S, p, t, st.level) * 2;
      if (tl.type === 'city' && E.ownsGroup(S, p, tl.group)) sc += 400;
      if (st.level >= 4) sc += 300;
      sc += Math.max(0, -winSwing(ownerAfter(S, t, -1), p, t, lvl)) * 0.1;
      // lebih suka satu penjualan yang langsung menutup utang
      if (E.sellValue(S, t) >= need) sc -= 80;
      if (sc < bestScore) { bestScore = sc; best = t; }
    });
    return { type: 'SELL', p, tile: best };
  }

  // ---------- keputusan utama ----------
  function decide(S, p) {
    const P = S.players[p];
    const lvl = P.ai || 'normal';
    const it = S.queue[0];
    if (it) {
      switch (it.type) {
        case 'BUY': return decideBuy(S, p, it, lvl);
        case 'UPGRADE': return decideUpgrade(S, p, it, lvl);
        case 'RENT': return decideRent(S, p, it, lvl);
        case 'TAKEOVER': return decideTakeover(S, p, it, lvl);
        case 'TAX': return { type: 'PAY_TAX', p };
        case 'CARD': { const c = E.CARD[it.card]; return c.choice ? decideCardChoice(S, p, c, lvl) : { type: 'CARD_OK', p }; }
        case 'TARGET': return decideTarget(S, p, it, lvl);
        case 'TOUR': return decideTour(S, p, lvl);
        case 'CHALLENGE': return decideChallenge(S, p, it, lvl);
        case 'DEBT': return decideDebt(S, p, it, lvl);
        default: break;
      }
    }
    if (E.islandPre(S, p)) return decideIsland(S, p, lvl);
    if (E.canRoll(S, p)) {
      const aim = P.island ? null : decideAim(S, p, lvl);
      return aim ? { type: 'ROLL', p, aim } : { type: 'ROLL', p };
    }
    return { type: 'END_TURN', p };
  }

  G.LoveAI = { decide, reserve, winDist, winSwing, landValue, tollAt };
})(typeof window !== 'undefined' ? window : globalThis);
