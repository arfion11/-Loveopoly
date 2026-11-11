// Uji logika progres Paspor (murni, tanpa browser): Api Cinta mingguan, Payung Rindu, Jam Terbang, lencana.
// npm run test:progress
import * as P from '../src/ui/progress.js';
import { D } from '../src/engine/data.js';
import * as Q from '../src/ui/daily.js';
import * as B from '../src/ui/backup.js';

const results = [];
const ok = (name, cond, detail) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' — ' + detail : ''));
const at = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime(); // waktu LOKAL

// --- minggu lokal ---
const sun = at(2026, 11, 8, 23, 59),
  mon = at(2026, 11, 9, 0, 0),
  nextSun = at(2026, 11, 15, 23, 59);
ok('minggu: Minggu 23:59 dan Senin 00:00 beda minggu', P.weekNo(mon) === P.weekNo(sun) + 1, P.weekNo(sun) + ' → ' + P.weekNo(mon));
ok('minggu: Senin sampai Minggu satu minggu yang sama', P.weekNo(mon) === P.weekNo(nextSun));
ok('minggu: pergantian tahun tetap berurutan', P.weekNo(at(2027, 1, 4)) === P.weekNo(at(2026, 12, 28)) + 1);
ok(
  'sisa hari: Senin 7, Sabtu 2, Minggu 1',
  P.daysLeft(at(2026, 11, 9)) === 7 && P.daysLeft(at(2026, 11, 14)) === 2 && P.daysLeft(at(2026, 11, 15)) === 1
);
ok('selisih hari kalender (lokal)', P.daysBetween(at(2026, 11, 1, 23), at(2026, 11, 10, 1)) === 9);

// --- Api Cinta & Payung Rindu ---
const w0 = P.weekNo(at(2026, 11, 9));
let r = P.markWeek(null, w0);
ok('api: main pertama → menyala 1 minggu (start)', r.ev.kind === 'start' && r.wk.n === 1 && r.wk.last === w0);
ok('api: main lagi di minggu yang sama tidak menambah', P.markWeek(r.wk, w0).ev === null && P.markWeek(r.wk, w0).wk.n === 1);
ok('api: jam perangkat mundur tidak mengubah apa pun', P.markWeek(r.wk, w0 - 3).ev === null);
let wk = r.wk;
for (let i = 1; i <= 3; i++) wk = P.markWeek(wk, w0 + i).wk;
ok('api: 4 minggu beruntun → dapat 1 Payung Rindu', wk.n === 4 && wk.umb === 1, JSON.stringify(wk));
const due = P.streakView(wk, w0 + 4),
  umb = P.streakView(wk, w0 + 5),
  out = P.streakView(wk, w0 + 6);
ok(
  'api: tampilan due → umb (1 minggu bolong, Payung cukup) → out',
  due.state === 'due' && umb.state === 'umb' && umb.need === 1 && out.state === 'out' && out.prev === 4 && out.n === 0,
  [due.state, umb.state, out.state].join(',')
);
r = P.markWeek(wk, w0 + 5);
ok('api: 1 minggu bolong ditutup Payung → saved, lanjut 5', r.ev.kind === 'saved' && r.ev.used === 1 && r.wk.n === 5 && r.wk.umb === 0);
r = P.markWeek(wk, w0 + 6);
ok(
  'api: 2 minggu bolong, Payung cuma 1 → mulai lagi dari 1, rekor tetap 4',
  r.ev.kind === 'restart' && r.wk.n === 1 && r.wk.best === 4 && r.ev.prev === 4
);
wk = P.markWeek(null, w0).wk;
for (let i = 1; i < 16; i++) wk = P.markWeek(wk, w0 + i).wk;
ok('api: Payung maksimal 2', wk.n === 16 && wk.umb === 2, JSON.stringify(wk));
const two = P.markWeek(wk, w0 + 18);
ok(
  'api: 2 minggu bolong dengan 2 Payung → selamat, Payung habis',
  two.ev.kind === 'saved' && two.ev.used === 2 && two.wk.umb === 0 && two.wk.n === 17
);
ok(
  'api: data rusak dinormalkan aman',
  JSON.stringify(P.normWeek({ n: '3', last: -5, umb: 9, best: 'x' })) === '{"last":0,"n":3,"best":3,"umb":2}'
);
ok('api: tampilan tanpa data = none', P.streakView(undefined, w0).state === 'none');

