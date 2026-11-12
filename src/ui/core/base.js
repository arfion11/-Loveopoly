/* LOVEOPOLY — UI inti › dasar: helper DOM & teks, penyimpanan, impor data alamat lama, state App, kepemilikan kontrol (diekspor ulang lewat src/ui/core.js) */
import { D } from '../../engine/data.js';
import { E } from '../../engine/engine.js';
import { detectLang, fmtNum, getLang, loadLang, setLang, t, tLog, tile } from '../../i18n/i18n.js';

const { TILES, GROUPS, RULES } = D;
const N = E.N;

// angka uang/jumlah: pemisah ribuan sesuai bahasa aktif (2.500 / 2,500)
const fmt = n => fmtNum(Math.round(Number(n) || 0));
const esc = s =>
  String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ic = (n, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"></use></svg>';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      return false;
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch (e) {
      /* abaikan */
    }
  },
};
// Pindah alamat (loveopoly-5b227.web.app → loveopoly.web.app): halaman pengalih di alamat lama mengirim data
// perangkat lewat #lv-import=<base64url JSON>. Dipasang sebelum pengaturan dibaca. Hanya kunci loveopoly.* yang
// BELUM ada di alamat baru (tidak pernah menimpa); isinya tetap disaring saat dipakai (passport(), validSave, cleanState).
const imported = (() => {
  try {
    const m = /[#&]lv-import=([A-Za-z0-9_-]+)/.exec(location.hash || '');
    if (!m) return 0;
    history.replaceState(null, '', location.pathname + location.search);
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4))));
    const data = JSON.parse(json);
    let n = 0;
    Object.keys(data || {}).forEach(k => {
      const v = data[k];
      if (!/^loveopoly\.v\d\.[a-z0-9]+$/.test(k) || typeof v !== 'string' || v.length > 200000 || localStorage.getItem(k) != null) return;
      try {
        JSON.parse(v);
        localStorage.setItem(k, v);
        n++;
      } catch (e) {
        /* abaikan nilai rusak */
      }
    });
    return n;
  } catch (e) {
    return 0;
  }
})();
// gambar dari state (foto bukti) hanya boleh data URI gambar; selain itu dibuang (state bisa datang dari host
// online atau impor data, jangan pernah disisipkan apa adanya ke HTML)
const safeImg = u => (typeof u === 'string' && u.length < 60000 && /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : '');
const KEYS = {
  save: 'loveopoly.v2.save',
  prefs: 'loveopoly.v1.prefs',
  online: 'loveopoly.v2.online',
  setup: 'loveopoly.v2.setup',
  last: 'loveopoly.v2.last', // setelan game lokal terakhir (Main lagi cepat di beranda)
  tour: 'loveopoly.v2.tour',
  guide: 'loveopoly.v2.guide',
};
const reduceMotion = () => {
  try {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};
const coin = '<i class="coin-ic" aria-hidden="true"></i>';
// tutup dengan animasi keluar ringan (kelas .leaving di style.css, cermin animasi buka). Elemen langsung lepas dari
// logika: tanpa id (deep: id di dalamnya juga, kecuali SVG), inert & aria-hidden, lalu dihapus setelah animasi.
function leave(el, ms, deep) {
  if (!el) return;
  if (reduceMotion() || !el.isConnected) {
    el.remove();
    return;
  }
  el.removeAttribute('id');
  if (deep)
    $$('[id]', el).forEach(n => {
      if (!(n instanceof SVGElement)) n.removeAttribute('id');
    });
  el.setAttribute('inert', '');
  el.setAttribute('aria-hidden', 'true');
  el.classList.add('leaving');
  setTimeout(() => el.remove(), ms || 260);
}

// Bahasa: prefs.lang 'auto' (ikut perangkat) | 'id' | 'en'. Memasang bahasa aktif, <html lang> & judul tab.
// bahasa yang dipakai: pilihan di Pengaturan, atau (Otomatis) bahasa perangkat
function wantLang() {
  const want = App.prefs.lang === 'id' || App.prefs.lang === 'en' ? App.prefs.lang : 'auto';
  const nav = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
  return want === 'auto' ? detectLang(nav) : want;
}
// siapkan kamus bahasa yang dipakai (English dimuat terpisah, sekali)
const prepareLang = () => loadLang(wantLang());
function applyLang() {
  const l = setLang(wantLang());
  document.documentElement.lang = l;
  document.title = t('Loveopoly · Board game keliling dunia bareng pasangan & teman');
  // teks statis di index.html (aria-label dsb.): data-i18n = nama atribut, kunci asli disimpan di data-i18n-k
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const a = el.dataset.i18n;
    if (!el.dataset.i18nK) el.dataset.i18nK = el.getAttribute(a) || '';
    el.setAttribute(a, t(el.dataset.i18nK));
  });
  return l;
}
const App = {
  S: null,
  shown: null,
  mode: 'local',
  seat: -1,
  pending: [],
  animating: false,
  prefs: Object.assign(
    { sound: true, speed: 'normal', aiSpeed: 'normal', theme: 'system', autoEnd: true, lang: 'auto' },
    store.get(KEYS.prefs, {})
  ),
  modal: null,
  focus: -1,
  aiTimer: null,
  net: null,
  rollSpin: 0,
  cashShown: {},
  loveShown: {},
  turnKey: '',
  aim: null,
  threatKeys: null,
  tour: false,
  tourPending: false,
  revealing: false,
  layout: 'wide',
  cam: {
    pref: store.get('loveopoly.v2.cam', 'auto') === 'near' ? 'near' : 'auto',
    pref3d: store.get('loveopoly.v3.cam3d', 'all') === 'near' ? 'near' : 'all',
    zoomed: false,
    x: 0,
    y: 0,
    s: 1,
    manualUntil: 0,
    L: 0,
    top: 0,
    bot: 0,
    outTimer: null,
  },
  pick: null,
  lastLogN: 0,
};

