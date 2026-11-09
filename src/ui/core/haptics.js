/* LOVEOPOLY — UI inti › getar halus (diekspor ulang lewat src/ui/core.js)
   Getaran singkat hanya untuk aksi pemain SENDIRI di perangkat ini (lempar dadu, beli kota, menang, naik level):
   bot & lawan online tidak membuat HP bergetar. Hanya layar sentuh dengan navigator.vibrate (Android Chrome; Safari
   iPhone belum mendukung → diam saja). Sakelar di Pengaturan (prefs.haptics), mati otomatis di Hemat baterai. */
import { App } from './base.js';
import { lowPower } from './power.js';

const PATTERN = { dice: 14, buy: [16, 50, 16], win: [30, 70, 30, 70, 90], level: [20, 60, 20, 60, 40] };
function canBuzz() {
  return typeof navigator.vibrate === 'function' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}
function buzz(kind) {
  if (App.prefs.haptics === false || !canBuzz() || lowPower() || document.hidden) return;
  try {
    navigator.vibrate(PATTERN[kind] || 12);
  } catch (e) {
    /* getar opsional */
  }
}

export { buzz, canBuzz };
