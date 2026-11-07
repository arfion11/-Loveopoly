// Simulasi massal AI vs AI + pemeriksaan invariant engine (Loveopoly 2.0).
// node test/sim.js [jumlahGame] [mode]   mode: mix | hvn | nvE | classic | nolimit
require('../src/data.js');
require('../src/engine.js');
require('../src/ai.js');
const D = globalThis.LOVE_DATA, E = globalThis.LoveEngine, AI = globalThis.LoveAI;

const NG = Number(process.argv[2] || 200);
const MODE = process.argv[3] || 'mix';
const LEVELS = ['easy', 'normal', 'hard'];

function invariants(S, ctx) {
  const errs = [];
  const n = S.players.length;
  S.players.forEach(p => {
    if (!Number.isInteger(p.cash) || p.cash < 0) errs.push(`cash invalid ${p.name}=${p.cash}`);
    if (!(p.love >= 0 && p.love <= 100)) errs.push(`love invalid ${p.love}`);
    if (p.pos < 0 || p.pos >= E.N) errs.push('pos invalid');
    if (p.island && p.pos !== E.ISLAND) errs.push('island but not on island tile');
    if (p.bankrupt && (p.cards.length || E.ownedBy(S, p.i).length)) errs.push('bankrupt holds assets');
    if (p.discount < 0 || p.discount >= 1) errs.push('discount range');
  });
  D.TILES.forEach(t => {
    const st = S.tiles[t.i];
    if (!t.price) { if (st.owner !== -1 || st.level) errs.push('special tile owned ' + t.name); return; }
    if (st.owner >= n || st.owner < -1) errs.push('owner idx');
    if (st.owner >= 0 && S.players[st.owner].bankrupt) errs.push(`tile ${t.name} owned by bankrupt`);
    if (st.level < 0 || st.level > 4) errs.push('level range');
    if (t.type === 'spot' && st.level) errs.push('spot with building');
    if (st.owner === -1 && st.level) errs.push('bank tile with building ' + t.name);
  });
  if (S.festival.tile >= 0) {
    const st = S.tiles[S.festival.tile];
    if (st.owner < 0) errs.push('festival on bank tile');
    if (S.festival.mult < 2 || S.festival.mult > D.RULES.festivalMax) errs.push('festival mult');
    if (D.TILES[S.festival.tile].type !== 'city') errs.push('festival not on city');
  }
  // konservasi kartu simpan
  const powerIds = D.CARDS.filter(c => c.power).map(c => c.id);
  const seen = [];
  S.decks.card.forEach(id => { if (powerIds.includes(id)) seen.push(id); });
  S.players.forEach(p => seen.push(...p.cards));
  S.queue.forEach(it => { if (it.type === 'CARD' && powerIds.includes(it.card)) seen.push(it.card); });
  if (seen.length !== powerIds.length || new Set(seen).size !== seen.length) errs.push(`power conservation ${seen.length} ${JSON.stringify(seen)}`);
  const nonPower = D.CARDS.filter(c => !c.power).length;
  if (S.decks.card.filter(id => !powerIds.includes(id)).length !== nonPower) errs.push('non-power card count');
  if (!S.over) {
    const a = E.actor(S);
    if (a < 0 || S.players[a].bankrupt) errs.push('actor invalid ' + a);
    if (S.players[S.turn.p].bankrupt) errs.push('turn player bankrupt');
  }
  if (errs.length) { const e = new Error('INVARIANT: ' + errs.join(' | ') + ' @' + ctx); e.state = S; throw e; }
}

function runGame(seed, opts) {
  const players = Array.from({ length: opts.n }, (_, i) => ({ name: 'P' + i, kind: 'ai', ai: opts.levels[i % opts.levels.length] }));
  let S = E.create({ players, settings: opts.settings, seed });
  let steps = 0;
  const types = {};
  while (!S.over && steps < 40000) {
    const a = E.actor(S);
    const act = AI.decide(S, a);
    const r = E.dispatch(S, act);
    if (!r.ok) return { error: r.error, act, item: S.queue[0], steps, seed, round: S.round, cash: S.players[a].cash };
    types[act.type] = (types[act.type] || 0) + 1;
    S = r.state;
    steps++;
    invariants(S, `seed ${seed} step ${steps} after ${act.type}`);
  }
  return { S, steps, types };
}

