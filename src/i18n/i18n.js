/* LOVEOPOLY — bahasa (i18n). Bahasa sumber = Indonesia: teks di kode tetap Bahasa Indonesia dan sekaligus menjadi
   kunci kamus (gaya gettext), jadi kode tetap mudah dibaca dan teks yang belum diterjemahkan tampil dalam Bahasa
   Indonesia (tidak pernah kosong). Kamus English di ./en.js (+ ./en/*.js), dimuat terpisah hanya saat dipakai supaya
   pemain berbahasa Indonesia tidak ikut mengunduhnya. Dicek `npm run test:i18n`.

   t('Beli {kota}?', { kota })       → "Buy Bandung?"
   t('{n} {n|minggu|minggu}', { n })  → bentuk jamak English lewat {n|satu|banyak} di templat English: "{n} {n|week|weeks}"
   t('Kota§petak')                    → konteks setelah § membedakan kunci yang sama ("Kota" = Cities / City); tidak tampil
   Nilai parameter: string apa adanya (nama pemain), angka diformat sesuai bahasa, { tile: i } = nama petak
   diterjemahkan, { t: 'teks', p } = teks lain yang ikut diterjemahkan. Engine memakai bentuk yang sama (tx() di
   src/engine/rules/base.js) untuk riwayat netral bahasa: tiap HP menerjemahkan sendiri (main online beda bahasa). */
import { D } from '../engine/data.js';

const DICT = { id: null, en: null };
const LANGS = ['id', 'en'];
let LANG = 'id';
// teks yang diminta tapi belum ada di kamus (bahasa selain Indonesia): bahan uji & debug (window.LoveI18n)
const MISS = new Set();
let VALS = new Set();

// Bahasa perangkat → 'id' bila bahasa utama Indonesia (atau serumpun: Melayu, Jawa, Sunda), selain itu 'en'
function detectLang(list) {
  const first = String((list && list[0]) || 'id').toLowerCase();
  return /^(id|in|ms|jv|su)(\b|-|_)/.test(first + '-') ? 'id' : 'en';
}
// muat kamus sekali (chunk terpisah). Gagal (offline pertama kali) = tetap Bahasa Indonesia
function loadLang(l) {
  if (l !== 'en' || DICT.en) return Promise.resolve(true);
  return import('./en.js')
    .then(m => {
      useDict('en', m.EN);
      return true;
    })
    .catch(() => false);
}
function useDict(l, d) {
  DICT[l] = d;
  VALS = new Set(Object.values(d));
}
function setLang(l) {
  LANG = LANGS.includes(l) ? l : 'id';
  return LANG;
}
const getLang = () => LANG;
const numLocale = () => (LANG === 'en' ? 'en-US' : 'id-ID');
// angka bulat → pemisah ribuan sesuai bahasa; pecahan → maksimal 1 desimal (1,6 / 1.6)
function fmtNum(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v)
    ? Math.round(v).toLocaleString(numLocale())
    : v.toLocaleString(numLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
const PH = /\{(\w+)(?:\|([^}|]*)\|([^}]*))?\}/g;
function value(v) {
  if (typeof v === 'number') return fmtNum(v);
  if (v && typeof v === 'object') {
    if ('tile' in v) return t(D.TILES[v.tile] ? D.TILES[v.tile].name : '');
    if ('t' in v) return t(v.t, v.p);
  }
  return v == null ? '' : String(v);
}
function fill(tpl, p) {
  return String(tpl).replace(PH, (m, k, one, many) => {
    const v = p ? p[k] : undefined;
    if (one != null) return Number(v) === 1 ? one : many;
    return v === undefined ? m : value(v);
  });
}
const plain = s => (s.includes('§') ? s.replace(/§[^§]*$/, '') : s);
// terjemahan teks sumber (Indonesia) ke bahasa aktif, lalu isi parameter
function t(src, p) {
  if (src == null) return '';
  const s = String(src);
  const d = DICT[LANG];
  let out;
  if (LANG === 'id' || !d) out = plain(s);
  else if (Object.prototype.hasOwnProperty.call(d, s)) out = d[s];
  else {
    // teks yang sudah diterjemahkan (jaring pengaman di toast/btn) bukan kunci yang hilang
    if (s && !VALS.has(s) && /[A-Za-z]/.test(s)) MISS.add(s);
    out = plain(s);
  }
  return p ? fill(out, p) : out;
}
// entri riwayat / pesan engine: { text, k, a } (lihat tx di engine) atau teks biasa
const tLog = x => (x && typeof x === 'object' && x.k ? t(x.k, x.a) : t(x && typeof x === 'object' ? x.text : x));
// nama petak terjemahan
const tile = i => t(D.TILES[i] ? D.TILES[i].name : '');
const missing = () => [...MISS];

export { LANGS, detectLang, fill, fmtNum, getLang, loadLang, missing, numLocale, setLang, t, tLog, tile, useDict };
