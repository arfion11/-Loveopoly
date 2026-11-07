// Melayani hasil build (dist/) untuk uji browser. Modul ES tidak bisa dimuat lewat file://, jadi uji memakai
// server lokal ini (atau routeDist untuk origin lain, mis. https://loveopoly.web.app di uji migrasi).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const DIST = path.resolve(import.meta.dirname, '../../dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html belum ada. Jalankan npm run build dulu.');
  process.exit(1);
}

/** Berkas dist/ untuk path URL; path yang tidak ada → index.html (seperti hosting satu halaman). */
export function distFile(urlPath) {
  const clean = decodeURIComponent(String(urlPath).split(/[?#]/)[0]);
  let file = path.join(DIST, clean);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  return { file, type: TYPES[path.extname(file)] || 'application/octet-stream' };
}

/** Jalankan server statis untuk dist/. port 0 = port acak. Mengembalikan { url, close }. */
export function serveDist(port = 0) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const { file, type } = distFile(req.url);
      res.writeHead(200, { 'content-type': type });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(port, 'localhost', () => resolve({ url: 'http://localhost:' + srv.address().port, close: () => srv.close() }));
  });
}

/** Layani dist/ untuk origin lain lewat intersepsi Playwright (konteks atau halaman). */
export async function routeDist(target, origin) {
  await target.route(origin + '/**', route => {
    const { file, type } = distFile(new URL(route.request().url()).pathname);
    route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
  });
}