// --- Jam Terbang ---
ok(
  'level: ambang 0, 60, 180, 360',
  P.levelOf(0) === 1 && P.levelOf(59) === 1 && P.levelOf(60) === 2 && P.levelOf(179) === 2 && P.levelOf(180) === 3 && P.levelOf(360) === 4
);
const li = P.levelInfo(250);
ok('level: info progres (Lv 3, 70/180)', li.L === 3 && li.cur === 70 && li.need === 180 && li.title === P.RANKS[2], JSON.stringify(li));
ok('level: gelar tertinggi dipakai di atas Lv 8', P.levelInfo(P.levelXp(12)).title === P.RANKS[P.RANKS.length - 1]);
ok('level: XP aneh (negatif / teks) = 0', P.levelInfo(-50).xp === 0 && P.levelInfo('abc').L === 1);
const g = P.gameXp({ won: true, challenges: 3, newStamps: 2 });
ok('XP game: 20 + menang 30 + 3 tantangan 15 + 2 cap 10 = 75', g.total === 75 && g.parts.length === 4, JSON.stringify(g));
ok('XP game: kalah tanpa apa-apa = 20', P.gameXp({}).total === 20);

// --- lencana ---
const cities = D.TILES.filter(t => t.type === 'city').length;
const stampB = P.BADGES.find(b => b.id === 'stamps');
ok('lencana: tingkat Emas Kolektor Cap = jumlah kota di papan', stampB.tiers[2] === cities, stampB.tiers[2] + ' vs ' + cities);
ok(
  'lencana: tiap lencana punya 3 tingkat naik',
  P.BADGES.every(b => b.tiers.length === 3 && b.tiers[0] < b.tiers[1] && b.tiers[1] < b.tiers[2])
);
const pp = {
  games: 5,
  wins: 2,
  stamps: [1, 2, 3, 4, 5],
  life: P.normLife({ ch: 10, lm: 15, lt: 0, sm: 1 }),
  wk: P.normWeek({ n: 4, best: 4 }),
};
const t1 = P.badgeTiers(pp);
ok(
  'lencana: tingkat dihitung dari data paspor',
  t1.games === 1 && t1.wins === 0 && t1.challenges === 1 && t1.stamps === 1 && t1.landmarks === 2 && t1.soulmate === 1 && t1.streak === 1,
  JSON.stringify(t1)
);
const up = P.tierUps(t1, Object.assign({}, t1, { wins: 1, landmarks: 2 }));
ok('lencana: hanya yang naik tingkat dilaporkan', up.length === 1 && up[0].id === 'wins' && up[0].tier === 1, JSON.stringify(up));

// --- hadiah kosmetik: tema papan & Edisi Emas ---
ok(
  'tema: Klasik selalu terbuka, Senja Bali di Lv 3',
  P.themeFor('klasik', 1) === 'klasik' && P.themeFor('bali', 2) === 'klasik' && P.themeFor('bali', 3) === 'bali'
);
ok(
  'tema: pilihan tak dikenal / level aneh → Klasik',
  P.themeFor('xx', 9) === 'klasik' && P.themeFor('paris', 'abc') === 'klasik' && P.themeFor('paris', 5) === 'paris'
);
ok(
  'tema: yang baru terbuka saat naik Lv 2 → 5 = Senja Bali & Paris Malam',
  P.themesUnlocked(2, 5)
    .map(t => t.id)
    .join(',') === 'bali,paris' && P.themesUnlocked(5, 5).length === 0
);
ok(
  'tema: level tiap tema naik berurutan',
  P.BOARD_THEMES.every((t, i) => !i || t.lv > P.BOARD_THEMES[i - 1].lv)
);
const base = { name: 'Arfi', games: 1, wins: 0, stamps: [], xp: 0, life: P.normLife({}), wk: P.normWeek({}) };
ok('Edisi Emas: pemula belum', P.goldEdition(base) === false && P.goldEdition(null) === false);
ok('Edisi Emas: Lv 5', P.goldEdition(Object.assign({}, base, { xp: P.levelXp(5) })) === true);
ok('Edisi Emas: rekor Api Cinta 4 minggu', P.goldEdition(Object.assign({}, base, { wk: P.normWeek({ n: 1, best: 4 }) })) === true);
ok('Edisi Emas: punya lencana Emas', P.goldEdition(Object.assign({}, base, { life: P.normLife({ lm: 50 }) })) === true);
ok('Edisi Emas: tanpa paspor (tanpa nama) tidak', P.goldEdition(Object.assign({}, base, { name: '', xp: 9999 })) === false);

