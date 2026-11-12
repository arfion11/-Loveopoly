/* LOVEOPOLY — engine aturan › konstanta, RNG, helper, kepemilikan & nilai, registri handler (dikumpulkan lewat src/engine/engine.js) */
import { D } from '../data.js';

const {
  RULES,
  SIDES,
  GROUPS,
  TILES,
  CARDS,
  CHALLENGES,
  CH_TYPES,
  ACHIEVEMENTS,
  POWER,
  AUTO_TYPES,
  HEART_QS,
  CHARADES,
  CHARADES_EN,
  EMOJI_CLUES,
} = D;

const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]));
const CH = Object.fromEntries(CHALLENGES.map(c => [c.id, c]));
const ACH = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
const N = TILES.length;
const GROUP_TILES = {};
TILES.forEach(t => {
  if (t.group) (GROUP_TILES[t.group] = GROUP_TILES[t.group] || []).push(t.i);
});
const GROUP_IDS = Object.keys(GROUP_TILES);
const OWNABLE = TILES.filter(t => t.price).map(t => t.i);
const CITIES = TILES.filter(t => t.type === 'city').map(t => t.i);
const SPOTS = TILES.filter(t => t.type === 'spot').map(t => t.i);
const SIDE_TILES = SIDES.map(sd => Object.assign({}, sd, { tiles: OWNABLE.filter(t => t >= sd.from && t <= sd.to) }));
const sideOfTile = t => {
  const sd = SIDES.find(d => t >= d.from && t <= d.to);
  return sd ? sd.id : null;
};
const ISLAND = TILES.find(t => t.type === 'island').i;
const FEST = TILES.find(t => t.type === 'fest').i;
const TRAVEL = TILES.find(t => t.type === 'travel').i;
const AIM_LABEL = { low: 'kecil', mid: 'sedang', high: 'besar' };
const AI_LEVELS = ['easy', 'normal', 'hard'];
const LEVEL_NAME = D.LEVELS.map(l => l.name);

class RuleError extends Error {
  constructor(msg) {
    super(msg);
    /** @type {{ k: string, a: any } | null} templat pesan untuk diterjemahkan UI */
    this.t = null;
  }
}
// msg = teks atau tx(templat, data); dispatch mengembalikan { error: teks Indonesia, errorT: { k, a } }
function fail(msg) {
  const e = new RuleError(msg && typeof msg === 'object' ? msg.text : msg);
  if (msg && typeof msg === 'object') e.t = { k: msg.k, a: msg.a };
  throw e;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampInt = (v, a, b) => clamp(Math.round(Number(v) || 0), a, b);
const fmt = n => Math.round(n).toLocaleString('id-ID');
const r5 = x => Math.round(x / 5) * 5;
// ---------- teks netral bahasa (riwayat & pesan) ----------
// tx('{n} membeli {kota}.', { n: nama, kota: { tile: 2 } }) → { text: kalimat Indonesia jadi, k: templat, a: data }.
// text dipakai kode & uji yang membaca riwayat; UI menerjemahkan k + a di tiap perangkat (src/i18n/i18n.js), jadi
// pemain online beda bahasa melihat riwayat yang sama dalam bahasanya masing-masing. Data: string apa adanya, angka,
// { tile: i } (nama petak), { t: 'teks', p } (teks lain yang ikut diterjemahkan).
function txVal(v) {
  if (typeof v === 'number')
    return Number.isInteger(v) ? fmt(v) : v.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (v && typeof v === 'object') {
    if ('tile' in v) return TILES[v.tile] ? TILES[v.tile].name : '';
    if ('t' in v) return txFill(v.t, v.p);
  }
  return v == null ? '' : String(v);
}
function txFill(tpl, p) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (p && p[k] !== undefined ? txVal(p[k]) : m));
}
const tx = (tpl, p) => ({ text: txFill(tpl, p), k: tpl, a: p || null });
// sisipkan teks / tx lain sebagai parameter yang ikut diterjemahkan
const sub = o => (o && typeof o === 'object' ? { t: o.k, p: o.a } : { t: o == null ? '' : String(o) });

