/* LOVEOPOLY — progres Paspor Cinta (murni: tanpa DOM & tanpa impor; diuji test/progress.js, dipakai screens/passport.js)
   - Api Cinta: rekor minggu beruntun main (minggu lokal Senin–Minggu). Satu minggu tercatat saat game mencapai ronde 3
     atau selesai. Versi mingguan, bukan harian: pasangan tidak dikejar-kejar tiap hari.
   - Payung Rindu: pelindung otomatis minggu yang bolong. Didapat 1 tiap 4 minggu beruntun, disimpan maks 2.
   - Jam Terbang: XP & level (gelar). Hanya progres di paspor, tidak memengaruhi permainan (keadilan kursi tetap).
   - Lencana seumur hidup bertingkat Perunggu / Perak / Emas. */

const DAY = 864e5;
const UMB_MAX = 2;
const UMB_EVERY = 4;
const int = v => (Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0);

// Nomor minggu lokal (Senin = awal minggu). Tanggal lokal → hari sejak 1 Jan 1970 lewat Date.UTC, jadi jam musim
// panas / zona waktu tidak menggeser hari. 1 Jan 1970 = Kamis → +3 supaya pergantian minggu jatuh tiap Senin.
function weekNo(ms) {
  const d = new Date(ms);
  return Math.floor((Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY) + 3) / 7);
}
// sisa hari minggu ini termasuk hari ini: Senin 7 … Minggu 1
function daysLeft(ms) {
  const g = new Date(ms).getDay();
  return g === 0 ? 1 : 8 - g;
}
// hari kalender penuh di antara dua waktu (tanggal lokal)
function daysBetween(a, b) {
  const da = new Date(a),
    db = new Date(b);
  return Math.round(
    (Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / DAY
  );
}

function normWeek(wk) {
  const o = wk && typeof wk === 'object' ? wk : {};
  const n = int(o.n);
  return { last: int(o.last), n, best: Math.max(int(o.best), n), umb: Math.min(UMB_MAX, int(o.umb)) };
}
// Keadaan Api Cinta pada minggu w, tanpa mengubah data:
// none (belum pernah) · done (minggu ini sudah) · due (minggu lalu main, minggu ini belum) ·
// umb (ada minggu bolong, Payung cukup menutupinya bila main minggu ini) · out (padam)
function streakView(wk, w) {
  const s = normWeek(wk);
  const base = { best: s.best, umb: s.umb, need: 0, prev: 0 };
  if (!s.n) return Object.assign(base, { n: 0, state: 'none' });
  const missed = w - s.last - 1;
  if (missed < 0) return Object.assign(base, { n: s.n, state: 'done' }); // minggu ini (atau jam perangkat mundur)
  if (missed === 0) return Object.assign(base, { n: s.n, state: 'due' });
  if (missed <= s.umb) return Object.assign(base, { n: s.n, state: 'umb', need: missed });
  return Object.assign(base, { n: 0, state: 'out', prev: s.n });
}
// Catat "main di minggu w". ev = null bila minggu ini sudah tercatat (atau jam mundur), selain itu kejadian untuk UI:
// start (pertama) · up (+1) · saved (Payung menutup minggu bolong) · restart (padam, mulai lagi dari 1)
function markWeek(wk, w) {
  const s = normWeek(wk);
  if (s.n && w <= s.last) return { wk: s, ev: null };
  const prev = s.n;
  let kind,
    used = 0;
  if (!s.n) {
    s.n = 1;
    kind = 'start';
  } else {
    const missed = w - s.last - 1;
    if (missed <= 0) {
      s.n++;
      kind = 'up';
    } else if (missed <= s.umb) {
      s.umb -= missed;
      used = missed;
      s.n++;
      kind = 'saved';
    } else {
      s.n = 1;
      kind = 'restart';
    }
  }
  s.last = w;
  let earned = 0;
  if (s.n % UMB_EVERY === 0 && s.umb < UMB_MAX) {
    s.umb++;
    earned = 1;
  }
  s.best = Math.max(s.best, s.n);
  return { wk: s, ev: { kind, n: s.n, prev, used, earned, umb: s.umb, best: s.best } };
}

// ---------- Jam Terbang (XP & level) ----------
const XP = { game: 20, win: 30, challenge: 5, stamp: 5, week: 10, daily: 5 };
const RANKS = [
  'Penumpang Baru',
  'Turis Cinta',
  'Backpacker Rindu',
  'Penjelajah Hati',
  'Pilot Kangen',
  'Kapten Romansa',
  'Duta Cinta',
  'Legenda Dunia',
];
// XP minimal untuk level L: 0, 60, 180, 360, 600, 900, 1260, 1680, … (tiap level butuh 60 XP lebih banyak)
const levelXp = L => 30 * (L - 1) * L;
function levelOf(xp) {
  xp = int(xp);
  let L = 1;
  while (L < 999 && xp >= levelXp(L + 1)) L++;
  return L;
}
function levelInfo(xp) {
  xp = int(xp);
  const L = levelOf(xp),
    a = levelXp(L),
    b = levelXp(L + 1);
  return { L, title: RANKS[Math.min(L, RANKS.length) - 1], xp, cur: xp - a, need: b - a, pct: Math.floor(((xp - a) / (b - a)) * 100) };
}
// XP satu game selesai + rinciannya (ditampilkan di layar menang)
function gameXp(o) {
  const ch = int(o.challenges),
    st = int(o.newStamps);
  const parts = [['Selesai main', XP.game]];
  if (o.won) parts.push(['Menang', XP.win]);
  // [label (templat kunci kamus), XP, data templat] — UI menerjemahkan label dengan datanya
  if (ch) parts.push(['{n} tantangan lulus', ch * XP.challenge, { n: ch }]);
  if (st) parts.push(['{n} cap kota baru', st * XP.stamp, { n: st }]);
  return { total: parts.reduce((s, p) => s + p[1], 0), parts };
}

// ---------- lencana seumur hidup ----------
// tingkat cap kota = jumlah kota di papan (19; dicek test/progress.js supaya ikut bila papan berubah)
const BADGES = [
  { id: 'games', name: 'Teman Setia', icon: 'heart', unit: 'game selesai', tiers: [5, 25, 100] },
  { id: 'wins', name: 'Sang Juara', icon: 'trophy', unit: 'kemenangan', tiers: [3, 15, 50] },
  { id: 'challenges', name: 'Bucin Totalitas', icon: 'sparkle', unit: 'tantangan lulus', tiers: [10, 50, 150] },
  { id: 'stamps', name: 'Kolektor Cap', icon: 'map', unit: 'cap kota', tiers: [5, 12, 19] },
  { id: 'landmarks', name: 'Arsitek Cinta', icon: 'crown', unit: 'landmark', tiers: [3, 15, 50] },
  { id: 'letters', name: 'Penulis Surat', icon: 'letter', unit: 'pesan cinta', tiers: [3, 15, 50] },
  { id: 'soulmate', name: 'Soulmate Sejati', icon: 'ring', unit: 'game sampai Soulmate', tiers: [1, 10, 30] },
  { id: 'streak', name: 'Api Abadi', icon: 'flame', unit: 'minggu beruntun', tiers: [4, 12, 26] },
];
const TIER_NAMES = ['Perunggu', 'Perak', 'Emas'];
function normLife(l) {
  const o = l && typeof l === 'object' ? l : {};
  return { ch: int(o.ch), lm: int(o.lm), lt: int(o.lt), sm: int(o.sm) };
}
// nilai tiap lencana dari data paspor (p sudah dinormalkan passport())
function badgeValues(p) {
  return {
    games: int(p.games),
    wins: int(p.wins),
    challenges: p.life.ch,
    stamps: p.stamps.length,
    landmarks: p.life.lm,
    letters: p.life.lt,
    soulmate: p.life.sm,
    streak: p.wk.best,
  };
}
const tierOf = (b, v) => b.tiers.reduce((t, x, i) => (v >= x ? i + 1 : t), 0);
function badgeTiers(p) {
  const v = badgeValues(p);
  const out = {};
  BADGES.forEach(b => (out[b.id] = tierOf(b, v[b.id])));
  return out;
}
// lencana yang naik tingkat di antara dua keadaan
function tierUps(before, after) {
  return BADGES.filter(b => (after[b.id] || 0) > (before[b.id] || 0)).map(b => ({
    id: b.id,
    name: b.name,
    icon: b.icon,
    tier: after[b.id],
  }));
}

// ---------- hadiah kosmetik (hanya tampilan di perangkat ini, tidak memengaruhi permainan) ----------
// tema papan yang terbuka lewat level Jam Terbang (warna di src/styles/themes.css)
const BOARD_THEMES = [
  { id: 'klasik', name: 'Klasik', lv: 1 },
  { id: 'bali', name: 'Senja Bali', lv: 3 },
  { id: 'paris', name: 'Paris Malam', lv: 5 },
  { id: 'kyoto', name: 'Sakura Kyoto', lv: 7 },
];
// tema yang dipakai: pilihan tersimpan bila sudah terbuka di level L, selain itu Klasik
function themeFor(id, L) {
  const t = BOARD_THEMES.find(x => x.id === id);
  return t && levelGate(L) >= t.lv ? t.id : 'klasik';
}
const levelGate = L => (Number.isFinite(+L) ? +L : 1);
// tema yang baru terbuka saat naik dari level L0 ke L1
const themesUnlocked = (L0, L1) => BOARD_THEMES.filter(t => t.lv > L0 && t.lv <= L1);
// Kartu Kenangan Edisi Emas: Lv 5+, punya lencana Emas, atau rekor Api Cinta ≥ 4 minggu (p dinormalkan passport())
function goldEdition(p) {
  if (!p || !p.name) return false;
  const t = badgeTiers(p);
  return levelOf(p.xp) >= 5 || p.wk.best >= 4 || Object.keys(t).some(k => t[k] >= 3);
}

// ---------- catatan tahunan (bahan Kilas Balik Cinta) ----------
// Satu ringkasan per tahun kalender lokal, bukan daftar per game: ukurannya tetap kecil (muat di tautan Cadangan
// Paspor) berapa pun jumlah game. Hanya game selesai milik pemegang paspor (recordPassport). Disimpan 3 tahun terakhir.
const YEARS_KEEP = 3;
const VS_MAX = 8;
const MODES = ['local', 'ai', 'online'];
const REASONS = ['rounds', 'manual', 'bankrupt', 'resign', 'triple', 'line', 'spots'];
// eslint-disable-next-line no-control-regex
const BAD_CH = /[\u0000-\u001f\u007f<>]/g;
const txt = (s, n) => (typeof s === 'string' ? s.replace(BAD_CH, '').trim().slice(0, n) : '');
const counts = (o, keyOk, cap) => {
  const out = {};
  if (o && typeof o === 'object')
    Object.keys(o)
      .filter(keyOk)
      .slice(0, cap)
      .forEach(k => {
        const v = int(o[k]);
        if (v) out[k] = v;
      });
  return out;
};
function emptyYear() {
  return {
    g: 0,
    w: 0,
    mo: Array(12).fill(0),
    md: {},
    rd: 0,
    long: 0,
    ch: 0,
    lt: 0,
    lm: 0,
    tk: 0,
    tv: 0,
    mt: 0,
    love: 0,
    best: 0,
    how: {},
    city: {},
    vs: {},
    wk: 0,
    lw: 0,
    t0: 0,
    t1: 0,
  };
}
function normYear(y, isCity) {
  const o = y && typeof y === 'object' ? y : {};
  const e = emptyYear();
  ['g', 'w', 'rd', 'long', 'ch', 'lt', 'lm', 'tk', 'tv', 'mt', 'love', 'best', 'wk', 'lw', 't0', 't1'].forEach(k => (e[k] = int(o[k])));
  e.w = Math.min(e.w, e.g);
  if (Array.isArray(o.mo)) e.mo = e.mo.map((_, i) => int(o.mo[i]));
  e.md = counts(o.md, k => MODES.includes(k), 3);
  e.how = counts(o.how, k => REASONS.includes(k), 7);
  e.city = counts(o.city, k => /^\d{1,2}$/.test(k) && (!isCity || isCity(+k)), 64);
  if (o.vs && typeof o.vs === 'object')
    Object.keys(o.vs)
      .slice(0, VS_MAX)
      .forEach(k => {
        const n = txt(k, 16),
          v = Array.isArray(o.vs[k]) ? o.vs[k] : [];
        const g = int(v[0]);
        if (n && g) e.vs[n] = [g, Math.min(int(v[1]), g)];
      });
  return e;
}
// { "2026": {...}, ... } → hanya tahun 2000–2999 yang sah, YEARS_KEEP tahun terbaru
function normYears(yr, isCity) {
  const out = {};
  if (yr && typeof yr === 'object')
    Object.keys(yr)
      .filter(k => /^2\d{3}$/.test(k))
      .sort()
      .slice(-YEARS_KEEP)
      .forEach(k => (out[k] = normYear(yr[k], isCity)));
  return out;
}
// Catat satu game selesai ke tahun lokal `now`. g = { won, reason, mode, rounds, worth, love, ch, lt, lm, tk, tv, mt,
// cities: [indeks petak], vs: [nama lawan manusia] }. Mengembalikan data tahunan baru (tidak mengubah yr).
function noteYear(yr, g, now) {
  const all = normYears(yr);
  const d = new Date(now),
    key = String(d.getFullYear());
  const y = all[key] || emptyYear();
  y.g++;
  if (g.won) y.w++;
  y.mo[d.getMonth()]++;
  if (MODES.includes(g.mode)) y.md[g.mode] = (y.md[g.mode] || 0) + 1;
  const r = int(g.rounds);
  y.rd += r;
  y.long = Math.max(y.long, r);
  y.ch += int(g.ch);
  y.lt += int(g.lt);
  y.lm += int(g.lm);
  y.tk += int(g.tk);
  y.tv += int(g.tv);
  y.mt += int(g.mt);
  y.love += int(g.love);
  y.best = Math.max(y.best, int(g.worth));
  if (g.won && REASONS.includes(g.reason)) y.how[g.reason] = (y.how[g.reason] || 0) + 1;
  (Array.isArray(g.cities) ? g.cities : []).forEach(i => {
    if (Number.isInteger(i) && i >= 0 && i < 100) y.city[i] = (y.city[i] || 0) + 1;
  });
  const met = [];
  (Array.isArray(g.vs) ? g.vs : []).forEach(raw => {
    const n = txt(raw, 16);
    if (!n || met.includes(n)) return;
    met.push(n);
    const v = y.vs[n] || [0, 0];
    y.vs[n] = [v[0] + 1, v[1] + (g.won ? 1 : 0)];
  });
  // daftar lawan dibatasi: yang paling jarang dibuang dulu, tapi lawan game ini selalu tetap (lawan baru bisa tumbuh)
  const names = Object.keys(y.vs);
  if (names.length > VS_MAX)
    names
      .filter(n => !met.includes(n))
      .sort((a, b) => y.vs[a][0] - y.vs[b][0])
      .slice(0, names.length - VS_MAX)
      .forEach(n => delete y.vs[n]);
  const w = weekNo(now);
  if (w !== y.lw) {
    y.wk++;
    y.lw = w;
  }
  if (!y.t0) y.t0 = int(now);
  y.t1 = Math.max(y.t1, int(now));
  all[key] = y;
  return normYears(all);
}

export {
  BOARD_THEMES,
  goldEdition,
  noteYear,
  normYears,
  YEARS_KEEP,
  themeFor,
  themesUnlocked,
  BADGES,
  RANKS,
  TIER_NAMES,
  UMB_EVERY,
  UMB_MAX,
  XP,
  badgeTiers,
  badgeValues,
  daysBetween,
  daysLeft,
  gameXp,
  levelInfo,
  levelOf,
  levelXp,
  markWeek,
  normLife,
  normWeek,
  streakView,
  tierOf,
  tierUps,
  weekNo,
};