// --- Pertanyaan Hari Ini ---
const today = Q.dayNo(at(2026, 11, 9));
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const NQ = D.DAILY_QS.length;
ok(
  'bank harian: 365 soal biasa + edisi khusus, soal tidak kembar',
  NQ === 365 && new Set(Q.DAILY_ALL.map(x => x.q)).size === Q.DAILY_ALL.length,
  NQ + ' + ' + D.DAILY_SPECIAL.length
);
ok(
  'bank harian: tiap soal 4 pilihan berbeda, maks 30 karakter; edisi khusus bertanggal & berlabel unik',
  Q.DAILY_ALL.every(x => x.o.length === 4 && new Set(x.o).size === 4 && x.o.every(o => o.length > 0 && o.length <= 30)) &&
    D.DAILY_SPECIAL.every(x => /^\d\d-\d\d$/.test(x.md) && x.tag) &&
    new Set(D.DAILY_SPECIAL.map(x => x.md)).size === D.DAILY_SPECIAL.length
);
ok(
  'urutan harian: pengali 37 saling prima dengan 60 & jumlah soal baru',
  gcd(37, Q.OLD_N) === 1 && gcd(37, NQ - Q.OLD_N) === 1,
  NQ - Q.OLD_N
);
// sebelum peralihan (11 Nov 2026): urutan lama persis seperti dulu → tautan & jawaban lama tetap menunjuk soal yang sama
let same = true;
for (let d = Q.SWITCH - 400; d < Q.SWITCH; d++) if (Q.dailyIndex(d) !== (((d * 37) % 60) + 60) % 60) same = false;
ok(
  'urutan harian: hari sebelum 11 Nov 2026 tidak berubah (soal #313 & #314 tetap)',
  same && Q.dailyQ(20766).q === 'Gaya liburan kita?' && Q.dailyQ(20767).q === 'Hal paling romantis menurutmu?'
);
ok('urutan harian: hari peralihan = 11 Nov 2026 WIB', Q.mdOf(Q.SWITCH) === '11-11' && Q.dailyNo(Q.SWITCH) === 315);
// mulai peralihan: satu siklus tanpa soal berulang; 305 soal baru keluar dulu; tanggal khusus = edisi khusus
const regSeen = new Set();
let repeat = false,
  specials = 0,
  oldEarly = false;
