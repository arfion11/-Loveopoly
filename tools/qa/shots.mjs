// Screenshot QA: skenario × 4 ukuran wajib (CLAUDE.md) × tema terang/gelap, plus error konsol. Butuh `npm run build`.
// Contoh: npm run shots -- --preset momen            (semua ukuran & tema)
//         npm run shots -- --preset home-lama --webkit   (+ WebKit/iPhone 390×844)
// Hasil: test/out/shots/<preset>-<tema>-<lebar>x<tinggi>.png. Keluar dengan kode 1 bila ada error konsol.
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serveDist } from '../../test/helpers/serve.js';
import { args } from '../balance/args.mjs';

const o = args({ preset: 'home', themes: 'light,dark', webkit: 'false', out: 'test/out/shots' });
const SIZES = [
  [1366, 768],
  [820, 1180],
  [390, 844],
  [844, 390],
];
const PASSPORT = {
  name: 'Arfi',
  avatar: '🐻',
  color: '#FF4F8B',
  since: 1,
  games: 12,
  wins: 7,
  stamps: [1, 2, 9],
  xp: 420,
  seen: Date.now(),
};
const HUMANS = [
  { name: 'Arfi', avatar: '🐻', color: '#FF4F8B' },
  { name: 'Nadia', avatar: '🐰', color: '#7B61FF' },
];
// tiap preset: profil paspor awal + langkah di halaman (berjalan di browser lewat page.evaluate)
const PRESETS = {
  home: { profile: { skipped: true } },
  'home-lama': {
    profile: PASSPORT,
    last: { players: HUMANS.map(p => Object.assign({ kind: 'human' }, p)), settings: { roundLimit: 25 } },
  },
  paspor: { profile: PASSPORT, run: async p => (await p.click('#hPass'), p.waitForTimeout(1500)) },
  game: { profile: { skipped: true }, game: 'S.round = 3;' },
  momen: {
    profile: { skipped: true },
    game: 'S.round = 6; S.moment = 6; S.queue.push({ type: "CHALLENGE", p: 0, ch: "dr1", cat: "duo", source: "moment", redraws: 0 }); E.migrate(S);',
  },
};
const pre = PRESETS[o.preset];
if (!pre) {
  console.error('Preset tidak dikenal: ' + o.preset + '. Pilihan: ' + Object.keys(PRESETS).join(', '));
  process.exit(1);
}
const OUT = path.resolve(o.out);
fs.mkdirSync(OUT, { recursive: true });
const URL = (await serveDist()).url + '/';
const runs = [];
for (const theme of o.themes.split(',')) for (const [w, h] of SIZES) runs.push([chromium, theme, w, h, '']);
if (o.webkit === 'true') runs.push([webkit, 'light', 390, 844, '-webkit']);
let bad = 0;
for (const [bt, theme, w, h, tag] of runs) {
  const b = await bt.launch();
  const mobile = w < 900;
  const page = await b.newPage({
    viewport: { width: w, height: h },
    colorScheme: theme,
    deviceScaleFactor: 1,
    isMobile: mobile && bt !== webkit,
    hasTouch: mobile,
  });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.addInitScript(
    ([prof, last]) => {
      localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false }));
      localStorage.setItem('loveopoly.v2.tour', '"done"');
      localStorage.setItem('loveopoly.v1.profile', JSON.stringify(prof));
      if (last) localStorage.setItem('loveopoly.v2.last', JSON.stringify(last));
    },
    [pre.profile, pre.last || null]
  );
  await page.goto(URL);
  await page.waitForSelector('#hLocal');
  if (pre.game) {
    await page.evaluate(
      ([mut, players]) => {
        const E = window.LoveEngine;
        const S = E.create({ players, settings: { roundLimit: 25 }, seed: 9 });
        new Function('S', 'E', mut)(S, E);
        window.LoveUI.enterGame('local', -1, S);
        window.LoveUI.syncModal(true);
      },
      [pre.game, HUMANS]
    );
    await page.waitForFunction(() => !window.LoveUI.App.animating && !window.LoveUI.App.pending.length, null, { timeout: 15000 });
  }
  if (pre.run) await pre.run(page);
  await page.waitForTimeout(1400);
  const file = path.join(OUT, `${o.preset}-${theme}-${w}x${h}${tag}.png`);
  await page.screenshot({ path: file });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(
    path.relative(process.cwd(), file) + (sw > 0 ? '  ⚠ melebar ' + sw + ' px' : '') + (errs.length ? '  ✗ ' + errs.join(' | ') : '')
  );
  if (errs.length || sw > 0) bad++;
  await b.close();
}
console.log(bad ? bad + ' tangkapan bermasalah' : 'Semua tangkapan bersih (tanpa error konsol, tanpa halaman melebar).');
process.exit(bad ? 1 : 0);
