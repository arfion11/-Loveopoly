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
