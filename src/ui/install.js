/* LOVEOPOLY — pasang sebagai aplikasi (PWA): pendaftaran service worker & tombol "Pasang Aplikasi" di menu beranda. */
let deferred = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); // tampilkan lewat tombol di menu, bukan spanduk otomatis
  deferred = e;
});
window.addEventListener('appinstalled', () => {
  deferred = null;
});

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** 'prompt' (Chrome/Edge/Android), 'ios' (Safari: lewat menu Bagikan), '' (sudah terpasang / tidak didukung). */
export function installMode() {
  if (standalone()) return '';
  if (deferred) return 'prompt';
  return isIOS() ? 'ios' : '';
}

/** Tampilkan dialog pasang bawaan browser. true bila pemain memasang. */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  e.prompt();
  const r = await e.userChoice.catch(() => null);
  return !!(r && r.outcome === 'accepted');
}

/** Daftarkan service worker (hanya build produksi). Tidak dipasang saat browser dikendalikan uji otomatis,
    kecuali URL memuat ?uji-sw, supaya uji selalu memakai build terbaru. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (navigator.webdriver && !location.search.includes('uji-sw')) return;
  const go = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
