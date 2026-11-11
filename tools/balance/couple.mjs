// Model pasangan manusia: keputusan papan oleh AI (level normal), tantangan yang butuh manusia dimainkan dengan peluang
// berhasil --p (Tebak Isi Hati, Peragakan!, Aksi Berani, Foto Bukti; Dua Fakta = tebak acak; Surat = dilewati, batas
// bawah). Dipakai menyetel aturan yang menyentuh tantangan & Love (mis. Momen Berdua).
// Contoh: npm run balance:couple -- --games 500 --rounds 25 --p 0.7 --players 2 --moment on
import { D } from '../../src/engine/data.js';
import { E } from '../../src/engine/engine.js';
import { AI } from '../../src/engine/ai.js';
import { args, pct, quant, rng } from './args.mjs';

const o = args({ games: 500, rounds: 25, p: 0.7, players: 2, moment: 'on', seed: 31 });
const rnd = rng(12345);
const P = o.p;
function human(a, it) {
  const t = E.CH[it.ch].type;
  if (t === 'secret') {
    if (it.phase === 'intro') return { type: 'CH_ANSWER', p: a, answers: [] };
    if (it.phase === 'secret') return { type: 'CH_ANSWER', p: a, answers: it.pz.qs.map(q => Math.floor(rnd() * D.HEART_QS[q].o.length)) };
    const ok = rnd() < P;
    return {
      type: 'CH_ANSWER',
      p: a,
      answers: it.pz.secret.map((v, k) => (ok ? v : (v + 1) % D.HEART_QS[it.pz.qs[k]].o.length)),
    };
  }
  if (t === 'charades')
    return it.phase === 'act'
      ? { type: 'CH_ANSWER', p: a }
      : rnd() < P
        ? { type: 'CH_ANSWER', p: a, guess: it.pz.word }
        : { type: 'CH_ANSWER', p: a, giveUp: true };
  if (t === 'dare') return it.phase === 'do' ? { type: 'CH_ANSWER', p: a } : { type: 'CH_ANSWER', p: a, ok: rnd() < P };
  if (t === 'photo')
    return it.phase === 'do'
      ? { type: 'CH_ANSWER', p: a, photo: 'data:image/jpeg;base64,AAAA' }
      : { type: 'CH_ANSWER', p: a, ok: rnd() < P };
  if (t === 'bluff')
    return it.phase === 'write'
      ? { type: 'CH_ANSWER', p: a, lines: ['satu', 'dua', 'tiga'], lie: Math.floor(rnd() * 3) }
      : { type: 'CH_ANSWER', p: a, pick: Math.floor(rnd() * 3) };
  if (t === 'message') return { type: 'CH_RESOLVE', p: it.p, result: 'skip' };
  return null;
}
const A = { g: 0, ch: 0, ok: 0, love: [], soul: 0, bucin: 0, steps: [], first: 0, moments: 0 };
for (let g = 0; g < o.games; g++) {
  const players = Array.from({ length: o.players }, (_, i) => ({ name: 'P' + i, kind: 'human', ai: 'normal' }));
  let S = E.create({ players, settings: { roundLimit: o.rounds, moment: o.moment !== 'off' }, seed: o.seed + g * 7919, first: 'random' });
  let steps = 0;
  const seen = new Set();
  while (!S.over && steps < 60000) {
    const it = S.queue[0];
    const a = E.actor(S);
    let act = it && it.type === 'CHALLENGE' && it.phase ? human(a, it) : null;
    if (!act) act = AI.decide(S, a);
    const r = E.dispatch(S, act);
    if (!r.ok) throw new Error('aksi ditolak: ' + JSON.stringify(act).slice(0, 120) + ' — ' + r.error);
    S = r.state;
    if (S.moment && !seen.has(S.moment)) seen.add(S.moment);
    steps++;
  }
  if (!S.over) continue;
  A.g++;
  A.steps.push(steps);
  A.moments += seen.size;
  if (S.over.winner === S.start) A.first++;
  S.players.forEach(p => {
    A.ch += p.stats.challenges + p.stats.failed + p.stats.skipped;
    A.ok += p.stats.challenges;
    A.love.push(p.love);
    if (p.love >= 80) A.soul++;
    if (p.love >= 60) A.bucin++;
  });
}
const N = A.g * o.players;
console.log(
  `${o.players} pemain · ${o.rounds || 'bebas'} ronde · berhasil ${P} · Momen ${o.moment} · ${A.g} game\n` +
    `  tantangan/pemain ${(A.ch / N).toFixed(2)} (lulus ${(A.ok / N).toFixed(2)}) · Momen/game ${(A.moments / A.g).toFixed(1)}\n` +
    `  Love akhir p10/median/p90 ${quant(A.love, 0.1)}/${quant(A.love, 0.5)}/${quant(A.love, 0.9)} · Bucin+ ${pct(A.bucin, N)} · Soulmate ${pct(A.soul, N)}\n` +
    `  aksi/game median ${quant(A.steps, 0.5)} · pemain pertama menang ${pct(A.first, A.g)}`
);