for (let i = 0; i < NQ; i++) {
  const qi = Q.dailyIndex(Q.SWITCH + i);
  if (qi >= NQ) {
    specials++;
    continue;
  }
  if (regSeen.has(qi)) repeat = true;
  regSeen.add(qi);
  if (i < NQ - Q.OLD_N && qi < Q.OLD_N) oldEarly = true;
}
ok(
  'urutan harian: satu siklus 365 hari tanpa soal berulang, soal baru dulu baru soal lama',
  !repeat && !oldEarly && regSeen.size + specials === NQ && specials === D.DAILY_SPECIAL.length,
  regSeen.size + ' biasa + ' + specials + ' khusus'
);
const val = Q.dayNo(Date.UTC(2027, 1, 13, 17, 0)); // 14 Feb 2027 00.00 WIB
ok(
  'edisi khusus: 14 Feb 2027 = Valentine; 14 Feb 2026 (sebelum peralihan) soal biasa',
  Q.dailyQ(val).tag === 'Edisi Valentine' && !Q.dailyQ(Q.dayNo(Date.UTC(2026, 1, 13, 17, 0))).tag,
  Q.dailyQ(val).q
);
ok(
  'harian: tiap soal punya 4 pilihan',
  D.DAILY_QS.every(x => x.q && x.o.length === 4)
);
ok(
  'harian: hari berganti tepat 00.00 WIB (17.00 UTC), di zona mana pun perangkatnya',
  Q.dayNo(Date.UTC(2026, 10, 8, 17, 0)) === Q.dayNo(Date.UTC(2026, 10, 8, 16, 59)) + 1 &&
    Q.dayNo(Date.UTC(2026, 10, 8, 16, 59)) === Q.dayNo(Date.UTC(2026, 10, 7, 17, 0))
);
ok(
  'harian: nomor urut 1 Jan 2026 00.00 WIB = #1',
  Q.dailyNo(Q.dayNo(Date.UTC(2025, 11, 31, 17, 0))) === 1 && Q.dailyNo(Q.dayNo(Date.UTC(2025, 11, 31, 16, 59))) === 0
);
const lk = Q.encodeLink({ d: today, n: 'Nadia 💕', a: 2, g: 1 });
const lkQ = Q.decodeLink(Q.encodeLink({ d: today, q: 300, n: 'A', a: 0, g: 1 }), today);
ok(
  'tautan: nomor soal ikut & dipakai (soal sama walau urutan hari berubah)',
  lkQ && lkQ.q === 300 && Q.dailyQ(today, lkQ.q) === Q.DAILY_ALL[300]
);
const bq = o => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
ok(
  'tautan: nomor soal tak sah ditolak; tautan lama tanpa nomor soal tetap diterima',
  Q.decodeLink(bq({ v: 1, d: today, q: 99999, n: 'A', a: 1, g: 0 }), today) === null &&
    Q.decodeLink(bq({ v: 1, d: today, q: -1, n: 'A', a: 1, g: 0 }), today) === null &&
    Q.decodeLink(bq({ v: 1, d: today, n: 'A', a: 1, g: 0 }), today).q === Q.dailyIndex(today)
);
const back = Q.decodeLink(lk, today);
ok(
  'tautan: bolak-balik utuh (termasuk emoji)',
  back && back.n === 'Nadia 💕' && back.a === 2 && back.g === 1 && back.d === today && back.m === undefined,
  JSON.stringify(back)
);
const full = Q.decodeLink(Q.encodeLink({ d: today, n: 'Arfi', a: 0, g: 3, m: 'Nadia', b: 3, h: 0 }), today);
ok('tautan hasil: memuat jawaban berdua', full && full.m === 'Nadia' && full.b === 3 && full.h === 0);
const s1 = Q.score(full);
ok('skor: tebakan berdua benar → 2/2, pilihan beda', s1.n === 2 && s1.g1 && s1.g2 && !s1.same, JSON.stringify(s1));
const bad = obj => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
ok(
  'tautan: isi rusak / di luar batas ditolak',
  Q.decodeLink('!!!', today) === null &&
    Q.decodeLink(bad({ v: 1, d: today, n: 'A', a: 5, g: 0 }), today) === null &&
    Q.decodeLink(bad({ v: 1, d: today - 61, n: 'A', a: 1, g: 0 }), today) === null &&
    Q.decodeLink(bad({ v: 1, d: today + 3, n: 'A', a: 1, g: 0 }), today) === null &&
    Q.decodeLink(bad({ v: 2, d: today, n: 'A', a: 1, g: 0 }), today) === null &&
    Q.decodeLink(bad({ v: 1, d: today, n: '', a: 1, g: 0 }), today) === null &&
    Q.decodeLink(bad({ v: 1, d: today, n: 'A', a: 1, g: 0, m: 'B', b: 9, h: 0 }), today) === null
);
const xss = Q.decodeLink(bad({ v: 1, d: today, n: '<img src=x onerror=alert(1)>', a: 1, g: 0 }), today);
ok('tautan: tanda < > dibuang dari nama (lapisan kedua selain esc saat tampil)', xss && !/[<>]/.test(xss.n), xss && xss.n);

