// Build Loveopoly: gabungkan src/ menjadi satu file HTML.
//   dist/index.html  halaman lengkap yang di-deploy ke Firebase Hosting
//   dist/test.html   salinan identik untuk pratinjau lokal & uji otomatis (tidak ikut di-deploy)
// Pakai: node build.mjs   (atau npm run build)
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');

// urutan penting: data -> engine -> ai -> aset -> UI -> online -> panduan -> layar
export const ORDER = ['data.js', 'engine.js', 'ai.js', 'icons.js', 'art.js', 'audio.js', 'ui-core.js', 'ui-modals.js', 'firebase-config.js', 'backend.js', 'net.js', 'guide.js', 'ui-screens.js'];
const FONTS = [['Fredoka', 'fredoka-latin-wght-normal.woff2', '300 700'], ['Nunito', 'nunito-latin-wght-normal.woff2', '200 1000']];
const SKELETON = '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>' +
  '</head><body>';

// ganti semua kemunculan tanpa menafsirkan pola "$" (isi CSS/JS banyak memakai $)
const swap = (text, marker, value) => text.split(marker).join(value);

export function build() {
  const tpl = readFileSync(join(src, 'index.html'), 'utf8');
  const css = readFileSync(join(src, 'style.css'), 'utf8');
  let fonts = '/* Fredoka (c) The Fredoka Project Authors; Nunito (c) The Nunito Project Authors. Keduanya berlisensi SIL Open Font License 1.1 - https://openfontlicense.org */\n';
  for (const [fam, file, weight] of FONTS) {
    const b64 = readFileSync(join(root, 'fonts', file)).toString('base64');
    fonts += `@font-face{font-family:'${fam}';font-style:normal;font-display:swap;font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2')}\n`;
  }
  const js = ORDER.map(f => readFileSync(join(src, f), 'utf8').split('</script').join('<\\/script')).join('\n');
  const page = swap(swap(swap(tpl, '/*FONTS*/', fonts), '/*STYLE*/', css), '//SCRIPTS', js);
  mkdirSync(join(root, 'dist'), { recursive: true });
  const html = SKELETON + page + '</body></html>';
  writeFileSync(join(root, 'dist', 'index.html'), html);
  writeFileSync(join(root, 'dist', 'test.html'), html);
  rmSync(join(root, 'dist', 'loveopoly.html'), { force: true });
  return Buffer.byteLength(page);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const bytes = build();
  console.log('built', Math.round(bytes / 1024), 'KB -> dist/index.html, dist/test.html');
}
