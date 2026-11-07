// Build Loveopoly: gabungkan src/ menjadi satu file HTML.
//   dist/index.html  halaman lengkap yang di-deploy ke Firebase Hosting
//   dist/test.html   salinan identik untuk pratinjau lokal & uji otomatis (tidak ikut di-deploy)
// Pakai: node build.mjs   (atau npm run build)
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');

// urutan penting: data -> engine -> ai -> aset -> UI -> online -> panduan -> layar
export const ORDER = ['data.js', 'engine.js', 'ai.js', 'icons.js', 'art.js', 'audio.js', 'ui-core.js', 'ui-modals.js', 'firebase-config.js', 'backend.js', 'net.js', 'guide.js', 'ui-screens.js'];
const FONTS = [['Fredoka', 'fredoka-latin-wght-normal.woff2', '300 700'], ['Nunito', 'nunito-latin-wght-normal.woff2', '200 1000']];
// ikon tab & layar utama (gambar asli di assets/: icon.svg, icon-32.png, apple-touch-icon.png), disisipkan sebagai data URI
// supaya halaman tetap satu file; apple-touch-icon.png juga disalin ke dist/ karena iOS mencarinya di akar situs
function headIcons() {
  const b64 = f => readFileSync(join(root, 'assets', f)).toString('base64');
  return '<link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,' + b64('icon-32.png') + '">' +
    '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,' + b64('icon.svg') + '">' +
    '<link rel="apple-touch-icon" href="data:image/png;base64,' + b64('apple-touch-icon.png') + '">' +
    '<meta name="apple-mobile-web-app-title" content="Loveopoly">' +
    '<meta name="theme-color" content="#FFF0F6" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#170F25" media="(prefers-color-scheme: dark)">';
}
// mesin pencari & pratinjau tautan (Google, WhatsApp, X, Facebook): tag di <head>; robots.txt, sitemap.xml &
// og-image.jpg (gambar dari tools/og-image.mjs) disalin ke akar situs
export const SITE = 'https://loveopoly.web.app/';
const SEO = {
  title: 'Loveopoly · Board game keliling dunia bareng pasangan & teman',
  desc: 'Main board game keliling dunia bareng pasangan atau teman, gratis tanpa install. Beli kota romantis, jalani tantangan seru, main online, di satu HP, atau lawan AI.',
  // Google Search Console, metode "Tag HTML": isi dengan nilai content="…" dari Search Console, lalu build & deploy
  googleVerify: 'qkstZsCormFtTkSLJLMsvsfO2dHYHdbEz9VMxEo4uCc',
};
function headSeo() {
  const a = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const img = SITE + 'og-image.jpg', imgAlt = 'Merpi, maskot Loveopoly, dikelilingi kota-kota romantis';
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', name: 'Loveopoly', url: SITE, inLanguage: 'id' },
    { '@type': 'VideoGame', name: 'Loveopoly', url: SITE, description: SEO.desc, image: img, inLanguage: 'id', genre: 'Board game', gamePlatform: 'Web browser', applicationCategory: 'GameApplication', operatingSystem: 'Any', playMode: ['MultiPlayer', 'SinglePlayer'], numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 4 }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' } },
  ] };
  const m = (k, v, attr) => '<meta ' + (attr || 'name') + '="' + k + '" content="' + a(v) + '">';
  return '<title>' + a(SEO.title) + '</title>' + m('description', SEO.desc) + '<link rel="canonical" href="' + SITE + '">' +
    (SEO.googleVerify ? m('google-site-verification', SEO.googleVerify) : '') +
    m('og:type', 'website', 'property') + m('og:site_name', 'Loveopoly', 'property') + m('og:locale', 'id_ID', 'property') + m('og:url', SITE, 'property') +
    m('og:title', SEO.title, 'property') + m('og:description', SEO.desc, 'property') +
    m('og:image', img, 'property') + m('og:image:type', 'image/jpeg', 'property') + m('og:image:width', '1200', 'property') + m('og:image:height', '630', 'property') + m('og:image:alt', imgAlt, 'property') +
    m('twitter:card', 'summary_large_image') + m('twitter:title', SEO.title) + m('twitter:description', SEO.desc) + m('twitter:image', img) + m('twitter:image:alt', imgAlt) +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>';
}
const ROBOTS = 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE + 'sitemap.xml\n';
const SITEMAP = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>' + SITE + '</loc></url>\n</urlset>\n';
const SKELETON = () => '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' + headSeo() + headIcons() +
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
  const html = SKELETON() + page + '</body></html>';
  writeFileSync(join(root, 'dist', 'index.html'), html);
  writeFileSync(join(root, 'dist', 'test.html'), html);
  rmSync(join(root, 'dist', 'loveopoly.html'), { force: true });
  copyFileSync(join(root, 'assets', 'apple-touch-icon.png'), join(root, 'dist', 'apple-touch-icon.png'));
  copyFileSync(join(root, 'assets', 'og-image.jpg'), join(root, 'dist', 'og-image.jpg'));
  writeFileSync(join(root, 'dist', 'robots.txt'), ROBOTS);
  writeFileSync(join(root, 'dist', 'sitemap.xml'), SITEMAP);
  return Buffer.byteLength(page);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const bytes = build();
  console.log('built', Math.round(bytes / 1024), 'KB -> dist/index.html, dist/test.html');
}
