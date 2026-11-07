// Gambar pratinjau tautan (Open Graph, 1200×630) -> public/og-image.jpg
// Memakai seni & font asli game dari hasil build (jalankan npm run build dulu).
//   npm run og-image
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveDist } from '../test/helpers/serve.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const icon = readFileSync(join(root, 'public', 'icon.svg'), 'utf8');

const CSS = `
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
#og { position: relative; width: 1200px; height: 630px; display: grid; grid-template-columns: 640px 1fr; align-items: center; padding: 0 0 0 72px; box-sizing: border-box;
  background: radial-gradient(circle at 78% 46%, #FFE3EF 0 26%, transparent 27%), radial-gradient(circle at 12% 110%, #EBDDFF 0 30%, transparent 31%), linear-gradient(150deg, #FFF6FA, #FFE4EF 55%, #F1E6FF);
  color: #3A2148; font-family: Nunito, system-ui, sans-serif; }
.og-brand { display: flex; align-items: center; gap: 16px; font: 700 56px/1 Fredoka, sans-serif; color: #E0356F; letter-spacing: -.5px; }
.og-brand svg { width: 76px; height: 76px; }
h1 { margin: 26px 0 14px; font: 600 50px/1.08 Fredoka, sans-serif; color: #3A2148; letter-spacing: -.5px; }
p { margin: 0; font: 600 25px/1.4 Nunito, sans-serif; color: #6B4A78; }
.og-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.og-chips span { padding: 9px 18px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 2px #F6C9DA, 0 4px 0 #F6C9DA; font: 700 21px Nunito, sans-serif; color: #B4285A; }
.og-url { position: absolute; left: 72px; bottom: 34px; font: 700 22px Nunito, sans-serif; color: #8E5A86; letter-spacing: .3px; }
.og-r { position: relative; height: 630px; }
.og-merpi { position: absolute; left: 50%; top: 50%; width: 290px; height: 290px; translate: -50% -52%; filter: drop-shadow(0 18px 24px rgba(120, 40, 90, .22)); }
.og-merpi svg { width: 100%; height: 100%; }
.og-t { position: absolute; width: 108px; height: 108px; padding: 10px; box-sizing: border-box; border-radius: 26px; background: #fff; box-shadow: inset 0 0 0 3px var(--c), 0 7px 0 var(--c), 0 16px 26px rgba(80, 30, 70, .16); rotate: var(--r); }
.og-t svg { width: 100%; height: 100%; }
`;
const TILES = [
  ['paris', '#FF9EC4', 44, 64, '-8deg'],
  ['kyoto', '#FFB27A', 300, 44, '7deg'],
  ['santorini', '#8FC3FF', 352, 250, '-5deg'],
  ['bali', '#7FD9B8', 296, 448, '8deg'],
  ['swiss', '#B79CFF', 58, 456, '-7deg'],
  ['seoul', '#FFD36E', 0, 262, '6deg'],
];

const browser = await chromium.launch();
const page = await (
  await browser.newContext({ viewport: { width: 1200, height: 630 }, colorScheme: 'light', reducedMotion: 'reduce' })
).newPage();
await page.addInitScript(() => {
  localStorage.setItem('loveopoly.v1.profile', '{"skipped":true}');
  localStorage.setItem('loveopoly.v1.prefs', '{"sound":false}');
});
const srv = await serveDist();
await page.goto(srv.url + '/');
await page.waitForFunction(() => window.LoveArt && document.fonts.status === 'loaded');
await page.evaluate(
  ([css, icon, tiles]) => {
    const A = window.LoveArt;
    document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
    document.body.className = '';
    document.body.innerHTML =
      '<div id="og"><div class="og-l">' +
      '<div class="og-brand">' +
      icon +
      'Loveopoly</div>' +
      '<h1>Keliling dunia bareng pasangan &amp; teman</h1>' +
      '<p>Board game online gratis: beli kota romantis, jalani tantangan seru, dan menangkan hatinya.</p>' +
      '<div class="og-chips"><span>Gratis</span><span>Tanpa install</span><span>Online · Satu HP · Lawan AI</span></div></div>' +
      '<div class="og-r">' +
      tiles
        .map(
          ([a, c, x, y, r]) =>
            '<span class="og-t" style="--c:' + c + ';--r:' + r + ';left:' + x + 'px;top:' + y + 'px">' + A.art(a) + '</span>'
        )
        .join('') +
      '<span class="og-merpi">' +
      A.merpi('is-happy') +
      '</span></div>' +
      '<div class="og-url">loveopoly.web.app</div></div>';
  },
  [CSS, icon, TILES]
);
await page.evaluate(async () => {
  await Promise.all(['700 56px Fredoka', '600 50px Fredoka', '600 25px Nunito', '700 21px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
});
if (
  !(await page.evaluate(() =>
    ['Fredoka', 'Nunito'].every(n => [...document.fonts].some(f => f.family.replace(/["']/g, '') === n && f.status === 'loaded'))
  ))
)
  throw new Error('font game belum termuat');
await page.waitForTimeout(300);
await page.screenshot({ path: join(root, 'public', 'og-image.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
srv.close();
console.log('public/og-image.jpg (1200×630)');
