/* LOVEOPOLY — backend online di Firebase (Firestore + Auth anonim + Realtime Database).
   LoveBackend.use('db' | 'user' | 'room') memberi objek dengan bentuk API yang dipakai net.js:
   - db   : doc(path) / collection(path).where(f, '==', v) dengan get/set/update/delete/onSnapshot/acquire
   - user : id() = uid anonim (tetap sama di browser yang sama), can() selalu true
   - room : join('lv-<kode>') → presence, onPeers, onConnection (RTDB presence/<KODE>/<uid>)
   SDK compat dimuat dari gstatic hanya saat mode online dibuka. Dokumen Firestore disimpan sebagai
   { __j: JSON lengkap, ...kunci indeks } karena Firestore menolak array bersarang yang dipakai state game. */
(function (G) {
  'use strict';
  const VER = '10.14.1';
  const SDK = ['app', 'auth', 'firestore', 'database'].map(n => 'https://www.gstatic.com/firebasejs/' + VER + '/firebase-' + n + '-compat.js');
  const INDEX_KEYS = ['hostUid', 'status', 'room', 'uid', 'exp', 'holder'];

  let loading = null, authing = null, app = null;

  function normErr(e) {
    let code = String((e && e.code) || 'unknown').replace(/^(firestore|auth|database)\//, '');
    if (code === 'network-request-failed') code = 'unavailable';
    if (code === 'quota-exceeded') code = 'resource-exhausted';
    return { code, message: (e && e.message) || code };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = resolve;
      s.onerror = () => reject({ code: 'sdk-load', message: 'Gagal memuat ' + src });
      document.head.appendChild(s);
    });
  }
  function loadSdk() {
    if (!loading) {
      loading = (G.firebase && G.firebase.firestore && G.firebase.database ? Promise.resolve() : Promise.all(SDK.map(loadScript)))
        .then(() => {
          const cfg = G.LOVE_FIREBASE || {};
          if (!cfg.projectId) throw { code: 'sdk-load', message: 'Konfigurasi Firebase belum diisi.' };
          const fb = G.firebase;
          app = fb.apps.length ? fb.app() : fb.initializeApp(cfg);
          const em = cfg.emulator;
          if (em) {
            fb.auth().useEmulator('http://' + em.host + ':9099', { disableWarnings: true });
            fb.firestore().useEmulator(em.host, 8080);
            fb.database().useEmulator(em.host, 9000);
          }
          fb.firestore().settings({ experimentalAutoDetectLongPolling: true, merge: true });
        })
        .catch(e => { loading = null; throw e.code === 'sdk-load' ? e : normErr(e); });
    }
    return loading;
  }
  function signIn() {
    if (!authing) {
      authing = loadSdk()
        .then(() => {
          const auth = G.firebase.auth();
          // tunggu persistensi lama dipulihkan dulu supaya uid tetap sama setelah muat ulang
          return new Promise(resolve => { const off = auth.onAuthStateChanged(u => { off(); resolve(u); }); });
        })
        .then(u => u || G.firebase.auth().signInAnonymously().then(c => c.user))
        .then(u => u.uid)
        .catch(e => { authing = null; throw e.code === 'sdk-load' ? e : { code: 'auth', message: (e && e.message) || 'auth' }; });
    }
    return authing;
  }

  // ---------- penyandian dokumen ----------
  function encode(data) {
    const out = { __j: JSON.stringify(data) };
    INDEX_KEYS.forEach(k => { const v = data && data[k]; if (v != null && typeof v !== 'object') out[k] = v; });
    return out;
  }
  function decode(raw) {
    if (!raw) return undefined;
    return typeof raw.__j === 'string' ? JSON.parse(raw.__j) : raw;
  }
  const snapOf = s => ({ id: s.id, exists: s.exists, data: () => decode(s.exists ? s.data() : null) });
  const qsnapOf = q => {
    const docs = q.docs.map(snapOf);
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => q.docChanges().map(c => ({ type: c.type, doc: snapOf(c.doc) })) };
  };
  const wrapErr = p => p.catch(e => { throw normErr(e); });

  // ---------- db ----------
  function docRef(path) {
    const ref = () => G.firebase.firestore().doc(path);
    return {
      id: path.split('/').pop(), path,
      get: () => wrapErr(ref().get().then(snapOf)),
      set: data => wrapErr(ref().set(encode(data))),
      update: data => wrapErr(ref().get().then(s => {
        if (!s.exists) throw { code: 'not-found', message: 'Dokumen tidak ada.' };
        return ref().set(encode(Object.assign(decode(s.data()), data)));
      })),
      delete: () => wrapErr(ref().delete()),
      onSnapshot: (next, err) => ref().onSnapshot(s => next(snapOf(s)), e => err && err(normErr(e))),
      collection: sub => query(path + '/' + sub, []),
      acquire: () => Promise.reject({ code: 'unimplemented', message: 'acquire belum tersedia.' })
    };
  }
  function query(path, filters) {
    const build = () => filters.reduce((q, f) => q.where(f[0], f[1], f[2]), G.firebase.firestore().collection(path));
    return {
      path,
      where: (field, op, value) => query(path, filters.concat([[field, op, value]])),
      get: () => wrapErr(build().get().then(qsnapOf)),
      onSnapshot: (next, err) => build().onSnapshot(q => next(qsnapOf(q)), e => err && err(normErr(e))),
      doc: id => docRef(path + '/' + (id || G.firebase.firestore().collection(path).doc().id))
    };
  }
  const db = { doc: docRef, collection: p => query(p, []) };
  const user = { id: () => signIn(), can: () => Promise.resolve(true) };

  const LoveBackend = {
    use(name) {
      return signIn().then(() => {
        if (name === 'db') return db;
        if (name === 'user') return user;
        return null;
      });
    },
    _reset() { if (!app) loading = null; authing = null; },
    _normErr: normErr
  };
  G.LoveBackend = LoveBackend;
})(typeof window !== 'undefined' ? window : globalThis);
