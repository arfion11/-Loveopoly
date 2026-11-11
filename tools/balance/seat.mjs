// Keuntungan urutan duduk: seberapa sering pemain yang jalan duluan menang, per cara selesai, dan efek kompensasi uang
// awal untuk urutan berikutnya (--comp 0,100,150 = pemain ke-k setelah yang pertama dapat k·X). Hanya alat ukur:
// aturan "keadilan kursi" di CLAUDE.md melarang bonus kursi tanpa keputusan pemilik produk.
// Contoh: npm run balance:seat -- --games 2000 --players 2 --comp 0,150
import { E } from '../../src/engine/engine.js';
import { AI } from '../../src/engine/ai.js';
import { args, pct } from './args.mjs';

const o = args({ games: 2000, players: 2, rounds: 25, comp: '0', seed: 5 });
for (const X of o.comp.split(',').map(Number)) {
  const by = {};
  let n = 0,
    fw = 0;
  for (let g = 0; g < o.games; g++) {
    const players = Array.from({ length: o.players }, (_, i) => ({ name: 'P' + i, kind: 'ai', ai: 'normal' }));
    let S = E.create({ players, settings: { roundLimit: o.rounds }, seed: o.seed + g * 7919, first: 'random' });
    for (let k = 1; k < o.players; k++) S.players[(S.start + k) % o.players].cash += k * X;
    const first = S.start;
    let steps = 0;
    while (!S.over && steps < 50000) {
      const r = E.dispatch(S, AI.decide(S, E.actor(S)));
      if (!r.ok) throw new Error(r.error);
      S = r.state;
      steps++;
    }
    if (!S.over) continue;
    n++;
    const w = S.over.winner === first;
    if (w) fw++;
    by[S.over.reason] = by[S.over.reason] || [0, 0];
    by[S.over.reason][1]++;
    if (w) by[S.over.reason][0]++;
  }
  console.log(
    `${o.players} pemain · kompensasi ${X}/urutan · pemain pertama menang ${pct(fw, n)} (adil ${Math.round(100 / o.players)}%) · n=${n}\n  ` +
      Object.entries(by)
        .map(([k, [a, b]]) => `${k} ${pct(a, b)} dari ${b}`)
        .join(' · ')
  );
}
