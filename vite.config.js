// Build Loveopoly dengan Vite: index.html + src/main.js → dist/ (JS, CSS, font bernama hash = aman di-cache lama;
// isi public/ disalin apa adanya: ikon, manifest, gambar pratinjau, robots.txt, sitemap.xml) + dist/sw.js.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defineConfig } from 'vite';

// service worker: daftar precache = semua berkas hasil build (tanpa source map) + berkas public yang dipakai halaman.
// Versi = hash daftar & isi index.html, jadi tiap deploy memasang service worker baru dan membuang cache lama.
function serviceWorker() {
  return {
    name: 'loveopoly-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle)
        .filter(f => !f.endsWith('.map') && f !== 'index.html')
        .map(f => '/' + f)
        .sort();
      const list = ['/', ...built, '/manifest.webmanifest', '/icon.svg', '/icon-32.png', '/icon-192.png', '/apple-touch-icon.png'];
      const html = bundle['index.html'] ? String(bundle['index.html'].source) : '';
      const version = createHash('sha256').update(list.join('|')).update(html).digest('hex').slice(0, 12);
      const src = readFileSync('src/service-worker.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(list));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
  build: {
    sourcemap: true,
    // font & gambar tetap file terpisah supaya ikut di-cache browser
    assetsInlineLimit: 0,
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