const stats = { games: 0, errors: 0, reasons: {}, rounds: [], steps: [], wins: { easy: 0, normal: 0, hard: 0 }, types: {}, per: {} };
const add = (k, v) => { stats.per[k] = (stats.per[k] || 0) + v; };
const t0 = Date.now();
for (let g = 0; g < NG; g++) {
  const seed = 1000 + g * 7919;
  const two = MODE === 'hvn' || MODE === 'nve' || MODE === 'hve' || MODE === 'classichvn';
  const n = two ? 2 : 2 + (g % 3);
  let settings = { roundLimit: 30 };
  if (MODE === 'classic' || MODE === 'classichvn') settings = { roundLimit: 30, takeover: false, instantWin: false, diceControl: false };
  if (MODE === 'nolimit') settings = { roundLimit: 0 };
  const pair = { hvn: ['hard', 'normal'], nve: ['normal', 'easy'], hve: ['hard', 'easy'], classichvn: ['hard', 'normal'] }[MODE];
  const levels = pair ? (g % 2 ? pair : pair.slice().reverse()) : Array.from({ length: n }, (_, i) => LEVELS[(g + i) % 3]);
  let res;
  try { res = runGame(seed, { n, levels, settings }); }
  catch (e) { console.log('CRASH/INVARIANT', e.message); if (e.state) console.log(JSON.stringify(e.state.queue), JSON.stringify(e.state.turn)); else console.log(e.stack); stats.errors++; if (stats.errors > 5) break; continue; }
  stats.games++;
  if (res.error) { stats.errors++; console.log('INVALID ACTION', JSON.stringify(res)); if (stats.errors > 5) break; continue; }
  const S = res.S;
  stats.reasons[S.over ? S.over.reason : 'unfinished'] = (stats.reasons[S.over ? S.over.reason : 'unfinished'] || 0) + 1;
  stats.rounds.push(S.round);
  stats.steps.push(res.steps);
  if (S.over) stats.wins[S.players[S.over.winner].ai]++;
  Object.entries(res.types).forEach(([k, v]) => { stats.types[k] = (stats.types[k] || 0) + v; });
  S.players.forEach(p => { ['takeovers', 'landmarks', 'festivals', 'travels', 'islands', 'challenges', 'aimHits', 'built', 'bought', 'sold', 'angels'].forEach(k => add(k, p.stats[k] || 0)); });
  add('bankrupts', S.players.filter(p => p.bankrupt).length);
  add('cashEnd', S.players.filter(p => !p.bankrupt).reduce((s, p) => s + p.cash, 0) / Math.max(1, S.players.filter(p => !p.bankrupt).length));
}
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) * q)]; };
const per = {};
Object.keys(stats.per).forEach(k => { per[k] = +(stats.per[k] / Math.max(1, stats.games)).toFixed(1); });
console.log(JSON.stringify({
  mode: MODE, games: stats.games, errors: stats.errors, ms: Date.now() - t0,
  reasons: stats.reasons,
  rounds: { p10: pct(stats.rounds, 0.1), median: pct(stats.rounds, 0.5), p90: pct(stats.rounds, 0.9), max: Math.max(...stats.rounds) },
  steps_median: pct(stats.steps, 0.5),
  wins: stats.wins, perGame: per, actionTypes: stats.types
}, null, 1));
// kode keluar untuk npm test / CI: gagal bila ada crash, invariant rusak, atau aksi tidak valid
if (stats.errors) process.exitCode = 1;

