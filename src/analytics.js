/* LOVEOPOLY — statistik pemakaian anonim (Google Analytics 4) & laporan error.
   Yang dikirim hanya jenis kejadian & angka (mode main, jumlah pemain, ronde, alasan menang, pesan error dipendekkan),
   TIDAK PERNAH nama, pesan romantis, surat, foto, atau kode room. Fitur iklan & Google Signals dimatikan.
   Bisa dimatikan di Pengaturan (prefs.analytics = false); bawaan mati bila browser mengirim Global Privacy Control.
   Tidak dimuat saat pengembangan & uji otomatis (navigator.webdriver), kecuali URL memuat ?uji-ga. */
const ID = 'G-E5VSWC5YXW';
const PREFS = 'loveopoly.v1.prefs';
const MAX_ERRORS = 10; // per sesi, supaya error berulang tidak membanjiri

let loaded = false;
let errorCount = 0;
const seenErrors = new Set();

const enabledBuild = () => import.meta.env.PROD && (!navigator.webdriver || location.search.includes('uji-ga'));
/** Bawaan sakelar statistik bila pemain belum memilih. */
export const analyticsDefault = () => !navigator.globalPrivacyControl;
/** Pilihan pemain (atau bawaan). */
export function analyticsOn() {
  let p;
  try {
    p = JSON.parse(localStorage.getItem(PREFS) || '{}') || {};
  } catch (e) {
    p = {};
  }
  return typeof p.analytics === 'boolean' ? p.analytics : analyticsDefault();
}
const allowed = () => enabledBuild() && analyticsOn();

function gtag() {
  // gtag.js membaca objek arguments apa adanya
  window.dataLayer.push(arguments);
}
function load() {
  if (loaded) return;
  loaded = true;
  delete window['ga-disable-' + ID];
  window.dataLayer = window.dataLayer || [];
  gtag('js', new Date());
  gtag('config', ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    display_mode: window.matchMedia('(display-mode: standalone)').matches ? 'aplikasi' : 'browser',
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
}

/** Catat kejadian. params hanya angka/teks pendek tanpa data pribadi. */
export function track(name, params) {
  if (!allowed()) return;
  load();
  gtag('event', name, params || {});
}

/** Laporkan error ke Analytics (event "exception"): pesan dipendekkan, tanpa URL, maksimal 10 berbeda per sesi. */
export function reportError(message, where, fatal) {
  if (!allowed() || errorCount >= MAX_ERRORS) return;
  const msg = String(message || 'error')
    .replace(/https?:\/\/\S+/g, '')
    .slice(0, 110);
  if (seenErrors.has(msg)) return;
  seenErrors.add(msg);
  errorCount++;
  track('exception', { description: msg + (where ? ' @ ' + String(where).slice(0, 40) : ''), fatal: !!fatal });
}

/** Sakelar dari Pengaturan: mati = berhenti mengirim seketika (opt-out resmi gtag), hidup = mulai memuat. */
export function setAnalytics(on) {
  if (!on) window['ga-disable-' + ID] = true;
  else if (enabledBuild()) {
    delete window['ga-disable-' + ID];
    load();
  }
}

/** Pasang penangkap error & muat Analytics setelah halaman selesai dimuat (tidak memperlambat tampilan awal). */
export function initAnalytics() {
  const where = (file, line) => (file ? String(file).split('/').pop().split('?')[0] + ':' + (line || 0) : '');
  window.addEventListener('error', e => reportError(e.message, where(e.filename, e.lineno)));
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    reportError(r && r.message ? r.message : String(r), 'promise');
  });
  if (!allowed()) return;
  const go = () => setTimeout(load, 1200);
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
