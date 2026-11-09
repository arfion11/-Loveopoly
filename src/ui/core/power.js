/* LOVEOPOLY — UI inti › hemat daya (diekspor ulang lewat src/ui/core.js)
   Hiasan yang berulang terus (Merpi bergoyang & berkedip, bola dunia, dek, pion, tombol Lempar, latar suasana)
   membuat browser menggambar ulang ±60× per detik walau permainan sedang diam; di HP lemah itu bikin panas &
   boros baterai. body.calm menjeda hiasan itu (daftarnya di src/styles/power.css, berhenti di tempat lalu lanjut
   mulus saat bangun):
   - tenang: CALM_MS tanpa kejadian di layar game (sentuhan, tombol, langkah, pesan Merpi) → calm, kejadian → bangun;
   - Hemat baterai (body.lowp): calm selamanya + pola suasana diam. prefs.power 'auto' (bawaan) | 'save' | 'full'. */
import { App, KEYS, store, reduceMotion } from './base.js';
import { toast } from './notify.js';

const CALM_MS = 12000;
let calmT = 0,
  probed = false,
  // hasil ukur "HP sedang berat" untuk sesi ini saja, TIDAK disimpan: Mode Daya Rendah iPhone / penghemat baterai
  // Android membatasi layar ke 30 fps sementara; kalau disimpan, Hemat baterai menyala selamanya walau HP sudah normal
  slowNow = false;

// Otomatis = nyala bila Hemat Data aktif, Android ber-RAM ≤ 4 GB (navigator.deviceMemory sudah dibulatkan ke bawah),
// atau perangkat ini terukur patah-patah di sesi ini (slowNow, lihat probeFps)
function weakDevice() {
  const n = /** @type {any} */ (navigator);
  if (n.connection && n.connection.saveData) return true;
  return /Android/i.test(n.userAgent || '') && typeof n.deviceMemory === 'number' && n.deviceMemory <= 4;
}
function lowPower() {
  const v = App.prefs.power;
  if (v === 'save') return true;
  if (v === 'full') return false;
  return slowNow || weakDevice();
}
// Pesawat kecil di peta tengah papan = animasi SVG (SMIL <animateMotion>): tidak ikut animation-play-state CSS dan
// tetap menggambar ulang walau petanya disembunyikan. Dijeda lewat pauseAnimations() saat tenang, atau saat peta
// tersembunyi (papan 3D & ponsel: Merpi besar menggantikannya). Dipanggil juga oleh applyLayout.
function syncSmil() {
  const stop = document.body.classList.contains('calm') || !!document.querySelector('.game.v3d, .game.layout-compact, .game.layout-land');
  document.querySelectorAll('svg.cd-map').forEach(el => {
    const svg = /** @type {SVGSVGElement} */ (/** @type {unknown} */ (el));
    if (!svg.pauseAnimations) return;
    if (stop && !svg.animationsPaused()) svg.pauseAnimations();
    else if (!stop && svg.animationsPaused()) svg.unpauseAnimations();
  });
}
function goCalm() {
  calmT = 0;
  if (!document.body.classList.contains('in-game')) return;
  // jangan di tengah animasi permainan (pion melangkah, kartu terbang): coba lagi sebentar lagi
  if (App.animating || App.pending.length) {
    calmT = setTimeout(goCalm, 3000);
    return;
  }
  document.body.classList.add('calm');
  syncSmil();
}
// ada kejadian: hiasan jalan lagi (kecuali Hemat baterai) & hitung ulang waktu tenang. Murah: boleh sering dipanggil.
function wakeCalm() {
  const b = document.body;
  if (!b) return;
  const low = lowPower();
  b.classList.toggle('lowp', low);
  b.classList.toggle('calm', low);
  clearTimeout(calmT);
  calmT = low || !b.classList.contains('in-game') ? 0 : setTimeout(goCalm, CALM_MS);
  syncSmil();
}
function initPower() {
  // versi lama menyimpan hasil ukur permanen (prefs.powerSlow): dibuang supaya perangkat diukur ulang
  if ('powerSlow' in App.prefs) {
    delete App.prefs.powerSlow;
    store.set(KEYS.prefs, App.prefs);
  }
  const opt = { capture: true, passive: true };
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => document.addEventListener(ev, wakeCalm, opt));
  wakeCalm();
}
// Mode Otomatis: ukur kelancaran sekali per sesi saat game berjalan. Rata-rata < 40 fps = HP sedang berat →
// Hemat baterai nyala untuk sesi ini saja (dibuka lagi = diukur ulang) + kabar sekali per perangkat (prefs.powerTold).
// Tidak saat uji otomatis (navigator.webdriver).
function probeFps() {
  if (probed || navigator.webdriver || reduceMotion() || lowPower() || (App.prefs.power && App.prefs.power !== 'auto')) return;
  if (document.hidden || !document.body.classList.contains('in-game')) return;
  probed = true;
  let n = 0,
    t0 = 0;
  const step = t => {
    if (document.hidden || !document.body.classList.contains('in-game')) return void (probed = false);
    if (!t0) t0 = t;
    n++;
    if (t - t0 < 3000) return void requestAnimationFrame(step);
    if (((n - 1) * 1000) / (t - t0) >= 40) return;
    slowNow = true;
    wakeCalm();
    if (App.prefs.powerTold) return;
    App.prefs.powerTold = true;
    store.set(KEYS.prefs, App.prefs);
    toast(
      'HP-mu sedang terasa agak berat, jadi Hemat baterai menyala untuk sesi ini: hiasan diam & latar Kabar Merpi bergerak pelan. Saat dibuka lagi diukur ulang. Bisa diubah di Pengaturan.',
      { title: 'Hemat baterai', ms: 7000 }
    );
  };
  requestAnimationFrame(step);
}

export { initPower, lowPower, probeFps, syncSmil, wakeCalm };
