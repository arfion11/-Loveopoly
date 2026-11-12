/* LOVEOPOLY — kamus English (dimuat terpisah lewat import() di ./i18n.js, hanya untuk pemain berbahasa Inggris).
   Kunci = teks Indonesia apa adanya. Bagian UI di ./en/*.js; urutan penggabungan: UI dulu, lalu konten data (pilihan
   soal harian menang bila teksnya kebetulan sama dengan label UI). Nama petak dari TILES[].en, kata Peragakan! dari
   CHARADES_EN (keduanya juga dipakai engine untuk menerima jawaban English). Kelengkapan dicek test/i18n.js. */
import { D } from '../engine/data.js';
import engine from './en/engine.js';
import core from './en/core.js';
import screens from './en/screens.js';
import passport from './en/passport.js';
import play from './en/play.js';
import challenge from './en/challenge.js';
import guide from './en/guide.js';
import content from './en/content.js';
import content2 from './en/content2.js';
import content3 from './en/content3.js';
import daily1 from './en/daily1.js';
import daily2 from './en/daily2.js';
import daily3 from './en/daily3.js';
import daily4 from './en/daily4.js';
import daily5 from './en/daily5.js';

const fromData = {};
D.TILES.forEach(t => {
  if (t.en) fromData[t.name] = t.en;
  if (t.en && t.short === t.name) fromData[t.short] = t.en;
});
D.CHARADES.forEach((w, i) => {
  if (D.CHARADES_EN[i]) fromData[w] = D.CHARADES_EN[i];
});

export const EN = Object.assign(
  {},
  engine,
  core,
  screens,
  passport,
  play,
  challenge,
  guide,
  content,
  content2,
  content3,
  daily1,
  daily2,
  daily3,
  daily4,
  daily5,
  fromData
);
