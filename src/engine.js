/* LOVEOPOLY 2.0 — engine aturan (deterministik, tanpa DOM). Dipakai UI, AI, host online, dan tes. */
(function (G) {
  'use strict';
  const D = G.LOVE_DATA;
  const { RULES, SIDES, GROUPS, TILES, CARDS, CHALLENGES, CH_TYPES, ACHIEVEMENTS, POWER, AUTO_TYPES, HEART_QS, CHARADES, EMOJI_CLUES } = D;

  const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]));
  const CH = Object.fromEntries(CHALLENGES.map(c => [c.id, c]));
  const ACH = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
  const N = TILES.length;
  const GROUP_TILES = {};
  TILES.forEach(t => { if (t.group) (GROUP_TILES[t.group] = GROUP_TILES[t.group] || []).push(t.i); });
  const GROUP_IDS = Object.keys(GROUP_TILES);
  const OWNABLE = TILES.filter(t => t.price).map(t => t.i);
  const CITIES = TILES.filter(t => t.type === 'city').map(t => t.i);
  const SPOTS = TILES.filter(t => t.type === 'spot').map(t => t.i);
  const SIDE_TILES = SIDES.map(sd => Object.assign({}, sd, { tiles: OWNABLE.filter(t => t >= sd.from && t <= sd.to) }));
  const sideOfTile = t => { const sd = SIDES.find(d => t >= d.from && t <= d.to); return sd ? sd.id : null; };
  const ISLAND = TILES.find(t => t.type === 'island').i;
  const FEST = TILES.find(t => t.type === 'fest').i;
  const TRAVEL = TILES.find(t => t.type === 'travel').i;
  const AIM_LABEL = { low: 'kecil', mid: 'sedang', high: 'besar' };
  const AI_LEVELS = ['easy', 'normal', 'hard'];
  const LEVEL_NAME = D.LEVELS.map(l => l.name);

  class RuleError extends Error {}
  function fail(msg) { throw new RuleError(msg); }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clampInt = (v, a, b) => clamp(Math.round(Number(v) || 0), a, b);
  const fmt = n => Math.round(n).toLocaleString('id-ID');
  const r5 = x => Math.round(x / 5) * 5;

  // ---------- RNG (mulberry32, state disimpan di game state) ----------
  function rnd(S) {
    let t = (S.rng = (S.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rint = (S, n) => Math.floor(rnd(S) * n);
  function shuffle(S, a) { for (let i = a.length - 1; i > 0; i--) { const j = rint(S, i + 1); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  // ---------- helpers ----------
  const PL = (S, i) => S.players[i];
  const activeIdx = S => S.players.filter(p => !p.bankrupt).map(p => p.i);
  const tierOf = love => { let k = 0; RULES.loveTiers.forEach((t, i) => { if (love >= t.min) k = i; }); return k; };
  const tierInfo = love => RULES.loveTiers[tierOf(love)];

  function log(S, text, icon, p) {
    S.logN = (S.logN || 0) + 1;
    S.log.push({ n: S.logN, r: S.round, text, icon: icon || 'dot', p: p == null ? -1 : p });
    if (S.log.length > 80) S.log.splice(0, S.log.length - 80);
  }
  const ev = (S, e) => { if (S._ev) S._ev.push(e); };
  const qadd = (S, item) => { S._new.push(item); };

  function cashAdd(S, i, amt) {
    amt = Math.round(amt);
    if (!amt) return;
    const p = PL(S, i);
    p.cash += amt;
    if (amt > 0) p.stats.earned += amt; else p.stats.spent -= amt;
    p.stats.transactions++;
    ev(S, { t: 'money', p: i, d: amt });
  }
  function loveAdd(S, i, d) {
    const p = PL(S, i);
    const before = p.love;
    p.love = clamp(p.love + Math.round(d), 0, 100);
    if (p.love !== before) ev(S, { t: 'love', p: i, d: p.love - before });
  }

  // ---------- kepemilikan & nilai ----------
  const ownedBy = (S, i) => OWNABLE.filter(t => S.tiles[t].owner === i);
  const citiesOf = (S, i) => CITIES.filter(t => S.tiles[t].owner === i);
  const spotsOf = (S, i) => SPOTS.filter(t => S.tiles[t].owner === i);
  function ownsGroup(S, i, g) { return i >= 0 && GROUP_TILES[g].every(t => S.tiles[t].owner === i); }
  function countGroup(S, i, g) { return GROUP_TILES[g].filter(t => S.tiles[t].owner === i).length; }
  function fullGroups(S, i) { return GROUP_IDS.filter(g => ownsGroup(S, i, g)); }

  function levelCost(ti, k) { return Math.round(TILES[ti].price * RULES.buildMult[k]); }
  // biaya dari tingkat `from` (eksklusif; -1 = belum punya tanah) sampai `to` (inklusif)
  function costRange(ti, from, to) { let c = 0; for (let k = from + 1; k <= to; k++) c += levelCost(ti, k); return c; }
  function tileValue(S, ti) {
    const t = TILES[ti];
    if (t.type === 'spot') return t.price;
    return costRange(ti, -1, S.tiles[ti].level);
  }
  function sellValue(S, ti) { return Math.round(tileValue(S, ti) * RULES.sellRate); }
  function netWorth(S, i) {
    const p = PL(S, i);
    if (p.bankrupt) return 0;
    return p.cash + ownedBy(S, i).reduce((s, t) => s + tileValue(S, t), 0);
  }
  function liquidation(S, i) { return PL(S, i).cash + ownedBy(S, i).reduce((s, t) => s + sellValue(S, t), 0); }
  function buildingLevels(S, i) { return citiesOf(S, i).reduce((s, t) => s + S.tiles[t].level, 0); }

  // tingkat tertinggi yang boleh dibangun di kota ini oleh pemain i
  function capLevel(S, i) { return PL(S, i).laps >= RULES.hotelLaps ? 3 : 2; }
  function buyLevels(S, i, ti) { return TILES[ti].type === 'spot' ? [0] : Array.from({ length: capLevel(S, i) + 1 }, (_, k) => k); }
  function upgradeLevels(S, i, ti) {
    const t = TILES[ti], st = S.tiles[ti];
    if (!t || t.type !== 'city' || st.owner !== i) return [];
    if (st.level >= 4) return [];
    if (st.level === 3) return [4];
    const cap = capLevel(S, i);
    const out = [];
    for (let k = st.level + 1; k <= cap; k++) out.push(k);
    return out;
  }
  // Kabar Merpi (event dunia berkala) & Musim Puncak (3 ronde terakhir permainan berbatas ronde)
  const newsOn = (S, id) => !!(S.news && S.news.id === id && S.round <= S.news.to);
  const peakOn = S => !!(S.settings.roundLimit && S.round > S.settings.roundLimit - RULES.peakRounds && !S.over);
  // jeda Kabar Merpi (ronde) menurut durasi: Singkat ≤15 → 4, Normal ≤25 → 5, Panjang → 6, Bebas → 5
  const newsGap = S => { const L = S.settings.roundLimit, G = RULES.newsGap; return !L ? G.free : L <= 15 ? G.short : L <= 25 ? G.normal : G.long; };
  const discounted = (S, i, cost) => Math.max(0, Math.round(cost * (1 - (PL(S, i).discount || 0)) * (newsOn(S, 'sale') ? 1 - RULES.newsSale : 1)));
  function buyCost(S, i, ti, level) { return discounted(S, i, TILES[ti].type === 'spot' ? TILES[ti].price : costRange(ti, -1, level)); }
  function upgradeCost(S, i, ti, level) { return discounted(S, i, costRange(ti, S.tiles[ti].level, level)); }

  // ---------- tol ----------
  function rentInfo(S, ti) {
    const t = TILES[ti], st = S.tiles[ti], o = st.owner;
    if (o < 0) return null;
    const parts = [];
    let r;
    if (t.type === 'spot') {
      const n = spotsOf(S, o).length;
      r = RULES.spotRent[Math.max(0, n - 1)];
      parts.push({ k: 'base', label: 'Tol wisata (' + n + ' dimiliki)', v: r });
    } else {
      r = t.price * RULES.rentMult[st.level];
      parts.push({ k: 'base', label: 'Tol ' + LEVEL_NAME[st.level], v: Math.round(r) });
      if (ownsGroup(S, o, t.group)) { r *= RULES.groupMult; parts.push({ k: 'group', label: 'Grup ' + GROUPS[t.group].name + ' penuh', m: RULES.groupMult }); }
      if (S.festival.tile === ti) { r *= S.festival.mult; parts.push({ k: 'fest', label: 'Festival Cinta', m: S.festival.mult }); }
    }
    if (S.news && S.round <= S.news.to && S.news.side && sideOfTile(ti) === S.news.side) {
      const m = S.news.id === 'rain' ? RULES.newsRain : S.news.id === 'holiday' ? RULES.newsHoliday : 1;
      if (m !== 1) { r *= m; parts.push({ k: 'news', label: NEWS_LABEL[S.news.id] + ' (' + sideName(S.news.side) + ')', m }); }
    }
    if (peakOn(S)) { r *= RULES.peakMult; parts.push({ k: 'peak', label: 'Musim Puncak', m: RULES.peakMult }); }
    const pct = tierInfo(PL(S, o).love).rentPct;
    if (pct) { r *= 1 + pct / 100; parts.push({ k: 'love', label: 'Love Meter ' + tierInfo(PL(S, o).love).name, pct }); }
    return { amount: r5(r), parts };
  }
  function rentFor(S, ti, payer) {
    const st = S.tiles[ti];
    if (st.owner < 0 || st.owner === payer || (payer >= 0 && PL(S, st.owner).bankrupt)) return 0;
    const ri = rentInfo(S, ti);
    return ri ? ri.amount : 0;
  }

  // ---------- menang instan & ambil alih ----------
  // Trio Warna: 3 grup warna penuh, minimal satu di antaranya grup 3 kota (grup 2 kota terlalu cepat terkumpul)
  const tripleOk = fg => fg.length >= RULES.tripleGroups && fg.some(g => GROUP_TILES[g].length >= 3);
  function winCheck(S, i) {
    const p = PL(S, i);
    if (!p || p.bankrupt) return null;
    const fg = fullGroups(S, i);
    if (tripleOk(fg)) return { kind: 'triple', groups: fg.slice(0, RULES.tripleGroups) };
    for (const sd of SIDE_TILES) if (sd.tiles.every(t => S.tiles[t].owner === i)) return { kind: 'line', side: sd.id };
    if (SPOTS.every(t => S.tiles[t].owner === i)) return { kind: 'spots' };
    return null;
  }
  // pemain yang tinggal SATU petak lagi menuju menang instan → [{ p, tile, kind, group?, side? }]
  function winThreats(S) {
    if (!S.settings.instantWin || S.over) return [];
    const out = [];
    activeIdx(S).forEach(i => {
      const need = new Map();
      const fg = fullGroups(S, i);
      if (fg.length >= RULES.tripleGroups - 1) GROUP_IDS.forEach(g => {
        if (fg.includes(g)) return;
        const miss = GROUP_TILES[g].filter(t => S.tiles[t].owner !== i);
        if (miss.length === 1 && !need.has(miss[0]) && tripleOk(fg.concat([g]))) need.set(miss[0], { kind: 'triple', group: g });
      });
      SIDE_TILES.forEach(sd => {
        const miss = sd.tiles.filter(t => S.tiles[t].owner !== i);
        if (miss.length === 1 && !need.has(miss[0])) need.set(miss[0], { kind: 'line', side: sd.id });
      });
      const ms = SPOTS.filter(t => S.tiles[t].owner !== i);
      if (ms.length === 1 && !need.has(ms[0])) need.set(ms[0], { kind: 'spots' });
      need.forEach((v, t) => out.push(Object.assign({ p: i, tile: t }, v)));
    });
    return out;
  }
  function takeoverPrice(S, ti) { return Math.round(tileValue(S, ti) * RULES.takeoverMult); }
  function canTakeover(S, i, ti) {
    if (!S.settings.takeover) return { ok: false, reason: 'Aturan ambil alih tidak aktif.' };
    const t = TILES[ti], st = S.tiles[ti];
    if (!t || !t.price) return { ok: false, reason: 'Petak ini tidak bisa dimiliki.' };
    const o = st.owner;
    if (o < 0 || o === i || PL(S, o).bankrupt) return { ok: false, reason: 'Bukan milik lawan.' };
    if (t.type === 'spot') return { ok: false, reason: 'Tempat wisata tidak bisa diambil alih.', spot: true };
    if (st.level >= 4) return { ok: false, reason: 'Landmark kebal diambil alih.', landmark: true };
    const price = takeoverPrice(S, ti);
    if (PL(S, i).cash < price) return { ok: false, reason: 'Uang kurang (butuh ' + fmt(price) + ').', price };
    return { ok: true, price };
  }
  function offerTakeover(S, i, ti) {
    if (!S.settings.takeover || S.over || PL(S, i).bankrupt) return;
    const c = canTakeover(S, i, ti);
    if (c.ok) qadd(S, { type: 'TAKEOVER', p: i, tile: ti, owner: S.tiles[ti].owner, price: c.price });
  }
  function offerUpgrade(S, i, ti, src) {
    const lv = upgradeLevels(S, i, ti);
    if (!lv.length) return false;
    if (PL(S, i).cash < upgradeCost(S, i, ti, lv[0])) {
      log(S, PL(S, i).name + ' belum cukup uang untuk membangun ' + LEVEL_NAME[lv[0]] + ' di ' + TILES[ti].name + '.', 'dot', i);
      return false;
    }
    qadd(S, { type: 'UPGRADE', p: i, tile: ti, src: src || 'visit' });
    return true;
  }

  // ---------- pembuatan game ----------
  // pesan romantis dari Paspor Cinta pemain: teks satu baris, maks 240 huruf
  const cleanMsg = x => String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
  function newPlayer(src, i, cash) {
    return {
      i,
      name: String(src.name || ('Pemain ' + (i + 1))).trim().slice(0, 16) || ('Pemain ' + (i + 1)),
      avatar: String(src.avatar || D.AVATARS[i % D.AVATARS.length]).slice(0, 8),
      msg: cleanMsg(src.msg),
      color: /^#[0-9a-fA-F]{6}$/.test(src.color || '') ? src.color : D.TOKEN_COLORS[i % D.TOKEN_COLORS.length],
      kind: src.kind === 'ai' ? 'ai' : 'human',
      ai: AI_LEVELS.includes(src.ai) ? src.ai : 'normal',
      uid: src.uid || null,
      cash, pos: 0, laps: 0, island: false, islandTries: 0, islandCh: false, tour: false, skip: 0, bankrupt: false,
      love: RULES.loveStart, cards: [], discount: 0, achievements: [],
      stats: {
        tollIn: 0, tollOut: 0, bought: 0, built: 0, landmarks: 0, takeovers: 0, takenFrom: 0, festivals: 0, travels: 0,
        islands: 0, escapes: 0, challenges: 0, skipped: 0, failed: 0, letters: 0, doubles: 0, aimHits: 0, debts: 0,
        survived: 0, angels: 0, earned: 0, spent: 0, transactions: 0, maxNet: cash, bankruptRound: 0, sold: 0, starts: 0
      }
    };
  }

  function create(setup) {
    if (!setup || !Array.isArray(setup.players) || setup.players.length < 2 || setup.players.length > 4) {
      throw new Error('Butuh 2–4 pemain.');
    }
    const st = setup.settings || {};
    const settings = {
      startCash: clampInt(st.startCash == null ? RULES.startCash : st.startCash, 1000, 6000),
      roundLimit: clampInt(st.roundLimit == null ? 30 : st.roundLimit, 0, 200),
      winMessage: String(st.winMessage || '').slice(0, 240),
      online: !!st.online,
      debug: !!st.debug,
      takeover: st.takeover !== false,
      instantWin: st.instantWin !== false,
      diceControl: st.diceControl !== false,
      news: st.news !== false
    };
    const seed = (Number(setup.seed) >>> 0) || ((Math.random() * 4294967296) >>> 0) || 1;
    const S = {
      v: 2, seq: 0, rng: seed, seed, settings,
      players: setup.players.map((p, i) => newPlayer(p, i, settings.startCash)),
      tiles: TILES.map(() => ({ owner: -1, level: 0 })),
      festival: { tile: -1, mult: 1 },
      turn: { p: 0, rolled: false, doubles: 0, canRollAgain: false, dice: [0, 0], rollId: 0 },
      round: 1, queue: [],
      decks: { card: [], challenge: {} },
      log: [], logN: 0, letters: [], proofs: [],
      lastEvents: [], evSeq: 0, over: null, paused: false
    };
    // semua pemain sama persis (modal, posisi START, tanpa bonus). Keadilan lewat undian giliran pertama:
    // setup.first = 'random' (dipakai UI & online) atau indeks pemain; bawaan 0 (deterministik untuk uji)
    const first = setup.first === 'random' ? rint(S, S.players.length) : clampInt(setup.first || 0, 0, S.players.length - 1);
    S.start = first;
    S.turn.p = first;
    S.decks.card = shuffle(S, CARDS.map(c => c.id));
    chDecks(S);
    log(S, 'Permainan dimulai. Selamat keliling dunia berdua!', 'heart');
    if (setup.first === 'random') log(S, 'Undian giliran: ' + PL(S, first).name + ' jalan duluan!', 'dice', first);
    return S;
  }

  // ---------- gerak ----------
  function passStart(S, i) {
    const p = PL(S, i);
    const pay = RULES.salary + tierInfo(p.love).salary + (newsOn(S, 'bonus') ? RULES.newsBonus : 0);
    p.laps++;
    p.stats.starts++;
    cashAdd(S, i, pay);
    loveAdd(S, i, newsOn(S, 'love') ? 5 : 1);
    ev(S, { t: 'salary', p: i, amount: pay, laps: p.laps });
    log(S, p.name + ' melewati START: gaji ' + fmt(pay) + '.' + (p.laps === RULES.hotelLaps ? ' Hotel sekarang bisa dibangun!' : ''), 'coins', i);
  }
  function walk(S, i, steps) {
    const p = PL(S, i), from = p.pos;
    ev(S, { t: 'move', p: i, from, to: (from + steps) % N, steps, kind: 'walk' });
    for (let k = 0; k < steps; k++) { p.pos = (p.pos + 1) % N; if (p.pos === 0) passStart(S, i); }
  }
  function walkBack(S, i, steps) {
    const p = PL(S, i), from = p.pos;
    p.pos = (p.pos - steps + N) % N;
    ev(S, { t: 'move', p: i, from, to: p.pos, steps: -steps, kind: 'walk' });
  }
  function advanceTo(S, i, target) {
    const steps = (target - PL(S, i).pos + N) % N;
    if (steps > 0) walk(S, i, steps);
  }
  function flyTo(S, i, target, kind) {
    const p = PL(S, i), from = p.pos;
    if (target === from) return;
    ev(S, { t: 'move', p: i, from, to: target, steps: 0, kind: kind || 'jump' });
    if (target < from || target === 0) passStart(S, i);
    p.pos = target;
  }
  function sendToIsland(S, i, why) {
    const p = PL(S, i), from = p.pos;
    p.pos = ISLAND; p.island = true; p.islandTries = 0; p.islandCh = false; p.tour = false;
    p.stats.islands++;
    if (S.turn.p === i) { S.turn.canRollAgain = false; S.turn.doubles = 0; }
    loveAdd(S, i, -3);
    if (from !== ISLAND) ev(S, { t: 'move', p: i, from, to: ISLAND, steps: 0, kind: 'jump' });
    ev(S, { t: 'island', p: i });
    log(S, p.name + ' terdampar di Pulau Rindu' + (why ? ' (' + why + ')' : '') + '.', 'island', i);
  }
  function release(S, i, how) {
    const p = PL(S, i);
    p.island = false; p.islandTries = 0;
    log(S, p.name + ' meninggalkan Pulau Rindu ' + how + '.', 'boat', i);
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
    [p].concat(others).forEach(q => { loveAdd(S, q.i, RULES.meetLove * k); cashAdd(S, q.i, RULES.meetCash * k); q.stats.meets = (q.stats.meets || 0) + 1; });
    log(S, 'Ketemuan! ' + p.name + ' bertemu ' + others.map(q => q.name).join(' & ') + ' di ' + TILES[p.pos].name + ': masing-masing +' + fmt(RULES.meetCash * k) + ' dan Love +' + RULES.meetLove * k + '.', 'heart', i);
    ev(S, { t: 'meet', p: i, with: others.map(q => q.i), tile: p.pos, cash: RULES.meetCash * k, love: RULES.meetLove * k });
  }
  function land(S, i) {
    meetUp(S, i);
    const p = PL(S, i);
    const t = TILES[p.pos];
    switch (t.type) {
      case 'city': case 'spot': landOwnable(S, i, t); break;
      case 'card': drawCard(S, i); break;
      case 'tax': {
        const amt = Math.round(netWorth(S, i) * RULES.taxRate / 10) * 10;
        if (amt > 0) qadd(S, { type: 'TAX', p: i, amount: amt });
        else log(S, p.name + ' bebas Pajak Rindu (aset kosong).', 'dot', i);
        break;
      }
      case 'start': offerTarget(S, i, 'build', 'start'); break;
      case 'island': sendToIsland(S, i, ''); break;
      case 'fest': offerTarget(S, i, 'festival', 'corner'); break;
      case 'travel':
        p.tour = true;
        if (S.turn.p === i) { S.turn.canRollAgain = false; }
        log(S, p.name + ' tiba di World Tour. Giliran depan bisa terbang ke mana saja!', 'plane', i);
        ev(S, { t: 'tour', p: i });
        break;
      default: break;
    }
  }
  function landOwnable(S, i, t) {
    const st = S.tiles[t.i];
    const p = PL(S, i);
    if (st.owner === -1) {
      if (p.cash < buyCost(S, i, t.i, 0)) { log(S, p.name + ' belum cukup uang untuk membeli ' + t.name + '.', 'dot', i); return; }
      qadd(S, { type: 'BUY', p: i, tile: t.i });
      return;
    }
    if (st.owner === i) {
      if (t.type === 'city') offerUpgrade(S, i, t.i, 'visit');
      return;
    }
    const amount = rentFor(S, t.i, i);
    if (amount <= 0) { offerTakeover(S, i, t.i); return; }
    qadd(S, { type: 'RENT', p: i, to: st.owner, tile: t.i, amount, base: amount, discountUsed: false });
  }
  // pilihan petak di papan (festival, bangun dari START, kartu aksi)
  function targetCandidates(S, i, kind) {
    const p = PL(S, i);
    if (kind === 'festival') return citiesOf(S, i);
    if (kind === 'build') return citiesOf(S, i).filter(t => { const lv = upgradeLevels(S, i, t); return lv.length && p.cash >= upgradeCost(S, i, t, lv[0]); });
    if (kind === 'renov') return citiesOf(S, i).filter(t => upgradeLevels(S, i, t).length);
    if (kind === 'storm') return CITIES.filter(t => { const st = S.tiles[t]; return st.owner >= 0 && st.owner !== i && !PL(S, st.owner).bankrupt && st.level >= 1 && st.level < 4; });
    if (kind === 'swap') return citiesOf(S, i).filter(t => S.tiles[t].level < 4);
    return [];
  }
  function swapTargets(S, i) { return CITIES.filter(t => { const st = S.tiles[t]; return st.owner >= 0 && st.owner !== i && !PL(S, st.owner).bankrupt && st.level < 4; }); }
  const TARGET_NONE = {
    festival: 'belum punya kota untuk festival',
    build: 'belum ada kota yang bisa dibangun',
    renov: 'belum ada kota yang bisa direnovasi',
    storm: 'tidak ada kota lawan yang terkena badai',
    swap: 'belum ada kota yang bisa ditukar'
  };
  function offerTarget(S, i, kind, src) {
    const c = targetCandidates(S, i, kind);
    if (!c.length || (kind === 'swap' && !swapTargets(S, i).length)) {
      log(S, PL(S, i).name + ' ' + TARGET_NONE[kind] + '.', 'dot', i);
      return false;
    }
    qadd(S, { type: 'TARGET', p: i, kind, src: src || 'card' });
    return true;
  }

  // ---------- kartu ----------
  function drawCard(S, i) {
    const d = S.decks.card;
    if (!d.length) { log(S, 'Tumpukan Kartu Cinta sedang kosong.', 'dot', i); return; }
    const id = d.shift();
    if (!CARD[id].power) d.push(id);
    qadd(S, { type: 'CARD', p: i, card: id });
    ev(S, { t: 'card', p: i, card: id });
  }
  function returnPowerCard(S, id) { if (CARD[id]) S.decks.card.push(id); }
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
      if (e.pay != null) charge(S, i, e.pay, -1, 'biaya kartu');
      if (e.love != null) loveAdd(S, i, e.love);
      if (e.collectEach != null) activeIdx(S).forEach(j => { if (j !== i) charge(S, j, e.collectEach, i, 'hadiah untuk ' + p.name); });
      if (e.payEach != null) activeIdx(S).forEach(j => { if (j !== i) charge(S, i, e.payEach, j, 'traktiran untuk ' + PL(S, j).name); });
      if (e.repairs != null) {
        const n = buildingLevels(S, i);
        if (n) charge(S, i, n * e.repairs, -1, 'servis bangunan'); else log(S, p.name + ' belum punya bangunan. Aman!', 'dot', i);
      }
      if (e.moveTo != null) { advanceTo(S, i, e.moveTo); land(S, i); }
      if (e.moveBack != null) { walkBack(S, i, e.moveBack); land(S, i); }
      if (e.nearest) { advanceTo(S, i, nearestTile(p.pos, e.nearest)); land(S, i); }
      if (e.goIsland) sendToIsland(S, i, 'kartu');
      if (e.skipTurn) { p.skip += e.skipTurn; log(S, p.name + ' akan kehilangan giliran berikutnya.', 'pause', i); }
      if (e.discount) { p.discount = Math.max(p.discount, e.discount); log(S, p.name + ' punya voucher diskon ' + Math.round(e.discount * 100) + '% untuk beli/bangun berikutnya.', 'ticket', i); }
      if (e.target) offerTarget(S, i, e.target, 'card');
      if (e.challenge) qadd(S, chItem(S, i, e.challenge, 'card'));
      if (e.richToPoor != null) {
        const act = activeIdx(S).slice().sort((a, b) => PL(S, b).cash - PL(S, a).cash);
        const rich = act[0], poor = act[act.length - 1];
        if (rich !== poor && PL(S, rich).cash > PL(S, poor).cash) {
          charge(S, rich, e.richToPoor, poor, 'traktiran untuk ' + PL(S, poor).name);
          log(S, PL(S, rich).name + ' (uang terbanyak) mentraktir ' + PL(S, poor).name + '.', 'coins', rich);
        } else log(S, 'Uang semua pemain setara. Tidak ada traktiran.', 'dot', i);
      }
    }
  }

  // ---------- tantangan ----------
  // Tidak ada "klik Selesai" tanpa bukti: auto = soal dari seed dinilai engine; duel = jawaban lawan dibandingkan
  // engine; judge = lawan manusia mengesahkan aksi nyata. Item: { type: 'CHALLENGE', p (pemilik), who (yang
  // sedang beraksi), judge (lawan penilai / -1), phase, pz (soal), isle (Rindu Challenge: syarat lebih ringan) }.
  const NEEDS_JUDGE = ['secret', 'bluff', 'charades', 'dare', 'photo'];
  const PHOTO_MAX = 22000, PHOTO_KEEP = 4;
  const PHOTO_RE = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
  const PRICED = TILES.filter(t => t.price).map(t => t.i);
  const RECALL_POOL = ['kotatua', 'bali', 'paris', 'kyoto', 'santorini', 'hawaii', 'ferris', 'balloon', 'swiss', 'seoul', 'maldives', 'aurora'];
  function chDecks(S) {
    S.decks.challenge = S.decks.challenge || {};
    Object.keys(CH_TYPES).forEach(type => {
      const ids = CHALLENGES.filter(c => c.type === type).map(c => c.id);
      const cur = S.decks.challenge[type];
      if (!Array.isArray(cur) || !cur.length || cur.some(id => !CH[id])) S.decks.challenge[type] = shuffle(S, ids);
    });
  }
  // lawan manusia aktif berikutnya dalam urutan giliran (bot tidak pernah menjadi penilai)
  function judgeFor(S, i) {
    const n = S.players.length;
    for (let k = 1; k < n; k++) { const q = S.players[(i + k) % n]; if (q.kind === 'human' && !q.bankrupt) return q.i; }
    return -1;
  }
  function chType(S, i, cat) {
    const human = PL(S, i).kind === 'human', j = human ? judgeFor(S, i) : -1;
    const pickOf = arr => arr[rint(S, arr.length)];
    const auto = () => pickOf(AUTO_TYPES);
    if (cat === 'skill') return auto();
    if (cat === 'any') return pickOf(AUTO_TYPES.concat(['dilemma'], human ? ['message'] : [], j >= 0 ? NEEDS_JUDGE : []));
    if (cat === 'rindu') return pickOf(AUTO_TYPES.concat(j >= 0 ? NEEDS_JUDGE : []));
    if (!CH_TYPES[cat]) return auto();
    if (NEEDS_JUDGE.includes(cat) && j < 0) return auto();
    if (cat === 'message' && !human) return auto();
    return cat;
  }
  function pickN(S, arr, n) { return shuffle(S, arr.slice()).slice(0, n); }
  const normWord = x => String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  function sideOf(t) { const sd = SIDES.find(d => t >= d.from && t <= d.to); return sd ? sd.name : ''; }
  // jawaban benar sebuah soal trivia (dihitung dari data papan, tidak disimpan di state)
  function triviaAnswer(q) {
    if (q.k === 'max') { let best = -1, bi = 0; q.o.forEach((nm, k) => { const t = TILES.find(x => x.name === nm); if (t && t.price > best) { best = t.price; bi = k; } }); return bi; }
    if (q.k === 'group') return q.o.indexOf(GROUPS[TILES[q.s].group].name);
    if (q.k === 'next') return q.o.indexOf(TILES[(q.s + 1) % N].name);
    if (q.k === 'side') return q.o.indexOf(sideOf(q.s));
    if (q.k === 'price') return q.o.indexOf(fmt(TILES[q.s].price));
    if (q.k === 'odd') return q.o.findIndex(nm => { const t = TILES.find(x => x.name === nm); return !t || sideOf(t.i) !== q.side; });
    return -1;
  }
  function genTrivia(S, n) {
    const kinds = shuffle(S, ['max', 'group', 'next', 'side', 'price', 'odd', 'next']).slice(0, n);
    const used = new Set();
    const subj = pool => { const c = pool.filter(t => !used.has(t)); const t = c[rint(S, c.length)]; used.add(t); return t; };
    const cities = TILES.filter(t => t.type === 'city').map(t => t.i), sideT = TILES.filter(t => t.price && sideOf(t.i)).map(t => t.i);
    const withAns = (ans, others) => shuffle(S, [ans].concat(pickN(S, others.filter(x => x !== ans), 3)));
    return kinds.map(k => {
      if (k === 'max') {
        const prices = new Set(), opts = [];
        shuffle(S, PRICED.slice()).forEach(t => { if (opts.length < 4 && !prices.has(TILES[t].price)) { prices.add(TILES[t].price); opts.push(TILES[t].name); } });
        return { k, s: -1, t: 'Mana yang harga belinya paling mahal?', o: opts };
      }
      if (k === 'group') { const t = subj(cities); return { k, s: t, t: TILES[t].name + ' termasuk grup warna apa?', o: withAns(GROUPS[TILES[t].group].name, Object.values(GROUPS).map(g => g.name)) }; }
      if (k === 'next') {
        const t = subj(TILES.map(x => x.i).filter(i => TILES[i].type !== 'card' && TILES[(i + 1) % N].type !== 'card'));
        const names = [...new Set(TILES.map(x => x.name))];
        return { k, s: t, t: 'Petak apa yang tepat sesudah ' + TILES[t].name + ' (searah langkah pion)?', o: withAns(TILES[(t + 1) % N].name, names) };
      }
      if (k === 'odd') {
        const sd = SIDES[rint(S, SIDES.length)], inS = sideT.filter(t => sideOf(t) === sd.name), out = sideT.filter(t => sideOf(t) !== sd.name);
        const o = shuffle(S, pickN(S, inS, 3).concat([out[rint(S, out.length)]]).map(t => TILES[t].name));
        return { k, s: -1, side: sd.name, t: 'Mana yang BUKAN bagian dari ' + sd.name + '?', o };
      }
      if (k === 'side') { const t = subj(sideT); return { k, s: t, t: TILES[t].name + ' ada di jalur mana?', o: withAns(sideOf(t), SIDES.map(d => d.name)) }; }
      const t = subj(PRICED);
      const near = [...new Set(PRICED.map(i => TILES[i].price))].filter(v => v !== TILES[t].price).sort((a, b) => Math.abs(a - TILES[t].price) - Math.abs(b - TILES[t].price)).slice(0, 5);
      return { k: 'price', s: t, t: 'Berapa harga beli ' + TILES[t].name + '?', o: withAns(fmt(TILES[t].price), near.map(fmt)) };
    });
  }
  function genMath(S, n) {
    const P = () => TILES[PRICED[rint(S, PRICED.length)]].price;
    const kinds = shuffle(S, ['fest', 'trip', 'tax', 'change', 'fest', 'trip']).slice(0, n);
    return kinds.map(k => {
      if (k === 'fest') { const a = P(), m = 2 + rint(S, 2), b = P(); return { k, n: [a, m, b], t: 'Tol ' + fmt(a) + ' × ' + m + ' (festival) + tol ' + fmt(b) + ' = ?' }; }
      if (k === 'trip') { const a = P(), b = P(), c = P(); return { k, n: [a, b, c], t: 'Beli ' + fmt(a) + ' + ' + fmt(b) + ' − jual ' + fmt(c) + ' = ?' }; }
      if (k === 'tax') { const a = (120 + rint(S, 380)) * 10; return { k, n: [a], t: 'Pajak Rindu 10% dari aset ' + fmt(a) + ' = ?' }; }
      const a = 1000 + rint(S, 20) * 50, b = P(), c = P(); return { k: 'change', n: [a, b, c], t: 'Uang ' + fmt(a) + ', bayar tol ' + fmt(b) + ' dan ' + fmt(c) + '. Sisa = ?' };
    });
  }
  function mathAnswer(q) {
    const [a, b, c] = q.n;
    if (q.k === 'fest') return a * b + c;
    if (q.k === 'trip') return a + b - c;
    if (q.k === 'tax') return Math.round(a / 10);
    return a - b - c;
  }
  function scrambleWord(S, w) {
    const word = x => { if (x.length < 3) return x; let y = x; for (let k = 0; k < 8 && y.toLowerCase() === x.toLowerCase(); k++) y = shuffle(S, x.split('')).join(''); return y; };
    return w.split(' ').map(word).join(' ').toUpperCase();
  }
  function setupCh(S, it) {
    const ch = CH[it.ch], def = CH_TYPES[ch.type], I = it.isle;
    const of = (I && def.ofIsle) || def.of, need = (I && def.needIsle) || def.need, secs = (I && def.secsIsle) || def.secs;
    it.phase = 'play'; it.who = it.p; it.pz = null;
    if (ch.type === 'trivia') it.pz = { qs: genTrivia(S, of), need, secs };
    else if (ch.type === 'price') it.pz = { items: pickN(S, PRICED, of), need, secs, tol: (I && def.tolIsle) || def.tol };
    else if (ch.type === 'recall') {
      const pool = pickN(S, RECALL_POOL, 6), seq = [];
      while (seq.length < of) { const x = pool[rint(S, pool.length)]; if (x !== seq[seq.length - 1]) seq.push(x); }
      it.pz = { pool, seq, need: of, secs, showMs: 900 + of * 550 };
    } else if (ch.type === 'math') it.pz = { qs: genMath(S, of), need, secs };
    else if (ch.type === 'emoji') {
      const keys = Object.keys(EMOJI_CLUES).map(Number), names = [...new Set(keys.map(t => TILES[t].name))];
      it.pz = { qs: pickN(S, keys, of).map(t => ({ s: t, e: EMOJI_CLUES[t], o: shuffle(S, [TILES[t].name].concat(pickN(S, names.filter(x => x !== TILES[t].name), 3))) })), need, secs };
    }
    else if (ch.type === 'scramble') it.pz = { items: pickN(S, PRICED.concat([ISLAND]), of).map(t => ({ s: t, w: scrambleWord(S, TILES[t].name) })), need, secs };
    else if (ch.type === 'secret') { it.phase = 'intro'; it.pz = { qs: pickN(S, HEART_QS.map((_, k) => k), def.of), need: def.need }; }
    else if (ch.type === 'bluff') it.phase = 'write';
    else if (ch.type === 'charades') { it.phase = 'act'; it.pz = { word: CHARADES[rint(S, CHARADES.length)], secs: def.secs, tries: 0, max: def.tries, guesses: [] }; }
    else if (ch.type === 'message') it.phase = 'write';
    else if (ch.type === 'dare') { it.phase = 'do'; it.pz = { secs: ch.secs || 30 }; }
    else if (ch.type === 'photo') { it.phase = 'do'; it.pz = {}; }
    else if (ch.type === 'dilemma') it.phase = 'choose';
  }
  function drawChallenge(S, i, cat) {
    chDecks(S);
    const type = chType(S, i, cat);
    const deck = S.decks.challenge[type];
    const id = deck.shift(); deck.push(id);
    return id;
  }
  // Penilai = semua lawan manusia aktif (it.judges). Penilai utama (it.judge, dipakai {j} di teks tantangan & Tebak Isi
  // Hati) bergiliran per pemilik lewat S.chRot supaya tidak selalu orang yang sama. 2 pemain: daftarnya 1 orang = aturan lama.
  function judgesFor(S, i, rot) {
    const n = S.players.length, list = [];
    for (let k = 1; k < n; k++) { const q = S.players[(i + k) % n]; if (q.kind === 'human' && !q.bankrupt) list.push(q.i); }
    if (!list.length) return list;
    const s = (((rot || 0) % list.length) + list.length) % list.length;
    return list.slice(s).concat(list.slice(0, s));
  }
  function assignJudges(S, it, fresh) {
    const t = CH[it.ch].type;
    if (!(NEEDS_JUDGE.includes(t) || t === 'message')) { it.judge = -1; it.judges = []; return; }
    if (fresh || it.rot == null) { S.chRot = S.chRot || {}; it.rot = S.chRot[it.p] || 0; S.chRot[it.p] = it.rot + 1; }
    it.judges = judgesFor(S, it.p, it.rot);
    it.judge = it.judges.length ? it.judges[0] : -1;
  }
  const multiJudge = it => Array.isArray(it.judges) && it.judges.length > 1;
  // Peragakan! dengan banyak penebak: siapa yang masih boleh menebak (sisa kesempatan)
  const charadesOpen = (S, it) => it && it.type === 'CHALLENGE' && CH[it.ch] && CH[it.ch].type === 'charades' && it.phase === 'guess' && multiJudge(it);
  const guessLeft = (it, j) => (it.pz.max || 3) - ((it.pz.triesBy || {})[j] || 0);
  function chActors(S) {
    const it = S.queue[0];
    if (charadesOpen(S, it)) return it.judges.filter(j => !PL(S, j).bankrupt && guessLeft(it, j) > 0);
    const a = actor(S);
    return a >= 0 ? [a] : [];
  }
  function chItem(S, i, cat, source) {
    const it = { type: 'CHALLENGE', p: i, ch: drawChallenge(S, i, cat), cat, source, redraws: 0, isle: source === 'island', judge: -1, judges: [] };
    assignJudges(S, it, true);
    setupCh(S, it);
    return it;
  }
  // migrasi save lama / item buatan tangan: tantangan tanpa fase atau dengan id yang sudah dihapus disiapkan ulang
  function migrate(S) {
    if (!S || !Array.isArray(S.queue)) return S;
    if (!S.proofs) S.proofs = [];
    S.queue.forEach(it => {
      if (it.type === 'CHALLENGE' && !Array.isArray(it.judges)) it.judges = it.judge >= 0 ? [it.judge] : [];
      if (it.type !== 'CHALLENGE' || (CH[it.ch] && it.phase && it.who != null)) return;
      if (!S.decks) S.decks = { card: [], challenge: {} };
      if (!CH[it.ch]) it.ch = drawChallenge(S, it.p, it.cat || 'any');
      if (it.redraws == null) it.redraws = 0;
      it.isle = it.source === 'island';
      assignJudges(S, it, false);
      if (NEEDS_JUDGE.includes(CH[it.ch].type) && it.judge < 0) { it.ch = drawChallenge(S, it.p, 'skill'); it.judge = -1; it.judges = []; }
      setupCh(S, it);
    });
    return S;
  }
  // jawaban benar untuk tantangan auto (dipakai AI & umpan balik UI; penilaian tetap di engine)
  function chSolve(it) {
    const ch = CH[it.ch], z = it.pz;
    if (!z) return null;
    if (ch.type === 'trivia') return z.qs.map(triviaAnswer);
    if (ch.type === 'price') return z.items.map(t => TILES[t].price);
    if (ch.type === 'recall') return z.seq.slice();
    if (ch.type === 'math') return z.qs.map(mathAnswer);
    if (ch.type === 'scramble') return z.items.map(x => TILES[x.s].name);
    if (ch.type === 'emoji') return z.qs.map(q => q.o.indexOf(TILES[q.s].name));
    return null;
  }
  function gradeAuto(it, ans) {
    const ch = CH[it.ch], z = it.pz, A = Array.isArray(ans) ? ans : [];
    if (ch.type === 'trivia') return z.qs.reduce((n, q, k) => n + (Number(A[k]) === triviaAnswer(q) ? 1 : 0), 0);
    if (ch.type === 'price') return z.items.reduce((n, t, k) => { const v = Number(String(A[k] == null ? '' : A[k]).replace(/\D/g, '')); const pr = TILES[t].price; return n + (v > 0 && Math.abs(v - pr) <= pr * z.tol ? 1 : 0); }, 0);
    if (ch.type === 'recall') return z.seq.every((x, k) => A[k] === x) && A.length === z.seq.length ? z.seq.length : 0;
    if (ch.type === 'math') return z.qs.reduce((n, q, k) => n + (A[k] !== '' && A[k] != null && Number(String(A[k]).replace(/[^\d-]/g, '')) === mathAnswer(q) ? 1 : 0), 0);
    if (ch.type === 'scramble') return z.items.reduce((n, x, k) => n + (normWord(A[k]) === normWord(TILES[x.s].name) ? 1 : 0), 0);
    if (ch.type === 'emoji') return z.qs.reduce((n, q, k) => n + (Number(A[k]) === q.o.indexOf(TILES[q.s].name) ? 1 : 0), 0);
    return 0;
  }
  const secsTxt = ms => (Math.round(ms / 100) / 10).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' dtk';
  // cek syarat Surat Bersyarat; kembalikan daftar { ok, label }
  function messageChecks(rule, text) {
    const t = String(text || ''), lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean), words = t.split(/\s+/).filter(w => /[a-z0-9]/i.test(w));
    const out = [];
    if (rule.acrostic) out.push({ ok: lines.length === rule.acrostic.length && rule.acrostic.split('').every((c, k) => lines[k] && normWord(lines[k])[0] === c.toLowerCase()), label: rule.acrostic.length + ' baris diawali ' + rule.acrostic.split('').join('-') });
    if (rule.cities) { const found = new Set(TILES.filter(x => x.type === 'city' || x.type === 'spot').filter(x => normWord(t).includes(normWord(x.name))).map(x => x.name)); out.push({ ok: found.size >= rule.cities, label: 'Memuat ' + rule.cities + ' nama kota di papan (' + found.size + ')' }); }
    if (rule.noLetter) out.push({ ok: t.length > 0 && !t.toLowerCase().includes(rule.noLetter), label: 'Tanpa huruf "' + rule.noLetter + '"' });
    if (rule.minWords) out.push({ ok: words.length >= rule.minWords, label: 'Minimal ' + rule.minWords + ' kata (' + words.length + ')' });
    if (rule.lines) out.push({ ok: lines.length === rule.lines, label: 'Tepat ' + rule.lines + ' baris (' + lines.length + ')' });
    if (rule.wordsPerLine) out.push({ ok: lines.length > 0 && lines.every(l => l.split(/\s+/).filter(Boolean).length >= rule.wordsPerLine), label: 'Tiap baris minimal ' + rule.wordsPerLine + ' kata' });
    if (rule.rhyme === 'abab') { const end = k => { const w = normWord((lines[k] || '').split(/\s+/).pop()); return w.slice(-2); }; out.push({ ok: lines.length === 4 && end(0) && end(0) === end(2) && end(1) === end(3), label: 'Rima a-b-a-b' }); }
    out.push({ ok: t.trim().length <= 400, label: 'Maksimal 400 karakter' });
    return out;
  }
  const cleanText = (x, max) => String(x || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim().slice(0, max);
  function chProof(S, it, ok, proof) {
    const ch = CH[it.ch];
    S.proofs = S.proofs || [];
    S.proofs.push({ p: it.p, type: ch.type, label: CH_TYPES[ch.type].label, ok, proof, judge: it.judge, r: S.round });
    if (S.proofs.length > 40) S.proofs.shift();
  }
  function rewardTo(S, i, rw) {
    if (!rw) return '';
    if (rw.gain) cashAdd(S, i, rw.gain);
    if (rw.love) loveAdd(S, i, rw.love);
    return [rw.gain ? '+' + fmt(rw.gain) : '', rw.love ? 'Love +' + rw.love : ''].filter(Boolean).join(', ');
  }
  // akhir tantangan: ok = pemilik lulus. judgeWin = penilai yang dapat hadiah (Dua Fakta Satu Bohong)
  function chFinish(S, it, ok, proof, judgeShare) {
    const ch = CH[it.ch], def = CH_TYPES[ch.type], p = PL(S, it.p);
    S.queue.shift();
    chProof(S, it, ok, proof);
    if (ok) {
      const got = rewardTo(S, it.p, def.reward);
      p.stats.challenges++;
      log(S, p.name + ' lulus ' + def.label + ' (' + got + '). Bukti: ' + proof + '.', 'heart', it.p);
      if (it.source === 'island' && p.island) { release(S, it.p, 'lewat Rindu Challenge'); p.stats.escapes++; }
    } else {
      p.stats.failed++;
      log(S, p.name + ' gagal ' + def.label + '. Bukti: ' + proof + '.' + (it.source === 'island' && p.island ? ' Tetap di Pulau Rindu.' : ''), 'dot', it.p);
    }
    const sharers = judgeShare === true ? [it.judge] : Array.isArray(judgeShare) ? judgeShare : [];
    sharers.forEach(j => {
      if (j < 0 || !PL(S, j) || PL(S, j).bankrupt) return;
      const g = rewardTo(S, j, def.judgeReward);
      if (g) log(S, PL(S, j).name + ' ikut dapat hadiah (' + g + ').', 'heart', j);
    });
    ev(S, { t: 'challenge', p: it.p, ok, proof, label: def.label, judge: it.judge });
  }
  // ---------- pembayaran & utang ----------
  function charge(S, i, amt, to, reason, opts) {
    opts = opts || {};
    amt = Math.round(amt);
    if (amt <= 0) return true;
    const p = PL(S, i);
    if (to >= 0 && PL(S, to).bankrupt) to = -1;
    if (p.cash >= amt) { transfer(S, i, to, amt, opts); return true; }
    qadd(S, { type: 'DEBT', p: i, to, amount: amt, reason, rent: !!opts.rent, tile: opts.tile == null ? -1 : opts.tile });
    p.stats.debts++;
    log(S, p.name + ' kekurangan uang untuk ' + reason + ' (' + fmt(amt) + ').', 'alert', i);
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
    st.owner = -1; st.level = 0;
    if (S.festival.tile === ti) S.festival = { tile: -1, mult: 1 };
  }

  function bankrupt(S, i, creditor) {
    const p = PL(S, i);
    let total = p.cash;
    ownedBy(S, i).forEach(t => { total += sellValue(S, t); resetTile(S, t); });
    if (p.cash) cashAdd(S, i, -p.cash);
    const cr = creditor >= 0 && !PL(S, creditor).bankrupt && creditor !== i ? creditor : -1;
    if (cr >= 0 && total > 0) cashAdd(S, cr, total);
    p.cards.forEach(id => returnPowerCard(S, id));
    p.cards = [];
    p.bankrupt = true; p.island = false; p.tour = false; p.skip = 0; p.discount = 0; p.stats.bankruptRound = S.round;
    log(S, p.name + ' bangkrut! Semua kotanya dijual ke bank' + (cr >= 0 ? ' dan hasilnya (' + fmt(total) + ') untuk ' + PL(S, cr).name : '') + '.', 'alert', i);
    const keep = it => !(it.p === i || (it.type === 'TAKEOVER' && it.owner === i));
    const fix = it => { if ((it.type === 'DEBT' || it.type === 'RENT') && it.to === i) it.to = -1; return it; };
    S.queue = S.queue.filter(keep).map(fix);
    S._new = S._new.filter(keep).map(fix);
    // tol ke pemain yang bangkrut tidak perlu dibayar lagi
    S.queue = S.queue.filter(it => !(it.type === 'RENT' && it.to === -1));
    S._new = S._new.filter(it => !(it.type === 'RENT' && it.to === -1));
    ev(S, { t: 'bankrupt', p: i });
    const act = activeIdx(S);
    if (act.length <= 1) { finish(S, 'bankrupt', act[0]); return; }
    if (S.turn.p === i) nextTurn(S);
  }

  // ---------- giliran & ronde ----------
  function beginTurn(S, p) {
    S.turn = { p, rolled: false, doubles: 0, canRollAgain: false, dice: [0, 0], rollId: S.turn.rollId };
    const pl = PL(S, p);
    if (pl.skip > 0) {
      pl.skip--;
      log(S, pl.name + ' kehilangan giliran ini.', 'pause', p);
      ev(S, { t: 'skip', p });
      nextTurn(S);
      return;
    }
    if (pl.tour && !pl.island) qadd(S, { type: 'TOUR', p });
  }
  function nextTurn(S) {
    if (S.over) return;
    const n = S.players.length, cur = S.turn.p, st = S.start || 0;
    let next = -1, newRound = false;
    // ronde baru saat giliran kembali melewati pemain pertama (S.start), supaya semua dapat jumlah giliran sama
    const rel = i => (i - st + n) % n;
    for (let k = 1; k <= n; k++) {
      const c = (cur + k) % n;
      if (!S.players[c].bankrupt) { next = c; newRound = rel(c) <= rel(cur); break; }
    }
    if (next < 0) return;
    if (newRound) { S.round++; if (startRound(S)) return; }
    beginTurn(S, next);
  }
  function startRound(S) {
    if ((S.settings.roundLimit && S.round > S.settings.roundLimit) || S.round > RULES.maxRounds) {
      S.round = Math.min(S.round, S.settings.roundLimit || S.round);
      finish(S, 'rounds');
      return true;
    }
    if (S.news && S.round > S.news.to) { log(S, 'Kabar Merpi "' + NEWS_LABEL[S.news.id] + '" selesai.', 'dot'); S.news = null; }
    const gap = newsGap(S);
    if (S.settings.news !== false && S.round >= gap && S.round % gap === 0 && !peakOn(S)) drawNews(S);
    if (S.settings.roundLimit && S.round === S.settings.roundLimit - RULES.peakRounds + 1) {
      log(S, 'Musim Puncak! ' + RULES.peakRounds + ' ronde terakhir: semua tol ×' + String(RULES.peakMult).replace('.', ',') + '.', 'bolt');
      ev(S, { t: 'peak', rounds: RULES.peakRounds, mult: RULES.peakMult });
    }
    return false;
  }
  // Kabar Merpi: event dunia berlaku 2 ronde, diundi tiap beberapa ronde (tidak sama dengan event sebelumnya)
  const NEWS_LABEL = { rain: 'Musim Hujan', holiday: 'Musim Liburan', sale: 'Diskon Properti', promo: 'Promo Maskapai', bonus: 'Bonus Tahunan', love: 'Pekan Kasih Sayang' };
  const NEWS_TEXT = {
    rain: 'tol semua kota di {s} ×0,5', holiday: 'tol semua kota di {s} ×1,5', sale: 'beli & bangun diskon 20%',
    promo: 'tiket World Tour gratis', bonus: 'gaji START +100', love: 'Ketemuan & lewat START bonus Love berlipat'
  };
  function drawNews(S) {
    const ids = Object.keys(NEWS_LABEL).filter(id => !S.news || id !== S.news.id);
    const id = ids[rint(S, ids.length)];
    const side = id === 'rain' || id === 'holiday' ? SIDES[rint(S, SIDES.length)].id : null;
    S.news = { id, side, from: S.round, to: S.round + RULES.newsLasts - 1 };
    const text = NEWS_TEXT[id].replace('{s}', side ? sideName(side) : '');
    log(S, 'Kabar Merpi: ' + NEWS_LABEL[id] + '! ' + text.charAt(0).toUpperCase() + text.slice(1) + ' selama ' + RULES.newsLasts + ' ronde.', 'sparkle');
    ev(S, { t: 'news', id, side, label: NEWS_LABEL[id], text, rounds: RULES.newsLasts });
  }
  function newsInfo(S) {
    if (!S.news || S.round > S.news.to) return null;
    return { id: S.news.id, side: S.news.side, label: NEWS_LABEL[S.news.id], text: NEWS_TEXT[S.news.id].replace('{s}', S.news.side ? sideName(S.news.side) : ''), left: S.news.to - S.round + 1 };
  }

  function finish(S, reason, winner, detail) {
    if (S.over) return;
    const ranking = S.players.map(p => p.i).sort((a, b) => {
      const A = PL(S, a), B = PL(S, b);
      if (A.bankrupt !== B.bankrupt) return A.bankrupt ? 1 : -1;
      if (A.bankrupt && B.bankrupt) return B.stats.bankruptRound - A.stats.bankruptRound;
      return netWorth(S, b) - netWorth(S, a);
    });
    if (winner == null || winner < 0) winner = ranking[0];
    else ranking.splice(ranking.indexOf(winner), 1), ranking.unshift(winner);
    S.players.forEach(p => { if (!p.bankrupt) p.stats.maxNet = Math.max(p.stats.maxNet, netWorth(S, p.i)); });
    checkAchievements(S);
    S.over = { winner, reason, detail: detail || null, ranking, round: S.round, worth: S.players.map(p => netWorth(S, p.i)), titles: computeTitles(S, ranking, winner) };
    S.queue = []; S._new = [];
    log(S, PL(S, winner).name + ' menang (' + winReason(S.over) + ')!', 'trophy', winner);
    ev(S, { t: 'gameover', winner, reason });
  }
  function sideName(id) { return (SIDE_TILES.find(x => x.id === id) || {}).name || 'satu jalur'; }
  function winReason(o) {
    return {
      bankrupt: 'semua lawan bangkrut', rounds: 'aset terbesar saat batas ronde', manual: 'aset terbesar saat permainan diakhiri', resign: 'lawan menyerah',
      triple: 'Trio Warna', line: 'Raja ' + (o.detail ? sideName(o.detail.side) : 'Jalur'), spots: 'Kolektor Wisata'
    }[o.reason] || o.reason;
  }
  function computeTitles(S, ranking, winner) {
    const titles = {};
    const used = new Set();
    titles[winner] = D.TITLES.winner[rint(S, D.TITLES.winner.length)];
    const cats = [
      ['rent', p => p.stats.tollIn], ['landmarks', p => p.stats.landmarks], ['takeovers', p => p.stats.takeovers],
      ['challenges', p => p.stats.challenges], ['love', p => p.love], ['travels', p => p.stats.travels],
      ['doubles', p => p.stats.doubles], ['island', p => p.stats.islands]
    ];
    S.players.forEach(p => {
      if (p.i === winner) return;
      for (const [k, f] of cats) {
        if (used.has(k)) continue;
        const v = f(p);
        if (v > 0 && S.players.every(q => q.i === p.i || f(q) < v)) { titles[p.i] = D.TITLES[k]; used.add(k); break; }
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
        landmark: s.landmarks >= 1, tycoon: citiesOf(S, p.i).length >= 8, monopoly2: fullGroups(S, p.i).length >= 2,
        festival: s.festivals >= 1, globe: s.travels >= 1, takeover: s.takeovers >= 1, tourist: spotsOf(S, p.i).length >= 3,
        rentking: s.tollIn >= 3000, romantic: s.challenges >= 5, escape: s.escapes >= 1, angel: s.angels >= 1,
        goals: p.love >= 100, doubles5: s.doubles >= 5, writer: s.letters >= 3, survivor: s.survived >= 1
      };
      Object.keys(cond).forEach(id => {
        if (cond[id] && !p.achievements.includes(id)) {
          p.achievements.push(id);
          log(S, 'Achievement: ' + p.name + ' membuka "' + ACH[id].name + '".', 'trophy', p.i);
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
  const islandPre = (S, i) => { const p = PL(S, i); return p.island && S.turn.p === i && !S.turn.rolled && !S.queue.length && !S.over && !S.paused; };

  // ---------- handler aksi ----------
  const H = {};
  H.PAUSE = (S, a) => { S.paused = !S.paused; log(S, PL(S, a.p).name + (S.paused ? ' menjeda permainan.' : ' melanjutkan permainan.'), 'pause', a.p); };

  H.ROLL = (S, a) => {
    const i = a.p, p = PL(S, i);
    if (!canRoll(S, i)) fail(S.queue.length ? 'Selesaikan dulu keputusan yang ada.' : 'Kamu tidak bisa melempar dadu sekarang.');
    let d1 = 1 + rint(S, 6), d2 = 1 + rint(S, 6);
    const aim = S.settings.diceControl && !p.island && typeof a.aim === 'string' && RULES.aimRanges[a.aim] ? a.aim : null;
    if (aim) {
      const [lo, hi] = RULES.aimRanges[aim];
      if (rnd(S) < RULES.aimChance) {
        for (let k = 0; k < 200 && (d1 + d2 < lo || d1 + d2 > hi); k++) { d1 = 1 + rint(S, 6); d2 = 1 + rint(S, 6); }
      }
    }
    if (S.settings.debug && Array.isArray(a.dice) && a.dice.length === 2) { d1 = clampInt(a.dice[0], 1, 6); d2 = clampInt(a.dice[1], 1, 6); }
    const dbl = d1 === d2;
    const hit = !!aim && d1 + d2 >= RULES.aimRanges[aim][0] && d1 + d2 <= RULES.aimRanges[aim][1];
    if (hit) p.stats.aimHits++;
    S.turn.dice = [d1, d2];
    S.turn.rollId++;
    ev(S, { t: 'dice', p: i, d: [d1, d2], dbl, aim, hit });
    if (p.island) {
      S.turn.rolled = true; S.turn.canRollAgain = false;
      if (dbl) {
        p.stats.doubles++;
        release(S, i, 'dengan dadu kembar ' + d1 + '-' + d2);
        walk(S, i, d1 + d2); land(S, i);
        return;
      }
      p.islandTries++;
      if (p.islandTries >= RULES.islandTurns) {
        release(S, i, 'karena kapal penjemput datang');
        walk(S, i, d1 + d2); land(S, i);
      } else {
        log(S, p.name + ' belum dapat dadu kembar (' + d1 + '-' + d2 + '). Percobaan ' + p.islandTries + '/' + RULES.islandTurns + '.', 'dice', i);
      }
      return;
    }
    S.turn.rolled = true;
    log(S, p.name + ' melempar ' + d1 + ' + ' + d2 + ' = ' + (d1 + d2) + (dbl ? ' (kembar!)' : '') + (aim ? ' · bidikan ' + AIM_LABEL[aim] + (hit ? ' tepat' : ' meleset') : '') + '.', 'dice', i);
    if (dbl) {
      S.turn.doubles++; p.stats.doubles++;
      loveAdd(S, i, 2);
      if (S.turn.doubles >= 3) { S.turn.canRollAgain = false; sendToIsland(S, i, '3× dadu kembar'); return; }
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
    const p = PL(S, a.p), t = TILES[it.tile];
    const level = clampInt(a.level || 0, 0, 4);
    if (S.tiles[it.tile].owner !== -1) fail('Petak ini sudah dimiliki.');
    if (!buyLevels(S, a.p, it.tile).includes(level)) fail(level === 3 ? 'Hotel baru bisa dibangun setelah 1 putaran (lewat START).' : 'Tingkat bangunan tidak valid.');
    const cost = buyCost(S, a.p, it.tile, level);
    if (p.cash < cost) fail('Uang tidak cukup (butuh ' + fmt(cost) + ').');
    S.queue.shift();
    if (cost) cashAdd(S, a.p, -cost);
    if (p.discount) { p.discount = 0; }
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
    const st = S.tiles[ti], p = PL(S, i), from = st.level;
    if (cost) cashAdd(S, i, -cost);
    st.level = level;
    p.stats.built += level - from;
    if (level === 4) p.stats.landmarks++;
    log(S, p.name + ' membangun ' + LEVEL_NAME[level] + ' di ' + TILES[ti].name + (cost ? ' (' + fmt(cost) + ')' : ' (gratis)') + (why ? ' · ' + why : '') + '.', level === 4 ? 'crown' : 'build', i);
    ev(S, { t: 'build', p: i, tile: ti, level, from });
  }
  H.UPGRADE = (S, a) => {
    const it = head(S, 'UPGRADE', a.p);
    const p = PL(S, a.p);
    const level = clampInt(a.level, 0, 4);
    const ok = upgradeLevels(S, a.p, it.tile);
    if (!ok.includes(level)) fail(level === 4 ? 'Landmark hanya bisa dibangun di kota yang sudah punya Hotel.' : level === 3 ? 'Hotel baru bisa dibangun setelah 1 putaran (lewat START).' : 'Tingkat bangunan tidak valid.');
    const cost = upgradeCost(S, a.p, it.tile, level);
    if (p.cash < cost) fail('Uang tidak cukup (butuh ' + fmt(cost) + ').');
    S.queue.shift();
    if (p.discount) p.discount = 0;
    applyLevel(S, a.p, it.tile, level, cost);
  };
  H.UPGRADE_SKIP = (S, a) => { head(S, 'UPGRADE', a.p); S.queue.shift(); };

  // --- tol & ambil alih ---
  H.PAY_RENT = (S, a) => {
    const it = head(S, 'RENT', a.p);
    S.queue.shift();
    const p = PL(S, a.p);
    const to = PL(S, it.to);
    if (to.bankrupt || S.tiles[it.tile].owner !== it.to) { log(S, 'Pemilik sudah berubah, tol dibatalkan.', 'dot', a.p); return; }
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
    const p = PL(S, a.p), o = PL(S, it.owner);
    transfer(S, a.p, it.owner, c.price, {});
    S.tiles[it.tile].owner = a.p;
    p.stats.takeovers++; o.stats.takenFrom++; p.stats.bought++;
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
    if (ok) { log(S, PL(S, a.p).name + ' membayar Pajak Rindu ' + fmt(it.amount) + '.', 'tax', a.p); ev(S, { t: 'tax', p: a.p, amount: it.amount }); }
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
    if (c.power) { p.cards.push(c.id); log(S, p.name + ' menyimpan kartu ' + c.title + '.', 'bolt', a.p); return; }
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
      S.tiles[ti].owner = other; S.tiles[t2].owner = a.p;
      log(S, p.name + ' menukar ' + TILES[ti].name + ' dengan ' + TILES[t2].name + ' milik ' + PL(S, other).name + '.', 'swap', a.p);
      ev(S, { t: 'swap', p: a.p, a: ti, b: t2, other });
      return;
    }
    S.queue.shift();
    if (it.kind === 'festival') hostFestival(S, a.p, ti, it.src === 'card' ? 'Festival Kilat' : '');
    else if (it.kind === 'build') { if (!offerUpgrade(S, a.p, ti, 'start')) fail('Kota ini belum bisa dibangun.'); }
    else if (it.kind === 'renov') {
      const lv = upgradeLevels(S, a.p, ti)[0];
      applyLevel(S, a.p, ti, lv, 0, 'Renovasi Gratis');
    } else if (it.kind === 'storm') {
      const st = S.tiles[ti], o = st.owner, from = st.level;
      st.level = from - 1;
      log(S, 'Badai Rindu menerjang ' + TILES[ti].name + ' milik ' + PL(S, o).name + ': ' + LEVEL_NAME[from] + ' turun jadi ' + LEVEL_NAME[st.level] + '.', 'storm', a.p);
      ev(S, { t: 'storm', p: a.p, tile: ti, level: st.level, from, owner: o });
    }
  };
  H.TARGET_SKIP = (S, a) => {
    const it = head(S, 'TARGET', a.p);
    S.queue.shift();
    log(S, PL(S, a.p).name + ' melewatkan ' + ({ festival: 'Festival Cinta', build: 'kesempatan membangun', renov: 'renovasi', storm: 'Badai Rindu', swap: 'Tukar Kota' }[it.kind] || 'pilihan') + '.', 'dot', a.p);
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
    S.turn.rolled = true; S.turn.canRollAgain = false;
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

  // --- tantangan ---
  // CH_REDRAW / CH_RESOLVE(skip|choice) oleh pemilik; CH_ANSWER oleh yang sedang beraksi (pemilik atau penilai)
  const chHead = (S, p) => { const it = S.queue[0]; if (!it || it.type !== 'CHALLENGE') fail('Tidak ada tantangan yang menunggu.'); if (it.p !== p) fail('Ini bukan tantanganmu.'); return it; };
  const FIRST_PHASE = { secret: 'intro', bluff: 'write', charades: 'act', message: 'write', dare: 'do', photo: 'do', dilemma: 'choose' };
  H.CH_REDRAW = (S, a) => {
    const it = chHead(S, a.p), ch = CH[it.ch];
    if (it.who !== it.p || it.phase !== (FIRST_PHASE[ch.type] || 'play')) fail('Tantangan sudah berjalan, tidak bisa diganti.');
    if (it.redraws >= RULES.maxRedraws) fail('Batas ganti tantangan sudah habis.');
    it.ch = drawChallenge(S, a.p, it.cat);
    assignJudges(S, it, it.rot == null);
    it.redraws++;
    setupCh(S, it);
  };
  // voting penilai (3–4 pemain): bergiliran, rahasia satu sama lain; mayoritas menentukan, seri = sah
  function judgeVote(S, it, okVote, p) {
    it.pz.votes = it.pz.votes || {};
    it.pz.votes[p] = !!okVote;
    const next = it.judges.find(j => !(j in it.pz.votes) && !PL(S, j).bankrupt);
    if (next != null) { it.who = next; return null; }
    const vs = it.judges.filter(j => j in it.pz.votes);
    const yes = vs.filter(j => it.pz.votes[j]).length;
    const ok = yes >= vs.length - yes;
    return { ok, vs, txt: (ok ? 'disahkan ' : 'tidak disahkan ') + yes + ' dari ' + vs.length + ' penilai (' + vs.map(j => PL(S, j).name + (it.pz.votes[j] ? ' ✓' : ' ✗')).join(', ') + ')' };
  }
  H.CH_ANSWER = (S, a) => {
    const it0 = S.queue[0];
    const it = charadesOpen(S, it0) && chActors(S).includes(a.p) ? it0 : head(S, 'CHALLENGE', a.p);
    const ch = CH[it.ch], def = CH_TYPES[ch.type], J = it.judge >= 0 ? PL(S, it.judge).name : '';
    const multi = multiJudge(it);
    if (AUTO_TYPES.includes(ch.type)) {
      const ms = clampInt(a.ms, 0, 3600000), z = it.pz;
      const late = ms > z.secs * 1000 + 2000;
      const got = late ? 0 : gradeAuto(it, a.answers);
      const total = ch.type === 'recall' ? z.seq.length : (z.qs || z.items).length;
      const shown = ch.type === 'recall' ? (got ? 'urutan ' + total + ' gambar tepat' : 'urutan keliru') : got + '/' + total + ' benar';
      chFinish(S, it, !late && got >= z.need, (late ? 'waktu habis' : shown + ' dalam ' + secsTxt(ms)));
      return;
    }
    if (ch.type === 'secret') {
      const n = it.pz.qs.length, A = Array.isArray(a.answers) ? a.answers.map(Number) : [];
      if (it.phase === 'intro') { it.phase = 'secret'; it.who = it.judge; return; }
      if (A.length !== n || A.some((v, k) => !(v >= 0 && v < HEART_QS[it.pz.qs[k]].o.length))) fail('Jawab semua pertanyaan.');
      if (it.phase === 'secret') { it.pz.secret = A; it.phase = 'guess'; it.who = it.p; return; }
      const hit = A.reduce((c, v, k) => c + (v === it.pz.secret[k] ? 1 : 0), 0);
      it.pz.guess = A;
      const ok = hit >= it.pz.need;
      chFinish(S, it, ok, hit + '/' + n + ' cocok dengan jawaban rahasia ' + J, ok);
      return;
    }
    if (ch.type === 'bluff') {
      if (it.phase === 'write') {
        const L = (Array.isArray(a.lines) ? a.lines : []).map(x => cleanText(x, 90));
        if (L.length !== 3 || L.some(x => x.length < RULES.bluffMin)) fail('Tulis 3 pernyataan, masing-masing minimal ' + RULES.bluffMin + ' huruf.');
        const lie = Number(a.lie);
        if (!(lie >= 0 && lie < 3)) fail('Tandai pernyataan yang bohong.');
        it.pz = { lines: L, lie };
        it.phase = 'guess'; it.who = it.judge; return;
      }
      const pick = Number(a.pick);
      if (!(pick >= 0 && pick < 3)) fail('Pilih pernyataan yang menurutmu bohong.');
      if (multi) {
        it.pz.picks = it.pz.picks || {};
        it.pz.picks[a.p] = pick;
        const next = it.judges.find(j => !(j in it.pz.picks) && !PL(S, j).bankrupt);
        if (next != null) { it.who = next; return; }
        const gs = it.judges.filter(j => j in it.pz.picks), caught = gs.filter(j => it.pz.picks[j] === it.pz.lie), fooled = gs.length - caught.length;
        const okB = fooled >= caught.length;
        chFinish(S, it, okB, fooled + ' dari ' + gs.length + ' tertipu, yang bohong #' + (it.pz.lie + 1) + (caught.length ? ' · ketahuan ' + caught.map(j => PL(S, j).name).join(' & ') : ''), caught);
        return;
      }
      it.pz.pick = pick;
      const fooled = pick !== it.pz.lie;
      chFinish(S, it, fooled, J + ' menebak #' + (pick + 1) + ', yang bohong #' + (it.pz.lie + 1) + (fooled ? ' (berhasil mengecoh)' : ' (ketahuan)'), !fooled);
      return;
    }
    if (ch.type === 'charades') {
      const z = it.pz;
      if (it.phase === 'act') { it.phase = 'guess'; it.who = it.judge; return; }
      if (multi) {
        z.triesBy = z.triesBy || {}; z.gby = z.gby || [];
        const nm = PL(S, a.p).name;
        if (a.timeout) { chFinish(S, it, false, 'waktu habis, tidak ada yang menebak "' + z.word + '"' + (z.guesses.length ? ' (' + z.guesses.length + ' tebakan)' : ''), false); return; }
        if (a.giveUp) z.triesBy[a.p] = z.max;
        else {
          const g = cleanText(a.guess, 40);
          if (!normWord(g)) fail('Ketik tebakanmu.');
          z.guesses.push(g); z.gby.push(a.p); z.tries++;
          z.triesBy[a.p] = (z.triesBy[a.p] || 0) + 1;
          if (normWord(g) === normWord(z.word)) { chFinish(S, it, true, nm + ' menebak "' + z.word + '" di tebakan ke-' + z.triesBy[a.p], [a.p]); return; }
        }
        const left = chActors(S);
        if (!left.length) { chFinish(S, it, false, 'semua penebak kehabisan kesempatan, jawabannya "' + z.word + '"', false); return; }
        if (!left.includes(it.who)) it.who = left[0];
        return;
      }
      if (a.giveUp) { chFinish(S, it, false, J + ' tidak berhasil menebak "' + z.word + '"' + (z.guesses.length ? ' (' + z.guesses.length + ' tebakan)' : ''), false); return; }
      const g = cleanText(a.guess, 40);
      if (!normWord(g)) fail('Ketik tebakanmu.');
      z.guesses.push(g); z.tries++;
      if (normWord(g) === normWord(z.word)) { chFinish(S, it, true, J + ' menebak "' + z.word + '" di tebakan ke-' + z.tries, true); return; }
      if (z.tries >= z.max) chFinish(S, it, false, J + ' salah ' + z.tries + ' kali, jawabannya "' + z.word + '"', false);
      return;
    }
    if (ch.type === 'message') {
      if (it.phase === 'write') {
        const text = cleanText(a.text, 400);
        const bad = messageChecks(ch.rule || {}, text).filter(c => !c.ok);
        if (bad.length) fail('Belum lolos syarat: ' + bad.map(c => c.label).join(', ') + '.');
        it.pz = { text };
        if (it.judge >= 0) { it.phase = 'judge'; it.who = it.judge; return; }
      } else if (multi) {
        const v = judgeVote(S, it, a.ok, a.p);
        if (!v) return;
        if (!v.ok) { chFinish(S, it, false, 'lolos syarat, tapi ' + v.txt, v.vs); return; }
        it.pz.voteTxt = v.txt; it.pz.voters = v.vs;
      } else if (!a.ok) { chFinish(S, it, false, 'lolos syarat, tapi tidak disahkan ' + J, false); return; }
      const text = it.pz.text, p = PL(S, it.p);
      S.letters.push({ p: it.p, text, r: S.round }); if (S.letters.length > 40) S.letters.shift();
      p.stats.letters++; ev(S, { t: 'letter', p: it.p });
      chFinish(S, it, true, 'lolos semua syarat' + (it.pz.voteTxt ? ' · ' + it.pz.voteTxt : it.judge >= 0 ? ' · disahkan ' + J : ' (dicek otomatis)'), it.pz.voters || it.judge >= 0);
      return;
    }
    if (ch.type === 'dare') {
      if (it.phase === 'do') { it.phase = 'judge'; it.who = it.judge; it.pz.votes = {}; return; }
      if (multi) { const v = judgeVote(S, it, a.ok, a.p); if (v) chFinish(S, it, v.ok, v.txt, v.vs); return; }
      chFinish(S, it, !!a.ok, a.ok ? 'disahkan oleh ' + J : 'tidak disahkan oleh ' + J, !!a.ok);
      return;
    }
    if (ch.type === 'photo') {
      if (it.phase === 'do') {
        const ph = String(a.photo || '');
        if (!ph || ph.length > PHOTO_MAX || !PHOTO_RE.test(ph)) fail('Ambil foto bukti dulu.');
        it.pz = { photo: ph, votes: {} };
        it.phase = 'judge'; it.who = it.judge; return;
      }
      // foto disimpan (maksimal 4 terakhir) dan dipajang di papan; yang ditolak tetap tersimpan sebagai bukti
      let okP = !!a.ok, txtP = (a.ok ? 'foto disahkan oleh ' : 'foto tidak disahkan oleh ') + J, shareP = okP;
      if (multi) { const v = judgeVote(S, it, a.ok, a.p); if (!v) return; okP = v.ok; txtP = 'foto ' + v.txt; shareP = v.vs; }
      S.photos = S.photos || [];
      S.photos.push({ p: it.p, img: it.pz.photo, text: ch.text.replace(/\{j\}/g, J), ok: okP, judge: it.judge, r: S.round });
      while (S.photos.length > PHOTO_KEEP) S.photos.shift();
      chFinish(S, it, okP, txtP, shareP);
      return;
    }
    fail('Tantangan ini tidak memakai jawaban.');
  };
  H.CH_RESOLVE = (S, a) => {
    const it = chHead(S, a.p);
    const ch = CH[it.ch], def = CH_TYPES[ch.type];
    const p = PL(S, a.p);
    const res = a.result;
    if (res === 'choice') {
      if (ch.type !== 'dilemma' || it.who !== a.p) fail('Pilihan hanya untuk dilema.');
      const opt = ch.options[a.choice];
      if (!opt) fail('Pilih salah satu opsi.');
      S.queue.shift();
      log(S, p.name + ' memilih: ' + opt.label + '.', 'scale', a.p);
      p.stats.challenges++;
      applyFx(S, a.p, opt.fx);
      ev(S, { t: 'challenge', p: a.p, ok: true, dilemma: true });
      return;
    }
    if (res === 'skip') {
      S.queue.shift();
      const sk = def.skip || {};
      if (sk.love) loveAdd(S, a.p, sk.love);
      p.stats.skipped++;
      log(S, p.name + ' melewati ' + def.label + (sk.love ? ' (Love ' + sk.love + ')' : '') + '.', 'dot', a.p);
      return;
    }
    // "complete"/"fail" dari pemain sendiri tidak diterima lagi: hasil harus dibuktikan lewat CH_ANSWER
    fail('Hasil tantangan harus dibuktikan lewat jawaban atau penilaian lawan.');
  };

  // ---------- dispatch ----------
  function clone(o) { return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)); }
  function postProcess(S) {
    if (S.over) return;
    if (PL(S, S.turn.p).bankrupt && !S.queue.length && !S._new.length) nextTurn(S);
    checkAchievements(S);
    S.players.forEach(p => { if (!p.bankrupt) p.stats.maxNet = Math.max(p.stats.maxNet, netWorth(S, p.i)); });
    if (S.settings.instantWin && !S.over) {
      const n = S.players.length;
      for (let k = 0; k < n; k++) {
        const i = (S.turn.p + k) % n;
        const w = winCheck(S, i);
        if (w) { finish(S, w.kind, i, w); return; }
      }
    }
  }
  function dispatch(S0, action) {
    if (!action || typeof action.type !== 'string' || !Object.prototype.hasOwnProperty.call(H, action.type)) return { ok: false, error: 'Aksi tidak dikenal.' };
    const S = clone(S0);
    migrate(S);
    S._ev = []; S._new = [];
    try {
      if (S.over) fail('Permainan sudah selesai.');
      const p = action.p;
      if (!Number.isInteger(p) || !S.players[p]) fail('Pemain tidak dikenal.');
      if (S.players[p].bankrupt) fail('Pemain ini sudah bangkrut.');
      if (S.paused && action.type !== 'PAUSE') fail('Permainan sedang dijeda.');
      // pemilik tantangan boleh membatalkan (skip) walau sedang menunggu penilai, supaya tidak macet bila penilai pergi
      const chCancel = action.type === 'CH_RESOLVE' && action.result === 'skip' && S.queue[0] && S.queue[0].type === 'CHALLENGE' && S.queue[0].p === p;
      const chGuess = action.type === 'CH_ANSWER' && charadesOpen(S, S.queue[0]) && chActors(S).includes(p);
      if (action.type !== 'PAUSE' && !chCancel && !chGuess && actor(S) !== p) fail('Bukan giliranmu.');
      H[action.type](S, action);
      S.queue = S._new.concat(S.queue);
      S._new = [];
      postProcess(S);
      S.queue = S._new.concat(S.queue);
    } catch (e) {
      if (e instanceof RuleError) return { ok: false, error: e.message };
      throw e;
    }
    const events = S._ev;
    delete S._ev; delete S._new;
    S.seq++;
    S.lastEvents = events;
    S.evSeq = S.seq;
    return { ok: true, state: S, events };
  }
  function check(S, action) {
    const r = dispatch(S, action);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  G.LoveEngine = {
    create, dispatch, check, actor, canRoll, canEnd, islandPre, chSolve, messageChecks, judgeFor, judgesFor, chActors, migrate, newsInfo, peakOn, newsGap, tripleOk, travelFee: S => (newsOn(S, 'promo') ? 0 : RULES.travelFee),
    rentFor, rentInfo, netWorth, liquidation, tileValue, sellValue, levelCost, costRange, buyCost, upgradeCost,
    buyLevels, upgradeLevels, capLevel, targetCandidates, swapTargets,
    ownsGroup, countGroup, fullGroups, ownedBy, citiesOf, spotsOf, buildingLevels, tierOf, tierInfo,
    winCheck, winThreats, canTakeover, takeoverPrice, winReason, sideName, nearestTile,
    GROUP_TILES, GROUP_IDS, OWNABLE, CITIES, SPOTS, SIDE_TILES, ISLAND, FEST, TRAVEL, N, AIM_LABEL, LEVEL_NAME, CARD, CH, ACH, POWER, fmt
  };
})(typeof window !== 'undefined' ? window : globalThis);
