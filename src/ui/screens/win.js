/* LOVEOPOLY — layar › layar menang (dikumpulkan lewat src/ui/screens.js) */
import { Icons } from '../../assets/icons.js';
import { Net } from '../../net/net.js';
import { App, D, E, SND, ART, fmt, esc, ic, $, coin, avatarHTML, buzz, t } from '../core.js';
import { UI } from '../ns.js';
import { passport, recordPassport, xpBar } from './passport.js';
import { TIER_NAMES } from '../progress.js';
import { enterGame, exitToHome } from './game.js';
import { openMemoryCard } from './memory.js';
import { track } from '../../analytics.js';
let trackedEnd = '';

// ---------- progres paspor di layar menang ----------
const chip = (icon, text, cls) => '<span class="jt-chip ' + (cls || '') + '">' + ic(icon) + '<span>' + esc(text) + '</span></span>';
// panel Jam Terbang: XP yang didapat + rinciannya, level & bar, Api Cinta, lencana baru, cap kota baru
function progPanel(r) {
  if (!r)
    return passport().name
      ? ''
      : '<div class="panel jt-hint">' +
          ic('book') +
          '<span>' +
          t('Buat {p} di beranda untuk mengumpulkan Jam Terbang, Api Cinta & lencana dari tiap game.', {
            p: '<b>' + esc(t('Paspor Cinta')) + '</b>',
          }) +
          '</span></div>';
  const up = r.to.L > r.from.L;
  const chips = [];
  const w = r.week;
  chips.push(
    chip(
      w && w.kind === 'saved' ? 'umbrella' : 'flame',
      w
        ? w.kind === 'saved'
          ? t('Payung Rindu menyelamatkan Api Cinta: {n} minggu', { n: w.n })
          : w.kind === 'up'
            ? t('Api Cinta naik: {n} minggu', { n: w.n })
            : t('Api Cinta menyala: {n} minggu', { n: w.n })
        : t('Api Cinta {n} minggu', { n: r.streak.n }),
      'fire'
    )
  );
  if (w && w.earned) chips.push(chip('umbrella', t('Dapat Payung Rindu')));
  r.badges.forEach(b => chips.push(chip('medal', t('Lencana {n} · {k}', { n: { t: b.name }, k: { t: TIER_NAMES[b.tier - 1] } }), 'gold')));
  (r.themes || []).forEach(x => chips.push(chip('sparkle', t('Tema papan {n} terbuka', { n: { t: x.name } }), 'gold')));
  if (r.fresh) chips.push(chip('map', t('{n} cap kota baru', { n: r.fresh })));
  return (
    '<div class="panel jt"><h3>' +
    ic('book') +
    esc(t('Paspor Cinta · Jam Terbang')) +
    '</h3>' +
    '<div class="jt-head"><span class="jt-gain">+' +
    r.xp +
    ' XP</span><span class="jt-lv' +
    (up ? ' up' : '') +
    '">' +
    esc(up ? t('Naik ke Lv {l}', { l: r.to.L }) : 'Lv ' + r.to.L) +
    ' · ' +
    esc(t(r.to.title)) +
    '</span></div>' +
    xpBar(r.to.pct, 'jt-bar', null, up ? 0 : r.from.pct) +
    '<div class="jt-next">' +
    esc(t('{a}/{b} XP ke Level {l}', { a: r.to.cur, b: r.to.need, l: r.to.L + 1 })) +
    '</div>' +
    '<ul class="jt-parts">' +
    r.parts.map(([lb, v, d]) => '<li>' + esc(t(lb, d)) + ' <b>+' + v + '</b></li>').join('') +
    '</ul>' +
    '<div class="jt-chips">' +
    chips.join('') +
    '</div></div>'
  );
}
// Layar perayaan singkat (naik level / lencana naik tingkat) di atas layar menang: tutup sendiri ±2,4 dtk, ketuk /
// Enter / Spasi / Esc melewati (ketukan & tombol ditelan, tidak mengenai tombol layar menang di bawahnya).
// role=status (bukan dialog): pengumuman sesaat, fokus tetap di layar menang.
function celebrate(r) {
  // jangan menumpuk di atas dialog lain yang sudah dibuka (Kartu Kenangan, dialog)
  if (!r || $('#celebOv') || !$('#winOv') || $('#memOv') || $('#modalRoot .modal')) return;
  const up = r.to.L > r.from.L;
  if (!up && !r.badges.length) return;
  const el = document.createElement('div');
  el.className = 'celeb';
  el.id = 'celebOv';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML =
    '<div class="cb-card"><span class="cb-merpi" aria-hidden="true">' +
    ART.merpi('is-wow') +
    '</span>' +
    (up
      ? '<div class="cb-k">' +
        esc(t('Naik level!')) +
        '</div><div class="cb-lv"><span class="cb-from">Lv ' +
        r.from.L +
        '</span>' +
        ic('chevron') +
        '<b class="cb-to">Lv ' +
        r.to.L +
        '</b></div><div class="cb-title">' +
        esc(t(r.to.title)) +
        '</div>'
      : '<div class="cb-k">' + esc(t('Lencana baru!')) + '</div>') +
    ((r.themes || []).length
      ? '<p class="cb-gift">' +
        ic('sparkle') +
        '<span>' +
        esc(t('Hadiah: tema papan {n}', { n: r.themes.map(x => t(x.name)).join(' & ') })) +
        '</span></p>'
      : '') +
    (r.badges.length
      ? '<ul class="cb-badges">' +
        r.badges
          .map(
            b =>
              '<li class="t' +
              b.tier +
              '">' +
              ic(b.icon) +
              '<span>' +
              esc(t(b.name)) +
              ' · ' +
              esc(t(TIER_NAMES[b.tier - 1])) +
              '</span></li>'
          )
          .join('') +
        '</ul>'
      : '') +
    '<span class="cb-skip">' +
    esc(t('Ketuk untuk lanjut')) +
    '</span></div>';
  document.body.appendChild(el);
  SND.play('achieve');
  buzz('level');
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    document.removeEventListener('keydown', key, true);
    UI.leave(el, 300);
  };
  const key = e => {
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  el.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  document.addEventListener('keydown', key, true);
  const timer = setTimeout(close, UI.reduceMotion() ? 2600 : 2400);
}

