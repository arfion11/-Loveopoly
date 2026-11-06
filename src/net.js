/* LOVEOPOLY 2.0 — multiplayer online.
   Arsitektur: host-authoritative di atas Firestore (lewat src/backend.js: LoveBackend.use('db'|'user'|'room')).
   - rooms/<KODE>            : dokumen room (kursi, pengaturan, state game, ack). Hanya host yang menulis.
   - rooms/<KODE>/locks/host : lease host (satu penulis aktif, bisa diambil alih bila host hilang).
   - lobby/<uid>             : permintaan gabung (aturan: hanya pemilik uid yang bisa menulis).
   - inbox/<uid>/intents/<id>: aksi pemain (aturan: identitas pengirim dijamin Firebase Auth).
   Presence (online/offline) di Realtime Database presence/<KODE>/<uid>.
   Host memvalidasi setiap aksi dengan engine yang sama (giliran, saldo, kepemilikan), menolak data basi (baseSeq),
   dan mencatat ack per intent sehingga aksi ganda tidak pernah diterapkan dua kali. */
(function (G) {
  'use strict';
  const UI = G.LoveUI;
  const { App, D, E, toast, esc, ic, store, KEYS, fmt } = UI;
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const LEASE_MS = 45000, RENEW_MS = 15000, POLL_MS = 6000;
  const MSG = {
    offline: 'Layanan online tidak bisa dihubungi. Periksa koneksi internetmu, lalu coba lagi.',
    auth: 'Gagal masuk ke server game. Coba lagi sebentar lagi.',
    full: 'Server sedang penuh untuk hari ini. Coba lagi besok, ya.'
  };

  const clientId = (() => {
    let id = store.get('loveopoly.v1.client', null);
    if (!id) { id = 'c' + Math.random().toString(36).slice(2, 10); store.set('loveopoly.v1.client', id); }
    return id;
  })();

  const Net = {
    db: null, user: null, room: null, named: null, uid: null, canWrite: null,
    initDone: false, avail: false, initErr: '',
    code: '', role: 'none', doc: null, joined: false,
    unsubRoom: null, unsubLobby: null, inboxUnsubs: {}, roomUnsubs: [],
    processed: new Set(), writing: false, dirty: false, leaseTimer: null, pollTimer: null,
    sending: null, lastSync: 0, onlineUids: new Set(), connected: false, kicked: false,

    async init() {
      if (this.initDone) return this.avail;
      this.initDone = true;
      try {
        const B = G.LoveBackend;
        if (!B || typeof B.use !== 'function') { this.initErr = MSG.offline; return false; }
        const [db, user] = await Promise.all([B.use('db'), B.use('user')]);
        this.db = db; this.user = user;
        this.uid = await user.id();
        if (!this.uid) { this.initErr = MSG.auth; return false; }
        this.canWrite = true;
        B.use('room').then(r => { this.room = r; }).catch(() => { this.room = null; });
        // HP di latar menghentikan timer perpanjangan lease: perpanjang segera saat aplikasi terlihat lagi
        document.addEventListener('visibilitychange', () => {
          if (document.hidden || !this.isHost()) return;
          this.renewLease().then(ok => { if (!ok && this.isHost()) this.stepDown('Host dipindahkan ke pemain lain.'); });
        });
        this.avail = true;
        return true;
      } catch (e) {
        const code = e && e.code;
        this.initErr = code === 'sdk-load' || code === 'unavailable' ? MSG.offline : code === 'auth' ? MSG.auth : code === 'resource-exhausted' ? MSG.full
          : 'Gagal menyiapkan mode online: ' + (e && e.message ? e.message : 'tidak diketahui');
        return false;
      }
    },

    isHost() { return this.role === 'host'; },
    isBotSeat(i) { const s = this.doc && this.doc.seats[i]; return !!(s && (s.bot || s.afk)); },
    mySeat() { return this.doc ? this.doc.seats.findIndex(s => s.uid === this.uid && !s.bot) : -1; },

    genCode() { let c = ''; for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return c; },
    roomRef(code) { return this.db.doc('rooms/' + (code || this.code)); },

    async createRoom(profile, settings) {
      let code = '', tries = 0;
      do {
        code = this.genCode(); tries++;
        const s = await this.roomRef(code).get();
        if (!s.exists) break;
      } while (tries < 6);
      const doc = {
        v: 1, code, status: 'lobby', hostUid: this.uid, createdAt: Date.now(), updatedAt: Date.now(),
        settings: settings || {}, seats: [{ uid: this.uid, name: profile.name, avatar: profile.avatar, color: profile.color, bot: false, afk: false }],
        state: null, seq: 0, acks: {}, kicked: []
      };
      await this.roomRef(code).set(doc);
      this.code = code; this.doc = doc; this.joined = true;
      store.set(KEYS.online, { code });
      const ok = await this.becomeHost();
      if (!ok) throw new Error('Gagal mengunci room sebagai host.');
      this.subscribeRoom();
      this.joinPresence();
      return code;
    },

    async joinRoom(code, profile) {
      code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 6) throw new Error('Kode room terdiri dari 6 huruf/angka.');
      const snap = await this.roomRef(code).get();
      if (!snap.exists) throw new Error('Room ' + code + ' tidak ditemukan. Periksa kodenya.');
      const d = snap.data();
      this.code = code; this.doc = d;
      const seat = d.seats.findIndex(s => s.uid === this.uid && !s.bot);
      if (seat < 0) {
        if ((d.kicked || []).includes(this.uid)) throw new Error('Kamu tidak bisa masuk ke room ini.');
        if (d.status !== 'lobby') throw new Error('Permainan di room ini sudah dimulai.');
        if (d.seats.length >= 4) throw new Error('Room penuh (maksimal 4 pemain).');
        if (!profile) throw new Error('Isi profil pemain dulu.');
        await this.db.doc('lobby/' + this.uid).set({ room: code, name: profile.name, avatar: profile.avatar, color: profile.color, ts: Date.now() });
      } else this.joined = true;
      store.set(KEYS.online, { code });
      this.role = 'guest';
      if (d.hostUid === this.uid) await this.becomeHost();
      this.subscribeRoom();
      this.joinPresence();
      this.cleanupOwnIntents();
      return seat;
    },

    async leave() {
      try {
        if (this.doc && this.doc.status === 'lobby' && this.role !== 'host') await this.db.doc('lobby/' + this.uid).delete();
      } catch (e) { /* abaikan */ }
      this.teardown();
      store.del(KEYS.online);
    },
    teardown() {
      if (this.unsubRoom) this.unsubRoom();
      if (this.unsubLobby) this.unsubLobby();
      Object.values(this.inboxUnsubs).forEach(u => u());
      this.roomUnsubs.forEach(u => { try { u(); } catch (e) { /* abaikan */ } });
      if (this.named) { try { this.named.leave(); } catch (e) { /* abaikan */ } }
      clearInterval(this.leaseTimer); clearInterval(this.pollTimer);
      Object.assign(this, { unsubRoom: null, unsubLobby: null, inboxUnsubs: {}, roomUnsubs: [], named: null, role: 'none', doc: null, code: '', joined: false, sending: null, processed: new Set(), kicked: false });
    },

    // ----- langganan room -----
    subscribeRoom() {
      if (this.unsubRoom) this.unsubRoom();
      this.unsubRoom = this.roomRef().onSnapshot(s => this.onRoomSnap(s), e => this.onDbError(e, 'room'));
      clearInterval(this.pollTimer);
      this.pollTimer = setInterval(() => this.poll(), POLL_MS);
    },
    async poll() {
      if (!this.code) return;
      const a = App.S && App.mode === 'online' ? E.actor(App.S) : -1;
      const waitingRemote = this.isHost() ? (a >= 0 && !UI.controls(a) && !this.isBotSeat(a)) : (a < 0 || a !== this.mySeat() || !!this.sending);
      if (Date.now() - this.lastSync < POLL_MS - 500 || !waitingRemote) return;
      try {
        if (this.isHost()) { await this.pollInboxes(); }
        else { const s = await this.roomRef().get(); this.onRoomSnap(s); }
      } catch (e) { /* periodic, abaikan */ }
    },
    onDbError(e, where) {
      const code = e && e.code;
      if (code === 'revoked') { toast('Akses ke room dicabut.', { kind: 'err' }); return; }
      if (code === 'unavailable') { setTimeout(() => { if (where === 'room' && this.code) this.subscribeRoom(); }, 2000); return; }
      if (code === 'permission-denied') { toast('Aksi ditolak server.', { kind: 'err' }); return; }
      if (code === 'resource-exhausted') { toast(MSG.full, { kind: 'err' }); return; }
      toast('Koneksi room bermasalah (' + (code || 'error') + ').', { kind: 'err' });
    },
    onRoomSnap(s) {
      this.lastSync = Date.now();
      if (!s.exists) {
        if (this.code) { toast('Room sudah dihapus host.', { kind: 'err' }); this.teardown(); store.del(KEYS.online); UI.exitToHome(true); }
        return;
      }
      const d = s.data();
      if (this.isHost()) {
        if (d.hostUid === this.uid) return; // host memegang versi terbaru di memori
        // dokumen menyebut host lain: percaya pada kunci host (lease), bukan isi dokumen yang bisa ditulis siapa saja
        this.verifyHostLease(d);
        return;
      }
      this.doc = d;
      // reaksi emoji (di luar state permainan, jadi tidak membuat aksi pemain lain "tertinggal")
      if (d.fx && d.fx.n !== this.fxN) {
        const mine = d.fx.p === this.mySeat() && this.fxSelf > 0;   // emoji sendiri sudah tampil saat dikirim
        if (mine) this.fxSelf--;
        else if (this.fxN != null && d.status === 'playing' && UI.showEmote) UI.showEmote(d.fx.p, d.fx.e);
        this.fxN = d.fx.n;
      }
      if (d.acks && this.emoteIds && this.emoteIds.size) this.emoteIds.forEach(id => { if (d.acks[id]) { this.emoteIds.delete(id); this.db.doc('inbox/' + this.uid + '/intents/' + id).delete().catch(() => {}); } });
      const seat = this.mySeat();
      if (seat >= 0) this.joined = true;
      if (this.joined && seat < 0 && d.status === 'lobby') { this.kicked = true; toast('Kamu sudah tidak ada di room ini.', { kind: 'err' }); }
      // ack untuk aksi yang kita kirim
      if (this.sending && d.acks && d.acks[this.sending.id]) {
        const res = d.acks[this.sending.id];
        const id = this.sending.id;
        this.sending = null;
        if (res !== 'ok') { toast(res.replace(/^error:/, ''), { kind: 'err' }); G.LoveAudio.play('error'); if (UI.refreshModal) UI.refreshModal(); }
        this.db.doc('inbox/' + this.uid + '/intents/' + id).delete().catch(() => {});
      }
      if (d.status === 'lobby') { UI.renderLobby && UI.renderLobby(); return; }
      if (d.state && d.state.v !== 2) {
        toast('Room ini dibuat dengan versi Loveopoly lama. Buat room baru, ya.', { kind: 'err' });
        this.teardown(); store.del(KEYS.online); UI.exitToHome(true);
        return;
      }
      if (d.state) {
        if (!App.S || App.mode !== 'online' || App.net !== this) UI.enterGame('online', seat, d.state);
        else if (d.state.seq > App.S.seq) UI.commit(d.state);
        else { UI.renderHeader(); UI.renderPlayers(); UI.renderCenter(); }
      }
    },

    // ----- presence (opsional) -----
    async joinPresence() {
      let room = this.room;
      if (!room) { try { room = await G.LoveBackend.use('room'); this.room = room; } catch (e) { room = null; } }
      if (!room || !this.code) return;
      try {
        this.named = await room.join('lv-' + this.code.toLowerCase());
        await this.named.presence({ code: this.code, uid: this.uid, client: clientId });
        this.roomUnsubs.push(this.named.onPeers(ch => {
          const set = new Set();
          ch.peers.forEach(p => { const u = p.by || (p.presence && p.presence.uid); if (u && p.presence && p.presence.code === this.code) set.add(u); });
          this.onlineUids = set;
          if (App.S && App.mode === 'online') { UI.renderPlayers(); UI.renderHeader(); }
          UI.renderLobby && this.doc && this.doc.status === 'lobby' && UI.renderLobby();
        }, () => {}));
        this.roomUnsubs.push(this.named.on('sync', m => {
          const seq = m && m.data && m.data.seq;
          if (!this.isHost() && typeof seq === 'number' && App.S && seq > App.S.seq) this.roomRef().get().then(s => this.onRoomSnap(s)).catch(() => {});
        }, () => {}));
        this.roomUnsubs.push(this.named.on('nudge', m => { if (this.isHost()) this.pollInboxes(); }, () => {}));
        this.roomUnsubs.push(this.named.onConnection(c => { this.connected = c; UI.renderHeader(); }, () => {}));
      } catch (e) { this.named = null; }
    },
    isOnline(uid) { if (!this.named) return null; return this.onlineUids.has(uid); },
    presenceChip(i) {
      const s = this.doc && this.doc.seats[i];
      if (!s) return '';
      if (s.bot) return '<span class="chip plain">' + ic('bot') + 'Bot</span>';
      if (s.afk) return '<span class="chip plain">' + ic('bot') + 'Dikendalikan AI</span>';
      const on = this.isOnline(s.uid);
      if (on == null) return '';
      return '<span class="chip ' + (on ? 'mint' : 'plain') + '"><span class="online-dot' + (on ? ' on' : '') + '"></span>' + (on ? 'Online' : 'Offline') + '</span>';
    },
    presenceDot(i) {
      const s = this.doc && this.doc.seats[i];
      if (!s || s.bot) return '';
      if (s.afk) return '<span class="online-dot afk" title="Dikendalikan AI"></span>';
      const on = this.isOnline(s.uid);
      if (on == null) return '';
      return '<span class="online-dot' + (on ? ' on' : '') + '" title="' + (on ? 'Online' : 'Offline') + '"></span>';
    },
    chipHTML() {
      const live = this.named ? this.connected : (Date.now() - this.lastSync < 20000);
      return '<span class="chip ' + (live ? 'mint' : 'plain') + ' net-chip" title="Room online">' + ic('globe') + '<span class="mono">' + esc(this.code) + '</span>' + (this.isHost() ? '<span class="host-tag"> · host</span>' : '') + (this.sending ? ' · mengirim…' : '') + '</span>';
    },

    // ----- host -----
    async becomeHost() {
      const lock = this.db.doc('rooms/' + this.code + '/locks/host');
      const holder = this.uid + ':' + clientId;
      let r;
      try { r = await lock.acquire({ holder, ttlMs: LEASE_MS }); } catch (e) { return false; }
      if (!r || !r.acquired) return false;
      this.role = 'host';
      clearInterval(this.leaseTimer);
      this.leaseTimer = setInterval(async () => {
        try { const rr = await lock.acquire({ holder, ttlMs: LEASE_MS }); if (!rr.acquired) this.stepDown('Host sudah diambil alih perangkat lain.'); } catch (e) { /* coba lagi nanti */ }
      }, RENEW_MS);
      const snap = await this.roomRef().get();
      if (snap.exists) this.doc = snap.data();
      (Object.keys(this.doc.acks || {})).forEach(k => this.processed.add(k));
      if (this.doc.hostUid !== this.uid) { this.doc.hostUid = this.uid; this.writeRoom(); }
      this.subscribeLobby();
      this.syncInboxSubs();
      return true;
    },
    async renewLease() {
      try { const r = await this.db.doc('rooms/' + this.code + '/locks/host').acquire({ holder: this.uid + ':' + clientId, ttlMs: LEASE_MS }); return !!(r && r.acquired); }
      catch (e) { return false; }
    },
    async verifyHostLease(d) {
      if (this.verifying) return;
      this.verifying = true;
      try {
        const r = await this.db.doc('rooms/' + this.code + '/locks/host').acquire({ holder: this.uid + ':' + clientId, ttlMs: LEASE_MS });
        if (r && r.acquired) { if (this.doc) { this.doc.hostUid = this.uid; this.writeRoom(); } }
        else { this.stepDown('Host dipindahkan ke pemain lain.'); this.doc = d; this.onRoomSnap({ exists: true, data: () => d }); }
      } catch (e) { /* jaringan: coba lagi di snapshot berikutnya */ }
      finally { this.verifying = false; }
    },
    stepDown(msg) {
      if (this.role !== 'host') return;
      this.role = 'guest';
      clearInterval(this.leaseTimer);
      if (this.unsubLobby) { this.unsubLobby(); this.unsubLobby = null; }
      Object.values(this.inboxUnsubs).forEach(u => u()); this.inboxUnsubs = {};
      if (msg) toast(msg, { kind: 'lilac', icon: 'globe' });
    },
    async takeOver() {
      if (this.isHost()) return true;
      const ok = await this.becomeHost();
      if (!ok) { toast('Host masih aktif. Coba lagi kalau host benar-benar offline.', { kind: 'err' }); return false; }
      toast('Kamu sekarang host room ini.', { kind: 'good', icon: 'globe' });
      UI.renderAll && App.S && UI.renderAll();
      UI.scheduleAI();
      return true;
    },
    subscribeLobby() {
      if (this.unsubLobby) this.unsubLobby();
      this.unsubLobby = this.db.collection('lobby').where('room', '==', this.code).onSnapshot(snap => {
        if (!this.isHost() || !this.doc || this.doc.status !== 'lobby') return;
        let changed = false;
        snap.docChanges().forEach(ch => {
          const uid = ch.doc.id, data = ch.type === 'removed' ? null : ch.doc.data();
          const idx = this.doc.seats.findIndex(s => s.uid === uid && !s.bot);
          if (ch.type === 'removed') { if (idx > 0) { this.doc.seats.splice(idx, 1); changed = true; } return; }
          if (idx >= 0 || (this.doc.kicked || []).includes(uid)) return;
          if (this.doc.seats.length >= 4) return;
          const name = String(data.name || 'Pemain').trim().slice(0, 16) || 'Pemain';
          const used = this.doc.seats.map(s => s.color), usedAv = this.doc.seats.map(s => s.avatar);
          let color = /^#[0-9a-fA-F]{6}$/.test(data.color || '') && !used.includes(data.color) ? data.color : (D.TOKEN_COLORS.find(c => !used.includes(c)) || D.TOKEN_COLORS[0]);
          let avatar = D.AVATARS.includes(data.avatar) && !usedAv.includes(data.avatar) ? data.avatar : (D.AVATARS.find(a => !usedAv.includes(a)) || D.AVATARS[0]);
          this.doc.seats.push({ uid, name, avatar, color, bot: false, afk: false });
          changed = true;
        });
        if (changed) { this.syncInboxSubs(); this.writeRoom(); UI.renderLobby && UI.renderLobby(); }
      }, e => this.onDbError(e, 'lobby'));
    },
    syncInboxSubs() {
      const want = new Set(this.doc.seats.filter(s => s.uid && !s.bot).map(s => s.uid));
      Object.keys(this.inboxUnsubs).forEach(u => { if (!want.has(u)) { this.inboxUnsubs[u](); delete this.inboxUnsubs[u]; } });
      want.forEach(uid => {
        if (this.inboxUnsubs[uid]) return;
        this.inboxUnsubs[uid] = this.db.collection('inbox/' + uid + '/intents').where('room', '==', this.code).onSnapshot(
          snap => this.handleIntents(uid, snap.docs), e => this.onDbError(e, 'inbox'));
      });
    },
    async pollInboxes() {
      if (!this.isHost() || !this.doc) return;
      for (const s of this.doc.seats) {
        if (!s.uid || s.bot) continue;
        try { const snap = await this.db.collection('inbox/' + s.uid + '/intents').where('room', '==', this.code).get(); this.handleIntents(s.uid, snap.docs); } catch (e) { /* abaikan */ }
      }
    },
    handleIntents(uid, docs) {
      if (!this.isHost()) return;
      this.lastSync = Date.now();
      const list = docs.filter(d => d.exists).map(d => Object.assign({ id: d.id }, d.data())).filter(x => !this.processed.has(x.id)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (!list.length) return;
      list.forEach(x => this.processIntent(uid, x));
      this.writeRoom();
    },
    processIntent(uid, x) {
      this.processed.add(x.id);
      const d = this.doc;
      const seat = d.seats.findIndex(s => s.uid === uid && !s.bot);
      let res = 'ok';
      const a = x.action || {};
      if (seat < 0) res = 'error:Kamu bukan anggota room ini.';
      else if (d.status !== 'playing' || !d.state) res = 'error:Permainan belum dimulai.';
      else if (a.p !== seat) res = 'error:Aksi untuk pemain lain ditolak.';
      else if (a.type === 'EMOTE') { if (!this.setFx(seat, a.e)) res = 'error:Reaksi tidak dikenal.'; }
      else if (x.baseSeq !== d.state.seq) res = 'error:Layarmu tertinggal satu langkah. Coba lagi.';
      else {
        const r = E.dispatch(d.state, a);
        if (!r.ok) res = 'error:' + r.error;
        else { d.state = r.state; d.seq = r.state.seq; UI.commit(r.state); }
      }
      d.acks = d.acks || {};
      d.acks[x.id] = res;
      const keys = Object.keys(d.acks);
      if (keys.length > 40) keys.slice(0, keys.length - 40).forEach(k => delete d.acks[k]);
    },
    applyHost(action) {
      const d = this.doc;
      if (!d || !d.state) return false;
      const r = E.dispatch(d.state, action);
      if (!r.ok) { toast(r.error, { kind: 'err' }); G.LoveAudio.play('error'); return false; }
      d.state = r.state; d.seq = r.state.seq;
      UI.commit(r.state);
      this.writeRoom();
      return true;
    },
    writeRoom() {
      if (!this.isHost() || !this.doc) return;
      this.dirty = true;
      if (this.writing) return;
      this.writing = true;
      (async () => {
        while (this.dirty && this.isHost()) {
          this.dirty = false;
          this.doc.updatedAt = Date.now();
          const body = JSON.parse(JSON.stringify(this.doc));
          let tries = 0;
          for (;;) {
            try { await this.roomRef().set(body); break; }
            catch (e) {
              tries++;
              if (e && e.code === 'unavailable' && tries < 3) { await new Promise(r => setTimeout(r, 400 + Math.random() * 600)); continue; }
              // aturan menolak: lease host lewat (mis. HP di latar). Ambil lagi lalu tulis ulang; gagal = host pindah
              if (e && e.code === 'permission-denied' && tries < 3) {
                if (await this.renewLease()) continue;
                this.stepDown('Host dipindahkan ke pemain lain.');
                break;
              }
              toast('Gagal menyimpan room (' + (e && e.code ? e.code : 'error') + ').', { kind: 'err' });
              break;
            }
          }
          if (this.named && this.doc.state) this.named.emit('sync', { seq: this.doc.state.seq }).catch(() => {});
        }
        this.writing = false;
      })();
    },
    // ----- aksi pemain -----
    // ----- reaksi emoji -----
    setFx(p, e) {
      if (!UI.EMOTES || !UI.EMOTES.includes(e)) return false;
      const d = this.doc;
      d.fx = { n: ((d.fx && d.fx.n) || 0) + 1, p, e };
      this.fxN = d.fx.n;
      if (UI.showEmote) UI.showEmote(p, e);
      return true;
    },
    emote(e) {
      const seat = this.mySeat();
      if (!this.doc || this.doc.status !== 'playing' || seat < 0) return false;
      if (this.isHost()) { if (this.setFx(seat, e)) this.writeRoom(); return true; }
      const id = clientId + '-e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      this.emoteIds = this.emoteIds || new Set();
      this.emoteIds.add(id);
      UI.showEmote && UI.showEmote(seat, e);
      this.fxSelf = (this.fxSelf || 0) + 1;
      this.db.doc('inbox/' + this.uid + '/intents/' + id).set({ room: this.code, action: { type: 'EMOTE', p: seat, e }, baseSeq: 0, ts: Date.now() })
        .then(() => { if (this.named) this.named.emit('nudge', { id }).catch(() => {}); }).catch(() => {});
      return true;
    },
    send(action) {
      if (!this.doc || this.doc.status !== 'playing') return false;
      if (this.isHost()) return this.applyHost(action);
      if (this.sending) { toast('Aksi sebelumnya masih diproses host…', { icon: 'clock' }); return false; }
      const base = this.doc.state && this.doc.state.seq >= App.S.seq ? this.doc.state : App.S;
      const pre = E.dispatch(base, action);
      if (!pre.ok) { toast(pre.error, { kind: 'err' }); G.LoveAudio.play('error'); return false; }
      const id = clientId + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      this.sending = { id, at: Date.now() };
      setTimeout(() => {
        if (this.sending && this.sending.id === id) {
          this.sending = null;
          toast('Host belum merespons. Periksa koneksi, lalu coba lagi.', { kind: 'err', icon: 'globe' });
          if (UI.refreshModal) UI.refreshModal();
          UI.renderHeader();
        }
      }, 12000);
      this.db.doc('inbox/' + this.uid + '/intents/' + id).set({ room: this.code, action, baseSeq: base.seq, ts: Date.now() })
        .then(() => { if (this.named) this.named.emit('nudge', { id }).catch(() => {}); })
        .catch(e => { this.sending = null; toast('Gagal mengirim aksi (' + (e && e.code ? e.code : 'error') + '). Periksa koneksi lalu coba lagi.', { kind: 'err' }); UI.renderHeader(); });
      UI.renderHeader();
      return true;
    },
    async cleanupOwnIntents() {
      try {
        const snap = await this.db.collection('inbox/' + this.uid + '/intents').get();
        snap.docs.forEach(d => { const x = d.data() || {}; if (x.room !== this.code || (this.doc && this.doc.acks && this.doc.acks[d.id])) this.db.doc('inbox/' + this.uid + '/intents/' + d.id).delete().catch(() => {}); });
      } catch (e) { /* abaikan */ }
    },
    // ----- kontrol lobby (host) -----
    addBot() {
      if (!this.isHost() || this.doc.seats.length >= 4) return;
      const used = this.doc.seats.map(s => s.color), usedAv = this.doc.seats.map(s => s.avatar);
      const n = this.doc.seats.filter(s => s.bot).length;
      this.doc.seats.push({ uid: null, name: D.AI_NAMES[n % D.AI_NAMES.length], avatar: D.AVATARS.find(a => !usedAv.includes(a)), color: D.TOKEN_COLORS.find(c => !used.includes(c)), bot: true, ai: 'normal', afk: false });
      this.writeRoom(); UI.renderLobby();
    },
    setBotLevel(i, lvl) { if (!this.isHost()) return; const s = this.doc.seats[i]; if (s && s.bot) { s.ai = lvl; this.writeRoom(); UI.renderLobby(); } },
    removeSeat(i) {
      if (!this.isHost() || i === 0) return;
      const s = this.doc.seats[i];
      if (!s) return;
      if (!s.bot) { this.doc.kicked = (this.doc.kicked || []).concat([s.uid]); }
      this.doc.seats.splice(i, 1);
      this.syncInboxSubs(); this.writeRoom(); UI.renderLobby();
    },
    updateSettings(st) { if (!this.isHost()) return; this.doc.settings = st; this.writeRoom(); },
    startGame() {
      if (!this.isHost()) return false;
      const seats = this.doc.seats;
      if (seats.length < 2) { toast('Butuh minimal 2 pemain.', { kind: 'err' }); return false; }
      const setup = {
        players: seats.map(s => ({ name: s.name, avatar: s.avatar, color: s.color, kind: s.bot ? 'ai' : 'human', ai: s.ai || 'normal', uid: s.uid })),
        settings: Object.assign({}, this.doc.settings, { online: true }),
        first: 'random'
      };
      const S = E.create(setup);
      this.doc.status = 'playing'; this.doc.state = S; this.doc.seq = S.seq;
      this.writeRoom();
      UI.enterGame('online', 0, S);
      return true;
    },
    setAfk(i, on) {
      if (!this.isHost()) return;
      const s = this.doc.seats[i];
      if (!s || s.bot) return;
      s.afk = !!on;
      this.writeRoom();
      toast(on ? s.name + ' sementara dikendalikan AI.' : s.name + ' kembali mengendalikan pionnya.', { icon: 'bot' });
      UI.renderAll(); UI.scheduleAI();
    },
    async deleteRoom() {
      if (!this.isHost()) return;
      try { await this.roomRef().delete(); await this.db.doc('rooms/' + this.code + '/locks/host').delete(); } catch (e) { /* abaikan */ }
      this.teardown(); store.del(KEYS.online);
    }
  };
  G.LoveNet = Net;
})(typeof window !== 'undefined' ? window : globalThis);
