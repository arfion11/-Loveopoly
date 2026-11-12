/* LOVEOPOLY — engine aturan › tol, menang instan & ambil alih (dikumpulkan lewat src/engine/engine.js) */
import {
  GROUPS,
  GROUP_IDS,
  GROUP_TILES,
  LEVEL_NAME,
  PL,
  RULES,
  SIDE_TILES,
  SPOTS,
  TILES,
  activeIdx,
  fullGroups,
  log,
  ownsGroup,
  peakOn,
  qadd,
  r5,
  sideOfTile,
  spotsOf,
  tierInfo,
  tileValue,
  upgradeCost,
  upgradeLevels,
  tx,
} from './base.js';
import { NEWS_LABEL, sideName } from './turns.js';

// ---------- tol ----------
function rentInfo(S, ti) {
  const t = TILES[ti],
    st = S.tiles[ti],
    o = st.owner;
  if (o < 0) return null;
  const parts = [];
  let r;
  if (t.type === 'spot') {
    const n = spotsOf(S, o).length;
    r = RULES.spotRent[Math.max(0, n - 1)];
    parts.push({ k: 'base', label: tx('Tol wisata ({n} dimiliki)', { n }), v: r });
  } else {
    r = t.price * RULES.rentMult[st.level];
    parts.push({ k: 'base', label: tx('Tol {l}', { l: { t: LEVEL_NAME[st.level] } }), v: Math.round(r) });
    if (ownsGroup(S, o, t.group)) {
      r *= RULES.groupMult;
      parts.push({ k: 'group', label: tx('Grup {g} penuh', { g: { t: GROUPS[t.group].name } }), m: RULES.groupMult });
    }
    if (S.festival.tile === ti) {
      r *= S.festival.mult;
      parts.push({ k: 'fest', label: tx('Festival Cinta'), m: S.festival.mult });
    }
  }
  if (S.news && S.round <= S.news.to && S.news.side && sideOfTile(ti) === S.news.side) {
    const m = S.news.id === 'rain' ? RULES.newsRain : S.news.id === 'holiday' ? RULES.newsHoliday : 1;
    if (m !== 1) {
      r *= m;
      parts.push({ k: 'news', label: tx('{l} ({s})', { l: { t: NEWS_LABEL[S.news.id] }, s: { t: sideName(S.news.side) } }), m });
    }
  }
  if (peakOn(S)) {
    r *= RULES.peakMult;
    parts.push({ k: 'peak', label: tx('Musim Puncak'), m: RULES.peakMult });
  }
  const pct = tierInfo(PL(S, o).love).rentPct;
  if (pct) {
    r *= 1 + pct / 100;
    parts.push({ k: 'love', label: tx('Love Meter {t}', { t: { t: tierInfo(PL(S, o).love).name } }), pct });
  }
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
    if (fg.length >= RULES.tripleGroups - 1)
      GROUP_IDS.forEach(g => {
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
function takeoverPrice(S, ti) {
  return Math.round(tileValue(S, ti) * RULES.takeoverMult);
}
function canTakeover(S, i, ti) {
  if (!S.settings.takeover) return { ok: false, reason: 'Aturan ambil alih tidak aktif.' };
  const t = TILES[ti],
    st = S.tiles[ti];
  if (!t || !t.price) return { ok: false, reason: 'Petak ini tidak bisa dimiliki.' };
  const o = st.owner;
  if (o < 0 || o === i || PL(S, o).bankrupt) return { ok: false, reason: 'Bukan milik lawan.' };
  if (t.type === 'spot') return { ok: false, reason: 'Tempat wisata tidak bisa diambil alih.', spot: true };
  if (st.level >= 4) return { ok: false, reason: 'Landmark kebal diambil alih.', landmark: true };
  const price = takeoverPrice(S, ti);
  if (PL(S, i).cash < price) return { ok: false, reason: tx('Uang kurang (butuh {a}).', { a: price }), price };
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
    log(
      S,
      tx('{n} belum cukup uang untuk membangun {l} di {k}.', { n: PL(S, i).name, l: { t: LEVEL_NAME[lv[0]] }, k: { tile: ti } }),
      'dot',
      i
    );
    return false;
  }
  qadd(S, { type: 'UPGRADE', p: i, tile: ti, src: src || 'visit' });
  return true;
}

export { canTakeover, offerTakeover, offerUpgrade, rentFor, rentInfo, takeoverPrice, tripleOk, winCheck, winThreats };
