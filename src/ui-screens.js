/* LOVEOPOLY 2.0 — layar: beranda, setup, online, kemenangan, jeda, tur, boot */
(function (G) {
  'use strict';
  const UI = G.LoveUI, Net = G.LoveNet;
  const { App, D, E, SND, ART, TILES, RULES, KEYS, fmt, esc, ic, $, $$, store, toast, coin, avatarHTML } = UI;

  // ---------- util layar ----------
  function show(id) {
    $$('.screen').forEach(s => { s.hidden = s.id !== id; });
    const inGame = id === 'scrGame';
    document.body.classList.toggle('in-game', inGame);
    $('#hMenu').hidden = !inGame;
    if (!inGame) UI.renderHeader(null);
    window.scrollTo(0, 0);
  }
  function savePrefs() { store.set(KEYS.prefs, App.prefs); }
  function applyTheme() {
    const t = App.prefs.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  function syncSoundBtn() {
    const b = $('#hSound');
    b.setAttribute('aria-pressed', String(App.prefs.sound));
    b.innerHTML = ic(App.prefs.sound ? 'soundOn' : 'soundOff');
    b.setAttribute('aria-label', App.prefs.sound ? 'Matikan suara' : 'Nyalakan suara');
  }
  const seg = (name, opts, val) => '<div class="seg" role="group" data-seg="' + name + '">' + opts.map(([k, l]) => '<button type="button" data-v="' + k + '" aria-pressed="' + (String(val) === String(k)) + '">' + esc(l) + '</button>').join('') + '</div>';
  const validSave = s => s && s.S && s.S.v === 2 && !s.S.over && Array.isArray(s.S.tiles) && s.S.tiles.length === TILES.length;

  // ---------- beranda ----------
  function homeArt() {
    const ring = ['paris', 'bali', 'kyoto', 'santorini', 'hawaii', 'swiss', 'seoul', 'maldives'];
    return '<div class="hero-scene" aria-hidden="true">' +
      '<div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>' +
      '<div class="hero-ring">' + ring.map((a, k) => '<span class="hr-tile" style="--k:' + k + '">' + ART.art(a) + '</span>').join('') + '</div>' +
      '<div class="hero-merpi">' + ART.merpi('is-happy') + '<span class="hero-letter">' + ART.art('card') + '</span></div>' +
      '<div class="hero-hearts"><i></i><i></i><i></i><i></i><i></i></div>' +
      '</div>';
  }
  function renderHome() {
    const save = store.get(KEYS.save, null);
    const online = store.get(KEYS.online, null);
    let resume = '';
    if (validSave(save)) {
      const S = save.S;
      resume += '<div class="resume-card"><span class="rc-ic">' + ic('play') + '</span><div class="grow"><b>Lanjutkan permainan</b><div class="tiny">' + esc(S.players.map(p => p.avatar + ' ' + p.name).join(' · ')) + ' · Ronde ' + S.round + '</div></div><button type="button" class="btn primary sm" id="hResume"><span>Lanjut</span></button><button type="button" class="icon-btn" id="hDiscard" aria-label="Hapus simpanan">' + ic('x') + '</button></div>';
    } else if (save) store.del(KEYS.save);
    if (online && online.code) resume += '<div class="resume-card"><span class="rc-ic">' + ic('globe') + '</span><div class="grow"><b>Kembali ke room <span class="mono">' + esc(online.code) + '</span></b><div class="tiny">Sambung ulang ke permainan online terakhir.</div></div><button type="button" class="btn primary sm" id="hRejoin"><span>Masuk</span></button><button type="button" class="icon-btn" id="hForget" aria-label="Lupakan room">' + ic('x') + '</button></div>';
    $('#scrHome').innerHTML = '<div class="home">' +
      '<div class="home-art">' + homeArt() + '</div>' +
      '<div class="home-copy">' +
      '<div class="eyebrow">' + ic('heart') + 'Board game pasangan LDR</div>' +
      '<h1 class="home-title" aria-label="Loveopoly"><span class="ht-word">' + 'Loveopoly'.split('').map((ch, k) => '<span aria-hidden="true" style="--i:' + k + '">' + ch + '</span>').join('') + '</span></h1>' +
      '<p class="home-sub">Keliling dunia berdua: beli kota romantis, bangun sampai landmark, adakan festival, dan rebut kota pasanganmu. Menang dengan monopoli atau bikin lawan bangkrut!</p>' +
      resume +
      '<div class="home-actions">' +
      // Online = kartu utama (paling atas & paling besar); dua mode lain lebih ringkas di bawahnya
      '<button type="button" class="mode-card mc-online mc-hero" id="hOnline"><span class="mc-badge">' + ic('heart') + 'Paling seru buat LDR</span><span class="mc-art">' + ART.art('plane') + '</span><span class="mc-txt"><b>Main Online</b><span>Beda kota? Main bareng pasangan pakai kode room</span></span><span class="mc-go" aria-hidden="true"><span class="mc-go-t">Mulai</span>' + ic('chevron') + '</span></button>' +
      '<div class="mc-row">' +
      '<button type="button" class="mode-card mc-ai mc-sm" id="hAI"><span class="mc-art">' + ART.art('bot') + '</span><span class="mc-txt"><b>Lawan AI</b><span>Easy, Normal, atau Hard</span></span>' + ic('chevron') + '</button>' +
      '<button type="button" class="mode-card mc-local mc-sm" id="hLocal"><span class="mc-art">' + ART.art('festival') + '</span><span class="mc-txt"><b>Main Bareng</b><span>2–4 orang, satu perangkat</span></span>' + ic('chevron') + '</button>' +
      '</div></div>' +
      '<div class="home-secondary"><button type="button" class="btn soft" id="hHow">' + ic('book') + '<span>Buku Panduan</span></button><span class="tiny muted">' + TILES.length + ' petak · ' + TILES.filter(t => t.type === 'city').length + ' kota romantis · ' + TILES.filter(t => t.type === 'spot').length + ' wisata · ' + D.CARDS.length + ' Kartu Cinta · ' + D.CHALLENGES.length + ' tantangan pasangan</span></div>' +
      '</div></div>';
    const on = (id, f) => { const el = $('#' + id); if (el) el.onclick = f; };
    on('hLocal', () => openSetup('local'));
    on('hAI', () => openSetup('ai'));
    on('hOnline', openOnline);
    on('hHow', () => UI.openGuide());
    on('hResume', () => { const s = store.get(KEYS.save, null); if (validSave(s)) enterGame('local', -1, s.S); });
    on('hDiscard', () => { store.del(KEYS.save); renderHome(); });
    on('hRejoin', () => openOnline(true));
    on('hForget', () => { store.del(KEYS.online); renderHome(); });
    // hero miring 3D mengikuti pointer (desktop); layar sentuh & gerak-dikurangi tetap diam
    const hero = $('#scrHome .hero-scene'), scr = $('#scrHome');
    if (hero && scr && !(G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      let raf = 0, tx = 0, ty = 0;
      const put = () => { raf = 0; hero.style.setProperty('--px', tx.toFixed(3)); hero.style.setProperty('--py', ty.toFixed(3)); };
      scr.onpointermove = e => {
        if (e.pointerType !== 'mouse') return;
        const r = hero.getBoundingClientRect();
        if (!r.width) return;
        tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
        ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
        if (!raf) raf = requestAnimationFrame(put);
      };
      scr.onpointerleave = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(put); };
    }
  }

  // ---------- setup lokal / AI ----------
  let setup = null;
  function defaultSetup(kind) {
    const base = store.get(KEYS.setup, null);
    const s = {
      kind,
      players: kind === 'ai'
        ? [{ name: 'Kamu', avatar: '🐻', color: D.TOKEN_COLORS[0], kind: 'human', ai: 'normal' }, { name: D.AI_NAMES[0], avatar: '🐰', color: D.TOKEN_COLORS[1], kind: 'ai', ai: 'normal' }]
        : [{ name: 'Pemain 1', avatar: '🐻', color: D.TOKEN_COLORS[0], kind: 'human', ai: 'normal' }, { name: 'Pemain 2', avatar: '🐰', color: D.TOKEN_COLORS[1], kind: 'human', ai: 'normal' }],
      startCash: RULES.startCash, roundLimit: 25, winMessage: '',
      takeover: true, instantWin: true, diceControl: true
    };
    if (base && base.kind === kind && Array.isArray(base.players) && base.players.length >= 2) {
      Object.assign(s, base);
      s.players = s.players.map((p, i) => Object.assign({}, p, { color: D.TOKEN_COLORS.includes(p.color) ? p.color : D.TOKEN_COLORS[i] }));
      if (![2000, 2500, 3000].includes(s.startCash)) s.startCash = RULES.startCash;
      if (![15, 25, 35, 0].includes(s.roundLimit)) s.roundLimit = 25;
    }
    return s;
  }
  function openSetup(kind) { setup = defaultSetup(kind); show('scrSetup'); renderSetup(); }
  function setupErrors() {
    const errs = {};
    const names = setup.players.map(p => p.name.trim().toLowerCase());
    setup.players.forEach((p, i) => {
      const n = p.name.trim();
      if (!n) errs['name' + i] = 'Nama wajib diisi.';
      else if (n.length > 16) errs['name' + i] = 'Maksimal 16 karakter.';
      else if (names.indexOf(n.toLowerCase()) !== i) errs['name' + i] = 'Nama sudah dipakai pemain lain.';
    });
    if (!setup.players.some(p => p.kind === 'human')) errs.humans = 'Minimal satu pemain manusia.';
    return errs;
  }
  function renderSetup() {
    const errs = setupErrors();
    const s = setup;
    const used = (k, i) => s.players.filter((_, j) => j !== i).map(p => p[k]);
    const seats = s.players.map((p, i) => '<div class="seat-card" style="--c:' + p.color + '">' +
      '<div class="sc-head">' + avatarHTML(p, 'lg') + '<div class="field grow"><label for="pn' + i + '">Pemain ' + (i + 1) + '</label><input class="input' + (errs['name' + i] ? ' invalid' : '') + '" id="pn' + i + '" data-i="' + i + '" maxlength="16" value="' + esc(p.name) + '" autocomplete="off">' + (errs['name' + i] ? '<div class="err">' + esc(errs['name' + i]) + '</div>' : '') + '</div>' +
      (s.players.length > 2 ? '<button type="button" class="icon-btn" data-rm="' + i + '" aria-label="Hapus pemain ' + (i + 1) + '">' + ic('x') + '</button>' : '') + '</div>' +
      '<div class="pick-row" aria-label="Avatar">' + D.AVATARS.map(a => '<button type="button" class="avbtn" data-av="' + i + '" data-v="' + a + '" aria-pressed="' + (p.avatar === a) + '"' + (used('avatar', i).includes(a) ? ' disabled' : '') + ' aria-label="Avatar ' + a + '">' + a + '</button>').join('') + '</div>' +
      '<div class="pick-row swatches" aria-label="Warna pion">' + D.TOKEN_COLORS.map(c => '<button type="button" class="swatch" style="--sw:' + c + '" data-col="' + i + '" data-v="' + c + '" aria-pressed="' + (p.color === c) + '"' + (used('color', i).includes(c) ? ' disabled' : '') + ' aria-label="Warna ' + c + '"></button>').join('') + '</div>' +
      '<div class="pick-row">' + seg('kind' + i, [['human', 'Manusia'], ['ai', 'AI']], p.kind) + (p.kind === 'ai' ? seg('ai' + i, [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], p.ai) : '') + '</div>' +
      '</div>').join('');
    $('#scrSetup').innerHTML = '<div class="setup">' +
      '<div class="setup-head"><button type="button" class="btn ghost" id="sBack">' + ic('back') + '<span>Kembali</span></button><h2>' + (s.kind === 'ai' ? 'Lawan AI' : 'Main Bareng') + '</h2></div>' +
      '<div class="setup-grid">' +
      '<div class="panel"><h3>' + ic('users') + 'Pemain <span class="muted">' + s.players.length + '/4</span></h3><div class="seat-list">' + seats + '</div>' +
      (errs.humans ? '<div class="err">' + esc(errs.humans) + '</div>' : '') +
      (s.players.length < 4 ? '<div class="add-row"><button type="button" class="btn soft" id="sAddH">' + ic('user') + '<span>Tambah pemain</span></button><button type="button" class="btn soft" id="sAddA">' + ic('bot') + '<span>Tambah AI</span></button></div>' : '') + '</div>' +
      '<div class="panel"><h3>' + ic('sliders') + 'Aturan</h3><div class="opt-list">' +
      '<div class="opt"><span class="label">Durasi</span>' + seg('rounds', [[15, 'Singkat · 15'], [25, 'Normal · 25'], [35, 'Panjang · 35'], [0, 'Bebas']], s.roundLimit) + '<div class="tiny muted">' + (s.roundLimit ? 'Setelah ' + s.roundLimit + ' ronde, aset terbesar menang.' : 'Main sampai ada yang menang monopoli atau bangkrut.') + '</div></div>' +
      '<div class="opt"><span class="label">Uang awal</span>' + seg('cash', [[2000, '2.000'], [2500, '2.500'], [3000, '3.000']], s.startCash) + '</div>' +
      '<div class="toggle-row"><div><b>Ambil alih kota</b><div class="tiny muted">Setelah bayar tol, rebut kota lawan seharga 2× nilainya. Landmark & wisata kebal.</div></div><button type="button" class="switch" role="switch" id="sTakeover" aria-checked="' + s.takeover + '" aria-label="Ambil alih kota"></button></div>' +
      '<div class="toggle-row"><div><b>Menang monopoli</b><div class="tiny muted">Triple Monopoli, Monopoli Jalur, atau Monopoli Wisata = menang instan.</div></div><button type="button" class="switch" role="switch" id="sInstant" aria-checked="' + s.instantWin + '" aria-label="Menang monopoli"></button></div>' +
      '<div class="toggle-row"><div><b>Kontrol dadu</b><div class="tiny muted">Bidik hasil kecil, sedang, atau besar sebelum melempar.</div></div><button type="button" class="switch" role="switch" id="sAimCtl" aria-checked="' + s.diceControl + '" aria-label="Kontrol dadu"></button></div>' +
      (!s.takeover && !s.instantWin && !s.diceControl && s.players.some(p => p.kind === 'ai') ? '<div class="note gold">' + ic('dice') + ' Tanpa ketiga aturan ini permainan lebih banyak ditentukan keberuntungan dadu, jadi level AI hanya sedikit berpengaruh.</div>' : '') +
      '<div class="field"><label for="sMsg">Pesan romantis di layar kemenangan (opsional)</label><textarea class="input" id="sMsg" maxlength="240" placeholder="' + esc(D.WIN_MESSAGES[0]) + '">' + esc(s.winMessage) + '</textarea></div>' +
      '</div></div></div>' +
      '<div class="setup-foot sticky-cta"><button type="button" class="btn go" id="sStart"' + (Object.keys(errs).length ? ' disabled' : '') + '>' + ic('heart') + '<span>Mulai Main!</span></button></div>' +
      '</div>';
    bindSetup();
  }
  function bindSetup() {
    const root = $('#scrSetup');
    const s = setup;
    const re = () => { store.set(KEYS.setup, s); renderSetup(); };
    $('#sBack').onclick = () => { show('scrHome'); renderHome(); };
    $$('input[id^="pn"]', root).forEach(inp => {
      inp.addEventListener('input', () => { s.players[Number(inp.dataset.i)].name = inp.value; const errs = setupErrors(); $('#sStart').disabled = Object.keys(errs).length > 0; inp.classList.toggle('invalid', !!errs['name' + inp.dataset.i]); });
      inp.addEventListener('change', re);
    });
    $$('[data-av]', root).forEach(b => b.onclick = () => { s.players[Number(b.dataset.av)].avatar = b.dataset.v; SND.play('click'); re(); });
    $$('[data-col]', root).forEach(b => b.onclick = () => { s.players[Number(b.dataset.col)].color = b.dataset.v; SND.play('click'); re(); });
    $$('[data-rm]', root).forEach(b => b.onclick = () => { s.players.splice(Number(b.dataset.rm), 1); re(); });
    $$('[data-seg]', root).forEach(g => $$('[data-v]', g).forEach(b => b.onclick = () => {
      const name = g.dataset.seg, v = b.dataset.v;
      if (name.startsWith('kind')) { const p = s.players[Number(name.slice(4))]; p.kind = v; if (v === 'ai' && /^Pemain \d$/.test(p.name)) p.name = D.AI_NAMES[Number(name.slice(4)) % 4]; }
      else if (name.startsWith('ai')) s.players[Number(name.slice(2))].ai = v;
      else if (name === 'cash') s.startCash = Number(v);
      else if (name === 'rounds') s.roundLimit = Number(v);
      SND.play('click');
      re();
    }));
    const add = kind => {
      const usedC = s.players.map(p => p.color), usedA = s.players.map(p => p.avatar);
      const n = s.players.length;
      s.players.push({ name: kind === 'ai' ? D.AI_NAMES[n % 4] : 'Pemain ' + (n + 1), avatar: D.AVATARS.find(a => !usedA.includes(a)), color: D.TOKEN_COLORS.find(c => !usedC.includes(c)), kind, ai: 'normal' });
      re();
    };
    const ah = $('#sAddH'); if (ah) ah.onclick = () => add('human');
    const aa = $('#sAddA'); if (aa) aa.onclick = () => add('ai');
    $('#sTakeover').onclick = () => { s.takeover = !s.takeover; re(); };
    $('#sInstant').onclick = () => { s.instantWin = !s.instantWin; re(); };
    $('#sAimCtl').onclick = () => { s.diceControl = !s.diceControl; re(); };
    const msg = $('#sMsg'); msg.addEventListener('input', () => { s.winMessage = msg.value; store.set(KEYS.setup, s); });
    $('#sStart').onclick = () => {
      if (Object.keys(setupErrors()).length) { renderSetup(); return; }
      store.set(KEYS.setup, s);
      const settings = { startCash: s.startCash, roundLimit: s.roundLimit, winMessage: s.winMessage.trim(), takeover: s.takeover !== false, instantWin: s.instantWin !== false, diceControl: s.diceControl !== false };
      const S = E.create({ players: s.players.map(p => ({ name: p.name.trim(), avatar: p.avatar, color: p.color, kind: p.kind, ai: p.ai })), settings });
      SND.unlock();
      SND.play('fanfare');
      enterGame('local', -1, S);
    };
  }

  // ---------- online ----------
  let onlineProfile = null, onlineSettings = null, onlineBusy = false, onlineErr = '';
  function profileDefault() {
    const p = store.get('loveopoly.v1.profile', null);
    const d = { name: '', avatar: '🐻', color: D.TOKEN_COLORS[0] };
    if (!p) return d;
    return Object.assign(d, p, { color: D.TOKEN_COLORS.includes(p.color) ? p.color : D.TOKEN_COLORS[0] });
  }
  async function openOnline(autoRejoin) {
    show('scrOnline');
    onlineProfile = onlineProfile || profileDefault();
    onlineSettings = onlineSettings || { startCash: RULES.startCash, roundLimit: 25, rules: 'seru' };
    onlineErr = '';
    $('#scrOnline').innerHTML = '<div class="empty big"><div class="spinner"></div><b>Menyiapkan koneksi online…</b><span>Menghubungkan ke server game.</span></div>';
    const ok = await Net.init();
    if (!ok) { renderOnlineUnavailable(); return; }
    const saved = store.get(KEYS.online, null);
    if (autoRejoin === true && saved && saved.code) {
      try { await Net.joinRoom(saved.code, onlineProfile.name ? onlineProfile : null); }
      catch (e) { onlineErr = e.message; store.del(KEYS.online); }
    }
    if (Net.doc && Net.doc.status === 'playing' && Net.mySeat() >= 0) return;
    renderLobby();
  }
  function renderOnlineUnavailable() {
    $('#scrOnline').innerHTML = '<div class="online"><div class="panel wide"><h3>' + ic('globe') + 'Mode online belum bisa dipakai</h3><p class="muted">' + esc(Net.initErr || 'Koneksi online tidak tersedia.') + '</p>' +
      '<div class="note">' + ic('info') + '<div><b>Cara main online</b><ol class="note-steps">' +
      '<li>Pastikan internet kalian berdua aktif.</li>' +
      '<li>Bagikan link game ini ke pasangan.</li>' +
      '<li>Satu orang membuat room, yang lain bergabung dengan kodenya.</li></ol></div></div>' +
      '<div class="setup-foot"><button type="button" class="btn ghost" id="oBack">' + ic('back') + '<span>Kembali</span></button><button type="button" class="btn ghost" id="oRetry">' + ic('globe') + '<span>Coba lagi</span></button><button type="button" class="btn primary" id="oLocal">' + ic('users') + '<span>Main Bareng Saja</span></button></div></div></div>';
    $('#oBack').onclick = () => { show('scrHome'); renderHome(); };
    $('#oLocal').onclick = () => openSetup('local');
    $('#oRetry').onclick = () => { Net.initDone = false; if (G.LoveBackend && G.LoveBackend._reset) G.LoveBackend._reset(); openOnline(); };
  }
  function profileFields(prefix) {
    const p = onlineProfile;
    return '<div class="sc-head">' + avatarHTML(p, 'lg') + '<div class="field grow"><label for="' + prefix + 'Name">Nama kamu</label><input class="input" id="' + prefix + 'Name" maxlength="16" value="' + esc(p.name) + '" placeholder="mis. Arfi"></div></div>' +
      '<div class="pick-row" aria-label="Avatar">' + D.AVATARS.map(a => '<button type="button" class="avbtn" data-pav="' + a + '" aria-pressed="' + (p.avatar === a) + '">' + a + '</button>').join('') + '</div>' +
      '<div class="pick-row swatches" aria-label="Warna pion">' + D.TOKEN_COLORS.map(c => '<button type="button" class="swatch" style="--sw:' + c + '" data-pcol="' + c + '" aria-pressed="' + (p.color === c) + '" aria-label="Warna ' + c + '"></button>').join('') + '</div>';
  }
  function renderLobby() {
    const host = $('#scrOnline');
    if (!host || host.hidden) return;
    const d = Net.doc;
    if (!d || !Net.code || Net.kicked) {
      const st = onlineSettings;
      host.innerHTML = '<div class="setup-head"><button type="button" class="btn ghost" id="oBack">' + ic('back') + '<span>Kembali</span></button><h2>Main Online</h2></div>' +
        (onlineErr ? '<div class="note warn page">' + ic('alert') + ' ' + esc(onlineErr) + '</div>' : '') +
        '<div class="online">' +
        '<div class="panel"><h3>' + ic('user') + 'Profilmu</h3><div class="seat-card" style="--c:' + onlineProfile.color + '">' + profileFields('o') + '</div></div>' +
        '<div class="panel stack"><div class="form-sec"><h3>' + ic('plus') + 'Buat room baru</h3><div class="opt-list">' +
        '<div class="opt"><span class="label">Durasi</span>' + seg('orounds', [[15, '15'], [25, '25'], [35, '35'], [0, 'Bebas']], st.roundLimit) + '</div>' +
        '<div class="opt"><span class="label">Uang awal</span>' + seg('ocash', [[2000, '2.000'], [2500, '2.500'], [3000, '3.000']], st.startCash) + '</div>' +
        '<div class="opt"><span class="label">Aturan</span>' + seg('orules', [['seru', 'Lengkap'], ['santai', 'Santai']], st.rules) + '<div class="tiny muted">' + (st.rules === 'seru' ? 'Ambil alih, menang monopoli, dan kontrol dadu aktif.' : 'Tanpa ambil alih dan menang instan: aset terbesar menang.') + '</div></div>' +
        '<button type="button" class="btn primary" id="oCreate"' + (onlineBusy ? ' disabled' : '') + '>' + ic('heart') + '<span>Buat Room</span></button></div></div>' +
        '<div class="form-sec"><h3>' + ic('globe') + 'Gabung dengan kode</h3><div class="field"><label for="oCode">Kode room (6 karakter)</label><input class="input mono code-in" id="oCode" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Contoh: AB12CD"></div>' +
        '<button type="button" class="btn lilac" id="oJoin"' + (onlineBusy ? ' disabled' : '') + '>' + ic('chevron') + '<span>Gabung Room</span></button><div class="err" id="oErr" hidden></div></div></div>' +
        '</div>';
      bindProfile(host);
      $('#oBack').onclick = () => { show('scrHome'); renderHome(); };
      $$('[data-seg]', host).forEach(g => $$('[data-v]', g).forEach(b => b.onclick = () => {
        const n = g.dataset.seg, v = b.dataset.v;
        if (n === 'ocash') st.startCash = Number(v); if (n === 'orounds') st.roundLimit = Number(v); if (n === 'orules') st.rules = v;
        renderLobby();
      }));
      const err = $('#oErr');
      const check = () => {
        const n = onlineProfile.name.trim();
        if (!n) { err.hidden = false; err.textContent = 'Isi nama kamu dulu.'; $('#oName').classList.add('invalid'); return false; }
        return true;
      };
      $('#oCreate').onclick = async () => {
        if (!check()) return;
        onlineBusy = true; renderLobby();
        try {
          const seru = st.rules === 'seru';
          await Net.createRoom({ name: onlineProfile.name.trim(), avatar: onlineProfile.avatar, color: onlineProfile.color }, { startCash: st.startCash, roundLimit: st.roundLimit, takeover: seru, instantWin: seru, diceControl: seru });
          onlineErr = '';
        } catch (e) { onlineErr = 'Gagal membuat room: ' + (e && e.message ? e.message : e); }
        onlineBusy = false; renderLobby();
      };
      $('#oJoin').onclick = async () => {
        if (!check()) return;
        const code = $('#oCode').value.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(code)) { err.hidden = false; err.textContent = 'Kode room terdiri dari 6 huruf/angka.'; $('#oCode').classList.add('invalid'); return; }
        onlineBusy = true; renderLobby();
        try { await Net.joinRoom(code, { name: onlineProfile.name.trim(), avatar: onlineProfile.avatar, color: onlineProfile.color }); onlineErr = ''; }
        catch (e) { onlineErr = e && e.message ? e.message : String(e); Net.teardown(); }
        onlineBusy = false;
        if (!(Net.doc && Net.doc.status === 'playing')) renderLobby();
      };
      return;
    }
    const isHost = Net.isHost();
    const me = Net.mySeat();
    const seats = d.seats.map((s, i) => {
      const on = s.bot ? true : Net.isOnline(s.uid);
      return '<div class="seat-chip" style="--c:' + esc(s.color) + '">' + avatarHTML(s, 'sm') + '<div class="grow"><b>' + esc(s.name) + '</b>' + (i === 0 ? ' <span class="chip">Host</span>' : '') + (i === me ? ' <span class="chip lilac">Kamu</span>' : '') + (s.bot ? ' <span class="chip plain">' + ic('bot') + 'AI</span>' : '') + '</div>' +
        (s.bot && isHost ? seg('bot' + i, [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], s.ai || 'normal') : '') +
        (on == null || s.bot ? '' : '<span class="online-dot' + (on ? ' on' : '') + '" title="' + (on ? 'Online' : 'Offline') + '"></span>') +
        (isHost && i > 0 ? '<button type="button" class="icon-btn" data-rmseat="' + i + '" aria-label="Keluarkan ' + esc(s.name) + '">' + ic('x') + '</button>' : '') + '</div>';
    }).join('');
    const pending = me < 0 && !Net.kicked;
    const st = d.settings || {};
    host.innerHTML = '<div class="setup-head"><button type="button" class="btn ghost" id="oLeave">' + ic('back') + '<span>Keluar Room</span></button><h2>Lobby Room</h2></div>' +
      (onlineErr ? '<div class="note warn page">' + ic('alert') + ' ' + esc(onlineErr) + '</div>' : '') +
      '<div class="online"><div class="panel stack"><h3>' + ic('globe') + 'Kode room</h3><div class="code-box" id="codeBox">' + esc(Net.code) + '</div>' +
      '<button type="button" class="btn soft" id="oCopy">' + ic('copy') + '<span>Salin kode</span></button>' +
      '<div class="note">' + ic('info') + ' Kirim kode ini ke pasanganmu. Minta dia buka <b>' + esc(location.host || 'Loveopoly') + '</b>, pilih <b>Main Online</b>, ketik kodenya di <b>Gabung dengan kode</b>, lalu tekan Gabung Room. Tanpa daftar akun, langsung main!</div>' +
      '<div class="tiny muted">Uang awal ' + fmt(st.startCash || RULES.startCash) + (st.roundLimit ? ' · ' + st.roundLimit + ' ronde' : ' · tanpa batas ronde') + ' · aturan ' + (st.takeover ? 'lengkap' : 'santai') + '</div></div>' +
      '<div class="panel stack"><h3>' + ic('users') + 'Pemain <span class="muted">' + d.seats.length + '/4</span></h3>' + seats +
      (pending ? '<div class="note">' + ic('clock') + ' Menunggu host menerima kamu…</div>' : '') +
      (isHost ? '<div class="add-row">' + (d.seats.length < 4 ? '<button type="button" class="btn soft" id="oBot">' + ic('bot') + '<span>Tambah Bot</span></button>' : '') + '<button type="button" class="btn go" id="oStart"' + (d.seats.length < 2 ? ' disabled' : '') + '>' + ic('heart') + '<span>Mulai</span></button></div>' + (d.seats.length < 2 ? '<div class="tiny muted">Butuh minimal 2 pemain. Tunggu pasanganmu bergabung atau tambah bot.</div>' : '')
        : (me >= 0 ? '<div class="note">' + ic('clock') + ' Menunggu host memulai permainan…</div>' : '')) +
      '</div></div>';
    $('#oLeave').onclick = async () => { await Net.leave(); onlineErr = ''; renderLobby(); };
    $('#oCopy').onclick = () => {
      const txt = Net.code;
      const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#codeBox')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Kode dipilih, salin manual dengan Ctrl/Cmd+C.'); };
      try { navigator.clipboard.writeText(txt).then(() => toast('Kode room disalin.', { kind: 'good', icon: 'copy' }), fallback); } catch (e) { fallback(); }
    };
    $$('[data-rmseat]', host).forEach(b => b.onclick = () => Net.removeSeat(Number(b.dataset.rmseat)));
    $$('[data-seg^="bot"]', host).forEach(g => $$('[data-v]', g).forEach(b => b.onclick = () => Net.setBotLevel(Number(g.dataset.seg.slice(3)), b.dataset.v)));
    const bb = $('#oBot'); if (bb) bb.onclick = () => Net.addBot();
    const sb = $('#oStart'); if (sb) sb.onclick = () => Net.startGame();
  }
  function bindProfile(root) {
    const p = onlineProfile;
    const save = () => store.set('loveopoly.v1.profile', p);
    const n = $('#oName', root);
    if (n) n.addEventListener('input', () => { p.name = n.value; n.classList.remove('invalid'); save(); });
    $$('[data-pav]', root).forEach(b => b.onclick = () => { p.avatar = b.dataset.pav; save(); renderLobby(); });
    $$('[data-pcol]', root).forEach(b => b.onclick = () => { p.color = b.dataset.pcol; save(); renderLobby(); });
  }

  // ---------- masuk / keluar game ----------
  let resizeBound = false;
  function enterGame(mode, seat, S) {
    UI.cleanState(S);
    clearTimeout(App.aiTimer);
    UI.closeModal(true);
    closeOverlay();
    App.mode = mode;
    App.net = mode === 'online' ? Net : null;
    App.seat = mode === 'online' ? (seat >= 0 ? seat : Net.mySeat()) : -1;
    UI.clearFx();
    App.S = S; App.shown = S; App.pending = []; App.animating = false; App.focus = -1; App.lastLogN = S.logN;
    App.cam.zoomed = App.prefs.view3d !== false ? App.cam.pref3d === 'near' : App.cam.pref === 'near'; App.cam.manualUntil = 0; App.cam.L = 0;
    show('scrGame');
    UI.buildBoard();
    UI.applyLayout(true);
    UI.bindCamDrag();
    UI.renderAll();
    requestAnimationFrame(() => { UI.sizeBoard(); UI.renderTokens(); const p = S.players[E.actor(S) >= 0 ? E.actor(S) : S.turn.p]; if (p) UI.camFocus(p.pos, false, 0, true); UI.camApply(false); });
    if (!resizeBound) {
      resizeBound = true;
      let t = null;
      addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (App.S && !$('#scrGame').hidden) { UI.applyLayout(); UI.renderAll(); } }, 80); });
    }
    UI.persist();
    afterSettle();
    if (!S.over) setTimeout(startTour, UI.reduceMotion() ? 50 : 1300);
    setTimeout(() => { if (App.S === S && !App.tour) UI.merpiSay(UI.pick(D.MERPI.hello), 'happy', 2600); }, 700);
  }
  function exitToHome() {
    clearTimeout(App.aiTimer);
    UI.closeModal(true);
    closeOverlay();
    endTour(false);
    if (App.mode === 'online') Net.teardown();
    UI.clearFx();
    App.S = null; App.shown = null; App.mode = 'local'; App.net = null; App.pending = [];
    show('scrHome');
    renderHome();
  }

  // ---------- jeda ----------
  function togglePause() {
    const S = App.S;
    if (!S || S.over) return;
    const v = UI.viewer();
    const p = UI.controls(v) ? v : S.players.findIndex(x => !x.bankrupt && UI.controls(x.i));
    if (p < 0) { toast('Kamu tidak mengendalikan pemain di permainan ini.', { kind: 'err' }); return; }
    UI.act({ type: 'PAUSE', p });
  }
  function renderPause() {
    const root = $('#overlayRoot');
    const S = App.S;
    const exist = $('#pauseOv');
    if (S && S.paused && !S.over) {
      if (exist) return;
      const el = document.createElement('div');
      el.className = 'overlay'; el.id = 'pauseOv';
      el.innerHTML = '<div class="pause-card" role="dialog" aria-modal="true" aria-labelledby="pauseT">' + ART.merpi('is-think') + '<h2 id="pauseT">Istirahat dulu</h2><p class="muted">Minum air, kirim stiker ke pasangan. Permainan menunggu.</p><button type="button" class="btn go" id="pResume">' + ic('play') + '<span>Lanjutkan</span></button><button type="button" class="btn ghost" id="pExit">' + ic('exit') + '<span>Keluar ke menu</span></button></div>';
      root.appendChild(el);
      $('#pResume').onclick = togglePause;
      $('#pExit').onclick = UI.openExit;
      setTimeout(() => $('#pResume') && $('#pResume').focus(), 50);
    } else if (exist) exist.remove();
  }
  function closeOverlay() { $('#overlayRoot').innerHTML = ''; }

  // ---------- layar menang ----------
  let confettiStop = null;
  function confetti(canvas) {
    if (UI.reduceMotion()) return () => {};
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, G.devicePixelRatio || 1);
    const resize = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
    resize();
    const cols = ['#FF4F8B', '#FFD93D', '#3DDBD9', '#B79CFF', '#FF9F43', '#7BCF5D'];
    const parts = Array.from({ length: 180 }, () => ({ x: Math.random() * canvas.width, y: -Math.random() * canvas.height * 0.8, vx: (Math.random() - 0.5) * 2 * dpr, vy: (2 + Math.random() * 3) * dpr, r: (5 + Math.random() * 7) * dpr, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.2, c: cols[Math.floor(Math.random() * cols.length)], heart: Math.random() < 0.35 }));
    let raf = 0;
    const t0 = performance.now();
    const heart = (x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y + s * 0.3); ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3); ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s); ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3); ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3); ctx.fill(); };
    const tick = now => {
      const el = (now - t0) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.a += p.va;
        if (p.y > canvas.height + 20 && el < 4.5) { p.y = -20; p.x = Math.random() * canvas.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        if (p.heart) heart(0, -p.r / 2, p.r * 1.4); else ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      });
      if (el < 9) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(tick);
    addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }
  let winMsgOverride = null;
  function showWin() {
    const S = App.S;
    if (!S || !S.over) return;
    UI.closeModal(true);
    UI.endPick(true);
    const root = $('#overlayRoot');
    if ($('#winOv')) return;
    const tw = $('#toasts'); if (tw) tw.innerHTML = '';
    const bn = $('#boardVP .banner'); if (bn) bn.remove();
    const o = S.over, w = S.players[o.winner];
    const instant = o.reason === 'triple' || o.reason === 'line' || o.reason === 'spots';
    const reason = {
      bankrupt: 'Semua lawan bangkrut', rounds: 'Aset terbesar saat batas ronde', manual: 'Aset terbesar saat permainan diakhiri', resign: 'Lawan menyerah',
      triple: 'Triple Monopoli: menguasai 3 grup warna', line: 'Monopoli Jalur: menguasai seluruh ' + (o.detail ? E.sideName(o.detail.side) : 'jalur'), spots: 'Monopoli Wisata: menguasai 5 tempat wisata'
    }[o.reason] || '';
    const msg = winMsgOverride || S.settings.winMessage || D.WIN_MESSAGES[S.seed % D.WIN_MESSAGES.length];
    const rows = o.ranking.map((i, k) => {
      const p = S.players[i];
      return '<div class="rank-row' + (k === 0 ? ' first' : '') + '" style="--c:' + p.color + '"><span class="rk">' + (k + 1) + '</span>' + avatarHTML(p, 'sm') + '<span class="rk-name"><b>' + esc(p.name) + '</b><small>' + esc(o.titles[i] || '') + (p.bankrupt ? ' · bangkrut ronde ' + p.stats.bankruptRound : '') + '</small></span><span class="rk-worth">' + coin + fmt(o.worth ? o.worth[i] : E.netWorth(S, i)) + '</span></div>';
    }).join('');
    const statRows = S.players.map(p => '<tr><td>' + esc(p.avatar + ' ' + p.name) + '</td><td>' + E.ownedBy(S, p.i).length + '</td><td>' + p.stats.landmarks + '</td><td>' + fmt(p.stats.tollIn) + '</td><td>' + p.stats.takeovers + '</td><td>' + p.stats.challenges + '</td><td>' + p.love + '</td></tr>').join('');
    const ach = S.players.map(p => '<div><b>' + esc(p.avatar + ' ' + p.name) + '</b><div class="ach-list">' + (p.achievements.length ? p.achievements.map(id => '<span class="ach">' + ic(E.ACH[id].icon in G.LoveIcons.paths ? E.ACH[id].icon : 'trophy') + esc(E.ACH[id].name) + '</span>').join('') : '<span class="tiny muted">Belum ada achievement.</span>') + '</div></div>').join('');
    const letters = S.letters.length ? '<div class="letters">' + S.letters.slice().reverse().map(l => '<div class="letter"><span class="from">' + ic('letter') + ' Dari ' + esc(S.players[l.p].name) + ' · ronde ' + l.r + '</span>' + esc(l.text) + '</div>').join('') + '</div>' : '<div class="empty">' + ic('letter') + 'Belum ada surat cinta di permainan ini.</div>';
    const el = document.createElement('div');
    el.className = 'win'; el.id = 'winOv';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'winName');
    el.innerHTML = '<canvas id="confetti" aria-hidden="true"></canvas><div class="win-card">' +
      '<div class="win-hero"><div class="eyebrow">' + (instant ? 'Menang instan' : 'Pemenang') + ' · ronde ' + o.round + '</div>' +
      '<div class="win-stage"><span class="rays" aria-hidden="true"></span><span class="win-merpi">' + ART.merpi('is-love') + '</span><div class="win-av">' + avatarHTML(w, 'xl') + '<span class="win-crown">' + ic('crown') + '</span></div></div>' +
      '<div class="win-name" id="winName">' + esc(w.name) + '</div><div class="win-title">' + esc(o.titles[o.winner] || 'Juragan Cinta') + '</div><div class="win-reason">' + esc(reason) + '</div>' +
      '<p class="win-msg" id="winMsg">“' + esc(msg) + '”</p>' +
      '<div class="field msg-edit"><label for="winMsgIn">Ubah pesan romantis</label><textarea class="input" id="winMsgIn" maxlength="240">' + esc(msg) + '</textarea></div></div>' +
      '<div class="panel"><h3>' + ic('trophy') + 'Peringkat</h3><div class="rank-list">' + rows + '</div></div>' +
      '<div class="panel"><h3>' + ic('level') + 'Statistik</h3><div class="stats-wrap"><table class="stats"><thead><tr><th>Pemain</th><th>Kota</th><th>Landmark</th><th>Tol masuk</th><th>Ambil alih</th><th>Tantangan</th><th>Love</th></tr></thead><tbody>' + statRows + '</tbody></table></div></div>' +
      '<div class="panel stack"><h3>' + ic('sparkle') + 'Achievement</h3>' + ach + '</div>' +
      '<div class="panel stack"><h3>' + ic('letter') + 'Surat cinta selama permainan</h3>' + letters + '</div>' +
      '<div class="setup-foot"><button type="button" class="btn ghost" id="wBoard">' + ic('map') + '<span>Lihat Papan</span></button>' + (App.mode === 'online' && !Net.isHost() ? '' : '<button type="button" class="btn soft" id="wAgain">' + ic('refresh') + '<span>Main Lagi</span></button>') + '<button type="button" class="btn primary" id="wHome">' + ic('home') + '<span>Menu Utama</span></button></div>' +
      '</div>';
    root.appendChild(el);
    SND.play('win');
    confettiStop = confetti($('#confetti'));
    const inp = $('#winMsgIn');
    inp.addEventListener('input', () => { winMsgOverride = inp.value.trim() || null; $('#winMsg').textContent = '“' + (inp.value.trim() || msg) + '”'; });
    $('#wBoard').onclick = () => { if (confettiStop) confettiStop(); el.remove(); };
    $('#wHome').onclick = () => { if (confettiStop) confettiStop(); winMsgOverride = null; exitToHome(); };
    const again = $('#wAgain');
    if (again) again.onclick = () => {
      if (confettiStop) confettiStop();
      winMsgOverride = null;
      if (App.mode === 'online') { Net.startGame(); return; }
      const ns = E.create({ players: S.players.map(p => ({ name: p.name, avatar: p.avatar, color: p.color, kind: p.kind, ai: p.ai })), settings: S.settings });
      enterGame('local', -1, ns);
    };
    setTimeout(() => { const b = $('#wHome'); if (b) b.focus({ preventScroll: true }); }, 60);
  }

  // ---------- tur singkat di game pertama ----------
  function tourSteps(S) {
    const st = S.settings, steps = [];
    steps.push({ sel: '#centerActions', title: 'Mulai dari sini', text: st.diceControl ? 'Pilih bidikan dadu (opsional), lalu tekan Lempar. Dadu kembar = lempar lagi!' : 'Tekan Lempar untuk berjalan. Dadu kembar = lempar lagi!' });
    steps.push({ sel: '#boardVP', title: 'Beli kota, bangun, tarik tol', text: 'Mendarat di kota kosong: beli tanah + villa/gedung/hotel sekaligus. Ketuk petak mana pun untuk melihat detailnya.' });
    if (st.instantWin) steps.push({ sel: '#game .pcard', title: 'Menang lebih cepat', text: 'Kuasai 3 grup warna, satu jalur penuh, atau 5 tempat wisata. Petak berdenyut = ada yang hampir menang!' });
    steps.push({ sel: '#hMenu', title: 'Menu & panduan', text: 'Buku Panduan bergambar, riwayat, dan pengaturan ada di sini.' });
    return steps;
  }
  let tourPlace = null;
  function endTour(done) {
    const ov = $('#tourOv');
    if (ov) ov.remove();
    if (tourPlace) { removeEventListener('resize', tourPlace); tourPlace = null; }
    if (done) store.set(KEYS.tour, 'done');
    if (!App.tour) return;
    App.tour = false;
    if (App.S) { UI.syncModal(); UI.renderStage(); UI.scheduleAI(); UI.scheduleAutoEnd(); }
  }
  function startTour() {
    const S = App.S;
    if (!S || S.over || $('#scrGame').hidden || store.get(KEYS.tour, null) === 'done' || $('#tourOv') || $('#winOv') || $('#guideOv')) return;
    const steps = tourSteps(S).filter(s => $(s.sel));
    if (!steps.length) return;
    let k = 0;
    App.tour = true;
    clearTimeout(App.aiTimer);
    UI.cancelAutoEnd();
    const ov = document.createElement('div');
    ov.className = 'tour'; ov.id = 'tourOv';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'tourT');
    ov.innerHTML = '<div class="tour-ring"></div><div class="tour-card"><span class="tour-merpi">' + ART.merpi('is-happy') + '</span><div class="tour-step"></div><b id="tourT"></b><p id="tourP"></p><div class="tour-foot"><button type="button" class="btn ghost sm" id="tSkip"><span>Lewati</span></button><span class="grow"></span><button type="button" class="btn primary sm" id="tNext"></button></div></div>';
    document.body.appendChild(ov);
    const ring = $('.tour-ring', ov), card = $('.tour-card', ov);
    tourPlace = () => {
      const el = $(steps[k].sel);
      const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0, right: innerWidth / 2, bottom: innerHeight / 2 };
      const pad = 8, top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
      const h = Math.min(innerHeight - 8, r.bottom + pad) - top, w = Math.min(innerWidth - 8, r.right + pad) - left;
      Object.assign(ring.style, { top: top + 'px', left: left + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
      const cw = Math.min(340, innerWidth - 32);
      card.style.width = cw + 'px';
      const ch = card.offsetHeight;
      let ct = top + h + 14;
      if (ct + ch > innerHeight - 12) ct = top - ch - 14;
      if (ct < 12) ct = Math.max(12, Math.min(innerHeight - ch - 12, top + h / 2 - ch / 2));
      const cl = Math.max(16, Math.min(innerWidth - cw - 16, left + w / 2 - cw / 2));
      card.style.top = ct + 'px'; card.style.left = cl + 'px';
    };
    const showStep = () => {
      const st = steps[k];
      $('.tour-step', ov).textContent = 'Tur singkat · ' + (k + 1) + '/' + steps.length;
      $('#tourT', ov).textContent = st.title;
      $('#tourP', ov).textContent = st.text;
      $('#tNext', ov).innerHTML = '<span>' + (k === steps.length - 1 ? 'Mulai main!' : 'Lanjut') + '</span>';
      card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
      requestAnimationFrame(tourPlace);
    };
    $('#tNext', ov).onclick = () => { SND.play('click'); if (++k >= steps.length) endTour(true); else showStep(); };
    $('#tSkip', ov).onclick = () => endTour(true);
    addEventListener('resize', tourPlace);
    showStep();
    setTimeout(() => { const b = $('#tNext', ov); if (b) b.focus({ preventScroll: true }); }, 80);
  }

  // ---------- setelah state stabil ----------
  function afterSettle() {
    const S = App.S;
    if (!S) return;
    renderPause();
    if (S.over) { UI.renderStage(); if (App.modal && App.modal.decision) UI.closeModal(true); UI.endPick(true); showWin(); return; }
    if (!App.tour) UI.syncModal();
    UI.renderStage();
    UI.scheduleAI();
    UI.scheduleAutoEnd();
  }
  function onLetter(p) {
    const S = App.S;
    if (!S) return;
    const l = S.letters.slice().reverse().find(x => x.p === p);
    if (!l) return;
    if (UI.controls(p) && App.mode === 'online') { toast('Pesanmu terkirim dan tersimpan sampai akhir permainan.', { icon: 'letter', kind: 'good' }); return; }
    toast(l.text, { title: 'Surat cinta dari ' + S.players[p].name, icon: 'letter', kind: 'love', ms: 6500 });
  }

  // ---------- boot ----------
  function bindHeader() {
    $('#hSound').onclick = () => { App.prefs.sound = !App.prefs.sound; SND.setEnabled(App.prefs.sound); if (App.prefs.sound) SND.play('click'); savePrefs(); syncSoundBtn(); };
    $('#hGuide').onclick = () => UI.openGuide();
    $('#hSettings').onclick = UI.openSettings;
    $('#hMenu').onclick = () => UI.openMenu();
    $('#brandHome').onclick = e => { e.preventDefault(); if (App.S && !$('#scrGame').hidden) UI.openExit(); else { show('scrHome'); renderHome(); } };
    $('#hMenu').innerHTML = ic('menu'); $('#hGuide').innerHTML = ic('book'); $('#hSettings').innerHTML = ic('sliders');
    $('.brand-mark').innerHTML = ART.merpi('');
  }
  function boot() {
    document.documentElement.lang = 'id';
    // tata letak papan memakai container query (iOS 16+, Chrome/Edge 105+, Firefox 110+)
    const modern = !!(G.CSS && CSS.supports && CSS.supports('container-type: inline-size'));
    if (!modern) setTimeout(() => toast('Browser kamu terlalu lama untuk Loveopoly. Perbarui iOS / Chrome agar papan tampil rapi.', { kind: 'err', title: 'Perbarui browser', ms: 9000 }), 600);
    if (!$('#iconSprite')) { const d = document.createElement('div'); d.id = 'iconSprite'; d.innerHTML = G.LoveIcons.sprite(); document.body.prepend(d); }
    applyTheme();
    SND.setEnabled(App.prefs.sound);
    syncSoundBtn();
    bindHeader();
    document.addEventListener('pointerdown', () => SND.unlock(), { once: true });
    show('scrHome');
    renderHome();
  }

  Object.assign(UI, { show, savePrefs, applyTheme, syncSoundBtn, renderHome, openSetup, openOnline, renderLobby, enterGame, exitToHome, togglePause, showWin, afterSettle, onLetter, boot, startTour, endTour });

  const start = () => { try { boot(); } catch (e) { console.error(e); const m = document.getElementById('fatal'); if (m) { m.hidden = false; m.textContent = 'Terjadi kesalahan saat memuat game: ' + e.message; } } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
