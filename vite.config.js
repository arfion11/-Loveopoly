// Build Loveopoly dengan Vite: index.html + src/main.js → dist/ (JS, CSS, font bernama hash = aman di-cache lama;
// isi public/ disalin apa adanya: ikon, gambar pratinjau, robots.txt, sitemap.xml).
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    // font & gambar tetap file terpisah supaya ikut di-cache browser
    assetsInlineLimit: 0,
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
