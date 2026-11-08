/* LOVEOPOLY — UI inti › dadu & pion (diekspor ulang lewat src/ui/core.js) */
import { SND } from '../../assets/audio.js';
import { E } from '../../engine/engine.js';
import { $, $$, App, N, SPD, ic, pulse, restart, sleep } from './base.js';
import { view3d } from './layout.js';
import { auto3d, camActive, camFocus, camHold, is3d } from './camera.js';
import { tileEl, tilePos } from './board.js';
import { ripple } from './effects.js';
import { mascotLook } from './mascot.js';

// ---------- dadu ----------
const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] };
// saat diam dadu menghadap lurus (hanya dimiringkan 2D), jadi sisi kubus tidak terlihat bertumpuk;
// saat dilempar baru berguling 3D
function setDieFace(el, v, spin) {
  if (!el) return;
  const [rx, ry] = FACE_ROT[v] || [0, 0];
  App.rollSpin = spin ? App.rollSpin + 1 : App.rollSpin;
  const k = App.rollSpin % 2 ? 2 : 3;
  const tz = el.id === 'die2' ? 7 : -6;
  el.style.transform = 'rotateZ(' + tz + 'deg) rotateX(' + (rx + 360 * k) + 'deg) rotateY(' + (ry + 360 * k) + 'deg)';
}
async function rollDice(d, dbl, aim, hit) {
  const box = $('#dice');
  if (!box) return;
  SND.play('dice');
  const ms = Math.round(950 * SPD());
  box.style.setProperty('--roll', ms + 'ms');
  $$('.die', box).forEach(x => {
    x.style.transitionDuration = Math.round(ms * 1.05) + 'ms';
  });
  $$('.roll-l, .roll-r', box).forEach(b => b.remove());
  box.classList.remove('dbl');
  restart(box, 'rolling');
  setDieFace($('#die1'), d[0], true);
  setDieFace($('#die2'), d[1], false);
  const aimTxt = aim ? (hit ? 'Bidikan tepat' : 'Bidikan meleset') : '';
  box.setAttribute(
    'aria-label',
    'Dadu: ' + d[0] + ' + ' + d[1] + ' = ' + (d[0] + d[1]) + (dbl ? ', kembar' : '') + (aim ? ', ' + aimTxt.toLowerCase() : '')
  );
  await sleep(ms);
  box.classList.remove('rolling');
  // satu grup per sisi dadu (lihat .roll-l/.roll-r di CSS) supaya lencana tidak saling tumpuk
  let html =
    '<span class="roll-r"><span class="sum-badge"><i>=&nbsp;</i>' +
    (d[0] + d[1]) +
    '</span>' +
    (dbl ? '<span class="dbl-badge">KEMBAR!</span>' : '') +
    '</span>';
  if (aim)
    html +=
      '<span class="roll-l"><span class="aim-badge' +
      (hit ? ' hit' : '') +
      '" title="' +
      aimTxt +
      '">' +
      ic('target') +
      '<b>' +
      (hit ? 'Tepat!' : 'Meleset') +
      '</b></span></span>';
  box.insertAdjacentHTML('beforeend', html);
  if (dbl) {
    box.classList.add('dbl');
    SND.play('heart');
  }
}

