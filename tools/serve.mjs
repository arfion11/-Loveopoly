// Pratinjau lokal Loveopoly dengan rebuild + reload otomatis.
//   npm run dev  ->  http://localhost:5173
// "/" = dist/test.html (halaman lengkap seperti di Claude). Saat file di src/ berubah: build ulang, lalu
// browser memuat ulang sendiri. Catatan: mode online butuh database artifact Claude, jadi di sini hanya
// menampilkan petunjuk; uji online memakai mock (npm run test:online).
import { createServer } from 'node:http';
import { readFileSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 5173);
const clients = new Set();
const RELOAD = '<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>';

const rebuild = () => {
  try { const kb = Math.round(build() / 1024); console.log(new Date().toLocaleTimeString(), 'build', kb, 'KB'); clients.forEach(res => res.write('data: reload\n\n')); }
  catch (e) { console.error('build gagal:', e.message); }
};
rebuild();

let timer = null;
watch(join(root, 'src'), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); });

createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/__reload') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': ok\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  const file = { '/': 'test.html', '/index.html': 'test.html', '/artifact.html': 'loveopoly.html' }[path];
  if (!file) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Tidak ada: ' + path); return; }
  try {
    let html = readFileSync(join(root, 'dist', file), 'utf8');
    if (file === 'test.html') html = html.replace('</body>', RELOAD + '</body>');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Build dulu: npm run build');
  }
}).listen(PORT, () => console.log(`Loveopoly siap: http://localhost:${PORT}  (Ctrl+C untuk berhenti)`));
