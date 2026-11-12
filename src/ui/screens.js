/* LOVEOPOLY — layar. Isinya dipecah per bagian di src/ui/screens/*.js;
   berkas ini mengumpulkan API-nya dan mendaftarkannya di registri UI. */
import { UI } from './ns.js';
import { show, savePrefs, applyTheme, syncSoundBtn, toggleSound, relang } from './screens/base.js';
import { passport, recordPassport, openPassport, notePlay } from './screens/passport.js';
import { renderHome } from './screens/home.js';
import { openSetup, renderSetup } from './screens/setup.js';
import { openOnline, renderLobby } from './screens/online.js';
import { enterGame, exitToHome, togglePause, afterSettle, onLetter } from './screens/game.js';
import { showWin } from './screens/win.js';
import { endTour, startTour } from './screens/tour.js';
import { boot } from './screens/boot.js';
import { openDaily } from './screens/daily.js';
import { backupLink, openRestore, shareBackup } from './screens/backup.js';

Object.assign(UI, {
  toggleSound,
  openPassport,
  passport,
  recordPassport,
  notePlay,
  show,
  savePrefs,
  applyTheme,
  syncSoundBtn,
  renderHome,
  openSetup,
  renderSetup,
  relang,
  openOnline,
  renderLobby,
  enterGame,
  exitToHome,
  togglePause,
  showWin,
  afterSettle,
  onLetter,
  boot,
  startTour,
  endTour,
  openDaily,
  backupLink,
  openRestore,
  shareBackup,
});

export { start } from './screens/boot.js';
