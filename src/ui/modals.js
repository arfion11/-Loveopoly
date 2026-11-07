/* LOVEOPOLY — dialog permainan. Isinya dipecah per bagian di src/ui/modals/*.js;
   berkas ini mengumpulkan API-nya dan mendaftarkannya di registri UI. */
import { UI } from './ns.js';
import { showModal, refreshModal, closeModal, btn, cityHero } from './modals/base.js';
import { openDecision, syncModal } from './modals/decisions.js';
import { openProofs } from './modals/challenge.js';
import { onTileClick, openPortfolio, openHistory } from './modals/info.js';
import { openMenu, openExit, openSettings, openPrivacy } from './modals/menu.js';

Object.assign(UI, {
  openPrivacy,
  showModal,
  refreshModal,
  closeModal,
  syncModal,
  openDecision,
  openPortfolio,
  onTileClick,
  openMenu,
  openHistory,
  openSettings,
  openExit,
  btn,
  cityHero,
  openProofs,
});
