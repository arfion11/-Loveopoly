// Uji adapter LoveBackend (src/backend.js) terhadap Firebase Emulator sungguhan.
// npm run test:backend   (menjalankan emulator auth/firestore/database lalu skrip ini)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SDK = path.resolve(__dirname, '../node_modules/firebase');
const PAGE = path.resolve(__dirname, '../dist/test.html');
const PORT = 8128;
const CFG = { apiKey: 'demo-key', authDomain: 'demo-loveopoly.firebaseapp.com', projectId: 'demo-loveopoly', databaseURL: 'http://127.0.0.1:9000?ns=demo-loveopoly', appId: 'demo', emulator: { host: '127.0.0.1' } };

const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(PAGE).pipe(res); }).listen(PORT);

(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const ok = (n, c, d) => results.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
  const newCtx = async init => {
    const ctx = await browser.newContext();
    await ctx.route(/^https:\/\/www\.gstatic\.com\/firebasejs\/10\.14\.1\/(.+)$/, r => r.fulfill({ path: path.join(SDK, new URL(r.request().url()).pathname.split('/').pop()), contentType: 'application/javascript' }));
    await ctx.addInitScript(cfg => { window.LOVE_FIREBASE = cfg; }, CFG);
    if (init) await ctx.addInitScript(init);
    return ctx;
  };
  const open = async ctx => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await p.goto('http://localhost:' + PORT + '/');
    await p.waitForFunction(() => !!window.LoveBackend);
    return p;
  };
  const uidOf = p => p.evaluate(async () => (await window.LoveBackend.use('user')).id());

  // --- user ---
  const ctxA = await newCtx();
  const A = await open(ctxA);
  const uid = await uidOf(A).catch(e => 'ERR ' + JSON.stringify(e));
  ok('uid ada', typeof uid === 'string' && uid.length > 5 && !uid.startsWith('ERR'), uid);
  await A.reload(); await A.waitForFunction(() => !!window.LoveBackend);
  const uid2 = await uidOf(A).catch(() => null);
  ok('uid tetap setelah reload', uid2 === uid, uid2);

  // --- db: round-trip __j ---
  const rt = await A.evaluate(async () => {
    const db = await window.LoveBackend.use('db'), me = await (await window.LoveBackend.use('user')).id();
    await db.doc('rooms/RT0001').set({ hostUid: me, state: { grid: [[1, [2]], [3]] }, x: undefined });
    const s = await db.doc('rooms/RT0001').get();
    const raw = (await firebase.firestore().doc('rooms/RT0001').get()).data();
    return { exists: s.exists, data: s.data(), me, rawKeys: Object.keys(raw).sort(), keepDays: raw.expireAt && raw.expireAt.toMillis ? (raw.expireAt.toMillis() - Date.now()) / 864e5 : -1 };
  }).catch(e => ({ err: String(e && (e.code || e.message || e)) }));
  ok('round-trip __j', rt.exists && JSON.stringify(rt.data) === JSON.stringify({ hostUid: rt.me, state: { grid: [[1, [2]], [3]] } }), JSON.stringify(rt.data || rt.err));
  ok('kunci indeks di tingkat atas (+ expireAt TTL)', JSON.stringify(rt.rawKeys) === JSON.stringify(['__j', 'expireAt', 'hostUid']), JSON.stringify(rt.rawKeys));
  ok('expireAt = Timestamp ±7 hari (hapus otomatis)', rt.keepDays > 6.9 && rt.keepDays <= 7, String(rt.keepDays));

  // --- db: where + docChanges ---
  const wc = await A.evaluate(async () => {
    const db = await window.LoveBackend.use('db'), me = await (await window.LoveBackend.use('user')).id();
    await db.doc('lobby/' + me).set({ room: 'ABC123', name: 'A' });
    const seen = [];
    const until = async f => { for (let t = 0; t < 80 && !f(); t++) await new Promise(r => setTimeout(r, 100)); };
    const unsub = db.collection('lobby').where('room', '==', 'ABC123').onSnapshot(q => { const c = q.docChanges().map(c => c.type + ':' + c.doc.id + ':' + (c.doc.data() || {}).name).join(','); if (c) seen.push(c); });
    await until(() => seen.some(x => x.startsWith('added:')));
    await db.doc('lobby/' + me).delete();
    await until(() => seen.some(x => x.startsWith('removed:')));
    unsub();
    const got = await db.collection('lobby').where('room', '==', 'ABC123').get();
    return { seen, me, size: got.size };
  }).catch(e => ({ err: String(e && (e.code || e.message || e)) }));
  ok('where + docChanges', wc.seen && wc.seen[0] === 'added:' + wc.me + ':A' && wc.seen[wc.seen.length - 1].startsWith('removed:' + wc.me) && wc.size === 0, JSON.stringify(wc));

  // --- error dinormalkan ---
  const ne = await A.evaluate(() => ['firestore/unavailable', 'permission-denied', 'firestore/resource-exhausted', 'auth/network-request-failed', 'auth/quota-exceeded'].map(c => window.LoveBackend._normErr({ code: c, message: 'm' }).code)).catch(e => String(e));
  ok('error dinormalkan', JSON.stringify(ne) === JSON.stringify(['unavailable', 'permission-denied', 'resource-exhausted', 'unavailable', 'resource-exhausted']), JSON.stringify(ne));

  // --- auth tanpa IndexedDB ---
  const ctxN = await newCtx(() => { try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (e) { /* abaikan */ } });
  const N = await open(ctxN);
  const nuid = await uidOf(N).catch(e => 'ERR ' + JSON.stringify(e));
  ok('auth jalan tanpa IndexedDB', typeof nuid === 'string' && nuid.length > 5 && !nuid.startsWith('ERR'), nuid);

  // --- SDK macet: batas waktu, lalu Coba lagi hanya memuat yang belum ada ---
  const ctxH = await newCtx(() => { window.LOVE_FIREBASE.sdkTimeoutMs = 1500; });
  let hang = true;
  await ctxH.route(/firebase-firestore-compat\.js$/, r => { if (!hang) return r.fallback(); /* tidak dijawab: koneksi macet */ });
  const H = await open(ctxH);
  const warns = [];
  H.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
  const t0 = Date.now();
  const hres = await H.evaluate(() => window.LoveBackend.use('user').then(() => 'ok', e => e.code));
  ok('SDK macet ditolak sdk-load dalam batas waktu', hres === 'sdk-load' && Date.now() - t0 < 6000, hres + ' ' + (Date.now() - t0) + 'ms');
  hang = false;
  const hres2 = await H.evaluate(async () => { try { window.LoveBackend._reset(); const u = await window.LoveBackend.use('user'); return { uid: await u.id(), n: document.querySelectorAll('script[src*="firebase-app-compat"]').length }; } catch (e) { return { err: (e && (e.code + ' ' + e.message)) || String(e) }; } });
  ok('Coba lagi berhasil tanpa memuat ulang SDK yang sudah ada', hres2.uid && hres2.n === 1 && !warns.some(w => /already|sudah/i.test(w)), JSON.stringify(hres2) + ' ' + warns.join(' | '));

  // --- offline saat masuk: kode unavailable (bukan auth) ---
  const ctxO = await newCtx();
  await ctxO.route(/127\.0\.0\.1:9099/, r => r.abort('internetdisconnected'));
  const O = await open(ctxO);
  const ores = await O.evaluate(() => window.LoveBackend.use('user').then(() => 'ok', e => e.code));
  ok('offline saat masuk → unavailable', ores === 'unavailable', ores);

  // --- lease host ---
  const ctxB = await newCtx();
  const B = await open(ctxB);
  await uidOf(B);
  const acq = (p, lock, holder, ttlMs) => p.evaluate(async ([lock, holder, ttlMs]) => (await window.LoveBackend.use('db')).doc(lock).acquire({ holder, ttlMs }), [lock, holder, ttlMs]).catch(e => ({ err: String(e && (e.code || e.message || e)) }));
  const r1 = await acq(A, 'rooms/LK0001/locks/host', 'a', 45000);
  ok('acquire pertama', r1.acquired === true && r1.holder === 'a', JSON.stringify(r1));
  const [ra, rb] = await Promise.all([acq(A, 'rooms/LK0002/locks/host', 'a', 45000), acq(B, 'rooms/LK0002/locks/host', 'b', 45000)]);
  ok('acquire bersaing', [ra.acquired, rb.acquired].filter(Boolean).length === 1, JSON.stringify([ra, rb]));
  const r2 = await acq(A, 'rooms/LK0001/locks/host', 'a', 45000), r3 = await acq(B, 'rooms/LK0001/locks/host', 'b', 45000);
  ok('acquire diperpanjang pemegang', r2.acquired === true && r3.acquired === false && r3.holder === 'a', JSON.stringify([r2, r3]));
  await acq(A, 'rooms/LK0003/locks/host', 'a', 300);
  await A.waitForTimeout(500);
  const r4 = await acq(B, 'rooms/LK0003/locks/host', 'b', 45000);
  ok('acquire setelah kedaluwarsa', r4.acquired === true && r4.holder === 'b', JSON.stringify(r4));

  // --- presence ---
  const joinP = p => p.evaluate(async () => {
    const room = await window.LoveBackend.use('room'), me = await (await window.LoveBackend.use('user')).id();
    const n = await room.join('lv-abc123');
    window.__peers = []; window.__conn = null;
    n.onPeers(ch => { window.__peers = ch.peers.map(x => x.by).sort(); });
    n.onConnection(c => { window.__conn = c; });
    await n.presence({ code: 'ABC123', uid: me, client: 'x' });
    window.__named = n;
    return me;
  });
  const ua = await joinP(A).catch(e => 'ERR ' + String(e && (e.code || e.message || e)));
  const ub = await joinP(B).catch(e => 'ERR ' + String(e && (e.code || e.message || e)));
  await A.waitForTimeout(800);
  const pa = await A.evaluate(() => ({ peers: window.__peers, conn: window.__conn }));
  ok('presence: dua pemain terlihat', JSON.stringify(pa.peers) === JSON.stringify([ua, ub].sort()) && pa.conn === true, JSON.stringify(pa));
  await B.evaluate(() => window.__named && window.__named.leave());
  await A.waitForTimeout(800);
  const pa2 = await A.evaluate(() => window.__peers);
  ok('presence: keluar hilang', JSON.stringify(pa2) === JSON.stringify([ua]), JSON.stringify(pa2));


  await browser.close(); server.close();
  results.forEach(r => console.log(r));
  if (errors.length) console.log('ERRORS (' + errors.length + '):\n' + errors.join('\n'));
  const fail = results.filter(r => r.startsWith('FAIL')).length + errors.length;
  console.log(fail ? fail + ' gagal' : results.length + '/' + results.length + ' lulus');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
