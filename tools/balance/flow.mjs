// Alur permainan AI vs AI: cara selesai, pemimpin awal yang akhirnya menang (efek bola salju), comeback, keputusan per
// giliran, tantangan, Love, kepadatan papan. Contoh: npm run balance:flow -- --games 600 --levels normal,normal --rounds 25
import { D } from '../../src/engine/data.js';
import { E } from '../../src/engine/engine.js';
import { AI } from '../../src/engine/ai.js';
import { args, pct, quant } from './args.mjs';

const o = args({ games: 600, levels: 'normal,normal', rounds: 25, players: 2, seed: 777 });
const LV = o.levels.split(',');
const DECIDE = new Set([
  'BUY',
  'BUY_SKIP',
  'UPGRADE',
  'UPGRADE_SKIP',
  'TAKEOVER_BUY',
  'TAKEOVER_SKIP',
  'TARGET_PICK',
  'TARGET_SKIP',
  'TOUR_GO',
  'TOUR_SKIP',
  'USE_DISCOUNT',
  'USE_ANGEL',
  'SELL',
  'ISLAND_PAY',
  'ISLAND_CARD',
  'ISLAND_CH',
]);
const cities = D.TILES.filter(t => t.type === 'city').map(t => t.i);
const A = { g: 0, first: 0, reasons: {}, endR: [], instR: [], lead: {}, comeback: [0, 0], turns: 0, empty: 0, dec: 0, ch: 0 };
Object.assign(A, { love: [], soul: 0, sat: [], poor: 0, ptur: 0, rent: 0, meet: 0, tk: 0, lm: 0, margin: [], steps: [] });
[5, 10, 15, 20].forEach(r => (A.lead[r] = [0, 0]));
for (let g = 0; g < o.games; g++) {
  const players = Array.from({ length: o.players }, (_, i) => ({ name: 'P' + i, kind: 'ai', ai: LV[(i + g) % LV.length] }));
  let S = E.create({ players, settings: { roundLimit: o.rounds }, seed: o.seed + g * 7919, first: 'random' });
  const first = S.start;
  let steps = 0,
    cur = null,
    tDec = 0,
    tCh = false,
    satR = 0,
    lastRound = S.round,
    gap15 = null;
  const leadAt = {};
  const close = () => {
    if (!cur) return;
    A.turns++;
    if (!tDec && !tCh) A.empty++;
    A.dec += tDec;
  };
  while (!S.over && steps < 50000) {
    const key = S.round + ':' + S.turn.p;
    if (key !== cur) {
      close();
      cur = key;
      tDec = 0;
      tCh = false;
      A.ptur++;
      if (S.players[S.turn.p].cash < 300) A.poor++;
    }
    if (S.round !== lastRound) {
      lastRound = S.round;
      const r = S.round - 1;
      if (A.lead[r]) {
        const w = S.players.map(p => (p.bankrupt ? -1 : E.netWorth(S, p.i)));
        leadAt[r] = w.indexOf(Math.max(...w));
        if (r === 15 && o.players === 2) gap15 = Math.abs(w[0] - w[1]) / Math.max(1, w[0], w[1]);
      }
      if (!satR && cities.filter(i => S.tiles[i].owner >= 0).length >= cities.length * 0.9) satR = S.round;
    }
    const act = AI.decide(S, E.actor(S));
    if (DECIDE.has(act.type)) tDec++;
    if (act.type.startsWith('CH_')) tCh = true;
    if (act.type === 'PAY_RENT') A.rent++;
    const r = E.dispatch(S, act);
    if (!r.ok) throw new Error('aksi ditolak: ' + act.type + ' — ' + r.error);
    S = r.state;
    steps++;
  }
  close();
  if (!S.over) continue;
  A.g++;
  A.steps.push(steps);
  const ov = S.over;
  A.reasons[ov.reason] = (A.reasons[ov.reason] || 0) + 1;
  A.endR.push(ov.round);
  if (['triple', 'line', 'spots'].includes(ov.reason)) A.instR.push(ov.round);
  if (ov.winner === first) A.first++;
  Object.keys(leadAt).forEach(r => {
    A.lead[r][1]++;
    if (leadAt[r] === ov.winner) A.lead[r][0]++;
  });
  if (gap15 != null && gap15 > 0.3) {
    A.comeback[1]++;
    if (leadAt[15] !== ov.winner) A.comeback[0]++;
  }
  S.players.forEach(p => {
    A.ch += p.stats.challenges + p.stats.failed + p.stats.skipped;
    A.love.push(p.love);
    if (p.love >= 80) A.soul++;
    A.meet += p.stats.meets || 0;
    A.tk += p.stats.takeovers;
    A.lm += p.stats.landmarks;
  });
  if (satR) A.sat.push(satR);
  if (o.players === 2) A.margin.push(Math.abs(ov.worth[0] - ov.worth[1]) / Math.max(1, ov.worth[0], ov.worth[1]));
}
const N = A.g * o.players;
console.log(
  JSON.stringify(
    {
      setup: `${o.players} pemain ${LV.join('/')} · batas ${o.rounds || 'bebas'} ronde`,
      games: A.g,
      menang_pemain_pertama: pct(A.first, A.g) + ' (adil ' + Math.round(100 / o.players) + '%)',
      cara_selesai: Object.fromEntries(Object.entries(A.reasons).map(([k, v]) => [k, pct(v, A.g)])),
      ronde_selesai: { p10: quant(A.endR, 0.1), median: quant(A.endR, 0.5), p90: quant(A.endR, 0.9) },
      ronde_menang_instan_median: quant(A.instR, 0.5),
      pemimpin_aset_akhirnya_menang: Object.fromEntries(Object.entries(A.lead).map(([r, [a, b]]) => ['ronde ' + r, pct(a, b)])),
      comeback_tertinggal_30pct_di_ronde15: A.comeback[1] ? pct(A.comeback[0], A.comeback[1]) + ' dari ' + A.comeback[1] : '-',
      selisih_aset_akhir_median: o.players === 2 ? pct(quant(A.margin, 0.5) * 100, 100) : '-',
      giliran_per_pemain: +(A.turns / N).toFixed(1),
      giliran_tanpa_keputusan: pct(A.empty, A.turns),
      keputusan_per_giliran: +(A.dec / A.turns).toFixed(2),
      tantangan_per_pemain: +(A.ch / N).toFixed(2),
      bayar_tol_per_pemain: +(A.rent / N).toFixed(1),
      ketemuan_per_pemain: +(A.meet / N).toFixed(2),
      ambil_alih_per_game: +(A.tk / A.g).toFixed(2),
      landmark_per_game: +(A.lm / A.g).toFixed(2),
      love_akhir: { p10: quant(A.love, 0.1), median: quant(A.love, 0.5), p90: quant(A.love, 0.9) },
      sampai_soulmate: pct(A.soul, N),
      kota_90pct_terjual: pct(A.sat.length, A.g),
      giliran_kas_di_bawah_300: pct(A.poor, A.ptur),
      aksi_per_game_median: quant(A.steps, 0.5),
    },
    null,
    1
  )
);