// ---------- RNG (mulberry32, state disimpan di game state) ----------
function rnd(S) {
  let t = (S.rng = (S.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rint = (S, n) => Math.floor(rnd(S) * n);
function shuffle(S, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rint(S, i + 1);
    const x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return a;
}

// ---------- helpers ----------
const PL = (S, i) => S.players[i];
const activeIdx = S => S.players.filter(p => !p.bankrupt).map(p => p.i);
const tierOf = love => {
  let k = 0;
  RULES.loveTiers.forEach((t, i) => {
    if (love >= t.min) k = i;
  });
  return k;
};
const tierInfo = love => RULES.loveTiers[tierOf(love)];

function log(S, text, icon, p) {
  S.logN = (S.logN || 0) + 1;
  const o = text && typeof text === 'object' ? text : null;
  const e = { n: S.logN, r: S.round, text: o ? o.text : text, icon: icon || 'dot', p: p == null ? -1 : p };
  if (o) {
    e.k = o.k;
    if (o.a) e.a = o.a;
  }
  S.log.push(e);
  if (S.log.length > 80) S.log.splice(0, S.log.length - 80);
}
const ev = (S, e) => {
  if (S._ev) S._ev.push(e);
};
const qadd = (S, item) => {
  S._new.push(item);
};

function cashAdd(S, i, amt) {
  amt = Math.round(amt);
  if (!amt) return;
  const p = PL(S, i);
  p.cash += amt;
  if (amt > 0) p.stats.earned += amt;
  else p.stats.spent -= amt;
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
function ownsGroup(S, i, g) {
  return i >= 0 && GROUP_TILES[g].every(t => S.tiles[t].owner === i);
}
function countGroup(S, i, g) {
  return GROUP_TILES[g].filter(t => S.tiles[t].owner === i).length;
}
function fullGroups(S, i) {
  return GROUP_IDS.filter(g => ownsGroup(S, i, g));
}

function levelCost(ti, k) {
  return Math.round(TILES[ti].price * RULES.buildMult[k]);
}
// biaya dari tingkat `from` (eksklusif; -1 = belum punya tanah) sampai `to` (inklusif)
function costRange(ti, from, to) {
  let c = 0;
  for (let k = from + 1; k <= to; k++) c += levelCost(ti, k);
  return c;
}
function tileValue(S, ti) {
  const t = TILES[ti];
  if (t.type === 'spot') return t.price;
  return costRange(ti, -1, S.tiles[ti].level);
}
function sellValue(S, ti) {
  return Math.round(tileValue(S, ti) * RULES.sellRate);
}
function netWorth(S, i) {
  const p = PL(S, i);
  if (p.bankrupt) return 0;
  return p.cash + ownedBy(S, i).reduce((s, t) => s + tileValue(S, t), 0);
}
function liquidation(S, i) {
  return PL(S, i).cash + ownedBy(S, i).reduce((s, t) => s + sellValue(S, t), 0);
}
function buildingLevels(S, i) {
  return citiesOf(S, i).reduce((s, t) => s + S.tiles[t].level, 0);
}

// tingkat tertinggi yang boleh dibangun di kota ini oleh pemain i
function capLevel(S, i) {
  return PL(S, i).laps >= RULES.hotelLaps ? 3 : 2;
}
function buyLevels(S, i, ti) {
  return TILES[ti].type === 'spot' ? [0] : Array.from({ length: capLevel(S, i) + 1 }, (_, k) => k);
}
function upgradeLevels(S, i, ti) {
  const t = TILES[ti],
    st = S.tiles[ti];
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
const newsGap = S => {
  const L = S.settings.roundLimit,
    G = RULES.newsGap;
  return !L ? G.free : L <= 15 ? G.short : L <= 25 ? G.normal : G.long;
};
// jeda Momen Berdua (ronde) menurut durasi: Singkat 5, Normal 6, Panjang 7, Bebas 6
const momentGap = S => {
  const L = S.settings.roundLimit,
    G = RULES.momentGap;
  return !L ? G.free : L <= 15 ? G.short : L <= 25 ? G.normal : G.long;
};
// ronde ini Momen Berdua? (sakelar settings.moment, ≥ 2 manusia aktif, bukan Musim Puncak)
const momentRound = S =>
  S.settings.moment !== false &&
  S.round >= momentGap(S) &&
  S.round % momentGap(S) === 0 &&
  !peakOn(S) &&
  S.players.filter(p => p.kind === 'human' && !p.bankrupt).length >= 2;
// hadiah Momen Berdua game ini: { gain, love } (Love menurut jumlah pemain)
const momentReward = S => {
  const r = RULES.momentReward;
  return { gain: r.gain, love: r.love[S.players.length] || r.love[2] };
};
const discounted = (S, i, cost) =>
  Math.max(0, Math.round(cost * (1 - (PL(S, i).discount || 0)) * (newsOn(S, 'sale') ? 1 - RULES.newsSale : 1)));
function buyCost(S, i, ti, level) {
  return discounted(S, i, TILES[ti].type === 'spot' ? TILES[ti].price : costRange(ti, -1, level));
}
function upgradeCost(S, i, ti, level) {
  return discounted(S, i, costRange(ti, S.tiles[ti].level, level));
}

// registri handler aksi per tipe: diisi rules/actions.js & rules/challenge-actions.js, dipakai dispatch
const H = {};

export {
  ACH,
  AIM_LABEL,
  AI_LEVELS,
  AUTO_TYPES,
  CARD,
  CARDS,
  CH,
  CHALLENGES,
  CHARADES,
  CHARADES_EN,
  CH_TYPES,
  CITIES,
  EMOJI_CLUES,
  FEST,
  GROUPS,
  GROUP_IDS,
  GROUP_TILES,
  H,
  HEART_QS,
  ISLAND,
  LEVEL_NAME,
  N,
  OWNABLE,
  PL,
  POWER,
  RULES,
  RuleError,
  SIDES,
  SIDE_TILES,
  SPOTS,
  TILES,
  TRAVEL,
  activeIdx,
  buildingLevels,
  buyCost,
  buyLevels,
  capLevel,
  cashAdd,
  citiesOf,
  clampInt,
  costRange,
  countGroup,
  ev,
  fail,
  fmt,
  sub,
  tx,
  fullGroups,
  levelCost,
  liquidation,
  log,
  loveAdd,
  netWorth,
  momentGap,
  momentReward,
  momentRound,
  newsGap,
  newsOn,
  ownedBy,
  ownsGroup,
  peakOn,
  qadd,
  r5,
  rint,
  rnd,
  sellValue,
  shuffle,
  sideOfTile,
  spotsOf,
  tierInfo,
  tierOf,
  tileValue,
  upgradeCost,
  upgradeLevels,
};