// ---------- layar menang ----------
let confettiStop = null;
function confetti(canvas) {
  if (UI.reduceMotion()) return () => {};
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();
  const cols = ['#FF4F8B', '#FFD93D', '#3DDBD9', '#B79CFF', '#FF9F43', '#7BCF5D'];
  const parts = Array.from({ length: 180 }, () => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * canvas.height * 0.8,
    vx: (Math.random() - 0.5) * 2 * dpr,
    vy: (2 + Math.random() * 3) * dpr,
    r: (5 + Math.random() * 7) * dpr,
    a: Math.random() * 6.28,
    va: (Math.random() - 0.5) * 0.2,
    c: cols[Math.floor(Math.random() * cols.length)],
    heart: Math.random() < 0.35,
  }));
  let raf = 0;
  const t0 = performance.now();
  const heart = (x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
    ctx.fill();
  };
  const tick = now => {
    const el = (now - t0) / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      if (p.y > canvas.height + 20 && el < 4.5) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.c;
      if (p.heart) heart(0, -p.r / 2, p.r * 1.4);
      else ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    });
    if (el < 9) raf = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  raf = requestAnimationFrame(tick);
  addEventListener('resize', resize);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
  };
}
function showWin() {
  let prog = null;
  try {
    prog = recordPassport(App.S);
  } catch (e) {
    /* abaikan */
  }
  const S = App.S;
  if (!S || !S.over) return;
  UI.closeModal(true);
  UI.endPick(true);
  const root = $('#overlayRoot');
  if ($('#winOv')) return;
  const tw = $('#toasts');
  if (tw) tw.innerHTML = '';
  const bn = $('#boardVP .banner');
  if (bn) bn.remove();
  const o = S.over,
    w = S.players[o.winner];
  const instant = o.reason === 'triple' || o.reason === 'line' || o.reason === 'spots';
  const endKey = S.seed + ':' + o.round + ':' + o.winner;
  if (trackedEnd !== endKey) {
    trackedEnd = endKey;
    track('game_end', { mode: App.mode, reason: o.reason, rounds: o.round, players: S.players.length, winner_ai: w.kind === 'ai' });
  }
  const reason =
    o.reason === 'line'
      ? t('Raja Jalur: menguasai seluruh {s}', { s: { t: o.detail ? E.sideName(o.detail.side) : 'jalur' } })
      : t(
          {
            bankrupt: 'Semua lawan bangkrut',
            rounds: 'Aset terbesar saat batas ronde',
            manual: 'Aset terbesar saat permainan diakhiri',
            resign: 'Lawan menyerah',
            triple: 'Trio Warna: menguasai 3 grup warna',
            spots: 'Kolektor Wisata: menguasai 5 tempat wisata',
          }[o.reason] || ''
        );
  // pesan romantis dari Paspor Cinta: milik pemenang, atau pemain lain yang menulisnya; game lama: settings.winMessage
  const author = w.msg ? w : S.players.find(p => p.msg && !p.bankrupt) || S.players.find(p => p.msg);
  // pesan pemain apa adanya; pesan bawaan game diterjemahkan
  const msg = author ? author.msg : S.settings.winMessage || t(D.WIN_MESSAGES[S.seed % D.WIN_MESSAGES.length]);
  const rows = o.ranking
    .map((i, k) => {
      const p = S.players[i];
      return (
        '<div class="rank-row' +
        (k === 0 ? ' first' : '') +
        '" style="--c:' +
        p.color +
        '"><span class="rk">' +
        (k + 1) +
        '</span>' +
        avatarHTML(p, 'sm') +
        '<span class="rk-name"><b>' +
        esc(p.name) +
        '</b><small>' +
        esc(t(o.titles[i] || '')) +
        (p.bankrupt ? ' · ' + esc(t('bangkrut ronde {r}', { r: p.stats.bankruptRound })) : '') +
        '</small></span><span class="rk-worth">' +
        coin +
        fmt(o.worth ? o.worth[i] : E.netWorth(S, i)) +
        '</span></div>'
      );
    })
    .join('');
  const statRows = S.players
    .map(
      p =>
        '<tr><td>' +
        esc(p.avatar + ' ' + p.name) +
        '</td><td>' +
        E.ownedBy(S, p.i).length +
        '</td><td>' +
        p.stats.landmarks +
        '</td><td>' +
        fmt(p.stats.tollIn) +
        '</td><td>' +
        p.stats.takeovers +
        '</td><td>' +
        p.stats.challenges +
        '</td><td>' +
        p.love +
        '</td></tr>'
    )
    .join('');
  const ach = S.players
    .map(
      p =>
        '<div><b>' +
        esc(p.avatar + ' ' + p.name) +
        '</b><div class="ach-list">' +
        (p.achievements.length
          ? p.achievements
              .map(
                id =>
                  '<span class="ach">' + ic(E.ACH[id].icon in Icons.paths ? E.ACH[id].icon : 'trophy') + esc(t(E.ACH[id].name)) + '</span>'
              )
              .join('')
          : '<span class="tiny muted">' + esc(t('Belum ada achievement.')) + '</span>') +
        '</div></div>'
    )
    .join('');
  const letters = S.letters.length
    ? '<div class="letters">' +
      S.letters
        .slice()
        .reverse()
        .map(
          l =>
            '<div class="letter"><span class="from">' +
            ic('letter') +
            ' ' +
            esc(t('Dari {n} · ronde {r}', { n: S.players[l.p].name, r: l.r })) +
            '</span>' +
            esc(l.text) +
            '</div>'
        )
        .join('') +
      '</div>'
    : '<div class="empty">' + ic('letter') + esc(t('Belum ada surat cinta di permainan ini.')) + '</div>';
  const proofsPanel = S => {
    const ph = S.photos || [],
      pr = S.proofs || [];
    if (!ph.length && !pr.length) return '';
    return (
      '<div class="panel stack"><h3>' +
      ic('polaroid') +
      esc(t('Bukti tantangan')) +
      '</h3>' +
      (ph.length
        ? '<div class="proof-grid">' +
          ph
            .slice()
            .reverse()
            .map(
              x =>
                '<figure class="proof-photo' +
                (x.ok ? '' : ' no') +
                '"><img src="' +
                UI.safeImg(x.img) +
                '" alt="' +
                esc(t('Foto bukti {n}', { n: S.players[x.p].name })) +
                '"><figcaption><span class="pc-who"><b>' +
                esc(S.players[x.p].name) +
                '</b> · ' +
                esc(t('ronde {r}', { r: x.r })) +
                '</span><span class="' +
                (x.ok ? 'ok' : 'bad') +
                '">' +
                esc(t(x.ok ? 'Disahkan' : 'Ditolak')) +
                '</span></figcaption></figure>'
            )
            .join('') +
          '</div>'
        : '') +
      (pr.length
        ? '<ul class="proof-list">' +
          pr
            .slice()
            .reverse()
            .slice(0, 10)
            .map(
              x =>
                '<li class="' +
                (x.ok ? 'ok' : 'bad') +
                '">' +
                ic(x.ok ? 'check' : 'x') +
                '<span><b>' +
                esc(S.players[x.p].name) +
                '</b> · ' +
                esc(t(x.label)) +
                '<small>' +
                esc(x.pt ? t(x.pt.k, x.pt.a) : t(x.proof)) +
                '</small></span></li>'
            )
            .join('') +
          '</ul>'
        : '') +
      '</div>'
    );
  };
  const el = document.createElement('div');
  el.className = 'win';
  el.id = 'winOv';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'winName');
  el.innerHTML =
    '<canvas id="confetti" aria-hidden="true"></canvas><div class="win-card">' +
    '<div class="win-hero"><div class="eyebrow">' +
    esc(t(instant ? 'Menang instan' : 'Pemenang')) +
    ' · ' +
    esc(t('ronde {r}', { r: o.round })) +
    '</div>' +
    '<div class="win-stage"><span class="rays" aria-hidden="true"></span><span class="win-merpi">' +
    ART.merpi('is-love') +
    '</span><div class="win-av">' +
    avatarHTML(w, 'xl') +
    '<span class="win-crown">' +
    ic('crown') +
    '</span></div></div>' +
    '<div class="win-name" id="winName">' +
    esc(w.name) +
    '</div><div class="win-title">' +
    esc(t(o.titles[o.winner] || 'Juragan Cinta')) +
    '</div><div class="win-reason">' +
    esc(reason) +
    '</div>' +
    '<p class="win-msg" id="winMsg">“' +
    esc(msg) +
    '”' +
    (author ? '<span class="win-msg-by">' + esc(author.name) + '</span>' : '') +
    '</p><button type="button" class="btn go win-share" id="wShare">' +
    ic('share') +
    '<span>' +
    esc(t('Bagikan Kenangan')) +
    '</span></button></div>' +
    progPanel(prog) +
    '<div class="panel"><h3>' +
    ic('trophy') +
    esc(t('Peringkat')) +
    '</h3><div class="rank-list">' +
    rows +
    '</div></div>' +
    '<div class="panel"><h3>' +
    ic('level') +
    esc(t('Statistik')) +
    '</h3><div class="stats-wrap" tabindex="0" role="region" aria-label="' +
    esc(t('Tabel statistik (bisa digulir)')) +
    '"><table class="stats"><thead><tr>' +
    ['Pemain', 'Kota', 'Landmark§kolom', 'Tol masuk', 'Ambil alih§kolom', 'Tantangan', 'Love']
      .map(h => '<th>' + esc(t(h)) + '</th>')
      .join('') +
    '</tr></thead><tbody>' +
    statRows +
    '</tbody></table></div></div>' +
    '<div class="panel stack"><h3>' +
    ic('sparkle') +
    esc(t('Achievement')) +
    '</h3>' +
    ach +
    '</div>' +
    '<div class="panel stack"><h3>' +
    ic('letter') +
    esc(t('Surat cinta selama permainan')) +
    '</h3>' +
    letters +
    '</div>' +
    proofsPanel(S) +
    '<div class="setup-foot"><button type="button" class="btn ghost" id="wBoard">' +
    ic('map') +
    '<span>' +
    esc(t('Lihat Papan')) +
    '</span></button>' +
    (App.mode === 'online' && !Net.isHost()
      ? ''
      : '<button type="button" class="btn soft" id="wAgain">' + ic('refresh') + '<span>' + esc(t('Main Lagi')) + '</span></button>') +
    '<button type="button" class="btn primary" id="wHome">' +
    ic('home') +
    '<span>' +
    esc(t('Menu Utama')) +
    '</span></button></div>' +
    '</div>';
  root.appendChild(el);
  SND.play('win');
  buzz('win');
  confettiStop = confetti($('#confetti'));
  if (prog) setTimeout(() => celebrate(prog), UI.reduceMotion() ? 200 : 1100);
  $('#wShare').onclick = () => openMemoryCard(S, { reason, msg, author });
  $('#wBoard').onclick = () => {
    if (confettiStop) confettiStop();
    UI.leave(el, 320);
  };
  $('#wHome').onclick = () => {
    if (confettiStop) confettiStop();
    exitToHome();
  };
  const again = $('#wAgain');
  if (again)
    again.onclick = () => {
      if (confettiStop) confettiStop();
      if (App.mode === 'online') {
        Net.startGame();
        return;
      }
      const ns = E.create({
        players: S.players.map(p => ({ name: p.name, avatar: p.avatar, color: p.color, kind: p.kind, ai: p.ai, msg: p.msg })),
        settings: S.settings,
        first: 'random',
      });
      enterGame('local', -1, ns);
    };
  setTimeout(() => {
    const b = $('#wHome');
    if (b) b.focus({ preventScroll: true });
  }, 60);
}

export { showWin };
