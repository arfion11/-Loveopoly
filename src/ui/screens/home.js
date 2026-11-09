/* LOVEOPOLY — layar › beranda (dikumpulkan lewat src/ui/screens.js) */
import { D, ART, TILES, KEYS, esc, ic, $, store } from '../core.js';
import { UI } from '../ns.js';
import { validSave } from './base.js';
import { dismissKangen, kangenNote, openPassport, passport, passportCard } from './passport.js';
import { openSetup } from './setup.js';
import { openOnline } from './online.js';
import { enterGame } from './game.js';
import { dailyCard, openDaily } from './daily.js';

// ---------- beranda ----------
function homeArt() {
  const ring = ['paris', 'bali', 'kyoto', 'santorini', 'hawaii', 'swiss', 'seoul', 'maldives'];
  return (
    '<div class="hero-scene" aria-hidden="true">' +
    '<div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>' +
    '<div class="hero-ring">' +
    ring.map((a, k) => '<span class="hr-tile" style="--k:' + k + '">' + ART.art(a) + '</span>').join('') +
    '</div>' +
    '<div class="hero-merpi">' +
    ART.merpi('is-happy') +
    '<span class="hero-letter">' +
    ART.art('card') +
    '</span></div>' +
    '<div class="hero-hearts"><i></i><i></i><i></i><i></i><i></i></div>' +
    '</div>'
  );
}
// Merpi kangen: sekali per sesi bila sudah ≥ 5 hari tidak membuka Loveopoly (lihat kangenNote di passport.js)
function kangenHTML() {
  const t = kangenNote();
  return t
    ? '<div class="merpi-note" role="status"><span class="mn-merpi" aria-hidden="true">' +
        ART.merpi('is-love') +
        '</span><p>' +
        esc(t) +
        '</p><button type="button" class="icon-btn mn-x" id="hKangenX" aria-label="Tutup pesan Merpi">' +
        ic('x') +
        '</button></div>'
    : '';
}
function renderHome() {
  const save = store.get(KEYS.save, null);
  const online = store.get(KEYS.online, null);
  let resume = '';
  if (validSave(save)) {
    const S = save.S;
    resume +=
      '<div class="resume-card"><span class="rc-ic">' +
      ic('play') +
      '</span><div class="grow"><b>Lanjutkan permainan</b><div class="tiny">' +
      esc(S.players.map(p => p.avatar + ' ' + p.name).join(' · ')) +
      ' · Ronde ' +
      S.round +
      '</div></div><button type="button" class="btn primary sm" id="hResume"><span>Lanjut</span></button><button type="button" class="icon-btn" id="hDiscard" aria-label="Hapus simpanan">' +
      ic('x') +
      '</button></div>';
  } else if (save) store.del(KEYS.save);
  if (online && online.code)
    resume +=
      '<div class="resume-card"><span class="rc-ic">' +
      ic('globe') +
      '</span><div class="grow"><b>Kembali ke room <span class="mono">' +
      esc(online.code) +
      '</span></b><div class="tiny">Sambung ulang ke permainan online terakhir.</div></div><button type="button" class="btn primary sm" id="hRejoin"><span>Masuk</span></button><button type="button" class="icon-btn" id="hForget" aria-label="Lupakan room">' +
      ic('x') +
      '</button></div>';
  // pengguna lama (punya paspor / simpanan): beranda ringkas, tombol main langsung terlihat di layar pertama HP
  const returning = !!passport().name || !!resume;
  $('#scrHome').innerHTML =
    '<div class="home' +
    (returning ? ' returning' : '') +
    '">' +
    '<div class="home-art">' +
    homeArt() +
    '</div>' +
    '<div class="home-copy">' +
    '<div class="eyebrow">' +
    ic('heart') +
    'Board game pasangan LDR</div>' +
    '<h1 class="home-title" aria-label="Loveopoly"><span class="ht-word">' +
    'Loveopoly'
      .split('')
      .map((ch, k) => '<span aria-hidden="true" style="--i:' + k + '">' + ch + '</span>')
      .join('') +
    '</span></h1>' +
    '<p class="home-sub">Keliling dunia berdua: beli kota romantis, bangun sampai landmark, adakan festival, dan rebut kota pasanganmu. Menang instan dengan Trio Warna, Raja Jalur, atau Kolektor Wisata!</p>' +
    kangenHTML() +
    passportCard() +
    // Pertanyaan Hari Ini: pengguna lama di atas (kebiasaan harian), pengguna baru di bawah tombol main
    (returning ? dailyCard() : '') +
    resume +
    '<div class="home-actions">' +
    // Online = kartu utama (paling atas & paling besar); dua mode lain lebih ringkas di bawahnya
    '<button type="button" class="mode-card mc-online mc-hero" id="hOnline"><span class="mc-badge">' +
    ic('heart') +
    'Paling seru buat LDR</span><span class="mc-art">' +
    ART.art('plane') +
    '</span><span class="mc-txt"><b>Main Online</b><span>Beda kota? Main bareng pasangan pakai kode room</span></span><span class="mc-go" aria-hidden="true"><span class="mc-go-t">Mulai</span>' +
    ic('chevron') +
    '</span></button>' +
    '<div class="mc-row">' +
    '<button type="button" class="mode-card mc-ai mc-sm" id="hAI"><span class="mc-art">' +
    ART.art('bot') +
    '</span><span class="mc-txt"><b>Lawan AI</b><span>Easy, Normal, atau Hard</span></span>' +
    ic('chevron') +
    '</button>' +
    '<button type="button" class="mode-card mc-local mc-sm" id="hLocal"><span class="mc-art">' +
    ART.art('festival') +
    '</span><span class="mc-txt"><b>Main Bareng</b><span>2–4 orang, satu perangkat</span></span>' +
    ic('chevron') +
    '</button>' +
    '</div></div>' +
    (returning ? '' : dailyCard()) +
    '<div class="home-secondary"><button type="button" class="btn soft" id="hHow">' +
    ic('book') +
    '<span>Buku Panduan</span></button><button type="button" class="btn ghost sm" id="hPrivacy">' +
    ic('shield') +
    '<span>Privasi</span></button><span class="tiny muted">' +
    TILES.length +
    ' petak · ' +
    TILES.filter(t => t.type === 'city').length +
    ' kota romantis · ' +
    TILES.filter(t => t.type === 'spot').length +
    ' wisata · ' +
    D.CARDS.length +
    ' Kartu Cinta · ' +
    D.CHALLENGES.length +
    ' tantangan</span></div>' +
    '</div></div>';
  const on = (id, f) => {
    const el = $('#' + id);
    if (el) el.onclick = f;
  };
  on('hLocal', () => openSetup('local'));
  on('hAI', () => openSetup('ai'));
  on('hOnline', openOnline);
  on('hHow', () => UI.openGuide());
  on('hPass', () => openPassport());
  on('hDaily', () => openDaily());
  on('hKangenX', () => {
    dismissKangen();
    const n = $('#scrHome .merpi-note');
    if (n) UI.leave(n, 260);
  });
  on('hPrivacy', () => UI.openPrivacy());
  on('hResume', () => {
    const s = store.get(KEYS.save, null);
    if (validSave(s)) enterGame('local', -1, s.S);
  });
  on('hDiscard', () => {
    store.del(KEYS.save);
    renderHome();
  });
  on('hRejoin', () => openOnline(true));
  on('hForget', () => {
    store.del(KEYS.online);
    renderHome();
  });
  // hero miring 3D mengikuti pointer (desktop); layar sentuh & gerak-dikurangi tetap diam
  const hero = $('#scrHome .hero-scene'),
    scr = $('#scrHome');
  if (hero && scr && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    let raf = 0,
      tx = 0,
      ty = 0;
    const put = () => {
      raf = 0;
      hero.style.setProperty('--px', tx.toFixed(3));
      hero.style.setProperty('--py', ty.toFixed(3));
    };
    scr.onpointermove = e => {
      if (e.pointerType !== 'mouse') return;
      const r = hero.getBoundingClientRect();
      if (!r.width) return;
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
      if (!raf) raf = requestAnimationFrame(put);
    };
    scr.onpointerleave = () => {
      tx = 0;
      ty = 0;
      if (!raf) raf = requestAnimationFrame(put);
    };
  }
}

export { renderHome };
