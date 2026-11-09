/* LOVEOPOLY — layar › header & boot (dikumpulkan lewat src/ui/screens.js) */
import { Icons } from '../../assets/icons.js';
import { reportError } from '../../analytics.js';
import { App, SND, ART, ic, $, toast, initPower } from '../core.js';
import { UI } from '../ns.js';
import { applyTheme, keepGameTop, show, syncSoundBtn } from './base.js';
import { openPassport, passport } from './passport.js';
import { renderHome } from './home.js';
import { dailyFromHash, openDaily } from './daily.js';

// ---------- boot ----------
function bindHeader() {
  $('#hMenu').onclick = () => UI.openMenu();
  $('#brandHome').onclick = e => {
    e.preventDefault();
    if (App.S && !$('#scrGame').hidden) UI.openExit();
    else {
      show('scrHome');
      renderHome();
    }
  };
  $('#hMenu').innerHTML = ic('menu');
  $('.brand-mark').innerHTML = ART.merpi('');
}
// buka tautan Pertanyaan Hari Ini (null = tidak ada tautan, false = rusak). true bila dialog dibuka
function takeLink(link) {
  if (link === false) {
    setTimeout(() => toast('Tautan Pertanyaan Hari Ini tidak valid atau sudah kedaluwarsa.', { kind: 'err' }), 400);
    return false;
  }
  if (!link) return false;
  // permainan sedang berjalan: tetap dibuka di atasnya (dialog), papan tidak berubah
  setTimeout(() => openDaily(link), UI.reduceMotion() ? 0 : 300);
  return true;
}
function boot() {
  document.documentElement.lang = 'id';
  keepGameTop();
  initPower();
  // tata letak papan memakai container query (iOS 16+, Chrome/Edge 105+, Firefox 110+)
  const modern = !!(window.CSS && CSS.supports && CSS.supports('container-type: inline-size'));
  if (!modern)
    setTimeout(
      () =>
        toast('Browser kamu terlalu lama untuk Loveopoly. Perbarui iOS / Chrome agar papan tampil rapi.', {
          kind: 'err',
          title: 'Perbarui browser',
          ms: 9000,
        }),
      600
    );
  if (!$('#iconSprite')) {
    const d = document.createElement('div');
    d.id = 'iconSprite';
    d.innerHTML = Icons.sprite();
    document.body.prepend(d);
  }
  applyTheme();
  SND.setEnabled(App.prefs.sound);
  syncSoundBtn();
  bindHeader();
  document.addEventListener('pointerdown', () => SND.unlock(), { once: true });
  show('scrHome');
  renderHome();
  if (UI.imported)
    setTimeout(
      () =>
        toast('Loveopoly pindah ke ' + location.host + '. Paspor, simpanan game, dan pengaturanmu ikut pindah.', {
          title: 'Alamat baru',
          icon: 'heart',
          kind: 'good',
          ms: 7000,
        }),
      600
    );
  // tautan Pertanyaan Hari Ini dari pasangan (#tanya=…): didahulukan, paspor tidak muncul otomatis di sesi ini.
  // Juga saat halaman sudah terbuka & hanya bagian # yang berganti (tautan ditempel di tab yang sama).
  window.addEventListener('hashchange', () => takeLink(dailyFromHash()));
  if (takeLink(dailyFromHash())) return;
  const pp = passport();
  if (!pp.name && !pp.skipped)
    setTimeout(
      () => {
        if (!$('#scrHome').hidden && !App.S) openPassport({ first: true });
      },
      UI.reduceMotion() ? 0 : 350
    );
}

// dipanggil src/main.js setelah semua modul siap
export const start = () => {
  try {
    boot();
  } catch (e) {
    console.error(e);
    reportError(e && e.message, 'boot', true);
    const m = document.getElementById('fatal');
    if (m) {
      m.hidden = false;
      m.textContent = 'Terjadi kesalahan saat memuat game: ' + e.message;
    }
  }
};

export { boot };
