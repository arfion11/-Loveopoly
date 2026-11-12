/* LOVEOPOLY — cadangan Paspor Cinta (murni: tanpa DOM; diuji test/progress.js, dipakai screens/passport.js & screens/backup.js)
   normProfile = SATU-SATUNYA penyaring profil paspor (passport() & pemulihan cadangan memakainya): data bisa rusak,
   dari versi lama, atau dari tautan orang lain. Cadangan = tautan pribadi …/#pulihkan=<base64url JSON>
   { v: 1, t: waktu, p: profil, s: pengaturan tampilan (daftar putih), d: Pertanyaan Hari Ini }. Simpanan game berjalan
   & persetujuan statistik (analytics) sengaja TIDAK ikut. */
import { D } from '../engine/data.js';
import { normLife, normWeek, normYears } from './progress.js';

const isCity = i => !!D.TILES[i] && D.TILES[i].type === 'city';
const int = v => (Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0);
// eslint-disable-next-line no-control-regex
const txt = (s, n) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, n) : '');

function normProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    name: txt(p.name, 16),
    avatar: D.AVATARS.includes(p.avatar) ? p.avatar : D.AVATARS[0],
    color: D.TOKEN_COLORS.includes(p.color) ? p.color : D.TOKEN_COLORS[0],
    since: int(p.since),
    games: int(p.games),
    wins: int(p.wins),
    stamps: Array.isArray(p.stamps) ? [...new Set(p.stamps.filter(i => Number.isInteger(i) && isCity(i)))] : [],
    skipped: !!p.skipped,
    last: txt(p.last, 80),
    msg: txt(p.msg, 240),
    // progres (lihat src/ui/progress.js): Jam Terbang, Api Cinta, catatan seumur hidup untuk lencana, kunjungan terakhir
    xp: int(p.xp),
    wk: normWeek(p.wk),
    life: normLife(p.life),
    seen: int(p.seen),
    // rekap per tahun (bahan Kilas Balik Cinta): jumlah main, lawan, kota, cara menang, …
    yr: normYears(p.yr, isCity),
  };
}

// pengaturan yang ikut cadangan: hanya tampilan & kenyamanan, dengan nilai yang dikenal
const PREFS = {
  sound: v => typeof v === 'boolean',
  speed: v => v === 'normal' || v === 'fast',
  aiSpeed: v => v === 'slow' || v === 'normal' || v === 'fast',
  theme: v => v === 'system' || v === 'light' || v === 'dark',
  autoEnd: v => typeof v === 'boolean',
  view3d: v => typeof v === 'boolean',
  walkCam: v => typeof v === 'boolean',
  board: v => typeof v === 'string' && /^[a-z]{2,12}$/.test(v),
  power: v => v === 'auto' || v === 'save' || v === 'full',
  haptics: v => typeof v === 'boolean',
  lang: v => v === 'auto' || v === 'id' || v === 'en',
};
function pickPrefs(o) {
  const out = {};
  if (o && typeof o === 'object') Object.keys(PREFS).forEach(k => PREFS[k](o[k]) && (out[k] = o[k]));
  return out;
}
const pick4 = v => (Number.isInteger(v) && v >= 0 && v <= 3 ? v : null);
function pickDaily(o) {
  if (!o || typeof o !== 'object' || !Number.isInteger(o.d)) return null;
  const d = { d: o.d, n: txt(o.n, 16), a: pick4(o.a), g: pick4(o.g), p: null, xp: !!o.xp };
  if (Number.isInteger(o.q) && o.q >= 0 && o.q < 2000) d.q = o.q; // nomor soal (divalidasi lagi saat dibaca)
  if (o.p && typeof o.p === 'object' && pick4(o.p.a) != null && pick4(o.p.g) != null) d.p = { n: txt(o.p.n, 16), a: o.p.a, g: o.p.g };
  return d;
}

const b64 = s => {
  let bin = '';
  new TextEncoder().encode(s).forEach(c => (bin += String.fromCharCode(c)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = s => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

function makeBackup(o, now) {
  return b64(JSON.stringify({ v: 1, t: int(now), p: normProfile(o.profile), s: pickPrefs(o.prefs), d: pickDaily(o.daily) }));
}
// kode / tautan cadangan → isi tervalidasi, atau null. Harus berisi paspor bernama.
function parseBackup(input) {
  try {
    const m = /(?:#pulihkan=)?([A-Za-z0-9_-]{16,8000})\s*$/.exec(String(input || '').trim());
    if (!m) return null;
    const o = JSON.parse(unb64(m[1]));
    if (!o || o.v !== 1) return null;
    const p = normProfile(o.p);
    if (!p.name) return null;
    p.skipped = false;
    return { t: int(o.t), p, s: pickPrefs(o.s), d: pickDaily(o.d) };
  } catch (e) {
    return null;
  }
}

export { makeBackup, normProfile, parseBackup, pickPrefs };
