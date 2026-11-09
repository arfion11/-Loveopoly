/* LOVEOPOLY — layar › layar menang (dikumpulkan lewat src/ui/screens.js) */
import { Icons } from '../../assets/icons.js';
import { Net } from '../../net/net.js';
import { App, D, E, SND, ART, fmt, esc, ic, $, coin, avatarHTML } from '../core.js';
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
          '<span>Buat <b>Paspor Cinta</b> di beranda untuk mengumpulkan Jam Terbang, Api Cinta & lencana dari tiap game.</span></div>';
  const up = r.to.L > r.from.L;
  const chips = [];
  const w = r.week;
  chips.push(
    chip(
      w && w.kind === 'saved' ? 'umbrella' : 'flame',
      w
        ? w.kind === 'saved'
          ? 'Payung Rindu menyelamatkan Api Cinta: ' + w.n + ' minggu'
          : w.kind === 'up'
            ? 'Api Cinta naik: ' + w.n + ' minggu'
            : 'Api Cinta menyala: ' + w.n + ' minggu'
        : 'Api Cinta ' + r.streak.n + ' minggu',
      'fire'
    )
  );
  if (w && w.earned) chips.push(chip('umbrella', 'Dapat Payung Rindu'));
  r.badges.forEach(b => chips.push(chip('medal', 'Lencana ' + b.name + ' · ' + TIER_NAMES[b.tier - 1], 'gold')));
  if (r.fresh) chips.push(chip('map', r.fresh + ' cap kota baru'));
  return (
    '<div class="panel jt"><h3>' +
    ic('book') +
    'Paspor Cinta · Jam Terbang</h3>' +
    '<div class="jt-head"><span class="jt-gain">+' +
    r.xp +
    ' XP</span><span class="jt-lv' +
    (up ? ' up' : '') +
    '">' +
    (up ? 'Naik ke ' : '') +
    'Lv ' +
    r.to.L +
    ' · ' +
    esc(r.to.title) +
    '</span></div>' +
    xpBar(r.to.pct, 'jt-bar') +
    '<div class="jt-next">' +
    r.to.cur +
    '/' +
    r.to.need +
    ' XP ke Level ' +
    (r.to.L + 1) +
    '</div>' +
    '<ul class="jt-parts">' +
    r.parts.map(([t, v]) => '<li>' + esc(t) + ' <b>+' + v + '</b></li>').join('') +
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
      ? '<div class="cb-k">Naik level!</div><div class="cb-lv"><span class="cb-from">Lv ' +
        r.from.L +
        '</span>' +
        ic('chevron') +
        '<b class="cb-to">Lv ' +
        r.to.L +
        '</b></div><div class="cb-title">' +
        esc(r.to.title) +
        '</div>'
      : '<div class="cb-k">Lencana baru!</div>') +
    (r.badges.length
      ? '<ul class="cb-badges">' +
        r.badges
          .map(b => '<li class="t' + b.tier + '">' + ic(b.icon) + '<span>' + esc(b.name) + ' · ' + TIER_NAMES[b.tier - 1] + '</span></li>')
          .join('') +
        '</ul>'
      : '') +
    '<span class="cb-skip">Ketuk untuk lanjut</span></div>';
  document.body.appendChild(el);
  SND.play('achieve');
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    clearTimeout(t);
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
  const t = setTimeout(close, UI.reduceMotion() ? 2600 : 2400);
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
    {
      bankrupt: 'Semua lawan bangkrut',
      rounds: 'Aset terbesar saat batas ronde',
      manual: 'Aset terbesar saat permainan diakhiri',
      resign: 'Lawan menyerah',
      triple: 'Trio Warna: menguasai 3 grup warna',
      line: 'Raja Jalur: menguasai seluruh ' + (o.detail ? E.sideName(o.detail.side) : 'jalur'),
      spots: 'Kolektor Wisata: menguasai 5 tempat wisata',
    }[o.reason] || '';
  // pesan romantis dari Paspor Cinta: milik pemenang, atau pemain lain yang menulisnya; game lama: settings.winMessage
  const author = w.msg ? w : S.players.find(p => p.msg && !p.bankrupt) || S.players.find(p => p.msg);
  const msg = author ? author.msg : S.settings.winMessage || D.WIN_MESSAGES[S.seed % D.WIN_MESSAGES.length];
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
        esc(o.titles[i] || '') +
        (p.bankrupt ? ' · bangkrut ronde ' + p.stats.bankruptRound : '') +
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
                id => '<span class="ach">' + ic(E.ACH[id].icon in Icons.paths ? E.ACH[id].icon : 'trophy') + esc(E.ACH[id].name) + '</span>'
              )
              .join('')
          : '<span class="tiny muted">Belum ada achievement.</span>') +
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
            ' Dari ' +
            esc(S.players[l.p].name) +
            ' · ronde ' +
            l.r +
            '</span>' +
            esc(l.text) +
            '</div>'
        )
        .join('') +
      '</div>'
    : '<div class="empty">' + ic('letter') + 'Belum ada surat cinta di permainan ini.</div>';
  const proofsPanel = S => {
    const ph = S.photos || [],
      pr = S.proofs || [];
    if (!ph.length && !pr.length) return '';
    return (
      '<div class="panel stack"><h3>' +
      ic('polaroid') +
      'Bukti tantangan</h3>' +
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
                '" alt="Foto bukti ' +
                esc(S.players[x.p].name) +
                '"><figcaption><span class="pc-who"><b>' +
                esc(S.players[x.p].name) +
                '</b> · ronde ' +
                x.r +
                '</span><span class="' +
                (x.ok ? 'ok' : 'bad') +
                '">' +
                (x.ok ? 'Disahkan' : 'Ditolak') +
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
                esc(x.label) +
                '<small>' +
                esc(x.proof) +
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
    (instant ? 'Menang instan' : 'Pemenang') +
    ' · ronde ' +
    o.round +
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
    esc(o.titles[o.winner] || 'Juragan Cinta') +
    '</div><div class="win-reason">' +
    esc(reason) +
    '</div>' +
    '<p class="win-msg" id="winMsg">“' +
    esc(msg) +
    '”' +
    (author ? '<span class="win-msg-by">' + esc(author.name) + '</span>' : '') +
    '</p><button type="button" class="btn go win-share" id="wShare">' +
    ic('share') +
    '<span>Bagikan Kenangan</span></button></div>' +
    progPanel(prog) +
    '<div class="panel"><h3>' +
    ic('trophy') +
    'Peringkat</h3><div class="rank-list">' +
    rows +
    '</div></div>' +
    '<div class="panel"><h3>' +
    ic('level') +
    'Statistik</h3><div class="stats-wrap" tabindex="0" role="region" aria-label="Tabel statistik (bisa digulir)"><table class="stats"><thead><tr><th>Pemain</th><th>Kota</th><th>Landmark</th><th>Tol masuk</th><th>Ambil alih</th><th>Tantangan</th><th>Love</th></tr></thead><tbody>' +
    statRows +
    '</tbody></table></div></div>' +
    '<div class="panel stack"><h3>' +
    ic('sparkle') +
    'Achievement</h3>' +
    ach +
    '</div>' +
    '<div class="panel stack"><h3>' +
    ic('letter') +
    'Surat cinta selama permainan</h3>' +
    letters +
    '</div>' +
    proofsPanel(S) +
    '<div class="setup-foot"><button type="button" class="btn ghost" id="wBoard">' +
    ic('map') +
    '<span>Lihat Papan</span></button>' +
    (App.mode === 'online' && !Net.isHost()
      ? ''
      : '<button type="button" class="btn soft" id="wAgain">' + ic('refresh') + '<span>Main Lagi</span></button>') +
    '<button type="button" class="btn primary" id="wHome">' +
    ic('home') +
    '<span>Menu Utama</span></button></div>' +
    '</div>';
  root.appendChild(el);
  SND.play('win');
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