// ---------- uji aturan tantangan terbukti (deterministik) ----------
let chFails = 0;
(() => {
const ok = (n, c, d) => { if (!c) { chFails++; console.log('FAIL tantangan: ' + n + (d ? ' — ' + d : '')); } };
const mk = (type, src, players) => { const S = E.create({ players: players || [{ name: 'A' }, { name: 'B' }], seed: 11 }); const id = D.CHALLENGES.find(c => c.type === type).id; S.queue.push({ type: 'CHALLENGE', p: 0, ch: id, cat: type, source: src || 'card', redraws: 0 }); return E.migrate(S); };
const d = (S, a) => { const r = E.dispatch(S, a); if (!r.ok) return { err: r.error, S }; return { S: r.state }; };
// self-report ditolak
let S = mk('trivia'); ok('klik "complete" ditolak', !!d(S, { type: 'CH_RESOLVE', p: 0, result: 'complete' }).err);
for (const t of D.AUTO_TYPES) {
  S = mk(t); const it = S.queue[0], sol = E.chSolve(it);
  let r = d(S, { type: 'CH_ANSWER', p: 0, answers: sol, ms: 5000 });
  ok(t + ': jawaban benar lulus', r.S && r.S.players[0].cash > 2500 && !r.S.queue.length, r.err || r.S.log[r.S.log.length - 1].text);
  const wrong = sol.map(x => typeof x === 'number' ? x + 99999 : 'zzz');
  r = d(S, { type: 'CH_ANSWER', p: 0, answers: wrong, ms: 5000 }); ok(t + ': jawaban salah gagal', r.S && r.S.players[0].cash === 2500, r.err);
  r = d(S, { type: 'CH_ANSWER', p: 0, answers: sol, ms: 999999 }); ok(t + ': lewat waktu gagal', r.S && r.S.players[0].cash === 2500);
}
// pulau rindu: hanya keluar jika benar
S = E.create({ players: [{ name: 'A' }, { name: 'B', kind: 'ai' }], seed: 3 }); S.players[0].pos = 8; S.players[0].island = true;
let r = d(S, { type: 'ISLAND_CH', p: 0 }); const it = r.S.queue[0];
ok('rindu: lawan bot → hanya auto & syarat pulau lebih ringan', D.AUTO_TYPES.includes(E.CH[it.ch].type) && it.isle && (it.pz.qs || it.pz.items || it.pz.seq).length <= D.CH_TYPES[E.CH[it.ch].type].of, E.CH[it.ch].type);
let r2 = d(r.S, { type: 'CH_ANSWER', p: 0, answers: [], ms: 3000 }); ok('rindu: salah → tetap di pulau', r2.S.players[0].island);
r2 = d(r.S, { type: 'CH_ANSWER', p: 0, answers: E.chSolve(it), ms: 3000 }); ok('rindu: benar → keluar', r2.S && !r2.S.players[0].island, r2.err);
// secret
S = mk('secret'); r = d(S, { type: 'CH_ANSWER', p: 0 }); ok('secret: giliran penilai', E.actor(r.S) === 1);
ok('secret: pemilik tak bisa menjawab rahasia', !!d(r.S, { type: 'CH_ANSWER', p: 0, answers: [0, 0, 0] }).err);
r = d(r.S, { type: 'CH_ANSWER', p: 1, answers: [1, 2, 3] }); ok('secret: kembali ke pemilik', E.actor(r.S) === 0);
r2 = d(r.S, { type: 'CH_ANSWER', p: 0, answers: [1, 2, 0] }); ok('secret: 2/3 cocok lulus + penilai dapat Love', r2.S.players[0].cash > 2500 && r2.S.players[1].love > S.players[1].love);
r2 = d(r.S, { type: 'CH_ANSWER', p: 0, answers: [0, 0, 0] }); ok('secret: 0/3 gagal', r2.S.players[0].cash === 2500);
// bluff
ok('bluff: pernyataan pendek (3 huruf) diterima, 2 huruf ditolak', !d(mk('bluff'), { type: 'CH_ANSWER', p: 0, lines: ['Anak 1', 'Jomblo', 'Gay'], lie: 0 }).err && !!d(mk('bluff'), { type: 'CH_ANSWER', p: 0, lines: ['Ok', 'Jomblo', 'Anak 1'], lie: 0 }).err);
S = mk('bluff'); r = d(S, { type: 'CH_ANSWER', p: 0, lines: ['Aku pernah ke Bali', 'Aku takut kucing', 'Aku bisa main gitar'], lie: 1 });
r2 = d(r.S, { type: 'CH_ANSWER', p: 1, pick: 1 }); ok('bluff: ketahuan → penilai dapat hadiah', r2.S.players[1].cash > 2500 && r2.S.players[0].cash === 2500);
r2 = d(r.S, { type: 'CH_ANSWER', p: 1, pick: 0 }); ok('bluff: berhasil mengecoh → pemilik dapat hadiah', r2.S.players[0].cash > 2500);
// charades
S = mk('charades'); const word = S.queue[0].pz.word; r = d(S, { type: 'CH_ANSWER', p: 0 });
r2 = d(r.S, { type: 'CH_ANSWER', p: 1, guess: 'salah' }); r2 = d(r2.S, { type: 'CH_ANSWER', p: 1, guess: word.toUpperCase() });
ok('charades: tebakan benar ke-2 lulus', r2.S.players[0].cash > 2500 && /ke-2/.test(r2.S.log[r2.S.log.length - 2].text), r2.S.log.slice(-2).map(x => x.text).join(' | '));
// message
S = mk('message'); const rule = E.CH[S.queue[0].ch];
ok('message: teks asal ditolak', !!d(S, { type: 'CH_ANSWER', p: 0, text: 'halo kamu' }).err, rule.text);
// photo
S = mk('photo'); ok('photo: tanpa foto ditolak', !!d(S, { type: 'CH_ANSWER', p: 0 }).err);
r = d(S, { type: 'CH_ANSWER', p: 0, photo: 'data:image/jpeg;base64,AAAA' }); r2 = d(r.S, { type: 'CH_ANSWER', p: 1, ok: true });
ok('photo: disahkan & tersimpan', r2.S.photos.length === 1 && r2.S.players[0].cash > 2500);
// batal saat menunggu penilai
r2 = d(r.S, { type: 'CH_RESOLVE', p: 0, result: 'skip' }); ok('pemilik bisa batal saat menunggu penilai', !!r2.S && !r2.S.queue.length, r2.err);
// lawan bot: kartu secret → auto
S = mk('secret', 'card', [{ name: 'A' }, { name: 'B', kind: 'ai' }]); ok('vs bot: secret diganti auto', D.AUTO_TYPES.includes(E.CH[S.queue[0].ch].type), E.CH[S.queue[0].ch].type);

})();
console.log('tantangan: ' + (chFails ? chFails + ' gagal' : 'semua aturan lulus'));
if (chFails) process.exitCode = 1;

