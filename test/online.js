// Uji online: dua tab (host & tamu) dengan mock window.LoveBackend (db/user, berbasis localStorage) meniru src/backend.js.
const { chromium } = require('playwright');
const THREE_LOCAL = require('path').resolve(__dirname, 'vendor/three.min.js');
const routeThree = ctx => ctx.route(/three(\.min)?\.js$/, r => r.fulfill({ path: THREE_LOCAL, contentType: 'application/javascript' }));
const http = require('http');
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'out', 'online');
fs.mkdirSync(OUT, { recursive: true });

const MOCK = () => {
  const uid = new URLSearchParams(location.search).get('u');
  if (!uid) return;
  try { localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast', theme: 'system', autoEnd: false })); localStorage.setItem('loveopoly.v2.tour', '"done"'); } catch (e) {}
  const PFX = 'mockdb:';
  const listeners = [];
  const read = p => { const v = localStorage.getItem(PFX + p); return v ? JSON.parse(v) : null; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const mk = (id, d) => ({ id, exists: !!d, data: () => (d ? clone(d) : undefined), metadata: { fromCache: false, hasPendingWrites: false } });
  const notify = () => listeners.slice().forEach(l => { try { l.fire(); } catch (e) { console.error(e); } });
  window.addEventListener('storage', e => { if (e.key && e.key.startsWith(PFX)) notify(); });
  window.__mockWrites = 0;
  function docRef(p) {
    return {
      id: p.split('/').pop(), path: p,
      async get() { return mk(p.split('/').pop(), read(p)); },
      async set(data) {
        // tolak penulisan room sekali (meniru aturan Firestore saat lease host sudah lewat)
        if (window.__denyRoomWrites > 0 && /^rooms\/[^/]+$/.test(p)) { window.__denyRoomWrites--; throw { code: 'permission-denied', message: 'denied' }; }
        window.__mockWrites++; localStorage.setItem(PFX + p, JSON.stringify(data)); setTimeout(notify, 5);
      },
      async update(data) { const cur = read(p); if (!cur) throw { code: 'invalid_argument' }; localStorage.setItem(PFX + p, JSON.stringify(Object.assign(cur, data))); setTimeout(notify, 5); },
      async delete() { localStorage.removeItem(PFX + p); setTimeout(notify, 5); },
      async acquire({ holder, ttlMs }) {
        const k = 'mocklease:' + p, now = Date.now();
        const cur = JSON.parse(localStorage.getItem(k) || 'null');
        if (cur && cur.exp > now && cur.holder !== holder) return { acquired: false, expiresAt: new Date(cur.exp).toISOString() };
        localStorage.setItem(k, JSON.stringify({ holder, exp: now + (ttlMs || 30000) }));
        return { acquired: true, version: 1, holder };
      },
      onSnapshot(next) {
        let last;
        const l = { fire: () => { const d = read(p); const j = JSON.stringify(d); if (j !== last) { last = j; next(mk(p.split('/').pop(), d)); } } };
        listeners.push(l); setTimeout(l.fire, 0);
        return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
      },
      collection(sub) { return colRef(p + '/' + sub); }
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
      where(field, op, value) { return colRef(p, filters.concat([{ field, op, value }])); },
      orderBy() { return q; }, limit() { return q; },
      async get() { const docs = list(); return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map(d => ({ type: 'added', doc: d })), metadata: {} }; },
      onSnapshot(next) {
        let prev = {}, first = true;
        const l = { fire: () => {
          const docs = list(), cur = {};
          docs.forEach(d => { cur[d.id] = JSON.stringify(d.data()); });
          const ch = [];
          docs.forEach(d => { if (!(d.id in prev)) ch.push({ type: 'added', doc: d }); else if (prev[d.id] !== cur[d.id]) ch.push({ type: 'modified', doc: d }); });
          Object.keys(prev).forEach(id => { if (!(id in cur)) ch.push({ type: 'removed', doc: mk(id, JSON.parse(prev[id])) }); });
          if (ch.length || first) { first = false; prev = cur; next({ docs, size: docs.length, empty: !docs.length, docChanges: () => ch, metadata: {} }); }
        } };
        listeners.push(l); setTimeout(l.fire, 0);
        return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
      },
      doc(id) { return docRef(p + '/' + (id || Math.random().toString(36).slice(2))); },
      async add(data) { const r = q.doc(); await r.set(data); return r; }
    };
    return q;
  }
  const db = { doc: docRef, collection: colRef };
  const user = { async id() { return uid; }, async can() { return true; }, async isOwner() { return uid === 'u_host'; }, async canEdit() { return true }, async me() { return { id: uid, name: '', avatarUrl: '', color: '#888', email: null, isOwner: false, canEdit: true }; }, async profiles() { return {}; } };
  window.LoveBackend = { use: async n => (n === 'db' ? db : n === 'user' ? user : null), _reset() {}, _normErr: e => e };
};

const server = http.createServer((req, res) => {
  const f = path.resolve(__dirname, '../dist/test.html');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  fs.createReadStream(f).pipe(res);
}).listen(8127);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await routeThree(ctx);
  await ctx.addInitScript(MOCK);
  const errors = [];
  const mkPage = async (u) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(u + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts|net::|ERR_/.test(m.text())) errors.push(u + ' console: ' + m.text()); });
    await p.goto('http://localhost:8127/?u=' + u);
    await p.waitForSelector('#hOnline');
    return p;
  };
  const results = [];
  const ok = (n, c, d) => results.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
  const host = await mkPage('u_host');
  const guest = await mkPage('u_guest');

  await host.click('#hOnline');
  await host.waitForSelector('#oCreate');
  await host.fill('#oName', 'Arfi');
  await host.click('#oCreate');
  await host.waitForSelector('#codeBox', { timeout: 8000 });
  const code = (await host.textContent('#codeBox')).trim();
  ok('host membuat room', /^[A-Z0-9]{6}$/.test(code), code);
  await host.screenshot({ path: OUT + '/01-host-lobby.png' });

  await guest.click('#hOnline');
  await guest.waitForSelector('#oJoin');
  await guest.fill('#oName', 'Nadia');
  await guest.click('[data-pav="🐰"]');
  await guest.fill('#oName', 'Nadia');
  await guest.fill('#oCode', code);
  await guest.click('#oJoin');
  await host.waitForFunction(() => window.LoveNet.doc && window.LoveNet.doc.seats.length === 2, null, { timeout: 8000 });
  await guest.waitForFunction(() => window.LoveNet.doc && window.LoveNet.mySeat() === 1, null, { timeout: 8000 });
  ok('tamu bergabung & mendapat kursi', true);
  await guest.screenshot({ path: OUT + '/02-guest-lobby.png' });

  await host.click('#oStart', { force: true });
  await host.waitForSelector('#board .tile', { timeout: 8000 });
  await guest.waitForSelector('#board .tile', { timeout: 8000 });
  ok('kedua tab masuk papan', true);

  const settle = async p => { await p.waitForFunction(() => !window.LoveUI.App.animating && !window.LoveUI.App.pending.length, null, { timeout: 15000 }); await p.waitForTimeout(200); };
  const seqOf = p => p.evaluate(() => window.LoveUI.App.S && window.LoveUI.App.S.seq);
  const act = (p, a) => p.evaluate(a => window.LoveUI.act(a), a);
  const MON = () => {
    const vis = el => el && !el.disabled && el.offsetParent !== null;
    const q = s => document.querySelector(s);
    const m = q('#modalRoot:not([hidden]) .modal');
    if (m) {
      const ta = m.querySelector('#chText'); if (ta && ta.value.length < 10) { ta.value = 'Rindu kamu dari jauh!'; ta.dispatchEvent(new Event('input')); }
      const pd = m.querySelector('#bPayDebt');
      if (pd && pd.disabled) { const s = m.querySelector('[data-sell]:not(:disabled)'); if (s) { s.click(); return 'sell'; } }
      for (const s of ['#bTkSkip', '#bBuy', '#bUp', '#bCard', '[data-ch="0"]', '#bPay', '#bTax', '#bDone', '[data-opt="0"]', '#bFail', '#bPayDebt', '#bBk', '#bSkip']) { const el = m.querySelector(s); if (vis(el)) { el.click(); return s; } }
      return 'modal';
    }
    const bar = q('#pickbar');
    if (bar && !bar.hidden) {
      const ok = q('#pbOk'); if (vis(ok)) { ok.click(); return 'pick-ok'; }
      const t = q('#board .tile.pickable'); if (t) { t.click(); return 'pick-tile'; }
      const sk = q('#pbSkip'); if (vis(sk)) { sk.click(); return 'pick-skip'; }
    }
    for (const s of ['#cRoll', '#cEnd', '#cOpen']) { const el = q(s); if (vis(el)) { el.click(); return s; } }
    return null;
  };
  // mainkan bergantian 10 giliran
  let hostActs = 0, guestActs = 0;
  for (let k = 0; k < 140; k++) {
    const a = await host.evaluate(MON); if (a) hostActs++;
    await host.waitForTimeout(140);
    const b = await guest.evaluate(MON); if (b) guestActs++;
    await guest.waitForTimeout(260);
    const r = await host.evaluate(() => window.LoveUI.App.S.round);
    if (r >= 6) break;
  }
  await settle(host); await settle(guest);
  await guest.waitForFunction(() => window.LoveNet.doc && window.LoveNet.doc.state && window.LoveUI.App.S.seq === window.LoveNet.doc.state.seq, null, { timeout: 8000 }).catch(() => {});
  const hs = await seqOf(host), gs = await seqOf(guest);
  ok('state host & tamu sinkron', hs === gs && hs > 5, 'seq host=' + hs + ' tamu=' + gs + ' aksi host=' + hostActs + ' tamu=' + guestActs);
  const same = await Promise.all([host, guest].map(p => p.evaluate(() => JSON.stringify({ c: window.LoveUI.App.S.players.map(x => x.cash), pos: window.LoveUI.App.S.players.map(x => x.pos), own: window.LoveUI.App.S.tiles.map(t => t.owner) }))));
  ok('saldo, posisi, kepemilikan identik', same[0] === same[1]);
  const guestActed = await host.evaluate(() => window.LoveUI.App.S.log.some(l => l.p === 1 && /melempar/.test(l.text)));
  ok('aksi tamu diproses host', guestActed);
  await host.screenshot({ path: OUT + '/03-host-game.png' });
  await guest.screenshot({ path: OUT + '/04-guest-game.png' });

  // giliran tamu: kirim aksi yang sama dua kali (double click)
  await host.evaluate(() => { const S = window.LoveUI.App.S; });
  const ready = () => guest.evaluate(() => { const S = window.LoveUI.App.S; return S.turn.p === 1 && !S.queue.length && !S.turn.rolled && !window.LoveUI.App.animating && !window.LoveNet.sending; });
  for (let k = 0; k < 80; k++) {
    if (await ready()) break;
    await host.evaluate(MON); await host.waitForTimeout(200);
    if (await ready()) break;
    await guest.evaluate(MON); await guest.waitForTimeout(300);
  }
  console.log('DEBUG guest before double:', await guest.evaluate(() => { const S = window.LoveUI.App.S, N = window.LoveNet; return JSON.stringify({ turn: S.turn, q: S.queue, isl: S.players[1].island, sending: N.sending, seat: N.mySeat(), docSeq: N.doc.state.seq, seq: S.seq, check: window.LoveEngine.check(S, { type: 'ROLL', p: 1 }) }); }));
  const before = await guest.evaluate(() => window.LoveUI.App.S.seq);
  const r1 = await act(guest, { type: 'ROLL', p: 1 });
  const r2 = await act(guest, { type: 'ROLL', p: 1 });
  await host.waitForTimeout(1200); await settle(host); await settle(guest);
  const rollsLogged = await host.evaluate(seq => window.LoveUI.App.S.log.filter(l => l.p === 1 && /melempar/.test(l.text)).length, before);
  const after = await guest.evaluate(() => window.LoveUI.App.S.seq);
  ok('aksi ganda ditolak (hanya satu ROLL)', r1 === true && r2 === false && after === before + 1, 'kirim1=' + r1 + ' kirim2=' + r2 + ' seq ' + before + '->' + after);

  // achievement pasangan: host cukup dapat kabar singkat, tamu (pemiliknya) dapat kartu medali
  const watchToasts = ({ cls, key }) => { window[key] = ''; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains(cls)) window[key] += n.textContent + ' | '; }))).observe(document.querySelector('#toasts'), { childList: true }); };
  await host.evaluate(watchToasts, { cls: 'gold', key: '__goldToast' });
  await guest.evaluate(watchToasts, { cls: 'ach-pop', key: '__achCard' });
  await host.evaluate(() => { window.LoveNet.doc.state.players[1].stats.letters = 3; });
  for (let k = 0; k < 40; k++) {
    if (await host.evaluate(() => window.LoveUI.App.S.players[1].achievements.includes('writer'))) break;
    await host.evaluate(MON); await host.waitForTimeout(200);
    await guest.evaluate(MON); await guest.waitForTimeout(300);
  }
  for (let k = 0; k < 40; k++) { if (await guest.evaluate(() => /Penulis Surat/.test(window.__achCard))) break; await guest.evaluate(MON); await guest.waitForTimeout(400); }
  const gToast = await host.evaluate(() => window.__goldToast), gCard = await guest.evaluate(() => window.__achCard), hCard = await host.evaluate(() => !!document.querySelector('.ach-pop'));
  ok('achievement pasangan: host kabar singkat, tamu kartu medali', /Penulis Surat/.test(gToast) && /Penulis Surat/.test(gCard) && !hCard, 'host="' + gToast.slice(0, 60) + '" tamu="' + gCard.slice(0, 60) + '"');
  await settle(host); await settle(guest);

  // intent basi (baseSeq lama) harus ditolak host
  const staleId = await guest.evaluate(async () => {
    const N = window.LoveNet, S = window.LoveUI.App.S;
    const id = 'stale-' + Date.now();
    await N.db.doc('inbox/' + N.uid + '/intents/' + id).set({ room: N.code, action: { type: 'END_TURN', p: 1 }, baseSeq: S.seq - 3, ts: Date.now() });
    return id;
  });
  await host.waitForTimeout(1200);
  const ack = await host.evaluate(id => window.LoveNet.doc.acks[id], staleId);
  ok('intent basi ditolak dengan ack error', typeof ack === 'string' && ack.startsWith('error:'), ack);

  // intent untuk kursi lain (spoof) ditolak
  const spoofId = await guest.evaluate(async () => {
    const N = window.LoveNet, S = window.LoveUI.App.S;
    const id = 'spoof-' + Date.now();
    await N.db.doc('inbox/' + N.uid + '/intents/' + id).set({ room: N.code, action: { type: 'END_TURN', p: 0 }, baseSeq: S.seq, ts: Date.now() });
    return id;
  });
  await host.waitForTimeout(1200);
  const ack2 = await host.evaluate(id => window.LoveNet.doc.acks[id], spoofId);
  ok('aksi atas nama pemain lain ditolak', typeof ack2 === 'string' && ack2.includes('pemain lain'), ack2);

  // tamu menulis dokumen room langsung (mengaku host) -> host tetap host & memulihkan dokumen
  await guest.evaluate(async () => { const N = window.LoveNet; const ref = N.db.doc('rooms/' + N.code); const d = (await ref.get()).data(); d.hostUid = N.uid; d.state.players[1].cash = 999999; await ref.set(d); });
  await host.waitForTimeout(2500);
  const hj = await host.evaluate(async () => { const N = window.LoveNet; const d = (await N.db.doc('rooms/' + N.code).get()).data(); return { stillHost: N.isHost(), docHost: d.hostUid === N.uid, cash: d.state.players[1].cash }; });
  ok('dokumen room yang diubah tamu tidak merebut host', hj.stillHost && hj.docHost && hj.cash !== 999999, JSON.stringify(hj));

  // reconnect tamu
  const seqBefore = await seqOf(host);
  await guest.reload();
  await guest.waitForSelector('#hRejoin', { timeout: 8000 });
  await guest.click('#hRejoin', { force: true });
  await guest.waitForSelector('#board .tile', { timeout: 10000 });
  await settle(guest);
  const gseq = await seqOf(guest);
  ok('tamu reconnect ke room & state pulih', gseq === seqBefore, 'seq ' + gseq + ' vs ' + seqBefore);
  await guest.screenshot({ path: OUT + '/05-guest-rejoin.png' });

  // host yang tulisannya ditolak (lease lewat saat HP di latar) mengambil lease lagi lalu menulis ulang, tidak macet
  await host.evaluate(() => { window.__denyRoomWrites = 1; window.LoveNet.doc.settings = Object.assign({}, window.LoveNet.doc.settings, { probe: 7 }); window.LoveNet.writeRoom(); });
  await guest.waitForFunction(() => window.LoveNet.doc && window.LoveNet.doc.settings && window.LoveNet.doc.settings.probe === 7, null, { timeout: 8000 }).catch(() => {});
  const probe = await guest.evaluate(() => window.LoveNet.doc && window.LoveNet.doc.settings && window.LoveNet.doc.settings.probe);
  const stillHost = await host.evaluate(() => window.LoveNet.isHost());
  ok('host ditolak server: ambil lease lagi & tulis ulang', probe === 7 && stillHost, 'probe=' + probe + ' host=' + stillHost);
  const leaseLeft = await host.evaluate(async () => {
    const k = 'mocklease:rooms/' + window.LoveNet.code + '/locks/host';
    const cur = JSON.parse(localStorage.getItem(k)); cur.exp = Date.now() + 1000; localStorage.setItem(k, JSON.stringify(cur));
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 300));
    return JSON.parse(localStorage.getItem(k)).exp - Date.now();
  });
  ok('kembali ke aplikasi: lease host langsung diperpanjang', leaseLeft > 30000, 'sisa ' + leaseLeft + 'ms');

  console.log(results.join('\n'));
  console.log('ERRORS (' + errors.length + '):', errors.slice(0, 10).join('\n'));
  await browser.close();
  server.close();
  // kode keluar untuk npm test / CI: gagal bila ada FAIL atau error konsol
  process.exit(results.some(r => r.startsWith('FAIL')) || errors.length ? 1 : 0);
})().catch(e => { console.error('ONLINE CRASH', e); server.close(); process.exit(1); });
