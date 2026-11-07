// Mock window.LoveBackend (db/user berbasis localStorage) yang meniru src/net/backend.js untuk uji online
// multi-tab. Dipasang lewat context.addInitScript(MOCK); halaman tanpa ?u=<uid> memakai backend asli.
export const MOCK = () => {
  const uid = new URLSearchParams(location.search).get('u');
  if (!uid) return;
  try {
    localStorage.setItem(
      'loveopoly.v1.prefs',
      JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast', theme: 'system', autoEnd: false })
    );
    if (!localStorage.getItem('loveopoly.v1.profile')) localStorage.setItem('loveopoly.v1.profile', JSON.stringify({ skipped: true }));
    localStorage.setItem('loveopoly.v2.tour', '"done"');
  } catch (e) {}
  const PFX = 'mockdb:';
  const listeners = [];
  const read = p => {
    const v = localStorage.getItem(PFX + p);
    return v ? JSON.parse(v) : null;
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const mk = (id, d) => ({
    id,
    exists: !!d,
    data: () => (d ? clone(d) : undefined),
    metadata: { fromCache: false, hasPendingWrites: false },
  });
  const notify = () =>
    listeners.slice().forEach(l => {
      try {
        l.fire();
      } catch (e) {
        console.error(e);
      }
    });
  window.addEventListener('storage', e => {
    if (e.key && e.key.startsWith(PFX)) notify();
  });
  window.__mockWrites = 0;
  function docRef(p) {
    return {
      id: p.split('/').pop(),
      path: p,
      async get() {
        return mk(p.split('/').pop(), read(p));
      },
      async set(data) {
        // tolak penulisan room sekali (meniru aturan Firestore saat lease host sudah lewat)
        if (window.__denyRoomWrites > 0 && /^rooms\/[^/]+$/.test(p)) {
          window.__denyRoomWrites--;
          throw { code: 'permission-denied', message: 'denied' };
        }
        window.__mockWrites++;
        localStorage.setItem(PFX + p, JSON.stringify(data));
        setTimeout(notify, 5);
      },
      async update(data) {
        const cur = read(p);
        if (!cur) throw { code: 'invalid_argument' };
        localStorage.setItem(PFX + p, JSON.stringify(Object.assign(cur, data)));
        setTimeout(notify, 5);
      },
      async delete() {
        localStorage.removeItem(PFX + p);
        setTimeout(notify, 5);
      },
      async acquire({ holder, ttlMs }) {
        const k = 'mocklease:' + p,
          now = Date.now();
        const cur = JSON.parse(localStorage.getItem(k) || 'null');
        if (cur && cur.exp > now && cur.holder !== holder) return { acquired: false, expiresAt: new Date(cur.exp).toISOString() };
        localStorage.setItem(k, JSON.stringify({ holder, exp: now + (ttlMs || 30000) }));
        return { acquired: true, version: 1, holder };
      },
      onSnapshot(next) {
        let last;
        const l = {
          fire: () => {
            const d = read(p);
            const j = JSON.stringify(d);
            if (j !== last) {
              last = j;
              next(mk(p.split('/').pop(), d));
            }
          },
        };
        listeners.push(l);
        setTimeout(l.fire, 0);
        return () => {
          const i = listeners.indexOf(l);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
      collection(sub) {
        return colRef(p + '/' + sub);
      },
    };
  }
  function colRef(p, filters) {
    filters = filters || [];
    const list = () => {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k.startsWith(PFX + p + '/')) continue;
        const rest = k.slice((PFX + p + '/').length);
        if (rest.includes('/')) continue;
        const d = JSON.parse(localStorage.getItem(k));
        if (filters.every(f => (f.op === '==' ? d[f.field] === f.value : true))) out.push(mk(rest, d));
      }
      return out.sort((a, b) => (a.id < b.id ? -1 : 1));
    };
    const q = {
      path: p,
      where(field, op, value) {
        return colRef(p, filters.concat([{ field, op, value }]));
      },
      orderBy() {
        return q;
      },
      limit() {
        return q;
      },
      async get() {
        const docs = list();
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map(d => ({ type: 'added', doc: d })), metadata: {} };
      },
      onSnapshot(next) {
        let prev = {},
          first = true;
        const l = {
          fire: () => {
            const docs = list(),
              cur = {};
            docs.forEach(d => {
              cur[d.id] = JSON.stringify(d.data());
            });
            const ch = [];
            docs.forEach(d => {
              if (!(d.id in prev)) ch.push({ type: 'added', doc: d });
              else if (prev[d.id] !== cur[d.id]) ch.push({ type: 'modified', doc: d });
            });
            Object.keys(prev).forEach(id => {
              if (!(id in cur)) ch.push({ type: 'removed', doc: mk(id, JSON.parse(prev[id])) });
            });
            if (ch.length || first) {
              first = false;
              prev = cur;
              next({ docs, size: docs.length, empty: !docs.length, docChanges: () => ch, metadata: {} });
            }
          },
        };
        listeners.push(l);
        setTimeout(l.fire, 0);
        return () => {
          const i = listeners.indexOf(l);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
      doc(id) {
        return docRef(p + '/' + (id || Math.random().toString(36).slice(2)));
      },
      async add(data) {
        const r = q.doc();
        await r.set(data);
        return r;
      },
    };
    return q;
  }
  const db = { doc: docRef, collection: colRef };
  const user = {
    async id() {
      return uid;
    },
    async can() {
      return true;
    },
    async isOwner() {
      return uid === 'u_host';
    },
    async canEdit() {
      return true;
    },
    async me() {
      return { id: uid, name: '', avatarUrl: '', color: '#888', email: null, isOwner: false, canEdit: true };
    },
    async profiles() {
      return {};
    },
  };
  window.LoveBackend = { use: async n => (n === 'db' ? db : n === 'user' ? user : null), _reset() {}, _normErr: e => e };
};