// --- cadangan paspor ---
const prof = {
  name: 'Arfi',
  avatar: D.AVATARS[2],
  color: D.TOKEN_COLORS[1],
  since: 123,
  games: 9,
  wins: 4,
  stamps: [1, 2, 2, 999, 'x'],
  xp: 420,
  wk: { n: 3, last: 2966, best: 5, umb: 1 },
  life: { ch: 12 },
  msg: 'Sayang',
  seen: 5,
};
const code = B.makeBackup(
  {
    profile: prof,
    prefs: { theme: 'dark', board: 'paris', analytics: true, sound: false, power: 'save', evil: '<x>' },
    daily: { d: 20766, n: 'Arfi', a: 1, g: 2, p: null, xp: true },
  },
  1700000000000
);
const bk = B.parseBackup('https://loveopoly.web.app/#pulihkan=' + code);
ok(
  'cadangan: bolak-balik utuh dari tautan lengkap',
  bk && bk.p.name === 'Arfi' && bk.p.xp === 420 && bk.p.wk.best === 5 && bk.p.msg === 'Sayang' && bk.d.a === 1 && bk.t === 1700000000000,
  JSON.stringify(bk && bk.p).slice(0, 120)
);
ok(
  'cadangan: cap kota disaring (dobel / bukan kota dibuang)',
  bk && JSON.stringify(bk.p.stamps) === JSON.stringify(B.normProfile({ stamps: [1, 2, 2, 999, 'x'] }).stamps) && !bk.p.stamps.includes(999)
);
ok(
  'cadangan: pengaturan daftar putih (persetujuan statistik & kunci asing tidak ikut)',
  bk && bk.s.theme === 'dark' && bk.s.board === 'paris' && bk.s.power === 'save' && !('analytics' in bk.s) && !('evil' in bk.s),
  JSON.stringify(bk && bk.s)
);
ok('cadangan: kode mentah (tanpa alamat) juga diterima', !!B.parseBackup(code));
const enc = o => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
ok(
  'cadangan: rusak / tanpa nama paspor / versi lain ditolak',
  B.parseBackup('halo') === null &&
    B.parseBackup(enc({ v: 1, p: { name: '' } })) === null &&
    B.parseBackup(enc({ v: 2, p: { name: 'A' } })) === null &&
    B.parseBackup('') === null
);
const nasty = B.parseBackup(
  enc({ v: 1, p: { name: 'A\u0000B', xp: -9, games: 'banyak', avatar: '<script>', wk: { n: 99999999999, umb: 50 } } })
);
ok(
  'cadangan: nilai aneh dinormalkan (karakter kontrol, angka negatif, avatar asing)',
  nasty && nasty.p.name === 'AB' && nasty.p.xp === 0 && nasty.p.games === 0 && D.AVATARS.includes(nasty.p.avatar) && nasty.p.wk.umb === 2,
  JSON.stringify(nasty && nasty.p).slice(0, 140)
);

// --- rekap tahunan (bahan Kilas Balik Cinta) ---
const cityIds = D.TILES.filter(t => t.type === 'city').map(t => t.i);
const G = (o = {}) =>
  Object.assign(
    {
      won: false,
      reason: 'rounds',
      mode: 'local',
      rounds: 20,
      worth: 5000,
      love: 40,
      ch: 2,
      lt: 1,
      lm: 1,
      tk: 0,
      tv: 1,
      mt: 1,
      cities: [cityIds[0], cityIds[1]],
      vs: ['Nadia'],
    },
    o
  );