// ---------- uji aturan peluncuran: keadilan kursi, Trio Warna, Ketemuan, Kabar Merpi, Musim Puncak ----------
(() => {
  let fails = 0;
  const ok = (n, c, d) => { if (!c) { fails++; console.log('FAIL aturan: ' + n + (d ? ' — ' + d : '')); } };
  const R = D.RULES;
  const mk = (n, st) => E.create({ players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i })), settings: Object.assign({ debug: true }, st || {}), seed: 9 });
  let S = mk(4);
  ok('semua pemain sama: START, modal sama, tanpa diskon', S.players.every(p => p.pos === 0 && p.cash === S.settings.startCash && !p.discount));
  // undian giliran pertama: setiap kursi bisa dapat giliran pertama; ronde dihitung dari pemain pertama
  const firsts = new Set();
  for (let sd = 1; sd <= 40; sd++) firsts.add(E.create({ players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], seed: sd, first: 'random' }).turn.p);
  ok('undian: semua kursi bisa jalan duluan', firsts.size === 3, [...firsts].join());
  let F = E.create({ players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], seed: 5, first: 2, settings: { debug: true } });
  const turns = [];
  for (let k = 0; k < 6; k++) { turns.push(F.round + ':' + F.turn.p); let q = E.dispatch(F, { type: 'ROLL', p: F.turn.p, dice: [1, 2] }); while (q.ok && q.state.queue.length) { const it = q.state.queue[0]; const a = globalThis.LoveAI.decide(q.state, E.actor(q.state)); q = E.dispatch(q.state, a); } F = E.dispatch(q.state, { type: 'END_TURN', p: q.state.turn.p }).state; }
  ok('ronde berganti setelah semua dapat giliran (mulai kursi 3)', turns.join(' ') === '1:2 1:0 1:1 2:2 2:0 2:1', turns.join(' '));
  // Trio Warna wajib berisi grup 3 kota
  S = mk(2); S.players[0].laps = 1;
  [1, 2, 9, 10, 17].forEach(t => { S.tiles[t].owner = 0; });   // kota(2) tropis(2) + Roma; Praha (19) melengkapi klasik(2) → 3 grup kecil
  S.players[0].pos = 17;
  let r = E.dispatch(S, { type: 'ROLL', p: 0, dice: [1, 1] });
  if (r.ok && r.state.queue[0] && r.state.queue[0].type === 'BUY') r = E.dispatch(r.state, { type: 'BUY', p: 0, level: 0 });
  ok('3 grup kecil (2 kota) belum Trio Warna', r.ok && !r.state.over, r.error || (r.state.over && r.state.over.reason));
  ok('tripleOk butuh grup 3 kota', !E.tripleOk(['kota', 'tropis', 'klasik']) && E.tripleOk(['kota', 'tropis', 'asia']));
  // Ketemuan
  S = mk(2); S.players[0].pos = 0; S.players[1].pos = 4;
  r = E.dispatch(S, { type: 'ROLL', p: 0, dice: [1, 3] });
  ok('Ketemuan: keduanya dapat uang & Love', r.ok && r.state.players[1].cash === S.players[1].cash + R.meetCash && r.state.players[0].love >= R.loveStart + R.meetLove && r.state.lastEvents.some(e => e.t === 'meet'), r.error);
  // Kabar Merpi & Musim Puncak
  S = mk(2, { roundLimit: 10 });
  let k = 0;
  while (!S.over && S.round < 9 && k++ < 3000) { const a = E.actor(S); const x = globalThis.LoveAI.decide(S, a); const q = E.dispatch(S, x); if (!q.ok) break; S = q.state; }
  ok('Kabar Merpi tercatat', S.log.some(l => /Kabar Merpi:/.test(l.text)), 'round=' + S.round);
  ok('Musim Puncak aktif di 3 ronde terakhir', S.round >= 8 ? E.peakOn(S) : true, 'round=' + S.round);
  S = mk(2, { news: false, roundLimit: 10 }); S.round = 3;
  ok('Kabar Merpi bisa dimatikan', S.settings.news === false);
  // jeda Kabar Merpi mengikuti durasi; tidak ada kabar baru saat Musim Puncak
  const gapOf = L => E.newsGap(mk(2, { roundLimit: L }));
  ok('jeda kabar per durasi: 15→4, 25→5, 35→6, bebas→5', gapOf(15) === 4 && gapOf(25) === 5 && gapOf(35) === 6 && gapOf(0) === 5, [15, 25, 35, 0].map(gapOf).join());
  const newsRounds = L => { let T = mk(2, { roundLimit: L, instantWin: false, startCash: 6000 }); const out = []; let k = 0;
    while (!T.over && k++ < 8000) { const a = E.actor(T); const q = E.dispatch(T, globalThis.LoveAI.decide(T, a)); if (!q.ok) break; if (q.state.lastEvents.some(e => e.t === 'news')) out.push(q.state.round); T = q.state; }
    return { out, over: !!T.over }; };
  const n25 = newsRounds(25);
  ok('Normal 25: kabar tepat di ronde 5,10,15,20, tidak ada saat Musim Puncak', n25.out.join() === '5,10,15,20', n25.out.join() + ' over=' + n25.over);
  const n15 = newsRounds(15);
  ok('Singkat 15: kabar tepat di ronde 4,8,12', n15.out.join() === '4,8,12', n15.out.join());
  S = mk(2); S.news = { id: 'promo', side: null, from: 1, to: 2 };
  ok('Promo Maskapai: tiket gratis', E.travelFee(S) === 0);
  S.news = { id: 'rain', side: 'bottom', from: 1, to: 2 }; S.tiles[1].owner = 1;
  const rain = E.rentInfo(S, 1).amount; S.news = null; const dry = E.rentInfo(S, 1).amount;
  ok('Musim Hujan: tol jalur ×0,5', rain < dry, rain + ' vs ' + dry);
  console.log('aturan peluncuran: ' + (fails ? fails + ' gagal' : 'semua lulus'));
  if (fails) process.exitCode = 1;
})();