// ---------- pion ----------
function tileBox(i) {
  const el = tileEl(i);
  if (!el) return { x: 0, y: 0, w: 10, h: 10 };
  return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2, w: el.offsetWidth, h: el.offsetHeight };
}
// titik berdiri pion: di atas ilustrasi petak, supaya nama & harga tetap terbaca
function tileAnchor(tile) {
  const b = tileBox(tile),
    side = tilePos(tile).side;
  if (is3d()) {
    // 3D: kartu pop-up berdiri di bagian depan petak; pion berdiri di depannya (baris atas/bawah & sudut)
    // atau di sisi dalam petak (kolom kiri/kanan), jadi kartu tidak pernah menutupi pion
    if (side === 'left') return { x: b.x + b.w * 0.23, y: b.y, w: b.h, v: true };
    if (side === 'right') return { x: b.x - b.w * 0.23, y: b.y, w: b.h, v: true };
    return { x: b.x, y: b.y + b.h * (side === 'corner' ? 0.32 : 0.29), w: b.w };
  }
  if (side === 'bottom') return { x: b.x, y: b.y + b.h * 0.02, w: b.w };
  if (side === 'top') return { x: b.x, y: b.y - b.h * 0.04, w: b.w };
  if (side === 'left') return { x: b.x - b.w * 0.2, y: b.y + b.h * 0.2, w: b.h };
  if (side === 'right') return { x: b.x + b.w * 0.2, y: b.y + b.h * 0.2, w: b.h };
  return { x: b.x, y: b.y + b.h * 0.12, w: b.w };
}
const SLOT2 = [
  [-0.55, 0],
  [0.55, 0],
];
const SLOT4 = [
  [-0.5, -0.32],
  [0.5, -0.32],
  [-0.5, 0.32],
  [0.5, 0.32],
];
// kolom kiri/kanan 3D: berjajar ke belakang (searah kedalaman) supaya tetap di sisi dalam petak
const SLOT2V = [
  [0, -0.5],
  [0, 0.5],
];
const SLOT4V = [
  [-0.3, -0.5],
  [0.3, -0.5],
  [-0.3, 0.5],
  [0.3, 0.5],
];
function tokenXY(pi, tile, n) {
  const a = tileAnchor(tile);
  const S = App.S;
  const here = S ? S.players.filter(p => !p.bankrupt && p.pos === tile).map(p => p.i) : [pi];
  const k = Math.max(0, here.indexOf(pi));
  const many = n != null ? n : here.length;
  if (many <= 1) return { x: a.x, y: a.y };
  const sl = a.v ? (many === 2 ? SLOT2V : SLOT4V) : many === 2 ? SLOT2 : SLOT4;
  const [sx, sy] = sl[k % sl.length];
  const m = Math.min(a.w * 0.62, tokSize * 1.05);
  return { x: a.x + sx * m, y: a.y + sy * m };
}
let tokSize = 30;
function ensureTokens(S) {
  const host = $('#tokens');
  if (!host) return;
  S.players.forEach(p => {
    let el = $('#tok-' + p.i);
    if (!el) {
      el = document.createElement('div');
      el.className = 'token';
      el.id = 'tok-' + p.i;
      el.innerHTML =
        '<span class="tk"><span class="tk-pin"></span><span class="tk-av"></span><span class="tk-plane">' +
        ic('plane') +
        '</span></span><span class="tk-shadow"></span>';
      host.appendChild(el);
    }
    const av = el.querySelector('.tk-av');
    if (av.textContent !== p.avatar) av.textContent = p.avatar;
    el.style.setProperty('--c', p.color);
    el.title = p.name;
  });
  const bw = App.cam.L || ($('#board') ? $('#board').offsetWidth : 600);
  tokSize = view3d() ? Math.max(30, Math.min(66, Math.round(bw * 0.052))) : Math.max(18, Math.min(46, Math.round(bw * 0.046)));
  host.style.setProperty('--ts', tokSize + 'px');
}
function placeToken(pi, tile, n) {
  const el = $('#tok-' + pi);
  if (!el) return;
  const { x, y } = tokenXY(pi, tile, n);
  el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
}
function renderTokens(S) {
  S = S || App.S;
  if (!S) return;
  ensureTokens(S);
  const a = E.actor(S);
  S.players.forEach(p => {
    const el = $('#tok-' + p.i);
    if (!el) return;
    placeToken(p.i, p.pos);
    el.classList.toggle('out', !!p.bankrupt);
    el.classList.toggle('island', !!p.island);
    el.classList.toggle('me', !S.over && !App.revealing && p.i === S.turn.p);
    el.style.zIndex = p.i === a ? 4 : p.i === S.turn.p ? 3 : 1;
  });
}
function landFx(pi, tile) {
  pulse($('#tok-' + pi), 'land', 560);
  const p = App.S && App.S.players[pi];
  ripple(tile, p ? p.color : null);
  pulse(tileEl(tile), 'stepped', 520);
  if (is3d()) pulse(tileEl(tile), 'landed', 1300);
}
async function moveToken(e) {
  const el = $('#tok-' + e.p);
  if (!el) return;
  el.style.zIndex = 6;
  const bd = $('#board'),
    walker = App.S && App.S.players[e.p];
  if (bd && walker) bd.style.setProperty('--walk', walker.color);
  if (camActive() && !App.cam.zoomed && (!is3d() || auto3d())) {
    camHold(true, e.from);
    await sleep(Math.round((is3d() ? 600 : 380) * SPD()));
  }
  if (e.kind === 'jump' || e.kind === 'fly' || e.steps === 0) {
    const fly = e.kind === 'fly';
    const ms = Math.round((fly ? 1300 : 640) * SPD());
    el.style.setProperty('--fly', ms + 'ms');
    el.style.transition = 'transform ' + ms + 'ms cubic-bezier(.45,0,.25,1)';
    restart(el, fly ? 'plane' : 'fly');
    camFocus(e.to, true, ms);
    mascotLook(e.to);
    placeToken(e.p, e.to, 1);
    SND.play(fly ? 'plane' : 'whoosh');
    await sleep(ms + 30);
    el.classList.remove('fly', 'plane');
    el.style.transition = '';
    landFx(e.p, e.to);
    await sleep(180 * SPD());
    return;
  }
  const n = Math.abs(e.steps),
    dir = e.steps > 0 ? 1 : -1;
  const per = Math.round((n > 10 ? 120 : 165) * SPD());
  el.style.setProperty('--hop', per + 'ms');
  let pos = e.from;
  for (let k = 0; k < n; k++) {
    pos = (pos + dir + N) % N;
    el.style.transition = 'transform ' + per + 'ms cubic-bezier(.35,.1,.3,1)';
    placeToken(e.p, pos, 1);
    camFocus(pos, true, per + 60);
    mascotLook(pos);
    restart(el, 'hop');
    pulse(tileEl(pos), 'stepped', 380);
    SND.play('step');
    await sleep(per + 10);
  }
  el.classList.remove('hop');
  el.style.transition = '';
  landFx(e.p, e.to);
  await sleep(200 * SPD());
}

export { moveToken, renderTokens, rollDice, setDieFace, tileAnchor, tileBox, tokSize, tokenXY };