let yr = P.noteYear(null, G({ won: true, reason: 'triple', worth: 9000, rounds: 31 }), at(2026, 11, 10));
yr = P.noteYear(yr, G({ mode: 'online', cities: [cityIds[0]] }), at(2026, 11, 11));
yr = P.noteYear(yr, G({ mode: 'ai', vs: [] }), at(2026, 12, 21));
const y26 = yr['2026'];
ok(
  'tahunan: 3 game → jumlah, menang, per bulan, per mode',
  y26.g === 3 && y26.w === 1 && y26.mo[10] === 2 && y26.mo[11] === 1 && y26.md.local === 1 && y26.md.online === 1 && y26.md.ai === 1,
  JSON.stringify({ g: y26.g, w: y26.w, mo: y26.mo, md: y26.md })
);
ok(
  'tahunan: kota favorit, cara menang, lawan [main, menang], aset & game terpanjang',
  y26.city[cityIds[0]] === 3 &&
    y26.city[cityIds[1]] === 2 &&
    y26.how.triple === 1 &&
    !y26.how.rounds &&
    y26.vs.Nadia[0] === 2 &&
    y26.vs.Nadia[1] === 1 &&
    y26.best === 9000 &&
    y26.long === 31 &&
    y26.rd === 71,
  JSON.stringify({ city: y26.city, how: y26.how, vs: y26.vs })
);
ok('tahunan: minggu bermain dihitung sekali per minggu', y26.wk === 2, String(y26.wk));
const y27 = P.noteYear(yr, G(), at(2027, 1, 2));
ok('tahunan: pergantian tahun (lokal) membuat catatan baru', y27['2027'].g === 1 && y27['2026'].g === 3, Object.keys(y27).join(','));
let many = {};
for (let k = 0; k < 5; k++) many = P.noteYear(many, G(), at(2026 + k, 6, 1));
ok(
  'tahunan: hanya ' + P.YEARS_KEEP + ' tahun terbaru disimpan',
  Object.keys(many).join(',') === '2028,2029,2030',
  Object.keys(many).join(',')
);
let crowd = {};
for (let k = 0; k < 12; k++) crowd = P.noteYear(crowd, G({ vs: ['Teman ' + k] }), at(2026, 3, 1 + k));
for (let k = 0; k < 3; k++) crowd = P.noteYear(crowd, G({ vs: ['Teman 11'] }), at(2026, 4, 1 + k));
ok(
  'tahunan: daftar lawan dibatasi 8, lawan yang sering tetap tersimpan',
  Object.keys(crowd['2026'].vs).length === 8 && crowd['2026'].vs['Teman 11'][0] === 4,
  JSON.stringify(crowd['2026'].vs)
);
const dirty = B.normProfile({
  name: 'A',
  yr: {
    2026: {
      g: 2,
      w: 9,
      mo: [1, 'x'],
      md: { local: 2, hack: 5 },
      how: { triple: 1, evil: 3 },
      city: { 0: 4, [cityIds[2]]: 1 },
      vs: { '<b>N</b>': [2, 7], '': [1, 0] },
    },
    1999: { g: 1 },
    evil: { g: 1 },
  },
});
const dy = dirty.yr['2026'];
ok(
  'tahunan: data rusak dinormalkan (tahun asing, mode/cara asing, petak bukan kota, nama berbahaya, menang > main)',
  Object.keys(dirty.yr).join(',') === '2026' &&
    dy.w === 2 &&
    dy.mo[1] === 0 &&
    !dy.md.hack &&
    !dy.how.evil &&
    !dy.city[0] &&
    dy.city[cityIds[2]] === 1 &&
    dy.vs['bN/b'] &&
    dy.vs['bN/b'][1] === 2 &&
    !Object.keys(dy.vs).some(k => /[<>]/.test(k)) &&
    !('' in dy.vs),
  JSON.stringify(dy).slice(0, 220)
);
const bigP = B.normProfile({ name: 'Arfi', xp: 999, yr: crowd });
for (let k = 0; k < 2; k++) bigP.yr = P.noteYear(bigP.yr, G({ vs: ['Nadia Kusumawardani'] }), at(2027 + k, 2, 14));
const bigCode = B.makeBackup({ profile: bigP, prefs: {}, daily: null }, at(2028, 3, 1));
const bigBack = B.parseBackup('https://loveopoly.web.app/#pulihkan=' + bigCode);
ok(
  'tahunan: ikut Cadangan Paspor, 3 tahun penuh tetap muat di tautan',
  bigBack && bigBack.p.yr['2026'].g === 15 && bigBack.p.yr['2028'].g === 1 && bigCode.length < 6000,
  bigCode.length + ' karakter'
);

console.log(results.join('\n'));
const fails = results.filter(x => x.startsWith('FAIL')).length;
console.log('\n' + (results.length - fails) + '/' + results.length + ' lulus');
process.exit(fails ? 1 : 0);