// ---------- tantangan 3–4 pemain: semua lawan ikut, penilai bergiliran, hadiah hanya untuk yang ikut/benar ----------
(() => {
  let fails = 0;
  const ok = (n, c, d) => { if (!c) { fails++; console.log('FAIL multi: ' + n + (d ? ' — ' + d : '')); } };
  const P4 = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
  const mk = (type, players, extra) => { const S = E.create({ players: players || P4, seed: 21 }); const id = D.CHALLENGES.find(c => c.type === type).id; S.queue.push(Object.assign({ type: 'CHALLENGE', p: 0, ch: id, cat: type, source: 'card', redraws: 0 }, extra || {})); return E.migrate(S); };
  const d = (S, a) => { const r = E.dispatch(S, a); if (!r.ok) throw new Error(a.type + ' p' + a.p + ': ' + r.error); return r.state; };
  const cash = S => S.players.map(p => p.cash), love = S => S.players.map(p => p.love);
  // penilai utama bergiliran per pemilik (lewat kartu tantangan sungguhan)
  let S = E.create({ players: P4, seed: 3 });
  const firsts = [];
  for (let k = 0; k < 3; k++) {
    S.queue = [{ type: 'CARD', p: 0, card: 'K37' }];
    S = d(S, { type: 'CARD_OK', p: 0 });
    const it = S.queue.find(x => x.type === 'CHALLENGE');
    firsts.push(it ? it.judge : 'x');
  }
  ok('penilai utama bergiliran: B, C, D', firsts.join() === '1,2,3', firsts.join());
  ok('judgesFor: semua lawan manusia, mulai dari giliran', E.judgesFor(S, 0, 0).join() === '1,2,3' && E.judgesFor(S, 0, 1).join() === '2,3,1');
  // voting Aksi Berani: 2 setuju, 1 tolak → sah; semua penilai dapat Love
  S = mk('dare'); const base = love(S); const c0 = cash(S);
  S = d(S, { type: 'CH_ANSWER', p: 0 });
  ok('dare: penilai pertama giliran', E.actor(S) === S.queue[0].judges[0], E.actor(S));
  const J = S.queue[0].judges;
  S = d(S, { type: 'CH_ANSWER', p: J[0], ok: true });
  ok('dare: penilai kedua menyusul', E.actor(S) === J[1]);
  S = d(S, { type: 'CH_ANSWER', p: J[1], ok: false });
  S = d(S, { type: 'CH_ANSWER', p: J[2], ok: true });
  ok('dare: 2 dari 3 setuju → sah, pemilik dapat hadiah', !S.queue.length && S.players[0].cash > c0[0], S.proofs.slice(-1)[0].proof);
  ok('dare: ketiga penilai dapat Love', J.every(j => S.players[j].love === base[j] + D.CH_TYPES.dare.judgeReward.love), love(S).join());
  // seri (4 pemain: 3 penilai tidak bisa seri; pakai 3 pemain → 2 penilai)
  S = mk('dare', P4.slice(0, 3)); S = d(S, { type: 'CH_ANSWER', p: 0 });
  const J3 = S.queue[0].judges; const c3 = S.players[0].cash;
  S = d(S, { type: 'CH_ANSWER', p: J3[0], ok: true }); S = d(S, { type: 'CH_ANSWER', p: J3[1], ok: false });
  ok('dare 3 pemain: seri 1-1 → sah', S.players[0].cash > c3, S.proofs.slice(-1)[0].proof);
  // mayoritas tolak → gagal
  S = mk('dare'); S = d(S, { type: 'CH_ANSWER', p: 0 }); const Jx = S.queue[0].judges, cx = S.players[0].cash;
  S = d(S, { type: 'CH_ANSWER', p: Jx[0], ok: false }); S = d(S, { type: 'CH_ANSWER', p: Jx[1], ok: false }); S = d(S, { type: 'CH_ANSWER', p: Jx[2], ok: true });
  ok('dare: mayoritas tolak → tidak sah', S.players[0].cash === cx && !S.proofs.slice(-1)[0].ok);
  // penilai tidak bisa menilai di luar gilirannya
  S = mk('dare'); S = d(S, { type: 'CH_ANSWER', p: 0 }); const Jy = S.queue[0].judges;
  ok('dare: penilai ketiga tidak bisa menyalip', !E.dispatch(S, { type: 'CH_ANSWER', p: Jy[2], ok: true }).ok);
  // Dua Fakta Satu Bohong: semua menebak; yang benar dapat hadiah, pemilik menang bila mayoritas tertipu
  S = mk('bluff'); S = d(S, { type: 'CH_ANSWER', p: 0, lines: ['Aku ke Bali', 'Takut kucing', 'Bisa gitar'], lie: 2 });
  const Jb = S.queue[0].judges, cb = cash(S);
  S = d(S, { type: 'CH_ANSWER', p: Jb[0], pick: 2 }); S = d(S, { type: 'CH_ANSWER', p: Jb[1], pick: 0 }); S = d(S, { type: 'CH_ANSWER', p: Jb[2], pick: 1 });
  ok('bluff: 2 tertipu dari 3 → pemilik menang', S.players[0].cash > cb[0], S.proofs.slice(-1)[0].proof);
  ok('bluff: hanya penebak benar dapat hadiah', S.players[Jb[0]].cash > cb[Jb[0]] && S.players[Jb[1]].cash === cb[Jb[1]] && S.players[Jb[2]].cash === cb[Jb[2]]);
  // Peragakan!: semua bisa menebak serentak; yang duluan benar dapat hadiah
  S = mk('charades'); const word = S.queue[0].pz.word; S = d(S, { type: 'CH_ANSWER', p: 0 });
  const Jc = S.queue[0].judges, lc = love(S);
  ok('charades: semua penebak boleh beraksi', E.chActors(S).join() === Jc.join(), E.chActors(S).join());
  S = d(S, { type: 'CH_ANSWER', p: Jc[2], guess: 'salah' });
  S = d(S, { type: 'CH_ANSWER', p: Jc[1], guess: word });
  ok('charades: penebak benar (bukan giliran utama) menang, pemilik & dia dapat hadiah', !S.queue.length && S.players[Jc[1]].love > lc[Jc[1]] && S.players[Jc[0]].love === lc[Jc[0]] && S.players[0].love > lc[0], S.proofs.slice(-1)[0].proof);
  // Peragakan!: kesempatan per penebak, habis semua → gagal
  S = mk('charades'); S = d(S, { type: 'CH_ANSWER', p: 0 }); const Jd = S.queue[0].judges;
  for (const j of Jd) for (let t = 0; t < 3; t++) S = d(S, { type: 'CH_ANSWER', p: j, guess: 'zzz' + t });
  ok('charades: semua kehabisan kesempatan → gagal', !S.queue.length && !S.proofs.slice(-1)[0].ok);
  S = mk('charades'); S = d(S, { type: 'CH_ANSWER', p: 0 }); const Je = S.queue[0].judges;
  S = d(S, { type: 'CH_ANSWER', p: Je[0], giveUp: true });
  ok('charades: satu menyerah, yang lain masih bisa menebak', S.queue.length && !E.chActors(S).includes(Je[0]) && E.chActors(S).length === 2);
  S = d(S, { type: 'CH_ANSWER', p: Je[1], timeout: true });
  ok('charades: waktu habis mengakhiri untuk semua', !S.queue.length);
  // 2 pemain: tetap satu penilai (aturan lama)
  S = mk('dare', P4.slice(0, 2)); ok('2 pemain: satu penilai', S.queue[0].judges.length === 1 && S.queue[0].judge === 1);
  // bot tidak pernah menilai
  S = mk('dare', [{ name: 'A' }, { name: 'B', kind: 'ai' }, { name: 'C' }, { name: 'D', kind: 'ai' }]);
  ok('bot tidak masuk daftar penilai', S.queue[0].judges.join() === '2');
  console.log('tantangan 3–4 pemain: ' + (fails ? fails + ' gagal' : 'semua lulus'));
  if (fails) process.exitCode = 1;
})();
