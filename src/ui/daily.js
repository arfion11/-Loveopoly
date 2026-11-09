/* LOVEOPOLY — Pertanyaan Hari Ini: logika murni (tanpa DOM; diuji test/progress.js, dipakai screens/daily.js)
   Satu soal per hari dari D.DAILY_QS, sama di semua perangkat & zona waktu (hari menurut WIB). Tanpa server: jawaban
   pasangan dikirim lewat tautan …/#tanya=<base64url JSON> (bagian # tidak pernah terkirim ke server).
   Isi tautan: { v: 1, d: hari, n: nama pengirim, a: pilihan pengirim, g: tebakan pengirim atas pasangan,
                 m?: nama penjawab kedua, b?: pilihan penjawab kedua, h?: tebakan penjawab kedua atas pengirim }.
   Tautan dari orang lain = data tak tepercaya: selalu lewat decodeLink (divalidasi ketat) & di-escape saat tampil. */
import { D } from '../engine/data.js';

const DAY = 864e5;
const N = D.DAILY_QS.length;
// nomor hari menurut WIB (UTC+7, tanpa jam musim panas): SAMA untuk semua pemain di zona mana pun, berganti tiap
// 00.00 WIB. Dulu tanggal lokal → pasangan LDR beda zona sempat melihat nomor & soal berbeda selama beberapa jam.
const WIB = 7 * 3600e3;
const dayNo = ms => Math.floor((Number(ms) + WIB) / DAY);
// urutan soal diacak tetap (37 dan jumlah soal saling prima → semua soal muncul sebelum ada yang berulang)
const dailyIndex = day => (((day * 37) % N) + N) % N;
const dailyQ = day => D.DAILY_QS[dailyIndex(day)];
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
  const x = { v: 1, d: o.d, n: cleanName(o.n), a: o.a, g: o.g };
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
    const out = { d: o.d, n, a, g };
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

export { dailyIndex, dailyNo, dailyQ, dayNo, decodeLink, encodeLink, score };
