/* LOVEOPOLY — backend online di Firebase (Firestore + Auth anonim + Realtime Database).
   LoveBackend.use('db' | 'user' | 'room') memberi objek dengan bentuk API yang dipakai net.js:
   - db   : doc(path) / collection(path).where(f, '==', v) dengan get/set/update/delete/onSnapshot/acquire
   - user : id() = uid anonim (tetap sama di browser yang sama), can() selalu true
   - room : join('lv-<kode>') → presence, onPeers, onConnection (RTDB presence/<KODE>/<uid>)
   SDK compat dimuat dari gstatic hanya saat mode online dibuka. Dokumen Firestore disimpan sebagai
   { __j: JSON lengkap, ...kunci indeks } karena Firestore menolak array bersarang yang dipakai state game. */
import './firebase-config.js';

const VER = '10.14.1';
const SDK = ['app', 'auth', 'firestore', 'database'].map(
  n => 'https://www.gstatic.com/firebasejs/' + VER + '/firebase-' + n + '-compat.js'
);
const INDEX_KEYS = ['hostUid', 'status', 'room', 'uid', 'exp', 'holder'];
// privasi: setiap dokumen (room + Foto Bukti, lease, lobby, intent) diberi expireAt 7 hari setelah tulisan terakhir.
// Penghapusannya baru aktif setelah kebijakan TTL Firestore dipasang (butuh paket Blaze; lihat CLAUDE.md)
const KEEP_DAYS = 7;

let loading = null,
  authing = null,
  app = null;
const loaded = new Set();
let tries = 0;

function normErr(e) {
  let code = String((e && e.code) || 'unknown').replace(/^(firestore|auth|database)\//, '');
  if (code === 'network-request-failed') code = 'unavailable';
  if (code === 'quota-exceeded') code = 'resource-exhausted';
  return { code, message: (e && e.message) || code };
}

// satu skrip SDK; koneksi macet (portal Wi-Fi, sinyal lemah) dibatasi waktu supaya layar tidak menunggu selamanya
function loadScript(src) {
  if (loaded.has(src)) return Promise.resolve();
  const ms = (window.LOVE_FIREBASE && window.LOVE_FIREBASE.sdkTimeoutMs) || 15000;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    const fail = () => {
      clearTimeout(t);
      s.remove();
      reject({ code: 'sdk-load', message: 'Gagal memuat ' + src });
    };
    const t = setTimeout(fail, ms);
    // percobaan ulang memakai URL berbeda: browser bisa menumpang ke permintaan lama yang masih menggantung
    // async (bawaan): urutan sudah dijaga rantai Promise; async=false memakai antrean browser yang bisa
    // tertahan selamanya oleh skrip lama yang menggantung
    s.src = tries ? src + '?coba=' + tries : src;
    s.onload = () => {
      clearTimeout(t);
      loaded.add(src);
      resolve();
    };
    s.onerror = fail;
    document.head.appendChild(s);
  });
}
function loadSdk() {
  if (!loading) {
    // berurutan: app harus ada sebelum modul lain; yang sudah termuat tidak disisipkan lagi saat Coba lagi
    loading = SDK.reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve())
      .then(() => {
        const cfg = window.LOVE_FIREBASE || {};
        if (!cfg.projectId) throw { code: 'sdk-load', message: 'Konfigurasi Firebase belum diisi.' };
        const fb = window.firebase;
        app = fb.apps.length ? fb.app() : fb.initializeApp(cfg);
        const em = cfg.emulator;
        if (em) {
          fb.auth().useEmulator('http://' + em.host + ':9099', { disableWarnings: true });
          fb.firestore().useEmulator(em.host, 8080);
          fb.database().useEmulator(em.host, 9000);
        }
        fb.firestore().settings({ experimentalAutoDetectLongPolling: true, merge: true });
      })
      .catch(e => {
        loading = null;
        tries++;
        throw e.code === 'sdk-load' ? e : normErr(e);
      });
  }
  return loading;
}
function signIn() {
  if (!authing) {
    authing = loadSdk()
      .then(() => {
        const auth = window.firebase.auth();
        // tunggu persistensi lama dipulihkan dulu supaya uid tetap sama setelah muat ulang
        return new Promise(resolve => {
          const off = auth.onAuthStateChanged(u => {
            off();
            resolve(u);
          });
        });
      })
      .then(
        u =>
          u ||
          window.firebase
            .auth()
            .signInAnonymously()
            .then(c => c.user)
      )
      .then(u => u.uid)
      .catch(e => {
        authing = null;
        if (e.code === 'sdk-load') throw e;
        const n = normErr(e);
        throw n.code === 'unavailable' ? n : { code: 'auth', message: n.message };
      });
  }
  return authing;
}

// ---------- penyandian dokumen ----------
function encode(data) {
  const out = { __j: JSON.stringify(data), expireAt: window.firebase.firestore.Timestamp.fromMillis(Date.now() + KEEP_DAYS * 864e5) };
  INDEX_KEYS.forEach(k => {
    const v = data && data[k];
    if (v != null && typeof v !== 'object') out[k] = v;
  });
  return out;
}
function decode(raw) {
  if (!raw) return undefined;
  return typeof raw.__j === 'string' ? JSON.parse(raw.__j) : raw;
}
const snapOf = s => ({ id: s.id, exists: s.exists, data: () => decode(s.exists ? s.data() : null) });
const qsnapOf = q => {
  const docs = q.docs.map(snapOf);
  return {
    docs,
    size: docs.length,
    empty: !docs.length,
    docChanges: () => q.docChanges().map(c => ({ type: c.type, doc: snapOf(c.doc) })),
  };
};
const wrapErr = p =>
  p.catch(e => {
    throw normErr(e);
  });

