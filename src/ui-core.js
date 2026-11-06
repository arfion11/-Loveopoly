/* LOVEOPOLY 2.0 — UI inti: state aplikasi, tata letak, papan + kamera, pion, dadu, panggung Merpi, animasi, alur giliran & AI */
(function (G) {
  'use strict';
  const D = G.LOVE_DATA, E = G.LoveEngine, AI = G.LoveAI, SND = G.LoveAudio, ART = G.LoveArt;
  const { TILES, GROUPS, RULES } = D;
  const N = E.N;

  const fmt = n => Math.round(Number(n) || 0).toLocaleString('id-ID');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (n, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"></use></svg>';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };
  // Pindah alamat (loveopoly-5b227.web.app → loveopoly.web.app): halaman pengalih di alamat lama mengirim data
  // perangkat lewat #lv-import=<base64url JSON>. Dipasang sebelum pengaturan dibaca. Hanya kunci loveopoly.* yang
  // BELUM ada di alamat baru (tidak pernah menimpa); isinya tetap disaring saat dipakai (passport(), validSave, cleanState).
  const imported = (() => {
    try {
      const m = /[#&]lv-import=([A-Za-z0-9_-]+)/.exec(location.hash || '');
      if (!m) return 0;
      history.replaceState(null, '', location.pathname + location.search);
      const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4))));
      const data = JSON.parse(json);
      let n = 0;
      Object.keys(data || {}).forEach(k => {
        const v = data[k];
        if (!/^loveopoly\.v\d\.[a-z0-9]+$/.test(k) || typeof v !== 'string' || v.length > 200000 || localStorage.getItem(k) != null) return;
        try { JSON.parse(v); localStorage.setItem(k, v); n++; } catch (e) { /* abaikan nilai rusak */ }
      });
      return n;
    } catch (e) { return 0; }
  })();
  // gambar dari state (foto bukti) hanya boleh data URI gambar; selain itu dibuang (state bisa datang dari host
  // online atau impor data, jangan pernah disisipkan apa adanya ke HTML)
  const safeImg = u => (typeof u === 'string' && u.length < 60000 && /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : '');
  const KEYS = { save: 'loveopoly.v2.save', prefs: 'loveopoly.v1.prefs', online: 'loveopoly.v2.online', setup: 'loveopoly.v2.setup', tour: 'loveopoly.v2.tour', guide: 'loveopoly.v2.guide' };
  const reduceMotion = () => { try { return G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const coin = '<i class="coin-ic" aria-hidden="true"></i>';

  const App = {
    S: null, shown: null, mode: 'local', seat: -1,
    pending: [], animating: false,
    prefs: Object.assign({ sound: true, speed: 'normal', aiSpeed: 'normal', theme: 'system', autoEnd: true }, store.get(KEYS.prefs, {})),
    modal: null, focus: -1, aiTimer: null, net: null, rollSpin: 0,
    cashShown: {}, loveShown: {}, turnKey: '', aim: null, threatKeys: null, tour: false, tourPending: false, revealing: false,
    layout: 'wide', cam: { pref: store.get('loveopoly.v2.cam', 'auto') === 'near' ? 'near' : 'auto', pref3d: store.get('loveopoly.v3.cam3d', 'all') === 'near' ? 'near' : 'all', zoomed: false, x: 0, y: 0, s: 1, manualUntil: 0, L: 0, top: 0, bot: 0, outTimer: null }, pick: null, lastLogN: 0
  };

  const SPD = () => (reduceMotion() ? 0.15 : App.prefs.speed === 'fast' ? 0.5 : 1);
  const AISPD = () => (App.prefs.aiSpeed === 'fast' ? 0.45 : App.prefs.aiSpeed === 'slow' ? 1.7 : 1);

  // ---------- kepemilikan kontrol ----------
  function controls(i) {
    if (!App.S || i == null || i < 0 || !App.S.players[i]) return false;
    if (App.mode === 'online') return i === App.seat && !(App.net && App.net.isBotSeat(i));
    return App.S.players[i].kind === 'human';
  }
  function runsAI(i) {
    if (!App.S || i < 0) return false;
    const p = App.S.players[i];
    if (App.mode === 'online') return !!(App.net && App.net.isHost() && App.net.isBotSeat(i));
    return p.kind === 'ai';
  }
  function viewer() {
    const S = App.S;
    if (!S) return 0;
    if (App.mode === 'online') return App.seat;
    const a = E.actor(S);
    if (a >= 0 && S.players[a].kind === 'human') return a;
    if (S.players[S.turn.p].kind === 'human') return S.turn.p;
    const h = S.players.find(p => p.kind === 'human' && !p.bankrupt) || S.players.find(p => p.kind === 'human');
    return h ? h.i : 0;
  }
  const hotseat = () => App.mode !== 'online' && App.S && App.S.players.filter(q => q.kind === 'human').length > 1;
  const pname = i => (App.S && App.S.players[i] ? App.S.players[i].name : 'Bank');
  function setHTML(el, html) {
    if (!el || el._h === html) return false;
    el.innerHTML = html;
    el._h = html;
    return true;
  }
  function restart(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function pulse(el, cls, ms) {
    if (!el) return;
    restart(el, cls);
    clearTimeout(el['_t_' + cls]);
    el['_t_' + cls] = setTimeout(() => el.classList.remove(cls), ms);
  }
  const avatarHTML = (p, cls) => '<span class="av ' + (cls || '') + '" style="--c:' + p.color + '"><span>' + esc(p.avatar) + '</span></span>';

  // ---------- toast & banner ----------
  function toast(text, opts) {
    opts = opts || {};
    const host = $('#toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (opts.kind || '');
    el.setAttribute('role', opts.kind === 'err' ? 'alert' : 'status');
    el.innerHTML = '<span class="t-ic">' + ic(opts.icon || (opts.kind === 'err' ? 'alert' : 'heart')) + '</span><div>' + (opts.title ? '<b>' + esc(opts.title) + '</b>' : '') + '<span>' + esc(text) + '</span></div>';
    host.appendChild(el);
    // batasi 3 toast biasa; kartu achievement di host yang sama tidak ikut terbuang
    const ts = host.querySelectorAll(':scope > .toast');
    for (let k = 0; k < ts.length - 3; k++) ts[k].remove();
    const ms = opts.ms || (opts.kind === 'err' ? 3600 : 2800);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
  }
  let bannerTimer = null;
  function banner(title, sub, kind, ms, artName) {
    const host = $('#boardVP');
    if (!host) return;
    const old = host.querySelector('.banner'); if (old) old.remove();
    clearTimeout(bannerTimer);
    const el = document.createElement('div');
    el.className = 'banner ' + (kind || '');
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="bn-in">' + (artName ? '<span class="bn-art">' + ART.art(artName) + '</span>' : '') + '<div class="bn-txt"><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div></div>';
    host.appendChild(el);
    bannerTimer = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 420); }, ms || 2000);
  }

  // ---------- achievement: kartu medali (antre satu per satu) ----------
  // medali roset emas + pita; tanpa id gradien supaya salinan yang terbang tetap utuh
  const ROSETTE = 'M40 9.5A5.6 5.6 0 0 1 49.75 11.22A5.6 5.6 0 0 1 58.32 16.17A5.6 5.6 0 0 1 64.68 23.75A5.6 5.6 0 0 1 68.07 33.05A5.6 5.6 0 0 1 68.07 42.95A5.6 5.6 0 0 1 64.68 52.25A5.6 5.6 0 0 1 58.32 59.83A5.6 5.6 0 0 1 49.75 64.78A5.6 5.6 0 0 1 40 66.5A5.6 5.6 0 0 1 30.25 64.78A5.6 5.6 0 0 1 21.68 59.83A5.6 5.6 0 0 1 15.32 52.25A5.6 5.6 0 0 1 11.93 42.95A5.6 5.6 0 0 1 11.93 33.05A5.6 5.6 0 0 1 15.32 23.75A5.6 5.6 0 0 1 21.68 16.17A5.6 5.6 0 0 1 30.25 11.22A5.6 5.6 0 0 1 40 9.5Z';
  const achIcon = id => { const a = E.ACH[id]; return a && a.icon in G.LoveIcons.paths ? a.icon : 'trophy'; };
  function medalHTML(icon) {
    return '<span class="medal-art"><svg class="ma-svg" viewBox="0 0 80 92" aria-hidden="true">' +
      '<path d="M28 46 40 53 31 90 25 82 17 86z" fill="#FF4F8B"/><path d="M52 46 40 53 49 90 55 82 63 86z" fill="#7B61FF"/>' +
      '<path d="M34 49.5 40 53 37.6 63z M46 49.5 40 53 42.4 63z" fill="#2A0F3A" opacity=".18"/>' +
      '<path d="' + ROSETTE + '" fill="#FFC93C" stroke="#D38D08" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="40" cy="38" r="21.5" fill="#FFE07A"/>' +
      '<path d="M18.6 40.5a21.5 21.5 0 0 0 42.8 0A24 24 0 0 1 18.6 40.5z" fill="#F2B01F" opacity=".55"/>' +
      '<circle cx="40" cy="38" r="21.5" fill="none" stroke="#FFF6D6" stroke-width="2.2"/>' +
      '<circle cx="40" cy="38" r="17.2" fill="none" stroke="#DE9E12" stroke-width="1.1" stroke-dasharray="1.4 3"/>' +
      '<ellipse cx="31" cy="27.5" rx="6.5" ry="3.4" transform="rotate(-32 31 27.5)" fill="#fff" opacity=".6"/>' +
      '</svg><span class="ma-ic">' + ic(icon) + '</span></span>';
  }
  const achQ = [];
  let achCur = null, achTimer = null, achWait = null;
  // kartu menunggu sampai layar tenang: tidak saat animasi berjalan, dialog keputusan terbuka, atau overlay aktif
  const achOverlay = () => !!(App.modal || $('#pauseOv') || $('#guideOv') || $('#tourOv') || $('#winOv'));
  function achievementFx(e, ns, fresh) {
    const a = E.ACH[e.id], p = ns.players[e.p];
    if (!a || !p) return;
    if (controls(e.p)) {
      achQ.push({ id: e.id, p: e.p, n: Math.max(1, p.achievements.indexOf(e.id) + 1), first: !achQ.length && !achCur, fresh });
      achKick(80);
    } else if (p.kind === 'human') {
      // pencapaian pasangan (online): cukup kabar singkat
      SND.play('ding');
      toast(a.name + ' — ' + a.text, { title: p.name + ' dapat achievement!', icon: achIcon(e.id), kind: 'gold' });
    }
  }
  function achKick(ms) { clearTimeout(achWait); achWait = setTimeout(tryAch, ms); }
  function tryAch() {
    if (achCur || !achQ.length) return;
    if ($('#winOv') || !App.S || !$('#toasts')) { achQ.length = 0; return; }
    if (App.animating || App.pending.length || achOverlay()) { achKick(300); return; }
    showAch(achQ.shift());
  }
  function showAch(it) {
    const host = $('#toasts');
    const a = E.ACH[it.id], p = App.S.players[it.p], total = D.ACHIEVEMENTS.length;
    if (!a || !p) { achKick(0); return; }
    const pct = n => Math.round(Math.min(n, total) / total * 100);
    const el = document.createElement('div');
    el.className = 'ach-pop';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<div class="ap-card">' +
        '<span class="ap-badge" aria-hidden="true"><span class="ap-rays"></span><span class="ap-medal">' + medalHTML(achIcon(it.id)) + '</span>' +
          '<span class="ap-tw t1">' + ic('sparkle') + '</span><span class="ap-tw t2">' + ic('sparkle') + '</span></span>' +
        '<span class="ap-txt">' +
          '<span class="ap-kick">Achievement terbuka!</span>' +
          '<b class="ap-name">' + esc(a.name) + '</b>' +
          '<span class="ap-desc">' + esc(a.text) + '</span>' +
          '<span class="ap-foot"><span class="ap-who">' + avatarHTML(p, 'xs') + '<span>' + esc(p.name) + '</span></span>' +
            '<span class="ap-prog" title="Koleksi achievement"><span class="meter gold"><i style="--v:' + pct(it.n - 1) + '%"></i></span><b>' + it.n + '/' + total + '</b></span></span>' +
        '</span>' +
        '<span class="ap-shine" aria-hidden="true"></span>' +
      '</div>' +
      '<span class="ap-fx" aria-hidden="true"></span>';
    el._p = it.p;
    host.prepend(el);
    achCur = el;
    SND.play('achieve');
    if (it.first && it.fresh) merpiSay(pick(D.MERPI.achieve), 'love', 2200);
    // meter koleksi naik tepat setelah medali mendarat
    setTimeout(() => { const m = el.querySelector('.ap-prog i'); if (m) m.style.setProperty('--v', pct(it.n) + '%'); }, 700);
    if (!reduceMotion()) {
      const cols = ['#FF4F8B', '#FFC93C', '#7B61FF', '#16C2A3', '#47AEFF', '#FF9F43'];
      let h = '';
      for (let k = 0; k < 18; k++) {
        const ang = (k / 18) * Math.PI * 2 + Math.random() * 0.4, sp = 50 + Math.random() * 90;
        const w = k % 3 === 0 ? 8 : 6, ht = k % 3 === 0 ? 8 : 11;
        h += '<i style="--c:' + cols[k % cols.length] + ';--dx:' + Math.round(Math.cos(ang) * sp * 1.5) + 'px;--dy:' + Math.round(Math.sin(ang) * sp * 0.7 - 24) + 'px;--r:' + Math.round(Math.random() * 720 - 360) + 'deg;--w:' + w + 'px;--h:' + ht + 'px;--br:' + (k % 3 === 0 ? '50%' : '2px') + ';--d:' + (0.32 + Math.random() * 0.12).toFixed(2) + 's"></i>';
      }
      el.querySelector('.ap-fx').innerHTML = h;
    }
    el.addEventListener('click', () => achDone(el));
    // dialog yang muncul belakangan tidak boleh tertutup kartu: kartu diselesaikan lebih awal
    el._watch = setInterval(() => { if (achOverlay()) achDone(el); }, 250);
    achTimer = setTimeout(() => achDone(el), Math.round(3600 * Math.max(0.75, SPD())));
  }
  function achDone(el) {
    if (!el || el._done) return;
    el._done = true;
    clearTimeout(achTimer);
    clearInterval(el._watch);
    const live = el.isConnected;
    if (live) { el.classList.add('out'); achFly(el, App.S); }
    setTimeout(() => { el.remove(); if (achCur === el) { achCur = null; achKick(380); } }, live ? 460 : 0);
  }
  // medali "dikoleksi": terbang ke kartu pemain pemiliknya
  function achFly(el, S) {
    if (reduceMotion() || !S || el._p == null) return;
    const src = el.querySelector('.medal-art'), idx = el._p;
    const card = Array.from(document.querySelectorAll('.pcard[data-p="' + idx + '"]')).find(c => c.offsetParent !== null);
    if (!src || !card || typeof src.animate !== 'function') return;
    const tgt = card.querySelector('.av') || card;
    const a = src.getBoundingClientRect(), b = tgt.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const fly = document.createElement('div');
    fly.className = 'ap-fly';
    fly.setAttribute('aria-hidden', 'true');
    fly.innerHTML = src.outerHTML;
    fly.style.cssText = 'left:' + a.left.toFixed(1) + 'px;top:' + a.top.toFixed(1) + 'px;width:' + a.width.toFixed(1) + 'px';
    fly.firstChild.style.setProperty('--mw', a.width.toFixed(1) + 'px');
    document.body.appendChild(fly);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = Math.max(0.28, Math.min(1, (b.width / a.width) * 0.95));
    const lift = Math.min(70, 24 + Math.abs(dx) * 0.12);
    const anim = fly.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + (dx * 0.4).toFixed(1) + 'px,' + (dy * 0.4 - lift).toFixed(1) + 'px) scale(.8) rotate(-14deg)', opacity: 1, offset: 0.42 },
      { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + s.toFixed(2) + ') rotate(0deg)', opacity: 0.35 }
    ], { duration: 760, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
    anim.onfinish = () => {
      fly.remove();
      const now = card.isConnected ? card : Array.from(document.querySelectorAll('.pcard[data-p="' + idx + '"]')).find(c => c.offsetParent !== null);
      pulse(now, 'ach-got', 1100);
      SND.play('ding');
    };
    anim.oncancel = () => fly.remove();
  }
  function clearAch() {
    achQ.length = 0;
    clearTimeout(achTimer);
    clearTimeout(achWait);
    if (achCur) clearInterval(achCur._watch);
    achCur = null;
    $$('.ach-pop, .ap-fly').forEach(x => x.remove());
  }
  const winLabel = x => (x.kind === 'triple' ? 'Trio Warna' : x.kind === 'spots' ? 'Kolektor Wisata' : 'Raja ' + E.sideName(x.side));
  function clearFx() {
    const bn = $('#boardVP .banner'); if (bn) bn.remove();
    clearTimeout(bannerTimer); clearTimeout(merpiTimer);
    clearAch();
    cancelAutoEnd();
    endPick(true);
    App.aim = null; App.threatKeys = null;
    Object.keys(tweens).forEach(k => delete tweens[k]);
    App.cashShown = {}; App.loveShown = {}; App.turnKey = '';
  }

  // ---------- tata letak ----------
  function computeLayout() {
    const w = G.innerWidth, h = G.innerHeight;
    if (h < 600 && w > h) return 'land';
    if (w >= 960 && w >= h * 1.12) return 'wide';
    if (w >= 700 && h >= 700) return 'mid';
    return 'compact';
  }
  // strip kartu mini: ponsel, atau tablet/jendela yang tingginya terbatas
  const miniStrip = () => App.layout === 'compact' || App.layout === 'land' || (App.layout === 'mid' && G.innerHeight < 940);
  // papan 3D (POV ala Get Rich): papan dimiringkan, ilustrasi berdiri sebagai kartu pop-up; bawaannya seluruh papan
  // terlihat & kamera diam ("Dekat" = opsi mengikuti pion), di semua tata letak
  const view3d = () => App.prefs.view3d !== false;
  const usesCam = () => view3d() || App.layout === 'compact' || App.layout === 'land';
  let insetObs = null;
  function watchInsets() {
    if (insetObs || !('ResizeObserver' in G)) return;
    let t = null;
    insetObs = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!App.S || !usesCam()) return;
        const ins = camInsets();
        if (ins.top === App.cam.top && ins.bot === App.cam.bot) return;
        sizeBoard();
      }, 60);
    });
    ['#strip', '#hud'].forEach(sel => { const el = $(sel); if (el) insetObs.observe(el); });
  }
  function applyLayout(force) {
    const g = $('#game');
    if (!g) return;
    watchInsets();
    const lay = computeLayout();
    const sameLay = lay === App.layout;
    App.layout = lay;
    const mini = miniStrip();
    const cls = 'game layout-' + lay + (view3d() ? ' v3d' : '');
    if (!force && sameLay && g.className === cls && App.lastMini === mini) { sizeBoard(); return; }
    App.lastMini = mini;
    g.className = cls;
    placeStage();
    placePlayers();
    sizeBoard();
  }
  let stageEl = null, pickEl = null;
  // desktop/tablet mendatar + papan 3D: panel aksi menjadi panel samping di kolom kanan (seperti HP mendatar),
  // jadi papan memakai seluruh tinggi layar
  const sideHud = () => view3d() && App.layout === 'wide';
  function placeStage() {
    const st = stageEl || $('#stage'); if (!st) return;
    // tombol reaksi: di pojok papan; HP mendatar → pojok kiri bawah layar (kolom pemain) supaya tidak menutupi petak
    const emo = $('#emote'), gEl = $('#game'), vpE = $('#boardVP');
    if (emo && gEl && vpE) { const want = App.layout === 'land' ? gEl : vpE; if (emo.parentNode !== want) want.appendChild(emo); }
    const hud0 = $('#hud'), col = $('.board-col'), right = $('.seat-col.right');
    if (hud0 && col && right) {
      if (sideHud()) { if (hud0.parentNode !== right) right.insertBefore(hud0, $('#slotBR')); }
      else if (hud0.parentNode !== col) col.appendChild(hud0);
    }
    const host = usesCam() ? $('#hud') : $('#board .center');
    if (host && st.parentNode !== host) host.appendChild(st);
    // Merpi besar tampil di tengah papan: Merpi kecil di panel disembunyikan (CSS), gelembung katanya
    // pindah ke atas papan dan mengikuti kepala Merpi besar (lihat trackBubble)
    const bub = $('#bubble'), vpB = $('#boardVP'), slot = $('.st-merpi', st), big = $('#mascot');
    if (bub && vpB && slot) {
      const onBig = !!(big && big.offsetWidth);
      const want = onBig ? vpB : slot;
      if (bub.parentNode !== want) want.appendChild(bub);
      bub.classList.toggle('ms-say', onBig);
      if (onBig && bub.classList.contains('show')) trackBubble();
    }
    const b = $('#board'); if (b) b.classList.toggle('staged', !usesCam());
    // kontrol kamera tidak boleh menutup petak: ponsel potret -> header, ponsel mendatar & panel samping -> panel
    const cc = $('#camCtl'), hud = $('#hud'), vp = $('#boardVP'), mid = $('#hdrMid');
    if (cc && hud && vp && mid) {
      const want = App.layout === 'land' || sideHud() ? hud : App.layout === 'compact' ? mid : vp;
      if (cc.parentNode !== want) { if (want === hud) hud.insertBefore(cc, hud.firstChild); else want.appendChild(cc); }
    }
    // bilah pilih-petak menggantikan panel aksi, tidak pernah menutupi papan
    // (referensi disimpan: papan yang dibangun ulang ikut menghapus isi .center)
    const pb = pickEl || (pickEl = $('#pickbar')), ctr = $('#board .center');
    if (pb && hud && ctr) {
      const want = usesCam() ? hud : ctr;
      if (pb.parentNode !== want) want.appendChild(pb);
    }
  }
  // area papan yang tidak tertutup HUD/strip (ponsel potret: keduanya melayang di atas papan)
  function camInsets() {
    const hud = $('#hud');
    if (App.layout === 'compact') { const st = $('#strip'); return { top: st ? st.offsetHeight + 8 : 0, bot: hud ? hud.offsetHeight + 8 : 0 }; }
    if (sideHud()) return { top: 0, bot: 0 };
    // tablet tegak 3D: dok aksi di bawah papan, tombol kamera di atas
    if (view3d() && App.layout === 'mid') { const cc = $('#camCtl'); return { top: cc && !cc.hidden ? 52 : 0, bot: hud ? hud.offsetHeight + 14 : 0 }; }
    return { top: 0, bot: 0 };
  }
  function sizeBoard() {
    const vp = $('#boardVP'), b = $('#board');
    if (!vp || !b) return;
    const W = vp.clientWidth, H = vp.clientHeight;
    if (!W || !H) return;
    const ins = camInsets();
    App.cam.top = ins.top; App.cam.bot = ins.bot;
    const col = $('.board-col'); if (col) { col.style.setProperty('--hudH', ins.bot + 'px'); col.style.setProperty('--stripH', ins.top + 'px'); }
    const Hv = Math.max(120, H - ins.top - ins.bot);
    // ukuran papan dari ukuran layar saja (bukan tinggi HUD yang berubah-ubah) supaya tidak melompat
    const Hn = App.layout === 'compact' ? Math.max(200, H - 250) : H;
    let L;
    if (view3d()) {
      // ukuran tata letak dipilih supaya saat mengikuti pion skalanya ±1: petak besar & teks tetap tajam
      const tile = Math.max(80, Math.min(118, W / 4.3, Hv / 3.4));
      L = Math.round(tile * 10);
    } else if (usesCam()) {
      L = Math.round(Math.max(560, Math.min(760, Math.min(W, Hn) * 1.8)));
      if (L <= Math.min(W, Hv) * 1.08) L = Math.min(W, Hv);
    } else L = Math.floor(Math.min(W, H - 12));
    const changed = App.cam.L !== L;
    if (changed && App.cam.L) { const k = L / App.cam.L; if (App.cam.fx != null) { App.cam.fx *= k; App.cam.fy *= k; } }
    App.cam.L = L;
    b.style.width = L + 'px';
    b.style.height = L + 'px';
    b.classList.toggle('mini', L < 470);
    vp.classList.toggle('cam3d', view3d());
    b.classList.toggle('b3d', view3d());
    if (!view3d()) { vp.style.perspective = ''; vp.style.perspectiveOrigin = ''; }
    if (view3d()) {
      const wasCam = vp.classList.contains('cam');
      vp.classList.add('cam');
      // bawaan: seluruh papan terlihat & diam (tidak terpotong, tidak bikin pusing); "Dekat" bila dipilih pemain
      if (!wasCam) { App.cam.zoomed = App.cam.pref3d === 'near'; App.cam.fx = null; }
      camApply(false);
    } else if (usesCam() && L > Math.min(W, Hv) * 1.08) {
      const wasCam = vp.classList.contains('cam');
      vp.classList.add('cam');
      if (!wasCam) App.cam.zoomed = !camAuto();
      camApply(false);
    } else {
      vp.classList.remove('cam');
      b.classList.remove('far');
      b.style.transform = '';
      b.style.left = Math.round((W - L) / 2) + 'px';
      b.style.top = Math.round(ins.top + Math.max(0, Hv - L) / 2) + 'px';
    }
    renderCamCtl();
    if (changed && App.S) { $$('.token').forEach(t => { t.style.transition = 'none'; }); renderTokens(); }
  }

  // ---------- kamera (ponsel) ----------
  function camActive() { const vp = $('#boardVP'); return !!(vp && vp.classList.contains('cam')); }
  function camView() {
    const vp = $('#boardVP'), c = App.cam;
    const top = c.top || 0, bot = c.bot || 0;
    return { W: vp.clientWidth, H: vp.clientHeight, top, vh: Math.max(120, vp.clientHeight - top - bot) };
  }
  function camFit() { const v = camView(); return Math.min(v.W, v.vh) / App.cam.L; }
  function camClamp() {
    const c = App.cam, v = camView(), sz = c.L * c.s;
    c.x = sz <= v.W ? (v.W - sz) / 2 : Math.min(0, Math.max(v.W - sz, c.x));
    c.y = sz <= v.vh ? v.top + (v.vh - sz) / 2 : Math.min(v.top, Math.max(v.top + v.vh - sz, c.y));
  }
  function markFar() {
    const b = $('#board');
    if (b) b.classList.toggle('far', camActive() && !App.cam.zoomed && (is3d() || camFit() < 0.82));
  }
  // ---------- kamera 3D ----------
  // satu kemiringan & perspektif untuk "Semua" dan "Dekat" (berpindah mode tidak melompat / bikin pusing):
  // layar tegak lebih landai (30°) supaya papan selebar mungkin, layar datar 38°.
  // perspektif lemah (jarak pandang jauh) supaya baris belakang tidak mengecil banyak, mirip papan isometrik
  const is3d = () => { const vp = $('#boardVP'); return !!(vp && vp.classList.contains('cam3d')); };
  // HP (potret/mendatar) + papan 3D: saat pion berjalan / ada keputusan di petak, kamera mendekat & mengikuti pion
  // (nama & ilustrasi petak jadi besar), lalu kembali menampilkan seluruh papan. Bisa dimatikan di Pengaturan
  const phoneLay = () => App.layout === 'compact' || App.layout === 'land';
  const auto3d = () => is3d() && App.cam.pref3d !== 'near' && phoneLay() && App.prefs.walkCam !== false && !reduceMotion();
  function camRelax() {
    if (!is3d() || !App.cam.zoomed || App.cam.pref3d === 'near') return;
    clearTimeout(App.cam.outTimer);
    App.cam.zoomed = false;
    apply3d(true, 650);
  }
  const persp = v => Math.round(Math.max(1800, v.H * 3.2));
  const tiltOf = v => (v.vh > v.W * 1.05 ? 30 : 38);
  // ruang di atas baris terjauh untuk kartu pop-up yang berdiri (bagian papan, kali skala)
  const HEAD = 0.05, FOOT = 0.018;
  // proyeksi titik papan (bx, by) ke layar untuk fokus, skala, kemiringan & perspektif tertentu
  function proj(bx, by, f, s, cx, cy, d, t) {
    const rx = s * (bx - f.x), ry = s * (by - f.y), z = ry * Math.sin(t), k = d / Math.max(1, d - z);
    return { x: cx + rx * k, y: cy + ry * Math.cos(t) * k };
  }
  // skala terbesar yang memuat seluruh papan miring + kartu berdiri di area terlihat (mode "Semua"),
  // lalu konten dipusatkan rapat (atas & bawah sama), jadi tidak ada ruang kosong sebelah saja
  function fit3d(v, d, t) {
    const L = App.cam.L, f = { x: L / 2, y: L / 2 }, cx = v.W / 2, m = 10;
    const ext = s => {
      const q = [[0, 0], [L, 0], [0, L], [L, L]].map(([x, y]) => proj(x, y, f, s, cx, 0, d, t));
      return { top: Math.min(q[0].y, q[1].y) - L * HEAD * s, bot: Math.max(q[2].y, q[3].y) + L * FOOT * s, left: Math.min(...q.map(p => p.x)), right: Math.max(...q.map(p => p.x)) };
    };
    let lo = 0.05, hi = 1.6;
    for (let k = 0; k < 24; k++) {
      const s = (lo + hi) / 2, e = ext(s);
      const ok = e.left >= m && e.right <= v.W - m && e.bot - e.top <= v.vh - 2 * m && s * (L / 2) * Math.sin(t) < d * 0.8;
      if (ok) lo = s; else hi = s;
    }
    const e = ext(lo);
    return { s: lo, cy: v.top + v.vh / 2 - (e.top + e.bot) / 2 };
  }
  // bidikan kamera per petak (pion berjalan searah jarum jam): perlihatkan petak di depan pion,
  // ax = geser fokus (satuan petak), ay = letak fokus di area terlihat (0 atas .. 1 bawah)
  function camAim(tile) {
    if (tile == null) return { ax: 0, ay: 0.56 };
    const i = ((tile % N) + N) % N;
    if (i < 8) return { ax: -1.3, ay: 0.56 };   // START & baris bawah: berjalan ke kiri
    if (i === 8) return { ax: 0.4, ay: 0.62 };
    if (i < 16) return { ax: 0, ay: 0.64 };     // sisi kiri: menjauh ke atas
    if (i < 24) return { ax: 1.3, ay: 0.57 };   // sudut kiri atas & baris atas: ke kanan
    if (i === 24) return { ax: -0.4, ay: 0.47 };
    return { ax: 0, ay: 0.45 };                 // sisi kanan: mendekat ke bawah
  }
  function apply3d(anim, ms) {
    const b = $('#board'), vp = $('#boardVP'), c = App.cam, v = camView(), L = c.L, unit = L / 10;
    const d = persp(v), deg = tiltOf(v), t = deg * Math.PI / 180, cx = v.W / 2;
    c.deg = deg;
    let fx, fy, s, cy;
    if (c.zoomed) {
      if (c.fx == null) { const S = App.S, a = S ? E.actor(S) : -1, p = S ? S.players[a >= 0 ? a : S.turn.p] : null; const bx = p ? tileBox(p.pos) : { x: L / 2, y: L / 2 }; c.fx = bx.x; c.fy = bx.y; c.ft = p ? p.pos : null; }
      // jangan terlalu jauh keluar papan
      c.fx = Math.max(L * 0.08, Math.min(L * 0.92, c.fx));
      c.fy = Math.max(L * 0.06, Math.min(L * 0.94, c.fy));
      const aim = camAim(c.ft);
      s = 1;
      fy = c.fy;
      cy = v.top + v.vh * aim.ay;
      // tepi kiri/kanan papan menempel ke tepi layar (tidak ada ruang kosong di samping papan saat di sudut)
      const m = 14, lo = (cx - m) / s, hi = L - (v.W - m - cx) / s;
      fx = c.fx + aim.ax * unit;
      fx = lo <= hi ? Math.max(lo, Math.min(hi, fx)) : L / 2;
      c.fx = fx - aim.ax * unit;
      // tepi dekat papan menempel ke bawah area terlihat (tidak ada langit kosong di bawahnya)
      const nearY = proj(fx, L, { x: fx, y: fy }, s, cx, cy, d, t).y, want = v.top + v.vh - 6;
      if (nearY < want) cy = Math.min(v.top + v.vh * 0.86, cy + (want - nearY));
    } else { fx = L / 2; fy = L / 2; const ft = fit3d(v, d, t); s = ft.s; cy = ft.cy; }
    c.s = s;
    const tr = anim && !reduceMotion() ? (ms || 420) + 'ms cubic-bezier(.3,.7,.2,1)' : '';
    // titik hilang ikut bergeser bersama papan (tanpa ini papan sempat "miring ke samping" saat berpindah mode)
    vp.style.transition = tr ? 'perspective-origin ' + tr : 'none';
    vp.classList.toggle('zoom', !!c.zoomed);
    vp.style.perspective = d + 'px';
    vp.style.perspectiveOrigin = cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px';
    b.style.setProperty('--tilt', deg + 'deg');
    b.style.left = '0px'; b.style.top = '0px';
    b.style.transition = tr ? 'transform ' + tr + ', --tilt ' + tr : 'none';
    // scale3d (bukan scale 2D): benda yang berdiri di papan (pion, bangunan, globe) ikut mengecil ke arah z, tidak memanjang
    b.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px) rotateX(' + deg + 'deg) scale3d(' + s.toFixed(4) + ',' + s.toFixed(4) + ',' + s.toFixed(4) + ') translate(' + (-fx).toFixed(1) + 'px,' + (-fy).toFixed(1) + 'px)';
    markFar();
  }
  function camApply(anim, ms) {
    const b = $('#board'); if (!b || !camActive()) return;
    if (is3d()) { apply3d(anim, ms); return; }
    const c = App.cam;
    c.s = c.zoomed ? 1 : camFit();
    camClamp();
    markFar();
    b.style.left = '0px'; b.style.top = '0px';
    b.style.transition = anim && !reduceMotion() ? 'transform ' + (ms || 420) + 'ms cubic-bezier(.3,.7,.2,1)' : 'none';
    b.style.transform = 'translate(' + Math.round(c.x) + 'px,' + Math.round(c.y) + 'px) scale(' + c.s.toFixed(4) + ')';
  }
  const camAuto = () => App.cam.pref !== 'near';
  function camFocus(tile, anim, ms, force) {
    if (!camActive() || !App.cam.zoomed) return;
    if (!force && Date.now() < App.cam.manualUntil) return;
    if (is3d()) { const t = tileBox(tile); App.cam.fx = t.x; App.cam.fy = t.y; App.cam.ft = tile; apply3d(anim, ms); return; }
    const v = camView(), bx = tileBox(tile);
    App.cam.x = v.W / 2 - bx.x;
    App.cam.y = v.top + v.vh / 2 - bx.y;
    camApply(anim, ms);
  }
  // mode otomatis: perbesar saat pion bergerak / ada keputusan di petak, lalu kembali melihat seluruh papan
  function camHold(on, tile) {
    if (!camActive() || App.pick) return;
    if (is3d()) {
      if (!auto3d()) { if (on && tile != null && App.cam.zoomed) camFocus(tile, true, 480, true); return; }
      clearTimeout(App.cam.outTimer);
      if (on) {
        const was = App.cam.zoomed;
        if (!was) { App.cam.zoomed = true; App.cam.manualUntil = 0; App.cam.fx = null; }
        if (tile != null) camFocus(tile, true, was ? 480 : 640, true);
        else if (!was) apply3d(true, 640);
        return;
      }
      // kembali ke seluruh papan sebentar setelah semua beres (tidak langsung, supaya tidak "melompat-lompat")
      App.cam.outTimer = setTimeout(() => {
        if (!camActive() || !App.cam.zoomed || !auto3d() || App.pick || App.animating) return;
        App.cam.zoomed = false;
        apply3d(true, 720);
      }, 900);
      return;
    }
    clearTimeout(App.cam.outTimer);
    if (on) {
      if (!App.cam.zoomed) { App.cam.zoomed = true; App.cam.manualUntil = 0; renderCamCtl(); }
      if (tile != null) camFocus(tile, true, 480, true);
      return;
    }
    if (!camAuto() || is3d()) return;
    App.cam.outTimer = setTimeout(() => {
      if (!camActive() || !App.cam.zoomed || !camAuto() || App.pick || App.animating) return;
      App.cam.zoomed = false;
      camApply(true, 560);
      renderCamCtl();
    }, 700);
  }
  function camSettle() {
    if (!camActive()) return;
    const S = App.S;
    if (!S) return;
    const it = S.queue[0];
    if (is3d()) {
      if (auto3d()) {
        if (it && it.tile != null && ['BUY', 'UPGRADE', 'RENT', 'TAKEOVER'].includes(it.type)) camHold(true, it.tile);
        else camHold(false);
        return;
      }
      if (!App.cam.zoomed || Date.now() < App.cam.manualUntil) return;
      const a = E.actor(S), p = S.players[a >= 0 ? a : S.turn.p];
      camFocus(it && it.tile != null ? it.tile : p.pos, true, 520, true);
      return;
    }
    if (!camAuto()) { const a = E.actor(S); const p = S.players[a >= 0 ? a : S.turn.p]; camFocus(it && it.tile != null ? it.tile : p.pos, true, 450, true); return; }
    if (it && it.tile != null && ['BUY', 'UPGRADE', 'RENT', 'TAKEOVER'].includes(it.type)) camHold(true, it.tile);
    else camHold(false);
  }
  function camToggle() {
    if (is3d()) {
      App.cam.pref3d = App.cam.pref3d === 'near' ? 'all' : 'near';
      App.cam.zoomed = App.cam.pref3d === 'near';
      store.set('loveopoly.v3.cam3d', App.cam.pref3d);
      clearTimeout(App.cam.outTimer);
      App.cam.manualUntil = 0;
      if (App.cam.zoomed) { App.cam.fx = null; camSettle(); apply3d(true, 520); } else apply3d(true, 520);
      renderCamCtl();
      SND.play('click');
      return;
    }
    App.cam.pref = camAuto() ? 'near' : 'auto';
    store.set('loveopoly.v2.cam', App.cam.pref);
    App.cam.manualUntil = 0;
    clearTimeout(App.cam.outTimer);
    if (App.cam.pref === 'near' && App.S) {
      App.cam.zoomed = true;
      const a = E.actor(App.S), p = App.S.players[a >= 0 ? a : App.S.turn.p];
      camFocus(p.pos, true, 420, true);
    } else { App.cam.zoomed = false; camApply(true, 420); }
    renderCamCtl();
    SND.play('click');
  }
  function renderCamCtl() {
    const el = $('#camCtl');
    if (!el) return;
    el.hidden = !camActive();
    const S = App.S, lim = S ? S.settings.roundLimit : 0;
    // 3D: tombol beralih antara "Semua" (lihat seluruh papan) dan "Dekat" (ikuti pion terus);
    // label mengikuti pilihan pemain, bukan zoom sementara saat pion berjalan
    const near = is3d() ? App.cam.pref3d === 'near' : !camAuto();
    setHTML(el, (S ? '<span class="round-chip vp" title="Ronde">' + ic('calendar') + '<span><span class="rc-w">Ronde </span><b>' + S.round + '</b>' + (lim ? '/' + lim : '') + '</span></span>' + newsPillHTML(S) : '') +
      '<button type="button" class="cam-btn" id="camBtn" aria-pressed="' + near + '" aria-label="' + (is3d() ? (near ? 'Lihat seluruh papan' : 'Kamera dekat: ikuti pion') : near ? 'Kamera otomatis: lihat seluruh papan' : 'Kunci kamera dekat') + '">' + ic(near ? 'map' : 'zoomIn') + '<span>' + (near ? 'Semua' : 'Dekat') + '</span></button>');
    const b = $('#camBtn'); if (b) b.onclick = camToggle;
  }
  function bindCamDrag() {
    const vp = $('#boardVP');
    if (!vp || vp._drag) return;
    vp._drag = true;
    let st = null;
    vp.addEventListener('pointerdown', e => {
      if (!camActive() || (e.target.closest && e.target.closest('.cam-btn, .pickbar, .banner'))) return;
      st = { x: e.clientX, y: e.clientY, cx: App.cam.x, cy: App.cam.y, fx: App.cam.fx, fy: App.cam.fy, moved: false, id: e.pointerId };
    });
    vp.addEventListener('pointermove', e => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.moved && Math.hypot(dx, dy) < 8) return;
      st.moved = true;
      App.cam.manualUntil = Date.now() + 5000;
      if (is3d()) {
        if (!App.cam.zoomed || st.fx == null) return;
        App.cam.fx = st.fx - dx / App.cam.s;
        App.cam.fy = st.fy - dy / (App.cam.s * Math.cos((App.cam.deg || 34) * Math.PI / 180));
        apply3d(false);
        return;
      }
      App.cam.x = st.cx + dx; App.cam.y = st.cy + dy;
      camApply(false);
    });
    const end = e => {
      if (!st || (e && e.pointerId !== st.id)) return;
      if (st.moved) { vp._swallow = Date.now(); }
      st = null;
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    vp.addEventListener('click', e => { if (vp._swallow && Date.now() - vp._swallow < 250) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  // ---------- papan ----------
  function tilePos(i) {
    if (i === 0) return { row: 9, col: 9, side: 'corner' };
    if (i < 8) return { row: 9, col: 9 - i, side: 'bottom' };
    if (i === 8) return { row: 9, col: 1, side: 'corner' };
    if (i < 16) return { row: 9 - (i - 8), col: 1, side: 'left' };
    if (i === 16) return { row: 1, col: 1, side: 'corner' };
    if (i < 24) return { row: 1, col: 1 + (i - 16), side: 'top' };
    if (i === 24) return { row: 1, col: 9, side: 'corner' };
    return { row: 1 + (i - 24), col: 9, side: 'right' };
  }
  function cornerSub(t) {
    if (t.type === 'start') return 'Gaji +' + RULES.salary;
    if (t.type === 'island') return 'Terdampar';
    if (t.type === 'fest') return 'Tol ×2';
    if (t.type === 'travel') return 'Terbang';
    return '';
  }
  function dieHTML(id) {
    const pips = { 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [1, 3], [3, 1], [3, 3]], 5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]], 6: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]] };
    let faces = '<div class="face f1"><i class="hrt">' + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.5c0 5.8-7.5 10.4-7.5 10.4z"/></svg>' + '</i></div>';
    for (let f = 2; f <= 6; f++) faces += '<div class="face f' + f + '">' + pips[f].map(([r, c]) => '<i style="grid-area:' + r + '/' + c + '"></i>').join('') + '</div>';
    return '<div class="die-slot"><div class="die" id="' + id + '">' + faces + '</div></div>';
  }
  // papan 3D: ilustrasi, nama & harga berdiri sebagai kartu "pop-up" menghadap kamera (tidak gepeng ikut kemiringan papan)
  // susunan: label (harga/tol atau nama sudut) menempel di atas kartu; kartu berisi ilustrasi + keterangan (hanya saat dekat)
  const popHTML = (t, tag, cap) => '<span class="t-pop" aria-hidden="true">' + (tag || '') + '<span class="tp-card"><span class="tp-art">' + ART.art(t.art) + '</span>' + (cap ? '<span class="tp-cap">' + esc(cap) + '</span>' : '') + '</span></span>';
  function tileInner(t, pos) {
    if (pos.side === 'corner') {
      return '<span class="t-face"><span class="t-art">' + ART.art(t.art) + '</span><span class="t-name">' + esc(t.short) + '</span><span class="t-sub">' + esc(cornerSub(t)) + '</span></span>' + popHTML(t, '<span class="tp-tag tp-cn">' + esc(t.short) + '</span>', cornerSub(t));
    }
    const g = t.group ? GROUPS[t.group] : null;
    const band = '<span class="t-band"></span>';
    let price = '';
    if (t.price) price = '<span class="t-price">' + coin + '<b>' + fmt(t.price) + '</b></span>';
    else if (t.type === 'tax') price = '<span class="t-price muted"><b>10%</b></span>';
    else if (t.type === 'card') price = '<span class="t-price muted"><b>?</b></span>';
    const kind = t.type === 'spot' ? '<span class="t-kind">Wisata</span>' : '';
    void g;
    const tag = price ? price.replace('class="t-price', 'class="tp-tag t-price') : '';
    return '<span class="t-face">' + band + '<span class="t-art">' + ART.art(t.art) + '</span><span class="t-txt">' + kind + '<span class="t-name">' + esc(t.short) + '</span>' + price + '</span></span>' +
      popHTML(t, tag, t.short) +
      '<span class="t-bld" aria-hidden="true"></span><span class="t-own" aria-hidden="true"></span><span class="t-fb" aria-hidden="true"></span>';
  }
  function buildBoard() {
    const b = $('#board');
    b.innerHTML = '';
    // papan 3D: tekan & lepas jari bisa jatuh di elemen berbeda (petak sedikit bergerak), sehingga klik jatuh ke papan.
    // ambil petak di titik lepas supaya ketukan tetap terhitung
    if (!b._tapFix) {
      b._tapFix = true;
      b.addEventListener('click', e => {
        if (e.target !== b || !e.clientX) return;
        const hit = document.elementsFromPoint(e.clientX, e.clientY).map(el => el.closest && el.closest('#board .tile')).find(Boolean);
        if (hit) onTileTap(Number(hit.dataset.i), e);
      });
    }
    TILES.forEach(t => {
      const pos = tilePos(t.i);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tile tt-' + t.type + ' s-' + pos.side + (pos.side === 'corner' ? ' corner' : '');
      el.style.gridArea = pos.row + ' / ' + pos.col;
      // urutan gambar = kedalaman (baris depan di atas). Chrome mengurutkan 3D sendiri, Safari memakai urutan
      // lukis: tanpa ini kartu kolom kiri yang lebih jauh (indeks lebih besar) menimpa label harga kartu di depannya
      el.style.setProperty('--row', pos.row);
      el.style.setProperty('--d', (t.i * 22) + 'ms');
      if (t.group) { el.style.setProperty('--g', GROUPS[t.group].color); el.style.setProperty('--gi', GROUPS[t.group].ink); }
      el.dataset.i = t.i;
      el.setAttribute('aria-label', t.name + (t.type === 'card' ? ', ambil Kartu Cinta' : t.type === 'tax' ? ', bayar 10% aset' : t.type === 'spot' ? ', tempat wisata' : cornerSub(t) ? ', ' + cornerSub(t) : ''));
      el.innerHTML = tileInner(t, pos);
      el.addEventListener('click', e => onTileTap(t.i, e));
      b.appendChild(el);
    });
    const c = document.createElement('div');
    c.className = 'center';
    const still = reduceMotion();
    const plane = '<g fill="#fff" stroke="#3A2B4A" stroke-width="2" stroke-linejoin="round"><path d="M-12 0c0-2 2-3 4-3h14c4 0 8 1.4 8 3s-4 3-8 3H-8c-2 0-4-1-4-3z"/><path d="M0-3-6-12h4l7 9zM0 3l-6 9h4l7-9z" fill="#FF4F8B"/></g>';
    c.innerHTML = '<div class="ctr-amb" aria-hidden="true"></div><div class="center-deco" aria-hidden="true"><svg class="cd-map" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">' +
      '<g class="cd-clouds" fill="#fff" opacity=".7"><ellipse cx="70" cy="80" rx="46" ry="15"/><ellipse cx="96" cy="70" rx="24" ry="15"/><ellipse cx="320" cy="330" rx="50" ry="15"/><ellipse cx="292" cy="320" rx="22" ry="14"/><ellipse cx="330" cy="150" rx="30" ry="10"/></g>' +
      '<path id="cdRoute" d="M70 290 C 120 170, 200 330, 250 210 S 330 90, 340 80" fill="none" stroke="#FF7EAC" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round" opacity=".75"/>' +
      '<path d="M70 300c-8-6-14-12-14-19a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 7-6 13-14 19z" fill="#FF4F8B" stroke="#3A2B4A" stroke-width="2"/>' +
      '<path d="M340 92c-8-6-14-12-14-19a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 7-6 13-14 19z" fill="#7B61FF" stroke="#3A2B4A" stroke-width="2"/>' +
      (still ? '<g class="cd-plane" transform="translate(250 210) rotate(-40)">' + plane + '</g>' : '<g class="cd-plane">' + plane + '<animateMotion dur="9s" repeatCount="indefinite" rotate="auto"><mpath href="#cdRoute"/></animateMotion></g>') +
      '</svg><div class="cd-logo">Loveopoly</div><div class="cd-tag">Long Distance · One Destination</div>' +
      mascotHTML() +
      '<i class="ctr-pt" data-c="tl"></i><i class="ctr-pt" data-c="tr"></i><i class="ctr-pt" data-c="bl"></i><i class="ctr-pt" data-c="br"></i>' +
      '<div class="deck" id="deck"><span class="dk dk3"></span><span class="dk dk2"></span><span class="dk dk1">' + ART.art('card') + '</span></div></div>';
    b.appendChild(c);
    const tk = document.createElement('div');
    tk.className = 'tokens';
    tk.id = 'tokens';
    b.appendChild(tk);
    buildStage();
    placeStage();
    bindEmote();
    const mbody = $('#mascot .ms-body');
    if (mbody) mbody.onclick = () => merpiPoke();
    mascotWake();
    if (!reduceMotion()) {
      b.classList.add('enter');
      setTimeout(() => b.classList.remove('enter'), 1600);
    }
  }
  function buildStage() {
    let st = stageEl || $('#stage');
    if (!st) {
      st = document.createElement('div');
      st.className = 'stage';
      st.id = 'stage';
    }
    stageEl = st;
    const oldBub = $('#boardVP > #bubble'); if (oldBub) oldBub.remove();
    st.innerHTML =
      '<div class="st-top"><span class="round-chip" id="roundChip"></span><span class="news-slot" id="newsSlot"></span></div>' +
      '<div class="st-merpi"><button type="button" class="merpi-btn" id="merpiBtn" aria-label="Merpi, maskot Loveopoly">' + ART.merpi('') + '</button><div class="bubble" id="bubble" role="status" aria-live="polite"></div></div>' +
      '<div class="st-main">' +
      '<div class="turn-line" id="turnLine"></div>' +
      '<div class="dice-tray" id="dice" role="img" aria-label="Dadu">' + dieHTML('die1') + dieHTML('die2') + '</div>' +
      '<div class="status-note" id="statusNote"></div>' +
      '<div class="center-actions" id="centerActions"></div>' +
      '</div>' +
      '<div class="ticker" id="ticker" aria-hidden="true"></div>';
    setDieFace($('#die1', st), 5, false);
    setDieFace($('#die2', st), 2, false);
    const mb = $('#merpiBtn', st);
    if (mb) mb.onclick = () => { merpiPoke(); };
  }

  const tileEl = i => $('#board .tile[data-i="' + i + '"]');
  const LEVEL_ART = ['', 'b1', 'b2', 'b3', 'b4'];
  function tollText(S, i) {
    const r = E.rentInfo(S, i);
    return r ? fmt(r.amount) : '';
  }
  function renderTile(el, S, fx) {
    const i = Number(el.dataset.i), t = TILES[i], st = S.tiles[i];
    if (!t.price) return;
    const owned = st.owner >= 0;
    const o = owned ? S.players[st.owner] : null;
    el.classList.toggle('owned', owned);
    el.classList.toggle('landmark', owned && st.level === 4);
    el.style.setProperty('--oc', owned ? o.color : 'transparent');
    // lencana pemilik
    const own = el.querySelector('.t-own');
    const ownKey = owned ? o.i + ':' + o.avatar + ':' + (st.level === 4 ? 'L' : '') : '';
    if (own && own.dataset.k !== ownKey) {
      own.dataset.k = ownKey;
      own.innerHTML = owned ? '<span style="--c:' + o.color + '">' + esc(o.avatar) + '</span>' + (st.level === 4 ? '<i class="crown">' + ic('crown') + '</i>' : '') : '';
      if (fx && owned) pulse(own, 'pop', 700);
    }
    // bangunan
    const b = el.querySelector('.t-bld');
    const lv = owned && t.type === 'city' ? st.level : 0;
    if (b && b.dataset.l !== String(lv)) {
      const before = Number(b.dataset.l || 0);
      b.dataset.l = lv;
      b.innerHTML = lv ? ART.art(LEVEL_ART[lv]) + '<span class="lv-dots">' + '<i></i>'.repeat(lv) + '</span>' : '';
      if (fx && lv > before) { pulse(b, 'rise', 900); dust(i); }
      if (fx && lv < before) pulse(b, 'shrink', 700);
    }
    // harga / tol
    const txt = owned ? tollText(S, i) : fmt(t.price);
    const html = owned ? '<b>' + txt + '</b>' : coin + '<b>' + txt + '</b>';
    // label kartu 3D: avatar pemilik + tol (mahkota bila landmark), jadi lencana terpisah tidak perlu
    const popH = owned ? (st.level === 4 ? '<i class="tp-crown">' + ic('crown') + '</i>' : '') + '<i class="tp-av">' + esc(o.avatar) + '</i><b>' + txt + '</b>' : html;
    el.querySelectorAll('.t-price').forEach(pr => {
      const h = pr.classList.contains('tp-tag') ? popH : html;
      if (pr._h !== h) { pr.innerHTML = h; pr._h = h; if (fx && owned && pr.classList.contains('tp-tag') && is3d()) pulse(pr, 'pop', 700); }
      pr.classList.toggle('toll', owned);
    });
    // festival
    const fe = el.querySelector('.t-fb');
    const fv = S.festival.tile === i ? '×' + S.festival.mult : '';
    if (fe && fe.dataset.v !== fv) { fe.dataset.v = fv; fe.innerHTML = fv ? ic('party') + '<b>' + fv + '</b>' : ''; el.classList.toggle('fest', !!fv); }
    const lvName = E.LEVEL_NAME[st.level];
    el.setAttribute('aria-label', t.name + (owned ? ', milik ' + o.name + (t.type === 'city' ? ', ' + lvName : '') + ', tol ' + tollText(S, i) : ', kosong, harga ' + fmt(t.price)) + (fv ? ', festival ' + fv : ''));
  }
  function renderBoard(S) {
    S = S || App.S;
    $$('#board .tile').forEach(el => renderTile(el, S, false));
    renderThreats(S);
  }
  function renderThreats(S) {
    const th = E.winThreats(S);
    const mark = {};
    th.forEach(x => { if (!mark[x.tile]) mark[x.tile] = x; });
    $$('#board .tile').forEach(el => {
      const x = mark[el.dataset.i];
      el.classList.toggle('threat', !!x);
      if (x) el.style.setProperty('--tc', S.players[x.p].color);
    });
    const keys = th.map(x => x.p + ':' + x.tile).sort().join('|');
    if (App.threatKeys === keys) return;
    const prev = new Set(App.threatKeys ? App.threatKeys.split('|') : []);
    const fresh = App.threatKeys == null ? [] : th.filter(x => !prev.has(x.p + ':' + x.tile));
    App.threatKeys = keys;
    if (!fresh.length || S.over) return;
    const x = fresh[0], who = S.players[x.p];
    if (controls(x.p) && !hotseat()) banner('Satu petak lagi!', 'Dapatkan ' + TILES[x.tile].name + ' untuk ' + winLabel(x) + '.', 'goal', 2800);
    else banner('Awas, ' + who.name + '!', 'Tinggal ' + TILES[x.tile].name + ' menuju ' + winLabel(x) + '.', 'warn', 2800);
    merpiSay(pick(D.MERPI.threat), 'wow', 2400);
    SND.play('event');
  }
  function flashTile(i) { pulse(tileEl(i), 'flash', 1150); }

  // ---------- dadu ----------
  const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] };
  // saat diam dadu menghadap lurus (hanya dimiringkan 2D), jadi sisi kubus tidak terlihat bertumpuk;
  // saat dilempar baru berguling 3D
  function setDieFace(el, v, spin) {
    if (!el) return;
    const [rx, ry] = FACE_ROT[v] || [0, 0];
    App.rollSpin = spin ? App.rollSpin + 1 : App.rollSpin;
    const k = App.rollSpin % 2 ? 2 : 3;
    const tz = el.id === 'die2' ? 7 : -6;
    el.style.transform = 'rotateZ(' + tz + 'deg) rotateX(' + (rx + 360 * k) + 'deg) rotateY(' + (ry + 360 * k) + 'deg)';
  }
  async function rollDice(d, dbl, aim, hit) {
    const box = $('#dice');
    if (!box) return;
    SND.play('dice');
    const ms = Math.round(950 * SPD());
    box.style.setProperty('--roll', ms + 'ms');
    $$('.die', box).forEach(x => { x.style.transitionDuration = Math.round(ms * 1.05) + 'ms'; });
    $$('.roll-l, .roll-r', box).forEach(b => b.remove());
    box.classList.remove('dbl');
    restart(box, 'rolling');
    setDieFace($('#die1'), d[0], true);
    setDieFace($('#die2'), d[1], false);
    const aimTxt = aim ? (hit ? 'Bidikan tepat' : 'Bidikan meleset') : '';
    box.setAttribute('aria-label', 'Dadu: ' + d[0] + ' + ' + d[1] + ' = ' + (d[0] + d[1]) + (dbl ? ', kembar' : '') + (aim ? ', ' + aimTxt.toLowerCase() : ''));
    await sleep(ms);
    box.classList.remove('rolling');
    // satu grup per sisi dadu (lihat .roll-l/.roll-r di CSS) supaya lencana tidak saling tumpuk
    let html = '<span class="roll-r"><span class="sum-badge"><i>=&nbsp;</i>' + (d[0] + d[1]) + '</span>' + (dbl ? '<span class="dbl-badge">KEMBAR!</span>' : '') + '</span>';
    if (aim) html += '<span class="roll-l"><span class="aim-badge' + (hit ? ' hit' : '') + '" title="' + aimTxt + '">' + ic('target') + '<b>' + (hit ? 'Tepat!' : 'Meleset') + '</b></span></span>';
    box.insertAdjacentHTML('beforeend', html);
    if (dbl) { box.classList.add('dbl'); SND.play('heart'); }
  }

  // ---------- pion ----------
  function tileBox(i) {
    const el = tileEl(i);
    if (!el) return { x: 0, y: 0, w: 10, h: 10 };
    return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2, w: el.offsetWidth, h: el.offsetHeight };
  }
  // titik berdiri pion: di atas ilustrasi petak, supaya nama & harga tetap terbaca
  function tileAnchor(tile) {
    const b = tileBox(tile), side = tilePos(tile).side;
    if (is3d()) {
      // 3D: kartu pop-up berdiri di bagian depan petak; pion berdiri di depannya (baris atas/bawah & sudut)
      // atau di sisi dalam petak (kolom kiri/kanan), jadi kartu tidak pernah menutupi pion
      if (side === 'left') return { x: b.x + b.w * 0.23, y: b.y, w: b.h, v: true };
      if (side === 'right') return { x: b.x - b.w * 0.23, y: b.y, w: b.h, v: true };
      return { x: b.x, y: b.y + b.h * (side === 'corner' ? 0.32 : 0.29), w: b.w };
    }
    if (side === 'bottom') return { x: b.x, y: b.y + b.h * 0.02, w: b.w };
    if (side === 'top') return { x: b.x, y: b.y - b.h * 0.04, w: b.w };
    if (side === 'left') return { x: b.x - b.w * 0.2, y: b.y + b.h * 0.2, w: b.h };
    if (side === 'right') return { x: b.x + b.w * 0.2, y: b.y + b.h * 0.2, w: b.h };
    return { x: b.x, y: b.y + b.h * 0.12, w: b.w };
  }
  const SLOT2 = [[-0.55, 0], [0.55, 0]];
  const SLOT4 = [[-0.5, -0.32], [0.5, -0.32], [-0.5, 0.32], [0.5, 0.32]];
  // kolom kiri/kanan 3D: berjajar ke belakang (searah kedalaman) supaya tetap di sisi dalam petak
  const SLOT2V = [[0, -0.5], [0, 0.5]];
  const SLOT4V = [[-0.3, -0.5], [0.3, -0.5], [-0.3, 0.5], [0.3, 0.5]];
  function tokenXY(pi, tile, n) {
    const a = tileAnchor(tile);
    const S = App.S;
    const here = S ? S.players.filter(p => !p.bankrupt && p.pos === tile).map(p => p.i) : [pi];
    const k = Math.max(0, here.indexOf(pi));
    const many = n != null ? n : here.length;
    if (many <= 1) return { x: a.x, y: a.y };
    const sl = a.v ? (many === 2 ? SLOT2V : SLOT4V) : many === 2 ? SLOT2 : SLOT4;
    const [sx, sy] = sl[k % sl.length];
    const m = Math.min(a.w * 0.62, tokSize * 1.05);
    return { x: a.x + sx * m, y: a.y + sy * m };
  }
  let tokSize = 30;
  function ensureTokens(S) {
    const host = $('#tokens');
    if (!host) return;
    S.players.forEach(p => {
      let el = $('#tok-' + p.i);
      if (!el) {
        el = document.createElement('div');
        el.className = 'token';
        el.id = 'tok-' + p.i;
        el.innerHTML = '<span class="tk"><span class="tk-pin"></span><span class="tk-av"></span><span class="tk-plane">' + ic('plane') + '</span></span><span class="tk-shadow"></span>';
        host.appendChild(el);
      }
      const av = el.querySelector('.tk-av');
      if (av.textContent !== p.avatar) av.textContent = p.avatar;
      el.style.setProperty('--c', p.color);
      el.title = p.name;
    });
    const bw = App.cam.L || ($('#board') ? $('#board').offsetWidth : 600);
    tokSize = view3d() ? Math.max(30, Math.min(66, Math.round(bw * 0.052))) : Math.max(18, Math.min(46, Math.round(bw * 0.046)));
    host.style.setProperty('--ts', tokSize + 'px');
  }
  function placeToken(pi, tile, n) {
    const el = $('#tok-' + pi);
    if (!el) return;
    const { x, y } = tokenXY(pi, tile, n);
    el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  }
  function renderTokens(S) {
    S = S || App.S;
    if (!S) return;
    ensureTokens(S);
    const a = E.actor(S);
    S.players.forEach(p => {
      const el = $('#tok-' + p.i);
      if (!el) return;
      placeToken(p.i, p.pos);
      el.classList.toggle('out', !!p.bankrupt);
      el.classList.toggle('island', !!p.island);
      el.classList.toggle('me', !S.over && p.i === S.turn.p);
      el.style.zIndex = p.i === a ? 4 : p.i === S.turn.p ? 3 : 1;
    });
  }
  function landFx(pi, tile) {
    pulse($('#tok-' + pi), 'land', 560);
    const p = App.S && App.S.players[pi];
    ripple(tile, p ? p.color : null);
    pulse(tileEl(tile), 'stepped', 520);
    if (is3d()) pulse(tileEl(tile), 'landed', 1300);
  }
  async function moveToken(e) {
    const el = $('#tok-' + e.p);
    if (!el) return;
    el.style.zIndex = 6;
    const bd = $('#board'), walker = App.S && App.S.players[e.p];
    if (bd && walker) bd.style.setProperty('--walk', walker.color);
    if (camActive() && !App.cam.zoomed && (!is3d() || auto3d())) { camHold(true, e.from); await sleep(Math.round((is3d() ? 600 : 380) * SPD())); }
    if (e.kind === 'jump' || e.kind === 'fly' || e.steps === 0) {
      const fly = e.kind === 'fly';
      const ms = Math.round((fly ? 1300 : 640) * SPD());
      el.style.setProperty('--fly', ms + 'ms');
      el.style.transition = 'transform ' + ms + 'ms cubic-bezier(.45,0,.25,1)';
      restart(el, fly ? 'plane' : 'fly');
      camFocus(e.to, true, ms);
      mascotLook(e.to);
      placeToken(e.p, e.to, 1);
      SND.play(fly ? 'plane' : 'whoosh');
      await sleep(ms + 30);
      el.classList.remove('fly', 'plane');
      el.style.transition = '';
      landFx(e.p, e.to);
      await sleep(180 * SPD());
      return;
    }
    const n = Math.abs(e.steps), dir = e.steps > 0 ? 1 : -1;
    const per = Math.round((n > 10 ? 120 : 165) * SPD());
    el.style.setProperty('--hop', per + 'ms');
    let pos = e.from;
    for (let k = 0; k < n; k++) {
      pos = (pos + dir + N) % N;
      el.style.transition = 'transform ' + per + 'ms cubic-bezier(.35,.1,.3,1)';
      placeToken(e.p, pos, 1);
      camFocus(pos, true, per + 60);
      mascotLook(pos);
      restart(el, 'hop');
      pulse(tileEl(pos), 'stepped', 380);
      SND.play('step');
      await sleep(per + 10);
    }
    el.classList.remove('hop');
    el.style.transition = '';
    landFx(e.p, e.to);
    await sleep(200 * SPD());
  }

  // ---------- efek di atas papan ----------
  function boardFx(cls, x, y, html, vars, ms) {
    const host = $('#tokens');
    if (!host || reduceMotion()) return null;
    const el = document.createElement('div');
    el.className = cls;
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    if (vars) Object.keys(vars).forEach(k => el.style.setProperty(k, vars[k]));
    if (html) el.innerHTML = html;
    host.appendChild(el);
    setTimeout(() => el.remove(), ms || 1400);
    return el;
  }
  function ripple(tile, color) {
    const b = tileBox(tile);
    boardFx('ripple', b.x, b.y, '', { '--c': color || 'var(--brand)', '--r': Math.round(Math.max(b.w, b.h) * 1.3) + 'px' }, 900);
  }
  // titik kaki & tinggi kartu berdiri sebuah petak (3D), dalam koordinat papan
  function popFoot(tile) {
    const el = tileEl(tile), pop = el && el.querySelector('.t-pop');
    if (!pop || !pop.offsetHeight) return null;
    return { x: el.offsetLeft + pop.offsetLeft, y: el.offsetTop + pop.offsetTop + pop.offsetHeight, h: pop.offsetHeight };
  }
  function flagDrop(tile, color) {
    const b = tileBox(tile);
    const sz = Math.round(Math.max(34, Math.min(84, Math.min(b.w, b.h) * 0.95)));
    // 3D: bendera ditancapkan di atas kartu kota (bukan di titik pion yang menutupinya)
    const f = is3d() ? popFoot(tile) : null;
    if (f) boardFx('flag-drop lift', f.x, f.y, ART.art('flag'), { '--oc': color, '--sz': Math.round(sz * 0.8) + 'px', '--lift': Math.round(f.h * 0.92) + 'px' }, 1400);
    else boardFx('flag-drop', b.x, b.y, ART.art('flag'), { '--oc': color, '--sz': sz + 'px' }, 1400);
    burst(tile, ['#FFD93D', color, '#FFFFFF'], 10);
  }
  function stampDrop(tile, color, text) {
    const b = tileBox(tile);
    const sz = Math.round(Math.max(44, Math.min(110, Math.min(b.w, b.h) * 1.2)));
    boardFx('stamp-drop', b.x, b.y, '<span>' + esc(text) + '</span>', { '--c': color, '--sz': sz + 'px' }, 1500);
  }
  function burst(tile, colors, n) {
    if (reduceMotion()) return;
    const b = tileBox(tile);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = Math.min(b.w, b.h) * (0.6 + Math.random() * 0.6);
      boardFx('spark', b.x, b.y, '', { '--c': colors[k % colors.length], '--dx': Math.round(Math.cos(a) * d) + 'px', '--dy': Math.round(Math.sin(a) * d) + 'px', '--r': Math.round(Math.random() * 360) + 'deg' }, 900);
    }
  }
  function dust(tile) {
    if (reduceMotion()) return;
    const b = tileBox(tile);
    for (let k = 0; k < 6; k++) {
      boardFx('dust', b.x + (k - 2.5) * b.w * 0.14, b.y + b.h * 0.22, '', { '--dx': Math.round((k - 2.5) * 9) + 'px', '--s': (0.6 + Math.random() * 0.6).toFixed(2) }, 900);
    }
  }
  function fireworks(tile) {
    const cols = ['#FF4F8B', '#FFD93D', '#3DDBD9', '#B79CFF', '#FF9F43'];
    burst(tile, cols, 14);
    setTimeout(() => burst(tile, cols, 12), 260 * SPD());
    setTimeout(() => burst(tile, cols, 10), 520 * SPD());
  }
  function stormFx(tile) {
    const b = tileBox(tile);
    boardFx('storm-cloud', b.x, b.y - b.h * 0.35, ic('storm'), { '--sz': Math.round(Math.min(b.w, b.h) * 0.9) + 'px' }, 1400);
  }
  function boardPt(who) {
    if (who === 'bank') {
      const c = $('#board .center');
      return c ? { x: c.offsetLeft + c.offsetWidth / 2, y: c.offsetTop + c.offsetHeight * 0.42 } : null;
    }
    const p = App.S && App.S.players[who];
    return p ? tokenXY(who, p.pos) : null;
  }
  const floatStack = {};
  function bfloat(pi, html, cls) {
    const pt = boardPt(pi);
    if (!pt) return;
    const now = Date.now();
    const st = floatStack[pi] && now - floatStack[pi].t < 900 ? floatStack[pi] : { n: -1 };
    st.n++; st.t = now; floatStack[pi] = st;
    // 3D: diangkat ke atas kepala pion (arah atas layar), bukan digeser ke belakang ke deretan kartu
    if (is3d()) boardFx('bfloat lift ' + cls, pt.x, pt.y, html, { '--lift': Math.round(tokSize * 1.75 + st.n * Math.max(18, tokSize * 0.7)) + 'px' }, 1700);
    else boardFx('bfloat ' + cls, pt.x, pt.y - tokSize * 0.9 - st.n * Math.max(16, tokSize * 0.62), html, null, 1700);
  }
  function flyCoins(from, to, n) {
    if (reduceMotion() || !from || !to) return 0;
    const host = $('#tokens');
    if (!host || typeof host.animate !== 'function') return 0;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    if (dist < 6) return 0;
    const lift = Math.min(160, 40 + dist * 0.3);
    const dur = Math.round((600 + Math.min(420, dist * 0.5)) * SPD());
    const gap = Math.round(70 * SPD());
    for (let k = 0; k < n; k++) {
      const c = document.createElement('i');
      c.className = 'coin';
      host.appendChild(c);
      const jx = (Math.random() - 0.5) * 20, jy = (Math.random() - 0.5) * 14;
      const x0 = from.x + jx, y0 = from.y + jy;
      const cx = (from.x + to.x) / 2 + jx * 1.5, cy = Math.min(from.y, to.y) - lift;
      const frames = [];
      for (let s = 0; s <= 12; s++) {
        const u = s / 12, v = 1 - u;
        const x = v * v * x0 + 2 * v * u * cx + u * u * to.x;
        const y = v * v * y0 + 2 * v * u * cy + u * u * to.y;
        const sc = u < 0.15 ? 0.45 + u / 0.15 * 0.55 : u > 0.82 ? 1 - (u - 0.82) / 0.18 * 0.5 : 1;
        frames.push({ transform: 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + sc.toFixed(2) + ') rotate(' + Math.round(u * 540) + 'deg)', opacity: s === 0 ? 0 : s === 12 ? 0.15 : 1 });
      }
      const a = c.animate(frames, { duration: dur, delay: k * gap, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' });
      a.onfinish = () => c.remove();
      a.oncancel = () => c.remove();
    }
    return dur + (n - 1) * gap;
  }
  function moneyFx(evs, idx, used) {
    const e = evs[idx];
    bfloat(e.p, (e.d > 0 ? '+' : '−') + fmt(Math.abs(e.d)), e.d > 0 ? 'plus' : 'minus');
    if (used.has(idx)) return;
    let partner = -1;
    if (e.d < 0) {
      for (let j = idx + 1; j < Math.min(evs.length, idx + 3); j++) {
        const f = evs[j];
        if (f.t === 'money' && f.d === -e.d && f.p !== e.p) { partner = f.p; used.add(j); break; }
      }
    }
    const amt = Math.abs(e.d);
    const n = Math.max(2, Math.min(8, Math.round(Math.log2(amt / 15 + 1)) + 1));
    let t = 0;
    if (partner >= 0) t = flyCoins(boardPt(e.p), boardPt(partner), n);
    else if (e.d > 0) t = flyCoins(boardPt('bank'), boardPt(e.p), n);
    else flyCoins(boardPt(e.p), boardPt('bank'), n);
    const dest = partner >= 0 ? partner : e.d > 0 ? e.p : -1;
    if (dest >= 0 && t) setTimeout(() => { const tok = $('#tok-' + dest); if (tok && !tok.classList.contains('hop')) pulse(tok, 'land', 560); }, t);
  }

  // ---------- hitung naik uang ----------
  const tweens = {};
  let tweenRaf = 0;
  function tweenCash(pi, d) {
    const cur = App.cashShown[pi];
    if (cur == null) return;
    const to = (tweens[pi] ? tweens[pi].to : cur) + d;
    if (reduceMotion()) { App.cashShown[pi] = to; delete tweens[pi]; $$('[data-cash="' + pi + '"]').forEach(el => { el.textContent = fmt(to); }); return; }
    tweens[pi] = { from: cur, to, t0: performance.now(), dur: Math.round(850 * SPD()) };
    if (!tweenRaf) tweenRaf = requestAnimationFrame(stepTweens);
  }
  function stepTweens(now) {
    tweenRaf = 0;
    Object.keys(tweens).forEach(k => {
      const tw = tweens[k];
      const u = tw.dur ? Math.min(1, Math.max(0, (now - tw.t0) / tw.dur)) : 1;
      const v = Math.round(tw.from + (tw.to - tw.from) * (1 - Math.pow(1 - u, 3)));
      App.cashShown[k] = v;
      $$('[data-cash="' + k + '"]').forEach(el => {
        el.textContent = fmt(v);
        el.classList.toggle('up', u < 1 && tw.to > tw.from);
        el.classList.toggle('down', u < 1 && tw.to < tw.from);
      });
      if (u >= 1) delete tweens[k];
    });
    if (Object.keys(tweens).length) tweenRaf = requestAnimationFrame(stepTweens);
  }

  // ---------- Merpi ----------
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const MOODS = ['happy', 'sad', 'wow', 'love', 'think'];
  let merpiTimer = null, merpiMood = '';
  function merpiSay(text, mood, ms) {
    const m = $('#stage .merpi'), bub = $('#bubble');
    if (!m || !bub) return;
    const big = $('#mascot .merpi');
    const all = big ? [m, big] : [m];
    all.forEach(x => MOODS.forEach(k => x.classList.remove('is-' + k)));
    merpiMood = mood || '';
    if (mood) all.forEach(x => x.classList.add('is-' + mood));
    mascotWake();
    if (mood === 'happy' || mood === 'love') mascotAct('hop', 700);
    else if (mood === 'wow') mascotAct('cheer', 800);
    else if (mood === 'sad') mascotAct('droop', 1000);
    if (text) {
      bub.innerHTML = '<span>' + esc(text) + '</span>';
      restart(bub, 'show');
      trackBubble();
    }
    if (mood === 'happy' || mood === 'wow' || mood === 'love') pulse($('#merpiBtn'), 'jump', 700);
    else if (mood === 'sad') pulse($('#merpiBtn'), 'droop', 900);
    clearTimeout(merpiTimer);
    merpiTimer = setTimeout(() => {
      all.forEach(x => MOODS.forEach(k => x.classList.remove('is-' + k)));
      merpiMood = '';
      bub.classList.remove('show');
    }, ms || 2200);
  }
  function merpiPoke() {
    SND.play('chirp');
    merpiSay(pick(D.MERPI.poke), pick(['happy', 'love', 'wow']), 2600);
    mascotAct('spin', 900);
    mascotEmote(ic('heart'), 1400);
  }

  // ---------- reaksi emoji antar pemain (bukan bagian state permainan; online lewat field fx room) ----------
  const EMOTES = ['😂', '😍', '😱', '😤', '👏', '🥺'];
  const EMOTE_SAY = { '😂': 'Hahaha, kocak!', '😍': 'Uwu, manis banget~', '😱': 'Hah?! Serius?!', '😤': 'Awas ya, nanti dibalas!', '👏': 'Mantap! Tepuk tangan~', '🥺': 'Jangan jahat-jahat dong…' };
  let emoteAt = 0;
  function emoteSender() {
    const S = App.S; if (!S || S.over) return -1;
    if (App.mode === 'online') return App.net ? App.net.mySeat() : -1;
    const cur = S.players[S.turn.p];
    if (cur && cur.kind === 'human' && !cur.bankrupt) return cur.i;
    const h = S.players.find(p => p.kind === 'human' && !p.bankrupt);
    return h ? h.i : -1;
  }
  function sendEmote(e) {
    const now = Date.now();
    if (now - emoteAt < 1200 || !EMOTES.includes(e)) return;
    emoteAt = now;
    const p = emoteSender(); if (p < 0) return;
    if (App.mode === 'online' && App.net) App.net.emote(e); else showEmote(p, e);
  }
  function showEmote(p, e) {
    const S = App.S; if (!S || !S.players[p] || !EMOTES.includes(e)) return;
    SND.play('chirp');
    const pt = boardPt(p);
    if (pt) {
      if (is3d()) boardFx('emote-pop lift', pt.x, pt.y, '<span>' + e + '</span>', { '--lift': Math.round(tokSize * 1.45) + 'px' }, 2000);
      else boardFx('emote-pop', pt.x, pt.y - tokSize * 1.4, '<span>' + e + '</span>', null, 2000);
    }
    document.querySelectorAll('.pcard[data-p="' + p + '"]').forEach(el => pulse(el, 'emoted', 700));
    if (Math.random() < 0.35 && !merpiMood) merpiSay(EMOTE_SAY[e], e === '😍' || e === '👏' ? 'love' : e === '😱' ? 'wow' : e === '🥺' ? 'sad' : 'happy', 1600);
  }
  function bindEmote() {
    const btn = document.getElementById('emoteBtn'), pal = document.getElementById('emotePal');
    if (!btn || btn._b) return;
    btn._b = true;
    pal.innerHTML = EMOTES.map(e => '<button type="button" data-emo="' + e + '" aria-label="Reaksi ' + e + '"><span aria-hidden="true">' + e + '</span></button>').join('');
    // buka/tutup halus: tampilkan dulu (hidden=false), lalu transisi opacity+geser; tutup = transisi lalu hidden
    let tHide = 0;
    const open = () => { clearTimeout(tHide); pal.hidden = false; void pal.offsetWidth; pal.classList.add('on'); btn.setAttribute('aria-expanded', 'true'); };
    const close = () => { if (pal.hidden) return; pal.classList.remove('on'); btn.setAttribute('aria-expanded', 'false'); tHide = setTimeout(() => { pal.hidden = true; }, reduceMotion() ? 0 : 180); };
    btn.addEventListener('click', () => { if (btn.getAttribute('aria-expanded') === 'true') close(); else open(); });
    pal.addEventListener('click', ev => { const t = ev.target.closest('[data-emo]'); if (!t) return; sendEmote(t.dataset.emo); close(); });
    document.addEventListener('pointerdown', ev => { if (!pal.hidden && !ev.target.closest('#emote')) close(); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !pal.hidden) close(); });
    pal.hidden = true;
  }

  // ---------- Merpi besar di tengah papan (ponsel & kamera 3D, menggantikan globe) ----------
  // berdiri tegak di atas alas globe; menoleh ke pion yang aktif, bereaksi lewat gerak (kelas act-*) & ikon emote,
  // tertidur bila lama tidak ada kejadian. Teks tetap di gelembung panel aksi (wilayah aria-live).
  // Semua isi berada di dalam kotak .ms-stand (elemen 3D tidak boleh menjulur keluar kotaknya).
  function mascotHTML() {
    const land = '<g fill="#7FD9AE" stroke="#3A2B4A" stroke-width="2.5" stroke-linejoin="round"><path d="M50 60c10-12 30-14 40-6 6 5 2 12-6 14-8 2-6 10 2 14 6 3 4 12-6 12-10 0-16 8-24 4-10-5-14-26-6-38z"/><path d="M122 48c14-2 28 6 34 18 3 7-4 9-10 6-7-4-14 0-12 8 2 7-6 10-12 4-6-6-14-6-14-16 0-10 6-18 14-20z"/><path d="M104 126c10-4 24 0 30 10 5 9-2 22-12 26-9 4-16-2-16-10 0-6-8-8-8-14 0-6 0-10 6-12z"/><path d="M40 122c8-3 16 2 16 9s-8 10-14 7-8-13-2-16z"/></g>';
    // globe hidup: benua & awan berputar pelan di bawah bayangan siang-malam yang diam (terlihat seperti bola
    // dari atas), cincin putus-putus berputar berlawanan. Efek Kabar Merpi (pesawat promo, cincin Musim Puncak)
    // hanya tampil sesuai body[data-amb] / body.amb-peak (lihat renderAmbience)
    const plane = '<g fill="#fff" stroke="#3A2B4A" stroke-width="2" stroke-linejoin="round"><path d="M-12 0c0-2 2-3 4-3h14c4 0 8 1.4 8 3s-4 3-8 3H-8c-2 0-4-1-4-3z"/><path d="M0-3-6-12h4l7 9zM0 3l-6 9h4l7-9z" fill="#FF4F8B"/></g>';
    const clouds = '<g class="ms-clouds" fill="#fff" opacity=".8"><ellipse cx="70" cy="40" rx="18" ry="6"/><ellipse cx="80" cy="36" rx="9" ry="6"/><ellipse cx="150" cy="120" rx="16" ry="5"/><ellipse cx="60" cy="150" rx="14" ry="5"/><ellipse cx="135" cy="70" rx="10" ry="4"/></g>';
    const heart = '<svg viewBox="0 0 24 22"><path d="M12 21C5 15.6 1 11.8 1 7.2A5.7 5.7 0 0 1 12 4.6 5.7 5.7 0 0 1 23 7.2c0 4.6-4 8.4-11 13.8z" fill="#FF4F8B" stroke="#3A2B4A" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const many = (n, h, cls) => Array.from({ length: n }, (_, k) => '<i class="' + cls + '" style="--k:' + k + '">' + h + '</i>').join('');
    return '<div class="mascot" id="mascot">' +
      '<div class="ms-mat" aria-hidden="true"><svg viewBox="0 0 200 200"><defs>' +
        '<radialGradient id="msOcean" cx="40%" cy="36%" r="72%"><stop offset="0" stop-color="#A9E0FF"/><stop offset=".6" stop-color="#5DB6F5"/><stop offset="1" stop-color="#3A8FDB"/></radialGradient>' +
        '<radialGradient id="msShade" cx="34%" cy="30%" r="80%"><stop offset=".5" stop-color="#1B1035" stop-opacity="0"/><stop offset="1" stop-color="#1B1035" stop-opacity=".42"/></radialGradient>' +
        '<clipPath id="msClip"><circle cx="100" cy="100" r="84"/></clipPath></defs>' +
        '<circle class="ms-peak" cx="100" cy="100" r="97" fill="none" stroke="#FFC93C" stroke-width="5"/>' +
        '<circle cx="100" cy="100" r="94" fill="#fff" stroke="#3A2B4A" stroke-width="3"/>' +
        '<circle cx="100" cy="100" r="84" fill="url(#msOcean)"/>' +
        '<g clip-path="url(#msClip)"><g class="ms-land">' + land + '</g>' + clouds + '</g>' +
        '<circle cx="100" cy="100" r="84" fill="url(#msShade)"/>' +
        '<ellipse cx="70" cy="62" rx="22" ry="12" fill="#fff" opacity=".28" transform="rotate(-32 70 62)"/>' +
        '<circle cx="100" cy="100" r="84" fill="none" stroke="#3A2B4A" stroke-width="2.5"/>' +
        '<g class="ms-ring"><circle cx="100" cy="100" r="89" fill="none" stroke="#FF7EAC" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/></g>' +
        '<g class="ms-orbit"><path d="M100 22a78 78 0 0 1 60 28" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round" opacity=".85"/><g transform="translate(100 22) scale(1.7)">' + plane + '</g></g>' +
      '</svg></div>' +
      '<div class="ms-shadow" aria-hidden="true"></div>' +
      '<div class="ms-stand">' +
        // belakang Merpi: matahari (liburan), awan hujan
        '<div class="ms-fxb" aria-hidden="true">' +
          '<span class="fx-holiday"><span class="fx-sun"><svg viewBox="0 0 100 100"><g class="fx-rays" stroke="#FFC93C" stroke-width="7" stroke-linecap="round">' + Array.from({ length: 10 }, (_, k) => '<path d="M50 6v10" transform="rotate(' + k * 36 + ' 50 50)"/>').join('') + '</g><circle cx="50" cy="50" r="24" fill="#FFD54A" stroke="#C98D06" stroke-width="3"/><path d="M41 52q9 8 18 0" fill="none" stroke="#7A4A00" stroke-width="3" stroke-linecap="round"/><circle cx="42" cy="45" r="2.6" fill="#7A4A00"/><circle cx="58" cy="45" r="2.6" fill="#7A4A00"/></svg></span></span>' +
          '<span class="fx-rain"><span class="fx-cloud"><svg viewBox="0 0 100 46"><path d="M18 42c-9 0-14-6-14-12 0-7 6-12 13-12 2-9 10-14 19-14 9 0 16 5 19 12 3-2 6-3 9-3 9 0 15 6 15 14h1c7 0 12 4 12 8s-5 7-12 7z" fill="#C9D3E6" stroke="#3A2B4A" stroke-width="3" stroke-linejoin="round"/></svg></span></span>' +
        '</div>' +
        '<div class="ms-look"><div class="ms-body" title="Merpi">' + ART.merpi('') + '</div></div>' +
        // depan Merpi: payung & hujan, label diskon, koin, hati
        '<div class="ms-fx" aria-hidden="true">' +
          '<span class="fx-rain"><span class="fx-umb"><svg viewBox="0 0 64 44"><path d="M3 26C5 12 17 4 32 4s27 8 29 22c-4-3-8-3-12 0-4-3-8-3-12 0-4-3-8-3-12 0-4-3-8-3-12 0-4-3-8-3-11 0z" fill="#7B61FF" stroke="#3A2B4A" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 26c1-9 5-18 12-22M44 26c-1-9-5-18-12-22" fill="none" stroke="#3A2B4A" stroke-width="2" opacity=".5"/><path d="M32 4v32c0 5-7 5-7 0" fill="none" stroke="#3A2B4A" stroke-width="2.8" stroke-linecap="round"/></svg></span>' + many(7, '', 'fx-drop') + '</span>' +
          '<span class="fx-sale">' + many(4, '%', 'fx-tag') + '</span>' +
          '<span class="fx-bonus">' + many(5, '', 'fx-coin') + '</span>' +
          '<span class="fx-love">' + many(5, heart, 'fx-heart') + '</span>' +
        '</div>' +
      '<div class="ms-emote" aria-hidden="true"></div></div></div>';
  }
  // suasana Kabar Merpi & Musim Puncak: satu atribut di <body> mengatur warna tengah papan, latar halaman (diam,
  // hanya berganti warna lembut) dan efek di sekitar Merpi; kosong = kembali ke default
  function renderAmbience(S) {
    const b = document.body;
    const n = S && !S.over ? E.newsInfo(S) : null, peak = !!(S && !S.over && E.peakOn(S));
    const amb = n ? n.id : peak ? 'peak' : '';
    if ((b.dataset.amb || '') !== amb) { if (amb) b.dataset.amb = amb; else delete b.dataset.amb; }
    b.classList.toggle('amb-peak', peak);
  }
  const MS_ACTS = ['hop', 'droop', 'spin', 'fly', 'cheer', 'shake', 'peek'];
  let msActT = null, msEmoT = null, msSleepT = null;
  function mascotAct(act, ms) {
    const m = $('#mascot');
    if (!m || reduceMotion()) return;
    MS_ACTS.forEach(a => m.classList.remove('act-' + a));
    void m.offsetWidth;
    m.classList.add('act-' + act);
    clearTimeout(msActT);
    msActT = setTimeout(() => m.classList.remove('act-' + act), ms || 800);
  }
  function mascotEmote(html, ms) {
    const e = $('#mascot .ms-emote');
    if (!e) return;
    mascotWake();
    e.innerHTML = html;
    restart(e, 'show');
    clearTimeout(msEmoT);
    msEmoT = setTimeout(() => e.classList.remove('show'), ms || 1600);
  }
  // tertidur setelah 30 detik tanpa kejadian; bangun lagi saat ada kejadian atau diketuk
  function mascotWake() {
    const m = $('#mascot');
    if (!m) return;
    if (m.classList.contains('sleep')) {
      m.classList.remove('sleep');
      const mp = $('.merpi', m); if (mp) mp.classList.remove('is-sleep');
      const e = $('.ms-emote', m); if (e) e.classList.remove('show', 'zz');
    }
    clearTimeout(msSleepT);
    msSleepT = setTimeout(() => {
      const mm = $('#mascot');
      if (!mm || !App.S || App.S.over || merpiMood) return;
      mm.classList.add('sleep');
      const mp = $('.merpi', mm); if (mp) mp.classList.add('is-sleep');
      const e = $('.ms-emote', mm);
      if (e) { e.innerHTML = '<span class="ms-zz">z<i>z</i><b>Z</b></span>'; e.classList.add('show', 'zz'); }
    }, 30000);
  }
  // gelembung kata di atas kepala Merpi besar: 2D di atas papan (teks tetap tajam & seukuran, tidak ikut
  // kemiringan/skala kamera), posisinya mengikuti Merpi tiap frame selama tampil. Gelembung selalu di dalam
  // area tengah papan (tidak menutupi petak) dan tidak menutupi Merpi: batasnya trapesium dari 4 titik sudut
  // .center (.ctr-pt) yang sudah terproyeksi kamera, dipotong area papan yang terlihat; dicoba beberapa letak
  // (atas-kanan, atas, atas-kiri, bawah kaki). Bila tidak ada yang muat (kamera mendekat ke pion),
  // gelembung cukup menempel di tepi area terlihat.
  let bubRaf = 0;
  function trackBubble() {
    cancelAnimationFrame(bubRaf);
    const step = () => {
      const bub = $('#bubble'), body = $('#mascot .ms-body'), vp = $('#boardVP');
      if (!bub || !body || !vp || !bub.classList.contains('ms-say') || !bub.classList.contains('show')) return;
      const r = body.getBoundingClientRect(), v = vp.getBoundingClientRect(), ins = camInsets() || { top: 0, bot: 0 };
      const m = 8, pad = 8;
      const pt = k => { const e = $('#board .center .ctr-pt[data-c="' + k + '"]'); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left - v.left, y: q.top - v.top }; };
      const tl = pt('tl'), tr = pt('tr'), bl = pt('bl'), br = pt('br');
      const vTop = ins.top + m, vBot = v.height - ins.bot - m;
      // kotak Merpi (diciutkan sedikit: ujung sayap & ruang kosong SVG boleh tertutup)
      const mx = r.left - v.left, my = r.top - v.top, mw = r.width, mh = r.height;
      const mb = { l: mx + mw * 0.2, t: my + mh * 0.16, r: mx + mw * 0.8, b: my + mh * 0.95 };
      let bw = bub.offsetWidth, bh = bub.offsetHeight;
      let x = mx + mw * 0.6, y = my + mh * 0.16;
      let placed = false;
      if (tl && tr && bl && br) {
        const yMin = Math.max(tl.y + pad, vTop), yMax = Math.min(bl.y - pad, vBot);
        const span = yt => { const t = (yt - tl.y) / Math.max(1, bl.y - tl.y); return [Math.max(m, tl.x + (bl.x - tl.x) * t + pad), Math.min(v.width - m, tr.x + (br.x - tr.x) * t - pad)]; };
        // lebar maksimum = lebar area tengah setinggi kepala Merpi
        const [hl, hr] = span(Math.max(yMin, my));
        if (hr - hl >= 110) {
          const maxW = Math.min(260, Math.floor(hr - hl));
          if (bub._mw !== maxW) { bub._mw = maxW; bub.style.maxWidth = maxW + 'px'; bw = bub.offsetWidth; bh = bub.offsetHeight; }
          // kandidat (x kiri, y bawah gelembung): atas-kanan kepala, atas tengah, atas-kiri, di bawah kaki
          const cands = [[mx + mw * 0.58, my + mh * 0.16], [mx + mw / 2 - bw / 2, my + mh * 0.12], [mx + mw * 0.42 - bw, my + mh * 0.16], [mx + mw / 2 - bw / 2, my + mh + bh + 4]];
          for (const [cx0, cy0] of cands) {
            if (cy0 - bh < yMin || cy0 > yMax) continue;
            const [xl, xr] = span(cy0 - bh);
            if (xr - xl < bw) continue;
            const cx = Math.max(xl, Math.min(xr - bw, cx0));
            const hit = cx < mb.r && cx + bw > mb.l && cy0 - bh < mb.b && cy0 > mb.t;
            if (hit) continue;
            x = cx; y = cy0; placed = true; break;
          }
        }
      }
      if (!placed) {
        if (bub._mw) { bub._mw = 0; bub.style.maxWidth = ''; bw = bub.offsetWidth; bh = bub.offsetHeight; }
        x = Math.max(m, Math.min(v.width - bw - m, x));
        y = Math.max(vTop + bh, Math.min(vBot, y));
      }
      bub.style.left = x.toFixed(1) + 'px';
      bub.style.top = y.toFixed(1) + 'px';
      bubRaf = requestAnimationFrame(step);
    };
    step();
  }
  // menoleh ke petak: --lx -1 (kiri) .. 1 (kanan), --ly -1 (belakang/atas) .. 1 (depan/bawah)
  function mascotLook(tile) {
    const m = $('#mascot'), b = $('#board');
    if (!m || !b) return;
    let lx = 0, ly = 0;
    if (tile != null) {
      const a = tileAnchor(tile), W = b.offsetWidth || 1, H = b.offsetHeight || 1;
      lx = Math.max(-1, Math.min(1, (a.x - W / 2) / (W * 0.36)));
      ly = Math.max(-1, Math.min(1, (a.y - H / 2) / (H * 0.36)));
    }
    m.style.setProperty('--lx', lx.toFixed(2));
    m.style.setProperty('--ly', ly.toFixed(2));
  }
  const fill = (s, S) => s.replace('{n}', S && S.players[S.turn.p] ? S.players[S.turn.p].name : '');

  // ---------- header, pemain, panggung ----------
  function renderHeader(S) {
    S = S || App.S;
    const mid = $('#hdrMid');
    if (!mid) return;
    let net = $('#hdrNet');
    if (!net) { net = document.createElement('span'); net.id = 'hdrNet'; net.className = 'hdr-net'; mid.insertBefore(net, mid.firstChild); }
    const on = !!(S && App.mode === 'online' && App.net);
    setHTML(net, on ? App.net.chipHTML() : '');
    mid.classList.toggle('net-on', on);
  }
  function playerCardHTML(S, p, compact) {
    const tier = E.tierInfo(p.love);
    const cities = E.citiesOf(S, p.i).length, spots = E.spotsOf(S, p.i).length;
    const nw = E.netWorth(S, p.i);
    const active = p.i === S.turn.p && !S.over;
    const tags = [];
    if (p.bankrupt) tags.push('<span class="tag warn">' + ic('alert') + 'Bangkrut</span>');
    if (p.island) tags.push('<span class="tag sea">' + ic('island') + 'Pulau Rindu</span>');
    if (p.tour) tags.push('<span class="tag sky">' + ic('plane') + 'World Tour</span>');
    if (p.skip) tags.push('<span class="tag warn">' + ic('pause') + 'Lewat giliran</span>');
    if (p.discount) tags.push('<span class="tag good">' + ic('ticket') + 'Diskon ' + Math.round(p.discount * 100) + '%</span>');
    const held = {};
    p.cards.forEach(c => { const k = E.CARD[c].power; held[k] = (held[k] || 0) + 1; });
    Object.keys(held).forEach(k => tags.push('<span class="tag lilac" title="' + esc(D.POWER[k].name) + '">' + ic(D.POWER[k].icon) + '×' + held[k] + '</span>'));
    if (!tweens[p.i]) App.cashShown[p.i] = p.cash;
    const kind = p.kind === 'ai' ? 'AI ' + ({ easy: 'Easy', normal: 'Normal', hard: 'Hard' }[p.ai]) : App.mode === 'online' ? (p.i === App.seat ? 'Kamu' : 'Online') : 'Pemain';
    const presence = App.mode === 'online' && App.net ? App.net.presenceDot(p.i) : '';
    if (compact) {
      return '<button type="button" class="pcard mini' + (active ? ' active' : '') + (p.bankrupt ? ' bankrupt' : '') + '" data-p="' + p.i + '" style="--c:' + p.color + '">' +
        avatarHTML(p, 'sm') + '<span class="pc-txt"><span class="pc-name">' + esc(p.name) + presence + '</span><span class="pc-cash">' + coin + '<b class="num" data-cash="' + p.i + '">' + fmt(App.cashShown[p.i]) + '</b></span></span>' +
        (p.island ? '<span class="pc-flag">' + ic('island') + '</span>' : p.tour ? '<span class="pc-flag">' + ic('plane') + '</span>' : '') + '</button>';
    }
    return '<button type="button" class="pcard' + (active ? ' active' : '') + (p.bankrupt ? ' bankrupt' : '') + '" data-p="' + p.i + '" style="--c:' + p.color + '"><span class="sr-only">Lihat aset: </span>' +
      (active ? '<span class="turn-pill">Giliran</span>' : '') +
      '<span class="pc-top">' + avatarHTML(p) + '<span class="pc-id"><span class="pc-name">' + esc(p.name) + presence + '</span><span class="pc-kind">' + esc(kind) + '</span></span></span>' +
      '<span class="pc-cash">' + coin + '<b class="num" data-cash="' + p.i + '">' + fmt(App.cashShown[p.i]) + '</b></span>' +
      '<span class="pc-meta"><span title="Total aset">' + ic('briefcase') + fmt(nw) + '</span><span title="Kota">' + ic('house') + cities + '</span><span title="Wisata">' + ic('ferris') + spots + '</span></span>' +
      '<span class="pc-love" title="Love Meter ' + p.love + '/100 · ' + esc(tier.name) + '">' + ic('heart') + '<span class="meter"><i style="--v:' + p.love + '%"></i></span><b>' + esc(tier.name) + '</b></span>' +
      (tags.length ? '<span class="pc-tags">' + tags.join('') + '</span>' : '') +
      '</button>';
  }
  function slotOrder(n) {
    if (n === 2) return ['slotBL', 'slotTR'];
    if (n === 3) return ['slotBL', 'slotTL', 'slotTR'];
    return ['slotBL', 'slotTL', 'slotTR', 'slotBR'];
  }
  function placePlayers() { if (App.S) renderPlayers(App.S, true); }
  function renderPlayers(S, force) {
    S = S || App.S;
    if (!S) return;
    const compact = App.layout !== 'wide';
    const mini = miniStrip();
    const order = slotOrder(S.players.length);
    ['slotTL', 'slotBL', 'slotTR', 'slotBR'].forEach(id => { const el = $('#' + id); if (el && !order.includes(id) && el.innerHTML) { el.innerHTML = ''; el._h = ''; } });
    const strip = $('#strip');
    if (compact) {
      if (force) order.forEach(id => { const el = $('#' + id); if (el) { el.innerHTML = ''; el._h = ''; } });
      if (strip) {
        strip.dataset.n = S.players.length;
        setHTML(strip, S.players.map(p => playerCardHTML(S, p, mini)).join(''));
      }
    } else {
      if (strip && (force || strip.innerHTML)) { strip.innerHTML = ''; strip._h = ''; }
      S.players.forEach((p, k) => setHTML($('#' + order[k]), playerCardHTML(S, p, false)));
      const freeL = $('#slotTL'), freeR = $('#slotBR');
      if (S.players.length === 2 && freeL) setHTML(freeL, infoCardHTML(S));
      if (S.players.length <= 3 && freeR) setHTML(freeR, logCardHTML(S));
    }
    $$('.pcard').forEach(el => { el.onclick = () => G.LoveUI.openPortfolio(Number(el.dataset.p)); });
    const lb = $('#logMore'); if (lb) lb.onclick = () => G.LoveUI.openHistory();
    Object.keys(tweens).forEach(k => { if (S.players[k]) tweens[k].to = S.players[k].cash; });
  }
  function infoCardHTML(S) {
    const lim = S.settings.roundLimit;
    const pct = lim ? Math.min(100, Math.round((S.round / lim) * 100)) : 0;
    let h = '<div class="info-card"><div class="ic-row"><span class="ic-title">' + ic('calendar') + 'Ronde ' + S.round + (lim ? ' dari ' + lim : '') + '</span></div>' +
      (lim ? '<span class="meter gold"><i style="--v:' + pct + '%"></i></span>' : '') +
      newsCardHTML(S) +
      '<div class="ic-wins"><b>Cara menang cepat</b>';
    if (S.settings.instantWin) h += '<span>' + ic('trophy') + 'Trio Warna: 3 grup penuh (1 grup 3 kota)</span><span>' + ic('map') + 'Raja Jalur: 1 jalur penuh</span><span>' + ic('ferris') + 'Kolektor Wisata: 5 wisata</span>';
    h += '<span>' + ic('alert') + 'Buat lawan bangkrut</span></div></div>';
    return h;
  }
  // Kabar Merpi & Musim Puncak: pil kecil di samping chip ronde (ketuk = detail) dan blok di kartu info desktop
  function newsBits(S) {
    const n = S && !S.over ? E.newsInfo(S) : null, peak = S && E.peakOn(S);
    return { n, peak };
  }
  function newsPillHTML(S) {
    const { n, peak } = newsBits(S);
    if (!n && !peak) return '';
    return '<button type="button" class="news-pill' + (peak ? ' peak' : '') + '" data-news><span class="sr-only">Kabar Merpi: </span>' +
      (n ? ic(NEWS_ICON[n.id] || 'sparkle') + '<span class="np-t">' + esc(n.label) + '</span>' : '') + (peak ? '<span class="sr-only">' + (n ? ', ' : '') + 'Musim </span>' + ic('bolt') + '<span class="np-t">Puncak</span>' : '') + '</button>';
  }
  const NEWS_ICON = { rain: 'umbrella', holiday: 'sun', sale: 'ticket', promo: 'plane', bonus: 'coins', love: 'heart' };
  function newsCardHTML(S) {
    const { n, peak } = newsBits(S);
    if (!n && !peak) return '';
    return '<div class="news-card">' + (n ? '<div class="nc-row">' + ic(NEWS_ICON[n.id] || 'sparkle') + '<span><b>Kabar Merpi: ' + esc(n.label) + '</b><small>' + esc(n.text.charAt(0).toUpperCase() + n.text.slice(1)) + ' · sisa ' + n.left + ' ronde</small></span></div>' : '') +
      (peak ? '<div class="nc-row peak">' + ic('bolt') + '<span><b>Musim Puncak</b><small>Semua tol ×' + String(RULES.peakMult).replace('.', ',') + ' sampai akhir</small></span></div>' : '') + '</div>';
  }
  function showNewsToast() {
    const { n, peak } = newsBits(App.S);
    if (!n && !peak) return;
    toast([n ? n.label + ': ' + n.text + ' (sisa ' + n.left + ' ronde).' : '', peak ? 'Musim Puncak: semua tol ×' + String(RULES.peakMult).replace('.', ',') + ' sampai akhir permainan.' : ''].filter(Boolean).join(' '), { title: 'Kabar Merpi', icon: 'sparkle', kind: 'lilac' });
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-news]')) showNewsToast(); });
  function logCardHTML(S) {
    const items = S.log.slice(-6).reverse().map(l => '<li class="' + (l.n > App.lastLogN ? 'new' : '') + '"><span class="bub" style="--c:' + (l.p >= 0 && S.players[l.p] ? S.players[l.p].color : 'var(--ink-3)') + '">' + ic(l.icon in G.LoveIcons.paths ? l.icon : 'dot') + '</span><span>' + esc(l.text) + '</span></li>').join('');
    App.lastLogN = S.logN;
    return '<div class="log-card"><div class="ic-row"><span class="ic-title">' + ic('history') + 'Kabar terbaru</span><button type="button" class="link-btn" id="logMore">Semua</button></div><ul class="log">' + items + '</ul></div>';
  }

  function renderStage(S) {
    S = S || App.S;
    if (!S || !$('#turnLine')) return;
    const cur = S.players[S.turn.p];
    const lim = S.settings.roundLimit;
    setHTML($('#roundChip'), ic('calendar') + '<span>Ronde <b>' + S.round + '</b>' + (lim ? '/' + lim : '') + '</span>');
    setHTML($('#newsSlot'), newsPillHTML(S));
    renderAmbience(S);
    const tl = $('#turnLine');
    setHTML(tl, S.over ? '<span class="tl-txt">' + ic('trophy') + ' Permainan selesai</span>' :
      avatarHTML(cur, 'xs') + '<span class="tl-txt"><span class="tl-w">Giliran </span><b>' + esc(cur.name) + '</b></span>' + '<span class="tl-round">' + ic('calendar') + 'R' + S.round + (lim ? '/' + lim : '') + '</span>' + (cur.island ? '<span class="tag sea">' + ic('island') + '<span class="tl-w">Pulau Rindu </span>' + cur.islandTries + '/' + RULES.islandTurns + '</span>' : ''));
    tl.classList.toggle('has-tag', !S.over && !!cur.island);
    const tkey = S.over ? 'over' : S.turn.p + ':' + S.round;
    if (App.turnKey !== tkey) {
      const fresh = !!App.turnKey;
      App.turnKey = tkey;
      App.aim = null;
      if (fresh && !S.over) {
        pulse(tl, 'pop', 900);
        mascotLook(cur.pos); mascotWake();
        if (controls(S.turn.p)) merpiSay(fill(pick(D.MERPI.turn), S), '', 2400);
        if (is3d()) { if (auto3d()) camHold(false); else if (App.cam.zoomed && Date.now() >= App.cam.manualUntil) camFocus(cur.pos, true, 500, true); }
        else if (camAuto()) camHold(false); else camFocus(cur.pos, true, 500, true);
      }
    }
    const note = $('#statusNote'), acts = $('#centerActions');
    let nh = '', ah = '';
    const binds = [];
    const btn = (id, cls, icon, label, title) => '<button type="button" class="btn ' + cls + '" id="' + id + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + (icon ? ic(icon) : '') + '<span>' + esc(label) + '</span></button>';
    let aiming = false, mode = '';
    const dots = '<span class="dots"><i></i><i></i><i></i></span>';
    if (S.over) {
      ah = btn('cShowWin', 'primary big', 'trophy', 'Lihat Hasil');
      binds.push(['cShowWin', () => G.LoveUI.showWin()]);
    } else if (S.paused) {
      nh = 'Permainan dijeda.';
      ah = btn('cResume', 'primary big', 'play', 'Lanjutkan');
      binds.push(['cResume', () => G.LoveUI.togglePause()]);
    } else if (App.animating) {
      nh = dots;
    } else {
      const a = E.actor(S);
      const it = S.queue[0];
      if (it) {
        const who = S.players[a];
        if (controls(a)) {
          nh = esc(describeItem(S, it, true));
          if (it.type === 'TARGET' || it.type === 'TOUR') { mode = 'pick'; ah = ''; }
          else { ah = btn('cOpen', 'primary big attn', 'chevron', 'Buka Keputusan'); binds.push(['cOpen', () => G.LoveUI.syncModal(true)]); }
        } else {
          nh = '<span class="wait">' + (runsAI(a) ? ic('bot') : ic('clock')) + esc(who.name) + ' ' + esc(describeItem(S, it, false)) + ' ' + dots + '</span>';
          // online: pemilik tantangan yang menunggu penilai boleh membatalkan (penilai pergi / tidak merespons)
          if (it.type === 'CHALLENGE' && it.who !== it.p && controls(it.p)) { ah = btn('cChCancel', 'ghost', 'x', 'Batalkan tantangan', 'Lewati bila ' + who.name + ' tidak merespons'); binds.push(['cChCancel', () => act({ type: 'CH_RESOLVE', p: it.p, result: 'skip' })]); }
        }
      } else if (!controls(a)) {
        nh = '<span class="wait">' + (runsAI(a) ? ic('bot') + esc(cur.name) + ' sedang berpikir' : ic('clock') + 'Menunggu ' + esc(cur.name)) + ' ' + dots + '</span>';
        if (runsAI(a) && !merpiMood && Math.random() < 0.25) merpiSay(pick(D.MERPI.think), 'think', 1400);
      } else {
        const p = cur;
        if (E.islandPre(S, a)) {
          mode = 'island';
          ah += btn('cRoll', 'go', 'dice', 'Cari Kembar', 'Lempar: dadu kembar = keluar dan jalan');
          ah += '<div class="isle-opts">' + btn('cIslePay', 'soft', 'boat', 'Bayar ' + RULES.islandFee, 'Bayar perahu dan lempar dadu biasa') +
            (p.cards.some(c => E.CARD[c].power === 'escape') ? btn('cIsleCard', 'soft lilac', 'key', 'Tiket Pulang') : '') +
            (!p.islandCh ? btn('cIsleCh', 'soft rose', 'heart', 'Rindu Challenge', 'Lulus tantangan = keluar gratis. Gagal = tetap di pulau.') : '') + '</div>';
          nh = 'Terdampar! Percobaan ' + (p.islandTries + 1) + '/' + RULES.islandTurns + '. Kembar = keluar, atau pilih cara lain.';
        } else if (E.canRoll(S, a)) {
          if (S.settings.diceControl) {
            aiming = true;
            ah = '<div class="aim" role="group" aria-label="Bidik hasil dadu">' + [['low', 'Kecil', '2–5'], ['mid', 'Sedang', '6–8'], ['high', 'Besar', '9–12']].map(([k, l, r]) =>
              '<button type="button" data-aim="' + k + '" aria-pressed="' + (App.aim === k) + '" title="Bidik total ' + r + ' (berhasil ' + Math.round(RULES.aimChance * 100) + '%)"><b>' + l + '</b><small>' + r + '</small></button>').join('') + '</div>';
          }
          ah += btn('cRoll', 'go', 'dice', S.turn.canRollAgain ? 'Lempar Lagi!' : 'Lempar', App.aim ? 'Bidik ' + E.AIM_LABEL[App.aim] : '');
          nh = S.turn.canRollAgain ? 'Dadu kembar! Kamu dapat lemparan bonus.' : S.settings.diceControl ? 'Pilih bidikan (opsional), lalu tekan Lempar.' : 'Tekan Lempar untuk berjalan.';
        } else if (E.canEnd(S, a)) {
          ah = btn('cEnd', 'primary big', 'check', 'Akhiri Giliran');
          nh = App.prefs.autoEnd !== false ? 'Giliran berakhir otomatis. Sentuh layar untuk menahan.' : 'Tekan Akhiri Giliran untuk lanjut.';
        }
        const roll = () => { const aim = App.aim; if (act(aim ? { type: 'ROLL', p: a, aim } : { type: 'ROLL', p: a })) App.aim = null; };
        binds.push(['cRoll', roll], ['cEnd', () => act({ type: 'END_TURN', p: a })], ['cIslePay', () => act({ type: 'ISLAND_PAY', p: a })],
          ['cIsleCard', () => act({ type: 'ISLAND_CARD', p: a })], ['cIsleCh', () => act({ type: 'ISLAND_CH', p: a })]);
      }
    }
    setHTML(note, nh);
    setHTML(acts, ah);
    binds.forEach(([id, f]) => { const el = $('#' + id); if (el) el.onclick = f; });
    $$('[data-aim]', acts).forEach(b => { b.onclick = () => { App.aim = App.aim === b.dataset.aim ? null : b.dataset.aim; SND.play('click'); renderStage(); }; });
    const st = $('#stage');
    if (st) { st.classList.toggle('aiming', aiming); st.dataset.mode = mode; }
    renderTicker(S);
  }
  function renderTicker(S) {
    const el = $('#ticker');
    if (!el || !S) return;
    const l = S.log[S.log.length - 1];
    if (!l) { setHTML(el, ''); return; }
    if (setHTML(el, ic(l.icon in G.LoveIcons.paths ? l.icon : 'dot') + '<span>' + esc(l.text) + '</span>')) restart(el, 'new');
  }
  function describeItem(S, it, mine) {
    const t = it.tile != null ? TILES[it.tile] : null;
    switch (it.type) {
      case 'BUY': return mine ? 'Beli ' + t.name + '?' : 'memutuskan membeli ' + t.name;
      case 'UPGRADE': return mine ? 'Bangun di ' + t.name + '?' : 'membangun di ' + t.name;
      case 'RENT': return mine ? 'Bayar tol ' + fmt(it.amount) + '.' : 'membayar tol ' + fmt(it.amount);
      case 'TAKEOVER': return mine ? 'Ambil alih ' + t.name + '?' : 'mempertimbangkan ambil alih ' + t.name;
      case 'TAX': return mine ? 'Bayar Pajak Rindu.' : 'membayar Pajak Rindu';
      case 'CARD': return mine ? 'Buka Kartu Cinta.' : 'membuka Kartu Cinta';
      case 'CHALLENGE': {
        const ch = E.CH[it.ch], lb = ch ? D.CH_TYPES[ch.type].label : 'tantangan';
        if (it.who != null && it.who !== it.p) return mine ? 'Giliranmu menilai ' + lb + '.' : S.players[it.who].name + ' sedang menilai ' + lb;
        return mine ? lb + ' menunggu.' : 'mengerjakan ' + lb;
      }
      case 'DEBT': return mine ? 'Uangmu kurang ' + fmt(it.amount - S.players[it.p].cash) + '.' : 'sedang mencari dana';
      case 'TARGET': return mine ? ({ festival: 'Pilih kota tuan rumah Festival Cinta di papan.', build: 'Pilih kotamu untuk dibangun di papan.', renov: 'Pilih kota untuk renovasi gratis.', storm: 'Pilih kota lawan untuk Badai Rindu.', swap: 'Pilih kota yang mau ditukar.' }[it.kind]) : ({ festival: 'memilih kota festival', build: 'memilih kota untuk dibangun', renov: 'memilih kota renovasi', storm: 'memilih sasaran badai', swap: 'memilih kota untuk ditukar' }[it.kind]);
      case 'TOUR': return mine ? 'World Tour: pilih tujuan di papan.' : 'memilih tujuan World Tour';
      default: return '';
    }
  }

  // polaroid foto bukti terakhir: rebah di bidang papan (seperti foto di meja); ketuk = galeri bukti
  function renderProofPin(S) {
    const c = $('#board .center');
    if (!c) return;
    const ph = S && S.photos && S.photos[S.photos.length - 1];
    let pin = $('#proofPin', c);
    if (!ph) { if (pin) pin.remove(); return; }
    if (!pin) {
      pin = document.createElement('button');
      pin.type = 'button'; pin.id = 'proofPin'; pin.className = 'proof-pin';
      pin.addEventListener('click', () => G.LoveUI.openProofs && G.LoveUI.openProofs());
      c.appendChild(pin);
    }
    const k = S.photos.length + ':' + ph.r + ':' + ph.p;
    if (pin.dataset.k === k) return;
    pin.dataset.k = k;
    pin.setAttribute('aria-label', 'Galeri foto bukti (' + S.photos.length + ')');
    pin.innerHTML = '<img src="' + safeImg(ph.img) + '" alt=""><span class="pp-cap">' + esc(S.players[ph.p].name) + ' ' + (ph.ok ? '✓' : '✗') + '</span>' + (S.photos.length > 1 ? '<b class="pp-n">' + S.photos.length + '</b>' : '');
  }
  // foto bukti baru muncul besar di atas papan sebentar, lalu "jatuh" ke polaroid di papan
  function showPhotoPop(ph, S) {
    const vp = $('#boardVP'); if (!vp) return;
    const old = $('.photo-pop', vp); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'photo-pop' + (ph.ok ? '' : ' no');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<figure><img src="' + safeImg(ph.img) + '" alt=""><figcaption><b>' + esc(S.players[ph.p].name) + '</b><span>' + (ph.ok ? 'Disahkan' : 'Ditolak') + (ph.judge >= 0 ? ' ' + esc(S.players[ph.judge].name) : '') + '</span></figcaption></figure>';
    vp.appendChild(el);
    setTimeout(() => el.classList.add('out'), reduceMotion() ? 2400 : 2600);
    setTimeout(() => el.remove(), 3200);
  }
  function renderAll() {
    const S = App.S;
    if (!S) return;
    renderProofPin(S);
    renderHeader(S);
    renderBoard(S);
    renderTokens(S);
    renderPlayers(S);
    renderStage(S);
    renderCamCtl();
  }

  // ---------- mode pilih petak di papan ----------
  function startPick(def) {
    endPick(true);
    App.pick = def;
    const b = $('#board'), bar = pickEl || $('#pickbar');
    if (!b || !bar) return;
    b.classList.add('picking');
    const g = $('#game'); if (g) g.classList.add('pick-on');
    $$('#board .tile').forEach(el => { const i = Number(el.dataset.i); el.classList.toggle('pickable', def.can(i)); });
    if (camActive() && App.cam.zoomed) { clearTimeout(App.cam.outTimer); App.cam.pickBack = true; App.cam.zoomed = false; camApply(true, 380); renderCamCtl(); }
    renderPick();
  }
  function renderPick() {
    const def = App.pick, bar = pickEl || $('#pickbar');
    if (!def || !bar) return;
    bar.hidden = false;
    $$('#board .tile').forEach(el => { const i = Number(el.dataset.i); el.classList.toggle('picked', def.sel.includes(i)); el.classList.toggle('pickable', def.can(i)); });
    const ready = def.ready();
    bar.innerHTML = '<div class="pb-head">' + (def.art ? '<span class="pb-art">' + ART.art(def.art) + '</span>' : '') + '<div class="pb-txt"><b>' + esc(def.title) + '</b><span>' + esc(def.hint()) + '</span></div></div>' +
      '<div class="pb-acts">' + (def.skipLabel ? '<button type="button" class="btn ghost" id="pbSkip">' + esc(def.skipLabel) + '</button>' : '') +
      '<button type="button" class="btn primary" id="pbOk"' + (ready ? '' : ' disabled') + '>' + ic('check') + '<span>' + esc(def.okLabel()) + '</span></button></div>';
    const ok = $('#pbOk'), sk = $('#pbSkip');
    if (ok) ok.onclick = () => { if (def.ready()) def.confirm(); };
    if (sk) sk.onclick = () => def.skip();
  }
  function endPick(silent) {
    if (!App.pick) return;
    App.pick = null;
    const b = $('#board'), bar = pickEl || $('#pickbar'), g = $('#game');
    if (b) b.classList.remove('picking');
    if (g) g.classList.remove('pick-on');
    $$('#board .tile').forEach(el => el.classList.remove('pickable', 'picked'));
    if (bar) { bar.hidden = true; bar.innerHTML = ''; }
    const back = is3d() ? App.cam.pickBack && !auto3d() : !camAuto();
    App.cam.pickBack = false;
    if (!silent && camActive() && back) { App.cam.zoomed = true; camSettle(); renderCamCtl(); }
  }
  function onTileTap(i, e) {
    const def = App.pick;
    if (def) {
      // papan 3D: kartu yang berdiri bisa menutupi sebagian petak di belakangnya. Bila yang diketuk tidak bisa
      // dipilih tetapi ada petak yang bisa dipilih tepat di belakang titik ketukan, pakai petak itu
      if (!def.can(i) && e && e.clientX && is3d()) {
        const alt = document.elementsFromPoint(e.clientX, e.clientY).map(el => el.closest && el.closest('#board .tile')).filter(Boolean).map(el => Number(el.dataset.i)).find(k => def.can(k));
        if (alt != null) i = alt;
      }
      if (!def.can(i)) { SND.play('error'); pulse(tileEl(i), 'nope', 400); return; }
      def.tap(i);
      SND.play('click');
      renderPick();
      return;
    }
    G.LoveUI.onTileClick(i);
  }

  // ---------- alur commit & animasi ----------
  async function animateEvents(prev, ns) {
    const evs = ns.lastEvents || [];
    if (!prev || ns.evSeq !== ns.seq || prev.seq >= ns.seq) return;
    const fresh = ns.seq === prev.seq + 1;
    let coinBurst = 0;
    const used = new Set();
    const mine = i => controls(i) && !hotseat();
    for (let idx = 0; idx < evs.length; idx++) {
      const e = evs[idx];
      switch (e.t) {
        case 'dice':
          if (fresh) {
            mascotLook(ns.players[e.p].pos); mascotEmote(ic('dice'), 1100); mascotAct('peek', 700);
            await rollDice(e.d, e.dbl, e.aim, e.hit);
            if (e.dbl && !ns.players[e.p].island) { merpiSay(pick(D.MERPI.doubles), 'wow', 1600); mascotAct('spin', 900); mascotEmote(ic('sparkle'), 1400); }
          } else { setDieFace($('#die1'), e.d[0], false); setDieFace($('#die2'), e.d[1], false); }
          break;
        case 'move': if (fresh) await moveToken(e); break;
        case 'money':
          if (fresh) { tweenCash(e.p, e.d); moneyFx(evs, idx, used); }
          if (coinBurst++ < 2) SND.play(e.d > 0 ? 'coin' : 'pay');
          break;
        case 'salary': if (fresh) { merpiSay(pick(D.MERPI.salary), 'happy', 1500); mascotEmote(ic('coins'), 1400); pulse($('#tok-' + e.p), 'cheer', 800); } break;
        case 'love': if (fresh && Math.abs(e.d) >= 3) bfloat(e.p, (e.d > 0 ? '+' : '−') + Math.abs(e.d) + ic('heart'), 'love'); break;
        case 'buy': {
          SND.play('buy');
          if (fresh) { flagDrop(e.tile, ns.players[e.p].color); merpiSay(pick(D.MERPI.buy), 'happy', 1800); mascotEmote(ic('flag'), 1500); await sleep(420 * SPD()); }
          const el = tileEl(e.tile); if (el) renderTile(el, ns, true);
          flashTile(e.tile);
          if (fresh && e.level > 0) await sleep(380 * SPD());
          break;
        }
        case 'build': {
          SND.play(e.level === 4 ? 'fanfare' : 'build');
          const el = tileEl(e.tile); if (el) renderTile(el, ns, true);
          flashTile(e.tile);
          if (e.level === 4) {
            if (fresh) burst(e.tile, ['#FFD93D', '#FFF3B0', '#FFFFFF'], 16);
            banner('LANDMARK!', pname(e.p) + ' membangun landmark di ' + TILES[e.tile].name + '. Kebal diambil alih!', 'gold', 2400, 'b4');
            merpiSay(pick(D.MERPI.landmark), 'wow', 2200);
            mascotAct('spin', 900); mascotEmote(ic('crown'), 2000);
          } else if (fresh) { merpiSay(pick(D.MERPI.build), 'happy', 1600); mascotEmote(ic('build'), 1400); }
          if (fresh) await sleep(520 * SPD());
          break;
        }
        case 'takeover': {
          SND.play('stamp');
          const taker = ns.players[e.p], from = ns.players[e.from];
          if (fresh) stampDrop(e.tile, taker.color, 'DIAMBIL ALIH');
          banner('AMBIL ALIH!', taker.name + ' merebut ' + TILES[e.tile].name + ' dari ' + from.name + ' (' + fmt(e.price) + ').', 'take', 2400);
          merpiSay(pick(D.MERPI.takeover), 'wow', 2000);
          if (fresh) { mascotAct('shake', 700); mascotEmote(ic('alert'), 1600); }
          const el = tileEl(e.tile); if (el) renderTile(el, ns, true);
          flashTile(e.tile);
          if (fresh) await sleep(620 * SPD());
          break;
        }
        case 'rent':
          if (fresh) {
            if (mine(e.p)) merpiSay(pick(D.MERPI.rent), 'sad', 1800);
            else if (mine(e.to)) merpiSay('Cuan! Tol masuk ' + fmt(e.amount) + '.', 'love', 1800);
            mascotEmote(ic('coins'), 1400);
          }
          break;
        case 'festival': {
          SND.play('fanfare');
          const el = tileEl(e.tile);
          renderBoard(ns);
          if (fresh) { camHold(true, e.tile); fireworks(e.tile); }
          if (el) flashTile(e.tile);
          banner('FESTIVAL CINTA!', TILES[e.tile].name + ' jadi tuan rumah. Tol ×' + e.mult + '!', 'party', 2400, 'festival');
          merpiSay(pick(D.MERPI.festival), 'love', 2000);
          if (fresh) { mascotAct('spin', 900); mascotEmote(ic('party'), 2000); }
          if (fresh) await sleep(700 * SPD());
          break;
        }
        case 'storm': {
          SND.play('thunder');
          if (fresh) { camHold(true, e.tile); stormFx(e.tile); await sleep(500 * SPD()); }
          const el = tileEl(e.tile); if (el) renderTile(el, ns, true);
          flashTile(e.tile);
          toast(TILES[e.tile].name + ' turun jadi ' + E.LEVEL_NAME[e.level] + '.', { title: 'Badai Rindu', icon: 'storm' });
          if (fresh) await sleep(400 * SPD());
          break;
        }
        case 'swap': {
          SND.play('whoosh');
          [e.a, e.b].forEach(t => { const el = tileEl(t); if (el) renderTile(el, ns, true); flashTile(t); if (fresh) burst(t, [ns.players[e.p].color, '#FFFFFF'], 8); });
          banner('TUKAR KOTA!', pname(e.p) + ' menukar ' + TILES[e.a].name + ' dengan ' + TILES[e.b].name + '.', 'take', 2200);
          if (fresh) await sleep(500 * SPD());
          break;
        }
        case 'sell': { const el = tileEl(e.tile); if (el) renderTile(el, ns, true); flashTile(e.tile); SND.play('pay'); break; }
        case 'island':
          SND.play('splash');
          if (fresh) { pulse($('#tok-' + e.p), 'shake', 600); merpiSay(pick(D.MERPI.island), 'sad', 2000); mascotEmote(ic('island'), 1800); }
          break;
        case 'free': SND.play('good'); if (fresh) pulse($('#tok-' + e.p), 'cheer', 800); break;
        case 'tour':
          SND.play('plane');
          if (fresh) { merpiSay(pick(D.MERPI.travel), 'happy', 1800); mascotAct('fly', 1500); mascotEmote(ic('plane'), 1500); pulse($('#tok-' + e.p), 'cheer', 800); }
          break;
        case 'tax': SND.play('pay'); break;
        case 'card': {
          SND.play('card');
          // kartu sendiri: dialog Kartu Cinta yang menerbangkan kartu dari tumpukan; lawan: kotak intip
          if (!fresh) pulse($('#deck'), 'pull', 800);
          if (fresh && !controls(e.p)) peekCard(e);
          else if (fresh) merpiSay(pick(D.MERPI.card), 'think', 1200);
          if (fresh) mascotEmote(ic('letter'), 1500);
          break;
        }
        case 'gameover': {
          const o = ns.over;
          if (o && (o.reason === 'triple' || o.reason === 'line' || o.reason === 'spots')) {
            SND.play('win');
            banner({ triple: 'TRIO WARNA!', line: 'RAJA JALUR!', spots: 'KOLEKTOR WISATA!' }[o.reason], pname(o.winner) + ' menang instan!', 'gold', 2600, 'b4');
            merpiSay(pick(D.MERPI.win), 'love', 2600);
            mascotAct('spin', 900); mascotEmote(ic('trophy'), 2600);
            if (fresh) await sleep(1700 * SPD());
          }
          break;
        }
        case 'achievement': achievementFx(e, ns, fresh); break;
        case 'bankrupt': SND.play('bad'); toast(pname(e.p) + ' bangkrut.', { icon: 'alert', kind: 'err' }); banner('BANGKRUT!', pname(e.p) + ' keluar dari permainan.', 'warn', 2000); break;
        case 'skip': toast(pname(e.p) + ' kehilangan giliran.', { icon: 'pause' }); break;
        case 'meet': {
          if (!fresh) break;
          SND.play('heart');
          [e.p].concat(e.with).forEach(q => { pulse($('#tok-' + q), 'cheer', 800); bfloat(q, '+' + fmt(e.cash) + ' ' + ic('heart') + '+' + e.love, 'love'); });
          burst(e.tile, ['#FF4F8B', '#FF9EC4', '#FFFFFF'], 14);
          merpiSay(pick(['Ketemuan! Kangen terobati~', 'Akhirnya ketemu juga!', 'Peluk dulu dong!', 'Momen langka, abadikan!']), 'love', 2000);
          mascotEmote(ic('heart'), 1600); mascotAct('hop', 700);
          await sleep(600 * SPD());
          break;
        }
        case 'news': {
          SND.play('fanfare');
          banner('KABAR MERPI', e.label + ': ' + e.text + ' (' + e.rounds + ' ronde)', 'party', 3000, 'card');
          if (fresh) { merpiSay(pick(['Ada kabar baru dari seluruh dunia!', 'Surat kilat! Baca dulu, ya~', 'Kabar hangat, strategi berubah!']), 'wow', 2400); mascotAct('fly', 1500); mascotEmote(ic('letter'), 2000); await sleep(900 * SPD()); }
          break;
        }
        case 'peak': {
          SND.play('fanfare');
          banner('MUSIM PUNCAK!', e.rounds + ' ronde terakhir: semua tol ×' + String(e.mult).replace('.', ',') + '. Saatnya menyalip!', 'gold', 3000, 'festival');
          if (fresh) { merpiSay('Musim puncak! Siapa yang menyalip di akhir?', 'wow', 2400); mascotAct('spin', 900); mascotEmote(ic('bolt'), 2000); await sleep(900 * SPD()); }
          break;
        }
        case 'challenge': {
          if (e.dilemma) { SND.play('good'); break; }
          SND.play(e.ok ? 'fanfare' : 'bad');
          if (fresh) {
            const ph = ns.photos && ns.photos[ns.photos.length - 1];
            const isPhoto = ph && D.CH_TYPES.photo.label === e.label;
            if (isPhoto) showPhotoPop(ph, ns);
            else banner(e.ok ? 'LULUS!' : 'BELUM LULUS', pname(e.p) + ' · ' + e.label + ': ' + e.proof, e.ok ? 'gold' : 'warn', 2600);
            merpiSay(e.ok ? pick(['Terbukti! Keren banget!', 'Sah! Hadiah cair~', 'Bukti lengkap, mantap!']) : pick(['Hampir! Coba lagi lain kali.', 'Belum terbukti, hehe.', 'Ups, bukti kurang kuat!']), e.ok ? 'love' : 'sad', 2000);
            mascotEmote(ic(e.ok ? 'trophy' : 'x'), 1600);
            if (e.ok) mascotAct('spin', 900);
            await sleep(500 * SPD());
          }
          break;
        }
        case 'power': SND.play('card'); if (fresh) bfloat(e.p, ic(D.POWER[e.power].icon), 'love'); break;
        case 'letter': G.LoveUI.onLetter && G.LoveUI.onLetter(e.p); break;
        default: break;
      }
    }
  }
  let peekTimer = null;
  // ---------- kartu terbang: dari tumpukan di tengah papan (atau petak tempat pion mendarat bila tumpukan
  // tidak terlihat) ke kartu di dialog / kotak intip. target disembunyikan (kelas await) selama terbang ----------
  const shown = el => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  function flyFrom(p) {
    const dk = $('#deck .dk1');
    if (shown(dk)) return dk;
    const pl = App.S && App.S.players[p];
    const t = pl ? tileEl(pl.pos) : null;
    if (!t) return null;
    const c = t.querySelector('.tp-card');
    return shown(c) ? c : shown(t) ? t : null;
  }
  // posisi akhir elemen setelah animasi masuk induknya (dialog/kotak intip) selesai
  function finalRect(el) {
    const anims = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) n.getAnimations().forEach(a => { const end = a.effect && a.effect.getComputedTiming().endTime; if (isFinite(end)) anims.push([a, a.currentTime, a.playState, end]); });
    anims.forEach(([a, , , end]) => { a.currentTime = end; });
    const r = el.getBoundingClientRect();
    anims.forEach(([a, t, st]) => { a.currentTime = t; if (st === 'running') a.play(); });
    return r;
  }
  function flyCard(p, target, done) {
    const fin = flew => { if (target) { if (flew) target.classList.add('flown'); target.classList.remove('await'); } if (done) done(); };
    const from = !reduceMotion() && target ? flyFrom(p) : null;
    if (!from) { fin(); return; }
    target.classList.add('await');
    const a = from.getBoundingClientRect(), b = finalRect(target);
    const deck = $('#deck');
    if (deck && deck.contains(from)) { deck.classList.remove('lift'); void deck.offsetWidth; deck.classList.add('lift'); setTimeout(() => deck.classList.remove('lift'), 1300); }
    const fly = document.createElement('div');
    fly.className = 'fly-card';
    fly.setAttribute('aria-hidden', 'true');
    fly.innerHTML = '<span>' + ART.art('card') + '</span>';
    document.body.appendChild(fly);
    const box = (r, extra) => Object.assign({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }, extra);
    const mid = { left: (a.left + b.left) / 2, top: Math.min(a.top, b.top) - Math.min(90, innerHeight * .12), width: (a.width + b.width) / 2, height: (a.height + b.height) / 2 };
    const anim = fly.animate([
      box(a, { transform: 'perspective(800px) rotateX(35deg) rotate(-8deg)', opacity: 0.4 }),
      box(a, { transform: 'perspective(800px) translateY(-30%) rotate(-4deg) scale(1.12)', opacity: 1, offset: 0.22 }),
      box(mid, { transform: 'perspective(800px) rotateY(-24deg) rotate(6deg)', opacity: 1, offset: 0.6 }),
      box(b, { transform: 'perspective(800px) none', opacity: 1 })
    ], { duration: Math.round(900 * Math.max(0.7, SPD())), easing: 'cubic-bezier(.45, .05, .3, 1)', fill: 'forwards' });
    let ended = false;
    const end = () => { if (ended) return; ended = true; fly.remove(); fin(true); };
    anim.onfinish = end; anim.oncancel = end;
    setTimeout(end, 2500);
  }
  function peekCard(e) {
    const host = $('#boardVP');
    const c = E.CARD[e.card];
    if (!host || !c) return;
    const old = host.querySelector('.peek'); if (old) old.remove();
    clearTimeout(peekTimer);
    const el = document.createElement('div');
    el.className = 'peek';
    el.innerHTML = '<span class="pk-art">' + ART.art('card') + '</span><div><small>' + esc(pname(e.p)) + ' · Kartu Cinta</small><b>' + esc(c.title) + '</b><span>' + esc(c.text) + '</span></div>';
    host.appendChild(el);
    flyCard(e.p, el.querySelector('.pk-art'));
    peekTimer = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 380); }, Math.round(3400 * Math.max(0.65, AISPD())));
  }
  // state dari luar (simpanan lokal, dokumen room online) dibersihkan sebelum dirender:
  // warna dipakai di atribut style, nama/avatar dibatasi — pertahanan berlapis terhadap data yang diubah orang
  const HEX = /^#[0-9a-fA-F]{6}$/;
  function cleanState(S) {
    if (!S || !Array.isArray(S.players)) return S;
    if (Array.isArray(S.photos)) S.photos = S.photos.filter(x => x && safeImg(x.img) && S.players[x.p]);
    (S.queue || []).forEach(it => { if (it && it.type === 'CHALLENGE' && it.pz && it.pz.photo != null && !safeImg(it.pz.photo)) it.pz.photo = ''; });
    S.players.forEach((p, k) => {
      p.name = String(p.name == null ? 'Pemain' : p.name).slice(0, 16);
      if (!HEX.test(p.color || '')) p.color = D.TOKEN_COLORS[k % D.TOKEN_COLORS.length];
      if (typeof p.avatar !== 'string' || !p.avatar || p.avatar.length > 8) p.avatar = D.AVATARS[k % D.AVATARS.length];
    });
    return S;
  }
  function commit(ns) {
    cleanState(ns);
    App.pending.push(ns);
    if (!App.animating) drain();
  }
  async function drain() {
    App.animating = true;
    clearTimeout(App.aiTimer);
    cancelAutoEnd();
    renderStage(App.S);
    try {
      while (App.pending.length) {
        const ns = App.pending.shift();
        const prev = App.shown;
        App.S = ns;
        dropStaleDecision(ns);
        try { await animateEvents(prev, ns); } catch (e) { console.error(e); }
        App.shown = ns;
        renderAll();
      }
    } finally {
      App.animating = false;
    }
    renderStage(App.S);
    persist();
    G.LoveUI.afterSettle();
    camSettle();
  }
  function dropStaleDecision(ns) {
    const m = App.modal;
    if (App.pick) endPick(true);
    if (!m || !m.decision || ns.over || !G.LoveUI.closeModal) return;
    const it = ns.queue[0];
    if (it && controls(E.actor(ns)) && m.itype === it.type && it.type === 'DEBT') return;
    G.LoveUI.closeModal(true);
  }
  function persist() {
    if (App.mode !== 'local' || !App.S) return;
    if (App.S.over) { store.del(KEYS.save); return; }
    store.set(KEYS.save, { S: App.S, savedAt: Date.now() });
  }

  function lockModal() {
    const m = document.querySelector('#modalRoot:not([hidden]) .modal');
    if (m) m.querySelectorAll('.modal-body button, .modal-foot button, .modal-body input, .modal-body textarea').forEach(b => { b.disabled = true; });
    const bar = $('#pickbar');
    if (bar && !bar.hidden) bar.querySelectorAll('button').forEach(b => { b.disabled = true; });
  }
  function act(action) {
    if (!App.S) return false;
    SND.unlock();
    if (action.type !== 'PAUSE' && (App.animating || App.pending.length)) return false;
    let ok;
    if (App.mode === 'online' && App.net) ok = App.net.send(action);
    else {
      const r = E.dispatch(App.S, action);
      if (!r.ok) { toast(r.error, { kind: 'err' }); SND.play('error'); return false; }
      commit(r.state);
      ok = true;
    }
    if (ok) lockModal();
    return ok;
  }

  // ---------- akhiri giliran otomatis ----------
  let autoTimer = null;
  function onUserAct(e) { if (e && e.target && e.target.closest && e.target.closest('#cEnd')) return; cancelAutoEnd(); }
  function cancelAutoEnd() {
    clearTimeout(autoTimer); autoTimer = null;
    const b = document.getElementById('cEnd'); if (b) b.classList.remove('auto');
    document.removeEventListener('pointerdown', onUserAct, true);
    document.removeEventListener('keydown', onUserAct, true);
  }
  function scheduleAutoEnd() {
    cancelAutoEnd();
    const S = App.S;
    if (!S || S.over || S.paused || App.prefs.autoEnd === false || App.animating || App.pending.length || App.modal || App.tour || App.pick || document.getElementById('guideOv')) return;
    const a = E.actor(S);
    if (!controls(a) || !E.canEnd(S, a)) return;
    const b = $('#cEnd');
    if (!b) return;
    const ms = Math.round(2400 * (App.prefs.speed === 'fast' ? 0.8 : 1));
    b.style.setProperty('--auto', ms + 'ms');
    restart(b, 'auto');
    document.addEventListener('pointerdown', onUserAct, true);
    document.addEventListener('keydown', onUserAct, true);
    autoTimer = setTimeout(() => {
      autoTimer = null;
      cancelAutoEnd();
      if (App.S === S && !App.modal && !App.tour && !App.pick && !document.getElementById('guideOv')) act({ type: 'END_TURN', p: a });
    }, ms);
  }

  // ---------- AI ----------
  function fallbackAction(S, p) {
    const it = S.queue[0];
    if (it) {
      const m = { BUY: 'BUY_SKIP', UPGRADE: 'UPGRADE_SKIP', RENT: 'PAY_RENT', TAX: 'PAY_TAX', TAKEOVER: 'TAKEOVER_SKIP', TARGET: 'TARGET_SKIP', TOUR: 'TOUR_SKIP' };
      if (it.type === 'CARD') return E.CARD[it.card].choice ? { type: 'CARD_CHOOSE', p, choice: 0 } : { type: 'CARD_OK', p };
      if (it.type === 'CHALLENGE') return { type: 'CH_RESOLVE', p, result: 'skip' };
      if (it.type === 'DEBT') {
        if (S.players[p].cash >= it.amount) return { type: 'PAY_DEBT', p };
        const own = E.ownedBy(S, p);
        return own.length && E.liquidation(S, p) >= it.amount ? { type: 'SELL', p, tile: own[0] } : { type: 'BANKRUPT', p };
      }
      return { type: m[it.type], p };
    }
    return E.canRoll(S, p) ? { type: 'ROLL', p } : { type: 'END_TURN', p };
  }
  function aiDelay(S) {
    const it = S.queue[0];
    let ms = 650;
    if (!it) ms = S.turn.rolled ? 700 : 950;
    else if (it.type === 'CARD') ms = 1500;
    else if (it.type === 'CHALLENGE') ms = 1400;
    else if (it.type === 'BUY' || it.type === 'UPGRADE') ms = 900;
    else if (it.type === 'TAKEOVER' || it.type === 'TARGET' || it.type === 'TOUR') ms = 1100;
    return Math.round(ms * AISPD());
  }
  function scheduleAI() {
    clearTimeout(App.aiTimer);
    const S = App.S;
    if (!S || S.over || S.paused || App.animating) return;
    const a = E.actor(S);
    if (!runsAI(a)) return;
    if (App.modal && App.modal.blocksAI) return;
    if (App.tour || App.tourPending || App.revealing || document.getElementById('guideOv')) return;
    App.aiTimer = setTimeout(() => {
      if (App.animating || App.S !== S || App.tour || App.tourPending || App.revealing) return;
      let action;
      try { action = AI.decide(S, a); } catch (e) { console.error(e); action = fallbackAction(S, a); }
      let ok;
      if (App.mode === 'online') ok = App.net.applyHost(action, true);
      else {
        const r = E.dispatch(S, action);
        if (!r.ok) {
          console.warn('AI action ditolak:', action, r.error);
          const r2 = E.dispatch(S, fallbackAction(S, a));
          if (r2.ok) commit(r2.state); else console.error('AI macet', r2.error);
          return;
        }
        commit(r.state);
        ok = true;
      }
      if (!ok) { const fb = fallbackAction(S, a); if (App.mode === 'online') App.net.applyHost(fb, true); }
    }, aiDelay(S));
  }

  G.LoveUI = Object.assign(G.LoveUI || {}, {
    App, D, E, AI, SND, ART, TILES, GROUPS, RULES, KEYS, N,
    view3d, fmt, esc, ic, $, $$, sleep, store, toast, banner, clearFx, controls, runsAI, viewer, pname, winLabel, hotseat, coin, avatarHTML, EMOTES, showEmote, sendEmote, safeImg, imported,
    applyLayout, sizeBoard, bindCamDrag, camFocus, camApply, camSettle, renderCamCtl, camRelax,
    buildBoard, renderBoard, renderTokens, renderPlayers, renderHeader, renderStage, renderCenter: renderStage, renderTicker, renderAll,
    startPick, renderPick, endPick, merpiSay, merpiPoke, pulse, restart, tileEl,
    commit, cleanState, act, persist, scheduleAI, scheduleAutoEnd, cancelAutoEnd, fallbackAction, describeItem, tilePos, setDieFace, flashTile, reduceMotion, pick, flyCard
  });
})(typeof window !== 'undefined' ? window : globalThis);
