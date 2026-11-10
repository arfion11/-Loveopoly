/* LOVEOPOLY — Pertanyaan Hari Ini: logika murni (tanpa DOM; diuji test/progress.js, dipakai screens/daily.js)
   Satu soal per hari, sama di semua perangkat & zona waktu (hari menurut WIB). Bank = D.DAILY_QS (soal biasa) lalu
   D.DAILY_SPECIAL (edisi tanggal khusus); "nomor soal" (qi) = indeks di gabungan keduanya (ALL). Tanpa server: jawaban
   pasangan dikirim lewat tautan …/#tanya=<base64url JSON> (bagian # tidak pernah terkirim ke server).
   Isi tautan: { v: 1, d: hari, q?: nomor soal, n: nama pengirim, a: pilihan pengirim, g: tebakan pengirim atas
                 pasangan, m?: nama penjawab kedua, b?: pilihan penjawab kedua, h?: tebakan penjawab kedua atas pengirim }.
   q ikut di tautan supaya penerima menjawab soal yang SAMA walau bank/urutan soal suatu hari berubah.
   Tautan dari orang lain = data tak tepercaya: selalu lewat decodeLink (divalidasi ketat) & di-escape saat tampil. */
import { D } from '../engine/data.js';

const DAY = 864e5;
const REG = D.DAILY_QS,
  SPECIAL = D.DAILY_SPECIAL,
  ALL = REG.concat(SPECIAL),
  N = REG.length;
// nomor hari menurut WIB (UTC+7, tanpa jam musim panas): SAMA untuk semua pemain di zona mana pun, berganti tiap
// 00.00 WIB. Dulu tanggal lokal → pasangan LDR beda zona sempat melihat nomor & soal berbeda selama beberapa jam.
const WIB = 7 * 3600e3;
const dayNo = ms => Math.floor((Number(ms) + WIB) / DAY);
// Urutan soal. Hari sebelum SWITCH (11 Nov 2026) memakai urutan lama atas 60 soal pertama, PERSIS seperti dulu
// (tautan & jawaban tersimpan untuk hari-hari itu tetap menunjuk soal yang sama). Mulai SWITCH: siklus N hari →
// semua soal baru (indeks ≥ OLD_N) dulu, baru soal lama; tiap bagian diacak tetap dengan pengali 37 yang saling prima
// dengan panjangnya (dicek test/progress.js), jadi tidak ada soal berulang dalam satu siklus. Tanggal khusus (WIB)
// memakai soal edisi khusus. Menambah soal lagi nanti = SWITCH baru, jangan mengubah urutan hari yang sudah lewat.
const OLD_N = 60,
  SWITCH = 20768;
const mod = (a, n) => ((a % n) + n) % n;
// tanggal WIB "BB-HH" dari nomor hari (hari ke-d dimulai 00.00 WIB = d·24 jam sejak 1 Jan 1970 di jam UTC+7)
const mdOf = day => {
  const t = new Date(day * DAY);
  return String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0');
};
function dailyIndex(day) {
  if (day < SWITCH) return mod(day * 37, OLD_N);
  const sp = SPECIAL.findIndex(x => x.md === mdOf(day));
  if (sp >= 0) return N + sp;
  const t = mod(day - SWITCH, N),
    fresh = N - OLD_N;
  return t < fresh ? OLD_N + mod(t * 37, fresh) : mod((t - fresh) * 37, OLD_N);
}
// soal dari nomor soal (bila sah) atau dari hari
const questionAt = qi => (Number.isInteger(qi) && qi >= 0 && qi < ALL.length ? ALL[qi] : null);
const dailyQ = (day, qi) => questionAt(qi) || ALL[dailyIndex(day)];
// nomor urut tampilan "Pertanyaan #…" (dihitung dari 1 Jan 2026)
const dailyNo = day => day - 20453;

const cleanName = s =>
  typeof s === 'string'
    ? s
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f<>]/g, '')
        .trim()
        .slice(0, 16)
    : '';
const pick = v => (Number.isInteger(v) && v >= 0 && v <= 3 ? v : null);

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
function encodeLink(o) {
  const x = { v: 1, d: o.d, q: questionAt(o.q) ? o.q : dailyIndex(o.d), n: cleanName(o.n), a: o.a, g: o.g };
  if (o.m != null) Object.assign(x, { m: cleanName(o.m), b: o.b, h: o.h });
  return b64(JSON.stringify(x));
}
// tautan → isi tervalidasi, atau null. today: hari sekarang (tautan lama s.d. 60 hari & paling jauh 2 hari ke depan,
// untuk jam perangkat yang sedikit meleset)
function decodeLink(s, today) {
  try {
    if (typeof s !== 'string' || !/^[A-Za-z0-9_-]{8,400}$/.test(s)) return null;
    const o = JSON.parse(unb64(s));
    if (!o || o.v !== 1 || !Number.isInteger(o.d) || o.d < today - 60 || o.d > today + 2) return null;
    const n = cleanName(o.n),
      a = pick(o.a),
      g = pick(o.g);
    if (!n || a == null || g == null) return null;
    // nomor soal opsional (tautan versi lama tidak punya): harus menunjuk soal yang ada
    if (o.q != null && !questionAt(o.q)) return null;
    const out = { d: o.d, q: o.q != null ? o.q : dailyIndex(o.d), n, a, g };
    if (o.m != null) {
      const m = cleanName(o.m),
        b = pick(o.b),
        h = pick(o.h);
      if (!m || b == null || h == null) return null;
      Object.assign(out, { m, b, h });
    }
    return out;
  } catch (e) {
    return null;
  }
}
// hasil berdua: a/g milik orang pertama, b/h milik orang kedua
function score(o) {
  const g1 = o.g === o.b, // tebakan orang pertama tentang pilihan orang kedua
    g2 = o.h === o.a; // tebakan orang kedua tentang pilihan orang pertama
  return { same: o.a === o.b, g1, g2, n: Number(g1) + Number(g2) };
}

export { ALL as DAILY_ALL, OLD_N, SWITCH, dailyIndex, dailyNo, dailyQ, dayNo, decodeLink, encodeLink, mdOf, questionAt, score };