// ---------- db ----------
function docRef(path) {
  const ref = () => window.firebase.firestore().doc(path);
  return {
    id: path.split('/').pop(),
    path,
    get: () => wrapErr(ref().get().then(snapOf)),
    set: data => wrapErr(ref().set(encode(data))),
    update: data =>
      wrapErr(
        ref()
          .get()
          .then(s => {
            if (!s.exists) throw { code: 'not-found', message: 'Dokumen tidak ada.' };
            return ref().set(encode(Object.assign(decode(s.data()), data)));
          })
      ),
    delete: () => wrapErr(ref().delete()),
    onSnapshot: (next, err) =>
      ref().onSnapshot(
        s => next(snapOf(s)),
        e => err && err(normErr(e))
      ),
    collection: sub => query(path + '/' + sub, []),
    acquire: opts => acquire(ref(), opts),
  };
}
function query(path, filters) {
  const build = () => filters.reduce((q, f) => q.where(f[0], f[1], f[2]), window.firebase.firestore().collection(path));
  return {
    path,
    where: (field, op, value) => query(path, filters.concat([[field, op, value]])),
    get: () => wrapErr(build().get().then(qsnapOf)),
    onSnapshot: (next, err) =>
      build().onSnapshot(
        q => next(qsnapOf(q)),
        e => err && err(normErr(e))
      ),
    doc: id => docRef(path + '/' + (id || window.firebase.firestore().collection(path).doc().id)),
  };
}
// lease host: transaksi pada dokumen kunci {uid, holder, exp}; berhasil bila kosong, kedaluwarsa, atau milik holder
const LEASE_MAX = 60000;
function acquire(ref, opts) {
  const holder = String(opts.holder),
    ttl = Math.min(Number(opts.ttlMs) || 30000, LEASE_MAX);
  const fs = window.firebase.firestore(),
    uid = window.firebase.auth().currentUser.uid;
  return wrapErr(
    fs.runTransaction(async tx => {
      const s = await tx.get(ref);
      const cur = s.exists ? decode(s.data()) : null;
      const now = Date.now();
      if (cur && cur.exp > now && cur.holder !== holder)
        return { acquired: false, holder: cur.holder, expiresAt: new Date(cur.exp).toISOString() };
      const exp = now + ttl;
      tx.set(ref, encode({ uid, holder, exp }));
      return { acquired: true, holder, expiresAt: new Date(exp).toISOString() };
    })
  );
}
const db = { doc: docRef, collection: p => query(p, []) };

// ---------- room (presence di RTDB) ----------
function join(name) {
  const code = String(name).replace(/^lv-/, '').toUpperCase();
  const rdb = window.firebase.database(),
    uid = window.firebase.auth().currentUser.uid;
  const base = rdb.ref('presence/' + code),
    mine = base.child(uid);
  const offs = [];
  const listen = (ref, fn, err) => {
    const cb = ref.on('value', fn, e => err && err(normErr(e)));
    const off = () => ref.off('value', cb);
    offs.push(off);
    return off;
  };
  let current = null;
  const write = () =>
    current
      ? mine
          .onDisconnect()
          .remove()
          .then(() => mine.set(Object.assign({}, current, { ts: window.firebase.database.ServerValue.TIMESTAMP })))
      : Promise.resolve();
  // tulis ulang setelah tersambung kembali (onDisconnect sudah menghapus node saat koneksi putus)
  listen(rdb.ref('.info/connected'), s => {
    if (s.val() === true) write().catch(() => {});
  });
  return Promise.resolve({
    presence: obj => {
      current = obj;
      return wrapErr(write());
    },
    onPeers: (cb, err) =>
      listen(
        base,
        s => {
          const v = s.val() || {};
          cb({ peers: Object.keys(v).map(k => ({ by: k, presence: v[k] })) });
        },
        err
      ),
    onConnection: cb => listen(rdb.ref('.info/connected'), s => cb(s.val() === true)),
    on: () => () => {},
    emit: () => Promise.resolve(),
    leave: () => {
      offs.splice(0).forEach(f => f());
      current = null;
      return mine
        .onDisconnect()
        .cancel()
        .then(() => mine.remove())
        .catch(() => {});
    },
  });
}
const room = { join };
const user = { id: () => signIn(), can: () => Promise.resolve(true) };

const LoveBackend = {
  use(name) {
    return signIn().then(() => {
      if (name === 'db') return db;
      if (name === 'user') return user;
      if (name === 'room') return room;
      return null;
    });
  },
  _reset() {
    if (!app) loading = null;
    authing = null;
  },
  _normErr: normErr,
};
// backend yang sudah terpasang lebih dulu (mock uji online) tidak ditimpa
if (!window.LoveBackend) window.LoveBackend = LoveBackend;
// backend aktif dibaca saat dipakai, jadi uji boleh memasang/mengganti window.LoveBackend (mock)
export const backend = () => window.LoveBackend;
