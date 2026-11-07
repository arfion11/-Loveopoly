// Buat ikon PNG dari public/icon.svg (sumber satu-satunya). Jalankan setelah mengubah SVG: npm run icons
//   icon-32.png            tab browser (sudut membulat, latar transparan)
//   apple-touch-icon.png   180 px, penuh tanpa sudut membulat (iOS memotong sendiri)
//   icon-192.png, icon-512.png       PWA "any", penuh tanpa sudut membulat
//   icon-maskable-512.png  PWA "maskable": latar penuh, isi diperkecil ke zona aman (lingkaran 80%)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const pub = join(import.meta.dirname, '..', 'public');
const svg = readFileSync(join(pub, 'icon.svg'), 'utf8');
const square = svg.replace(/<rect width="64" height="64" rx="15"/, '<rect width="64" height="64" rx="0"');
if (square === svg) throw new Error('latar ikon (rect rx="15") tidak ditemukan di icon.svg');
// maskable: latar tetap penuh, isi lain diperkecil 78% di tengah
const maskable = square.replace(
  /(<rect width="64" height="64" rx="0"[^>]*\/>)([\s\S]*)(<\/svg>)/,
  '$1<g transform="translate(7.04 7.04) scale(.78)">$2</g>$3'
);
if (maskable === square) throw new Error('gagal menyusun ikon maskable');

const OUT = [
  ['icon-32.png', svg, 32],
  ['apple-touch-icon.png', square, 180],
  ['icon-192.png', square, 192],
  ['icon-512.png', square, 512],
  ['icon-maskable-512.png', maskable, 512],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, src, size] of OUT) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    '<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:' +
      size +
      'px;height:' +
      size +
      'px}</style>' +
      src
  );
  await page.screenshot({ path: join(pub, name), omitBackground: true });
  console.log('public/' + name, size + '×' + size);
}
await browser.close();
