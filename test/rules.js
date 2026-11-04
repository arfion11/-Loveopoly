// Uji aturan keamanan Firestore & Realtime Database di emulator.
// npm run test:rules   (menjalankan emulator firestore/database lalu skrip ini)
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-loveopoly',
    firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') },
    database: { host: '127.0.0.1', port: 9000, rules: fs.readFileSync(path.resolve(__dirname, '../database.rules.json'), 'utf8') }
  });
  const results = [];
  const check = async (name, p) => { try { await p; results.push('PASS ' + name); } catch (e) { results.push('FAIL ' + name + ' — ' + (e && e.message ? e.message.split('\n')[0] : e)); } };
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  const anon = env.unauthenticatedContext().firestore();
  const now = Date.now();
  const room = (code, host) => ({ __j: JSON.stringify({ hostUid: host, status: 'lobby' }), hostUid: host, status: 'lobby' });
  const lock = (uid, exp) => ({ __j: JSON.stringify({ uid, holder: uid + ':c', exp }), uid, holder: uid + ':c', exp });

  await check('tanpa login: baca room ditolak', assertFails(anon.doc('rooms/R1').get()));
  await check('alice buat room miliknya', assertSucceeds(alice.doc('rooms/R1').set(room('R1', 'alice'))));
  await check('bob buat room atas nama alice ditolak', assertFails(bob.doc('rooms/R2').set(room('R2', 'alice'))));
  await check('alice tanpa lease tidak bisa ubah room', assertFails(alice.doc('rooms/R1').set(room('R1', 'alice'))));
  await check('alice ambil lease', assertSucceeds(alice.doc('rooms/R1/locks/host').set(lock('alice', now + 45000))));
  await check('lease terlalu lama ditolak', assertFails(alice.doc('rooms/R9/locks/host').set(lock('alice', now + 600000))));
  await check('lease atas nama orang lain ditolak', assertFails(bob.doc('rooms/R8/locks/host').set(lock('alice', now + 45000))));
  await check('alice (pemegang lease) ubah room', assertSucceeds(alice.doc('rooms/R1').set(Object.assign(room('R1', 'alice'), { status: 'playing' }))));
  await check('bob ubah room ditolak', assertFails(bob.doc('rooms/R1').set(room('R1', 'bob'))));
  await check('bob rebut lease yang masih berlaku ditolak', assertFails(bob.doc('rooms/R1/locks/host').set(lock('bob', now + 45000))));
  await env.withSecurityRulesDisabled(c => c.firestore().doc('rooms/R1/locks/host').set(lock('alice', now - 1000)));
  await check('bob ambil lease kedaluwarsa', assertSucceeds(bob.doc('rooms/R1/locks/host').set(lock('bob', now + 45000))));
  await check('bob (host baru) ubah room', assertSucceeds(bob.doc('rooms/R1').set(room('R1', 'bob'))));
  await check('alice (lease habis) ubah room ditolak', assertFails(alice.doc('rooms/R1').set(room('R1', 'alice'))));
  await check('bob tulis lobby sendiri', assertSucceeds(bob.doc('lobby/bob').set({ __j: '{}', room: 'R1' })));
  await check('bob tulis lobby alice ditolak', assertFails(bob.doc('lobby/alice').set({ __j: '{}', room: 'R1' })));
  await check('bob tulis inbox sendiri', assertSucceeds(bob.doc('inbox/bob/intents/i1').set({ __j: '{}', room: 'R1' })));
  await check('bob tulis inbox alice ditolak', assertFails(bob.doc('inbox/alice/intents/i1').set({ __j: '{}', room: 'R1' })));
  await check('alice baca inbox bob (host membaca aksi)', assertSucceeds(alice.doc('inbox/bob/intents/i1').get()));
  await check('path lain ditolak', assertFails(alice.doc('foo/bar').set({ a: 1 })));
  await check('alice (lease habis) hapus room ditolak', assertFails(alice.doc('rooms/R1').delete()));
  await check('bob (host) hapus room', assertSucceeds(bob.doc('rooms/R1').delete()));

  const rb = env.authenticatedContext('bob').database(), ra = env.unauthenticatedContext().database();
  await check('RTDB: bob tulis presence sendiri', assertSucceeds(rb.ref('presence/R1/bob').set({ code: 'R1' })));
  await check('RTDB: bob tulis presence alice ditolak', assertFails(rb.ref('presence/R1/alice').set({ code: 'R1' })));
  await check('RTDB: tanpa login baca ditolak', assertFails(ra.ref('presence/R1').get()));
  await check('RTDB: path lain ditolak', assertFails(rb.ref('foo').set(1)));

  await env.cleanup();
  results.forEach(r => console.log(r));
  const fail = results.filter(r => r.startsWith('FAIL')).length;
  console.log(fail ? fail + ' gagal' : results.length + '/' + results.length + ' lulus');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