const SPD = () => (reduceMotion() ? 0.15 : App.prefs.speed === 'fast' ? 0.5 : 1);
const AISPD = () => (App.prefs.aiSpeed === 'fast' ? 0.45 : App.prefs.aiSpeed === 'slow' ? 1.7 : 1);

// ---------- kepemilikan kontrol ----------
function controls(i) {
  if (!App.S || i == null || i < 0 || !App.S.players[i]) return false;
  if (App.mode === 'online') return i === App.seat && !(App.net && App.net.isBotSeat(i));
  return App.S.players[i].kind === 'human';
}
function runsAI(i) {
  if (!App.S || i < 0) return false;
  const p = App.S.players[i];
  if (App.mode === 'online') return !!(App.net && App.net.isHost() && App.net.isBotSeat(i));
  return p.kind === 'ai';
}
function viewer() {
  const S = App.S;
  if (!S) return 0;
  if (App.mode === 'online') return App.seat;
  const a = E.actor(S);
  if (a >= 0 && S.players[a].kind === 'human') return a;
  if (S.players[S.turn.p].kind === 'human') return S.turn.p;
  const h = S.players.find(p => p.kind === 'human' && !p.bankrupt) || S.players.find(p => p.kind === 'human');
  return h ? h.i : 0;
}
const hotseat = () => App.mode !== 'online' && App.S && App.S.players.filter(q => q.kind === 'human').length > 1;
const pname = i => (App.S && App.S.players[i] ? App.S.players[i].name : 'Bank');
function setHTML(el, html) {
  if (!el || el._h === html) return false;
  el.innerHTML = html;
  el._h = html;
  return true;
}
function restart(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
function pulse(el, cls, ms) {
  if (!el) return;
  restart(el, cls);
  clearTimeout(el['_t_' + cls]);
  el['_t_' + cls] = setTimeout(() => el.classList.remove(cls), ms);
}
const avatarHTML = (p, cls) => '<span class="av ' + (cls || '') + '" style="--c:' + p.color + '"><span>' + esc(p.avatar) + '</span></span>';

export {
  applyLang,
  getLang,
  t,
  tLog,
  tile,
  $,
  $$,
  AISPD,
  App,
  GROUPS,
  KEYS,
  N,
  RULES,
  SPD,
  TILES,
  avatarHTML,
  coin,
  controls,
  esc,
  fmt,
  hotseat,
  ic,
  imported,
  leave,
  pname,
  pulse,
  reduceMotion,
  restart,
  runsAI,
  safeImg,
  setHTML,
  sleep,
  store,
  viewer,
  prepareLang,
  wantLang,
};
