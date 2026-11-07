/* LOVEOPOLY — titik masuk aplikasi (Vite). Urutan impor = urutan evaluasi modul. */
import './styles/index.css';
import { D } from './engine/data.js';
import { E } from './engine/engine.js';
import { AI } from './engine/ai.js';
import { Icons } from './assets/icons.js';
import { ART } from './assets/art.js';
import { SND } from './assets/audio.js';
import { UI } from './ui/ns.js';
import './ui/core.js';
import './ui/modals.js';
import { Net } from './net/net.js';
import './ui/guide.js';
import { start } from './ui/screens.js';
import { registerServiceWorker } from './ui/install.js';
import { initAnalytics } from './analytics.js';

// kait uji & debug: uji Playwright dan konsol browser memakai window.Love* (bukan dipakai antarmodul)
Object.assign(window, {
  LOVE_DATA: D,
  LoveEngine: E,
  LoveAI: AI,
  LoveIcons: Icons,
  LoveArt: ART,
  LoveAudio: SND,
  LoveUI: UI,
  LoveNet: Net,
});

initAnalytics();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
registerServiceWorker();
