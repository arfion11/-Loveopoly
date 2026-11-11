/* LOVEOPOLY — layar › util layar: pindah layar, tema, suara (dikumpulkan lewat src/ui/screens.js) */
import { App, SND, TILES, KEYS, esc, $$, store, wakeCalm, reduceMotion } from '../core.js';
import { UI } from '../ns.js';
import { levelOf, themeFor } from '../progress.js';

// ---------- util layar ----------
// layar yang aktif (diisi show(); sebelum show pertama = layar yang tidak tersembunyi)
const activeScreen = () => App.screen || ($$('.screen').find(s => !s.hidden) || {}).id || '';
// ---------- transisi layar ----------
// Layar menu (beranda ↔ setup ↔ online): isi layar baru naik & muncul dengan pegas, dan judul kartu mode yang diketuk
// "terbang" menjadi judul layar berikutnya (shared = 'ai' | 'local' | 'online'; teknik FLIP dengan salinan judul).
// Pergantian layar tetap SINKRON & langsung bisa disentuh. (View Transitions API sempat dipakai, tapi selama transisi
// ketukan mengenai <html> di Chromium & WebKit, jadi tombol di layar baru tertelan ±0,45 dtk.) Hanya transform/opacity,
// sekali jalan; layar game selalu langsung (kamera papan & animasi masuk papan sendiri); mati saat gerak dikurangi /
// Hemat baterai.
const TITLE_SEL = { ai: '.mc-ai .mc-txt b', local: '.mc-local .mc-txt b', online: '.mc-online .mc-txt b' };
const titleOf = (id, shared) => {
  const host = document.getElementById(id);
  const el = host && host.querySelector(id === 'scrHome' ? TITLE_SEL[shared] : '.setup-head h2');
  return el && el.getClientRects().length ? el : null;
};
// from/to = kotak judul asal & tujuan (diukur SEBELUM layar baru diberi animasi naik, supaya tidak ikut tergeser)
function flyTitle(from, dst, to) {
  if (!to.width || !to.height) return;
  const cs = getComputedStyle(dst);
  const g = dst.cloneNode(true);
  g.removeAttribute('id');
  g.className = 'title-fly';
  g.setAttribute('aria-hidden', 'true');
  ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'textShadow'].forEach(k => (g.style[k] = cs[k]));
  Object.assign(g.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
  document.body.appendChild(g);
  dst.style.opacity = '0';
  const k = from.height / to.height;
  const done = () => {
    g.remove();
    dst.style.opacity = '';
  };
  const a = g.animate(
    [
      { transform: 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' + k + ')', opacity: 0.85 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 440, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
  );
  a.onfinish = done;
  a.oncancel = done;
  setTimeout(done, 900); // pengaman bila animasi tidak pernah selesai (tab disembunyikan)
}
function screenIn(scr, back, from, shared) {
  scr.classList.remove('scr-in', 'scr-back');
  scr.classList.add('scr-pre'); // tak terlihat satu frame: pemanggil mengisi layar dulu, lalu diukur tanpa transform
  requestAnimationFrame(() => {
    const dst = from && titleOf(scr.id, shared),
      to = dst && dst.getBoundingClientRect();
    scr.classList.remove('scr-pre');
    scr.classList.add(back ? 'scr-back' : 'scr-in');
    if (dst) flyTitle(from, dst, to);
    const end = () => scr.classList.remove('scr-in', 'scr-back');
    const onEnd = e => {
      if (e.target !== scr) return;
      scr.removeEventListener('animationend', onEnd);
      end();
    };
    scr.addEventListener('animationend', onEnd);
    setTimeout(end, 900);
  });
}
function show(id, shared) {
  const from = activeScreen();
  App.screen = id;
  const anim =
    from && from !== id && from !== 'scrGame' && id !== 'scrGame' && !reduceMotion() && !document.body.classList.contains('lowp');
  const src = anim && shared ? titleOf(from, shared) : null;
  const srcRect = src ? src.getBoundingClientRect() : null;
  $$('.screen').forEach(s => {
    s.hidden = s.id !== id;
    if (s.id !== id) s.classList.remove('scr-pre', 'scr-in', 'scr-back');
  });
  const inGame = id === 'scrGame';
  document.body.classList.toggle('in-game', inGame);
  wakeCalm();
  if (!inGame) {
    UI.renderHeader(null);
    if (UI.renderAmbience) UI.renderAmbience(null);
  }
  window.scrollTo(0, 0);
  if (anim) screenIn(document.getElementById(id), id === 'scrHome', srcRect, shared);
}
// Layar game tidak pernah digulir. iOS (aplikasi terpasang) tetap bisa menggeser dokumen, mis. saat keyboard muncul
// atau sapuan jari, lalu membiarkannya tergeser: kartu pemain tertutup header. Kembalikan ke atas begitu tidak ada
// kolom yang sedang diketik (saat mengetik, biarkan iOS menggeser supaya kolomnya terlihat).
function keepGameTop() {
  const typing = () => {
    const a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
  };
  const fix = () => {
    if (document.body.classList.contains('in-game') && (window.scrollY || window.scrollX) && !typing()) window.scrollTo(0, 0);
  };
  window.addEventListener('scroll', fix, { passive: true });
  document.addEventListener('focusout', () => setTimeout(fix, 300));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => setTimeout(fix, 300));
}
function savePrefs() {
  store.set(KEYS.prefs, App.prefs);
}
function applyTheme() {
  const t = App.prefs.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  // tema papan (hadiah Jam Terbang): hanya bila sudah terbuka di level paspor perangkat ini
  const prof = store.get('loveopoly.v1.profile', null) || {};
  const b = themeFor(App.prefs.board, prof.name ? levelOf(prof.xp) : 1);
  if (b === 'klasik') document.documentElement.removeAttribute('data-board');
  else document.documentElement.setAttribute('data-board', b);
}
// suara diatur dari Menu (sakelar Suara); fungsi ini hanya menyelaraskan menu yang sedang terbuka
function syncSoundBtn() {
  if (App.modal && /^menu/.test(App.modal.key || '') && UI.refreshModal) UI.refreshModal();
}
function toggleSound() {
  App.prefs.sound = !App.prefs.sound;
  SND.setEnabled(App.prefs.sound);
  if (App.prefs.sound) SND.play('click');
  savePrefs();
  syncSoundBtn();
}
const seg = (name, opts, val) =>
  '<div class="seg" role="group" data-seg="' +
  name +
  '">' +
  opts
    .map(([k, l]) => '<button type="button" data-v="' + k + '" aria-pressed="' + (String(val) === String(k)) + '">' + esc(l) + '</button>')
    .join('') +
  '</div>';
const validSave = s => s && s.S && s.S.v === 2 && !s.S.over && Array.isArray(s.S.tiles) && s.S.tiles.length === TILES.length;

export { activeScreen, applyTheme, keepGameTop, savePrefs, seg, show, syncSoundBtn, toggleSound, validSave };
