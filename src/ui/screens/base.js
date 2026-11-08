/* LOVEOPOLY — layar › util layar: pindah layar, tema, suara (dikumpulkan lewat src/ui/screens.js) */
import { App, SND, TILES, KEYS, esc, $$, store } from '../core.js';
import { UI } from '../ns.js';

// ---------- util layar ----------
function show(id) {
  $$('.screen').forEach(s => {
    s.hidden = s.id !== id;
  });
  const inGame = id === 'scrGame';
  document.body.classList.toggle('in-game', inGame);
  if (!inGame) {
    UI.renderHeader(null);
    if (UI.renderAmbience) UI.renderAmbience(null);
  }
  window.scrollTo(0, 0);
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

export { applyTheme, keepGameTop, savePrefs, seg, show, syncSoundBtn, toggleSound, validSave };
