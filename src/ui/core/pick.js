/* LOVEOPOLY — UI inti › mode pilih petak di papan (diekspor ulang lewat src/ui/core.js) */
import { ART } from '../../assets/art.js';
import { SND } from '../../assets/audio.js';
import { UI } from '../ns.js';
import { $, $$, App, esc, ic, pulse } from './base.js';
import { pickEl } from './layout.js';
import { auto3d, camActive, camApply, camAuto, camSettle, is3d, renderCamCtl } from './camera.js';
import { tileEl } from './board.js';

// ---------- mode pilih petak di papan ----------
function startPick(def) {
  endPick(true);
  App.pick = def;
  const b = $('#board'),
    bar = pickEl || $('#pickbar');
  if (!b || !bar) return;
  b.classList.add('picking');
  const g = $('#game');
  if (g) g.classList.add('pick-on');
  $$('#board .tile').forEach(el => {
    const i = Number(el.dataset.i);
    el.classList.toggle('pickable', def.can(i));
  });
  if (camActive() && App.cam.zoomed) {
    clearTimeout(App.cam.outTimer);
    App.cam.pickBack = true;
    App.cam.zoomed = false;
    camApply(true, 380);
    renderCamCtl();
  }
  renderPick();
}
function renderPick() {
  const def = App.pick,
    bar = pickEl || $('#pickbar');
  if (!def || !bar) return;
  bar.hidden = false;
  $$('#board .tile').forEach(el => {
    const i = Number(el.dataset.i);
    el.classList.toggle('picked', def.sel.includes(i));
    el.classList.toggle('pickable', def.can(i));
  });
  const ready = def.ready();
  bar.innerHTML =
    '<div class="pb-head">' +
    (def.art ? '<span class="pb-art">' + ART.art(def.art) + '</span>' : '') +
    '<div class="pb-txt"><b>' +
    esc(def.title) +
    '</b><span>' +
    esc(def.hint()) +
    '</span></div></div>' +
    '<div class="pb-acts">' +
    (def.skipLabel ? '<button type="button" class="btn ghost" id="pbSkip">' + esc(def.skipLabel) + '</button>' : '') +
    '<button type="button" class="btn primary" id="pbOk"' +
    (ready ? '' : ' disabled') +
    '>' +
    ic('check') +
    '<span>' +
    esc(def.okLabel()) +
    '</span></button></div>';
  const ok = $('#pbOk'),
    sk = $('#pbSkip');
  if (ok)
    ok.onclick = () => {
      if (def.ready()) def.confirm();
    };
  if (sk) sk.onclick = () => def.skip();
}
function endPick(silent) {
  if (!App.pick) return;
  App.pick = null;
  const b = $('#board'),
    bar = pickEl || $('#pickbar'),
    g = $('#game');
  if (b) b.classList.remove('picking');
  if (g) g.classList.remove('pick-on');
  $$('#board .tile').forEach(el => el.classList.remove('pickable', 'picked'));
  if (bar) {
    bar.hidden = true;
    bar.innerHTML = '';
  }
  const back = is3d() ? App.cam.pickBack && !auto3d() : !camAuto();
  App.cam.pickBack = false;
  if (!silent && camActive() && back) {
    App.cam.zoomed = true;
    camSettle();
    renderCamCtl();
  }
}
function onTileTap(i, e) {
  const def = App.pick;
  if (def) {
    // papan 3D: kartu yang berdiri bisa menutupi sebagian petak di belakangnya. Bila yang diketuk tidak bisa
    // dipilih tetapi ada petak yang bisa dipilih tepat di belakang titik ketukan, pakai petak itu
    if (!def.can(i) && e && e.clientX && is3d()) {
      const alt = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map(el => el.closest && el.closest('#board .tile'))
        .filter(Boolean)
        .map(el => Number(el.dataset.i))
        .find(k => def.can(k));
      if (alt != null) i = alt;
    }
    if (!def.can(i)) {
      SND.play('error');
      pulse(tileEl(i), 'nope', 400);
      return;
    }
    def.tap(i);
    SND.play('click');
    renderPick();
    return;
  }
  UI.onTileClick(i);
}

export { endPick, onTileTap, renderPick, startPick };
