/* LOVEOPOLY — layar › menu online & lobi (dikumpulkan lewat src/ui/screens.js) */
import { backend } from '../../net/backend.js';
import { Net } from '../../net/net.js';
import { track } from '../../analytics.js';
import { D, RULES, KEYS, fmt, esc, ic, $, $$, store, toast, avatarHTML, t } from '../core.js';

const T = x => esc(t(x));
import { activeScreen, seg, show } from './base.js';
import { passport } from './passport.js';
import { renderHome } from './home.js';
import { openSetup } from './setup.js';

// ---------- online ----------
let onlineProfile = null,
  onlineSettings = null,
  onlineBusy = false,
  onlineErr = '';
function profileDefault() {
  const p = store.get('loveopoly.v1.profile', null);
  const d = { name: '', avatar: '🐻', color: D.TOKEN_COLORS[0] };
  if (!p) return d;
  return Object.assign(d, p, { color: D.TOKEN_COLORS.includes(p.color) ? p.color : D.TOKEN_COLORS[0] });
}
async function openOnline(autoRejoin) {
  show('scrOnline', 'online');
  onlineProfile = onlineProfile || profileDefault();
  onlineSettings = onlineSettings || { startCash: RULES.startCash, roundLimit: 25, rules: 'seru' };
  onlineErr = '';
  $('#scrOnline').innerHTML =
    '<div class="empty big"><div class="spinner"></div><b>' +
    T('Menyiapkan koneksi online…') +
    '</b><span>' +
    T('Menghubungkan ke server game.') +
    '</span></div>';
  const ok = await Net.init();
  if (!ok) {
    renderOnlineUnavailable();
    return;
  }
  const saved = store.get(KEYS.online, null);
  if (autoRejoin === true && saved && saved.code) {
    try {
      await Net.joinRoom(saved.code, onlineProfile.name ? onlineProfile : null);
    } catch (e) {
      onlineErr = e.message;
      store.del(KEYS.online);
    }
  }
  if (Net.doc && Net.doc.status === 'playing' && Net.mySeat() >= 0) return;
  renderLobby();
}
function renderOnlineUnavailable() {
  $('#scrOnline').innerHTML =
    '<div class="online"><div class="panel wide"><h3>' +
    ic('globe') +
    T('Mode online belum bisa dipakai') +
    '</h3><p class="muted">' +
    esc(Net.initErr || t('Koneksi online tidak tersedia.')) +
    '</p>' +
    '<div class="note">' +
    ic('info') +
    '<div><b>' +
    T('Cara main online') +
    '</b><ol class="note-steps">' +
    [
      'Pastikan internet kalian berdua aktif.',
      'Bagikan link game ini ke pasangan.',
      'Satu orang membuat room, yang lain bergabung dengan kodenya.',
    ]
      .map(x => '<li>' + T(x) + '</li>')
      .join('') +
    '</ol></div></div>' +
    '<div class="setup-foot"><button type="button" class="btn ghost" id="oBack">' +
    ic('back') +
    '<span>' +
    T('Kembali') +
    '</span></button><button type="button" class="btn ghost" id="oRetry">' +
    ic('globe') +
    '<span>' +
    T('Coba lagi') +
    '</span></button><button type="button" class="btn primary" id="oLocal">' +
    ic('users') +
    '<span>' +
    T('Main Bareng Saja') +
    '</span></button></div></div></div>';
  $('#oBack').onclick = () => {
    show('scrHome', 'online');
    renderHome();
  };
  $('#oLocal').onclick = () => openSetup('local');
  $('#oRetry').onclick = () => {
    Net.initDone = false;
    const B = backend();
    if (B && B._reset) B._reset();
    openOnline();
  };
}
function profileFields(prefix) {
  const p = onlineProfile;
  return (
    '<div class="sc-head">' +
    avatarHTML(p, 'lg') +
    '<div class="field grow"><label for="' +
    prefix +
    'Name">' +
    T('Nama kamu') +
    '</label><input class="input" id="' +
    prefix +
    'Name" maxlength="16" value="' +
    esc(p.name) +
    '" placeholder="' +
    T('mis. Arfi') +
    '"></div></div>' +
    '<div class="pick-row" aria-label="' +
    T('Avatar') +
    '">' +
    D.AVATARS.map(
      a => '<button type="button" class="avbtn" data-pav="' + a + '" aria-pressed="' + (p.avatar === a) + '">' + a + '</button>'
    ).join('') +
    '</div>' +
    '<div class="pick-row swatches" aria-label="' +
    T('Warna pion') +
    '">' +
    D.TOKEN_COLORS.map(
      c =>
        '<button type="button" class="swatch" style="--sw:' +
        c +
        '" data-pcol="' +
        c +
        '" aria-pressed="' +
        (p.color === c) +
        '" aria-label="' +
        esc(t('Warna {c}', { c })) +
        '"></button>'
    ).join('') +
    '</div>'
  );
}
function renderLobby() {
  const host = $('#scrOnline');
  if (!host || activeScreen() !== 'scrOnline') return;
  const d = Net.doc;
  if (!d || !Net.code || Net.kicked) {
    const st = onlineSettings;
    host.innerHTML =
      '<div class="setup-head"><button type="button" class="btn ghost" id="oBack">' +
      ic('back') +
      '<span>' +
      T('Kembali') +
      '</span></button><h2>' +
      T('Main Online') +
      '</h2></div>' +
      (onlineErr ? '<div class="note warn page">' + ic('alert') + ' ' + esc(onlineErr) + '</div>' : '') +
      '<div class="online">' +
      '<div class="panel"><h3>' +
      ic('user') +
      T('Profilmu') +
      '</h3><div class="seat-card" style="--c:' +
      onlineProfile.color +
      '">' +
      profileFields('o') +
      '</div></div>' +
      '<div class="panel stack"><div class="form-sec"><h3>' +
      ic('plus') +
      T('Buat room baru') +
      '</h3><div class="opt-list">' +
      '<div class="opt"><span class="label">' +
      T('Durasi') +
      '</span>' +
      seg(
        'orounds',
        [
          [15, '15'],
          [25, '25'],
          [35, '35'],
          [0, 'Bebas'],
        ],
        st.roundLimit
      ) +
      '</div>' +
      '<div class="opt"><span class="label">' +
      T('Uang awal') +
      '</span>' +
      seg(
        'ocash',
        [2000, 2500, 3000].map(v => [v, fmt(v)]),
        st.startCash
      ) +
      '</div>' +
      '<div class="opt"><span class="label">' +
      T('Aturan') +
      '</span>' +
      seg(
        'orules',
        [
          ['seru', 'Lengkap'],
          ['santai', 'Santai'],
        ],
        st.rules
      ) +
      '<div class="tiny muted">' +
      T(
        st.rules === 'seru'
          ? 'Ambil alih, menang instan, dan kontrol dadu aktif.'
          : 'Tanpa ambil alih dan menang instan: aset terbesar menang.'
      ) +
      '</div></div>' +
      '<button type="button" class="btn primary" id="oCreate"' +
      (onlineBusy ? ' disabled' : '') +
      '>' +
      ic('heart') +
      '<span>' +
      T('Buat Room') +
      '</span></button></div></div>' +
      '<div class="form-sec"><h3>' +
      ic('globe') +
      T('Gabung dengan kode') +
      '</h3><div class="field"><label for="oCode">' +
      T('Kode room (6 karakter)') +
      '</label><input class="input mono code-in" id="oCode" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="' +
      esc(t('Contoh: {c}', { c: 'AB12CD' })) +
      '"></div>' +
      '<button type="button" class="btn lilac" id="oJoin"' +
      (onlineBusy ? ' disabled' : '') +
      '>' +
      ic('chevron') +
      '<span>' +
      T('Gabung Room') +
      '</span></button><div class="err" id="oErr" hidden></div></div></div>' +
      (window.LOVE_FIREBASE && window.LOVE_FIREBASE.appCheckSiteKey
        ? '<p class="tiny muted rc-note">' +
          t('Main online dilindungi reCAPTCHA; berlaku {p} dan {s} Google.', {
            p: '<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">' + T('Kebijakan Privasi') + '</a>',
            s: '<a href="https://policies.google.com/terms" target="_blank" rel="noopener">' + T('Persyaratan Layanan') + '</a>',
          }) +
          '</p>'
        : '') +
      '</div>';
    bindProfile(host);
    $('#oBack').onclick = () => {
      show('scrHome', 'online');
      renderHome();
    };
    $$('[data-seg]', host).forEach(g =>
      $$('[data-v]', g).forEach(
        b =>
          (b.onclick = () => {
            const n = g.dataset.seg,
              v = b.dataset.v;
            if (n === 'ocash') st.startCash = Number(v);
            if (n === 'orounds') st.roundLimit = Number(v);
            if (n === 'orules') st.rules = v;
            renderLobby();
          })
      )
    );
    const err = $('#oErr');
    const check = () => {
      const n = onlineProfile.name.trim();
      if (!n) {
        err.hidden = false;
        err.textContent = t('Isi nama kamu dulu.');
        $('#oName').classList.add('invalid');
        return false;
      }
      return true;
    };
    $('#oCreate').onclick = async () => {
      if (!check()) return;
      onlineBusy = true;
      renderLobby();
      try {
        const seru = st.rules === 'seru';
        await Net.createRoom(
          { name: onlineProfile.name.trim(), avatar: onlineProfile.avatar, color: onlineProfile.color, msg: passport().msg },
          { startCash: st.startCash, roundLimit: st.roundLimit, takeover: seru, instantWin: seru, diceControl: seru }
        );
        track('room_create', { rules: st.rules || 'santai', rounds: st.roundLimit || 0 });
        onlineErr = '';
      } catch (e) {
        onlineErr = t('Gagal membuat room: {m}', { m: String(e && e.message ? e.message : e) });
      }
      onlineBusy = false;
      renderLobby();
    };
    $('#oJoin').onclick = async () => {
      if (!check()) return;
      const code = $('#oCode').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) {
        err.hidden = false;
        err.textContent = t('Kode room terdiri dari 6 huruf/angka.');
        $('#oCode').classList.add('invalid');
        return;
      }
      onlineBusy = true;
      renderLobby();
      try {
        await Net.joinRoom(code, {
          name: onlineProfile.name.trim(),
          avatar: onlineProfile.avatar,
          color: onlineProfile.color,
          msg: passport().msg,
        });
        track('room_join');
        onlineErr = '';
      } catch (e) {
        onlineErr = e && e.message ? e.message : String(e);
        Net.teardown();
      }
      onlineBusy = false;
      if (!(Net.doc && Net.doc.status === 'playing')) renderLobby();
    };
    return;
  }
  const isHost = Net.isHost();
  const me = Net.mySeat();
  const seats = d.seats
    .map((s, i) => {
      const on = s.bot ? true : Net.isOnline(s.uid);
      return (
        '<div class="seat-chip" style="--c:' +
        esc(s.color) +
        '">' +
        avatarHTML(s, 'sm') +
        '<div class="grow"><b>' +
        esc(s.name) +
        '</b>' +
        (i === 0 ? ' <span class="chip">' + T('Host') + '</span>' : '') +
        (i === me ? ' <span class="chip lilac">' + T('Kamu') + '</span>' : '') +
        (s.bot ? ' <span class="chip plain">' + ic('bot') + 'AI</span>' : '') +
        '</div>' +
        (s.bot && isHost
          ? seg(
              'bot' + i,
              [
                ['easy', 'Easy'],
                ['normal', 'Normal'],
                ['hard', 'Hard'],
              ],
              s.ai || 'normal'
            )
          : '') +
        (on == null || s.bot
          ? ''
          : '<span class="online-dot' + (on ? ' on' : '') + '" title="' + T(on ? 'Online' : 'Offline') + '"></span>') +
        (isHost && i > 0
          ? '<button type="button" class="icon-btn" data-rmseat="' +
            i +
            '" aria-label="' +
            esc(t('Keluarkan {n}', { n: s.name })) +
            '">' +
            ic('x') +
            '</button>'
          : '') +
        '</div>'
      );
    })
    .join('');
  const pending = me < 0 && !Net.kicked;
  const st = d.settings || {};
  host.innerHTML =
    '<div class="setup-head"><button type="button" class="btn ghost" id="oLeave">' +
    ic('back') +
    '<span>' +
    T('Keluar Room') +
    '</span></button><h2>' +
    T('Lobby Room') +
    '</h2></div>' +
    (onlineErr ? '<div class="note warn page">' + ic('alert') + ' ' + esc(onlineErr) + '</div>' : '') +
    '<div class="online"><div class="panel stack"><h3>' +
    ic('globe') +
    T('Kode room') +
    '</h3><div class="code-box" id="codeBox">' +
    esc(Net.code) +
    '</div>' +
    '<button type="button" class="btn soft" id="oCopy">' +
    ic('copy') +
    '<span>' +
    T('Salin kode') +
    '</span></button>' +
    '<div class="note">' +
    ic('info') +
    '<span>' +
    t(
      'Kirim kode ini ke pasanganmu. Minta dia buka {h}, pilih {m}, ketik kodenya di {g}, lalu tekan Gabung Room. Tanpa daftar akun, langsung main!',
      {
        h: '<b>' + esc(location.host || 'Loveopoly') + '</b>',
        m: '<b>' + T('Main Online') + '</b>',
        g: '<b>' + T('Gabung dengan kode') + '</b>',
      }
    ) +
    '</span></div>' +
    '<div class="tiny muted">' +
    esc(t('Uang awal {c}', { c: st.startCash || RULES.startCash })) +
    ' · ' +
    esc(st.roundLimit ? t('{n} ronde', { n: st.roundLimit }) : t('tanpa batas ronde')) +
    ' · ' +
    esc(t(st.takeover ? 'aturan lengkap' : 'aturan santai')) +
    '</div></div>' +
    '<div class="panel stack"><h3>' +
    ic('users') +
    T('Pemain') +
    ' <span class="muted">' +
    d.seats.length +
    '/4</span></h3>' +
    seats +
    (pending ? '<div class="note">' + ic('clock') + ' ' + T('Menunggu host menerima kamu…') + '</div>' : '') +
    (isHost
      ? '<div class="add-row">' +
        (d.seats.length < 4
          ? '<button type="button" class="btn soft" id="oBot">' + ic('bot') + '<span>' + T('Tambah Bot') + '</span></button>'
          : '') +
        '<button type="button" class="btn go" id="oStart"' +
        (d.seats.length < 2 ? ' disabled' : '') +
        '>' +
        ic('heart') +
        '<span>' +
        T('Mulai') +
        '</span></button></div>' +
        (d.seats.length < 2
          ? '<div class="tiny muted">' + T('Butuh minimal 2 pemain. Tunggu pasanganmu bergabung atau tambah bot.') + '</div>'
          : '')
      : me >= 0
        ? '<div class="note">' + ic('clock') + ' ' + T('Menunggu host memulai permainan…') + '</div>'
        : '') +
    '</div></div>';
  $('#oLeave').onclick = async () => {
    await Net.leave();
    onlineErr = '';
    renderLobby();
  };
  $('#oCopy').onclick = () => {
    const txt = Net.code;
    const fallback = () => {
      const r = document.createRange();
      r.selectNodeContents($('#codeBox'));
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      toast('Kode dipilih, salin manual dengan Ctrl/Cmd+C.');
    };
    try {
      navigator.clipboard.writeText(txt).then(() => toast('Kode room disalin.', { kind: 'good', icon: 'copy' }), fallback);
    } catch (e) {
      fallback();
    }
  };
  $$('[data-rmseat]', host).forEach(b => (b.onclick = () => Net.removeSeat(Number(b.dataset.rmseat))));
  $$('[data-seg^="bot"]', host).forEach(g =>
    $$('[data-v]', g).forEach(b => (b.onclick = () => Net.setBotLevel(Number(g.dataset.seg.slice(3)), b.dataset.v)))
  );
  const bb = $('#oBot');
  if (bb) bb.onclick = () => Net.addBot();
  const sb = $('#oStart');
  if (sb) sb.onclick = () => Net.startGame();
}
function bindProfile(root) {
  const p = onlineProfile;
  // hanya field yang diedit di sini yang ditulis, digabung ke profil TERKINI: onlineProfile bisa salinan lama
  // (dibuat saat layar online pertama dibuka), jangan sampai menimpa progres paspor yang tercatat sesudahnya
  const save = () =>
    store.set(
      'loveopoly.v1.profile',
      Object.assign({}, store.get('loveopoly.v1.profile', null) || {}, { name: p.name, avatar: p.avatar, color: p.color })
    );
  const n = $('#oName', root);
  if (n)
    n.addEventListener('input', () => {
      p.name = n.value;
      n.classList.remove('invalid');
      save();
    });
  $$('[data-pav]', root).forEach(
    b =>
      (b.onclick = () => {
        p.avatar = b.dataset.pav;
        save();
        renderLobby();
      })
  );
  $$('[data-pcol]', root).forEach(
    b =>
      (b.onclick = () => {
        p.color = b.dataset.pcol;
        save();
        renderLobby();
      })
  );
}

export { openOnline, renderLobby };
