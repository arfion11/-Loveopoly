/* LOVEOPOLY — layar › masuk/keluar game, undian giliran, jeda, setelah state stabil (dikumpulkan lewat src/ui/screens.js) */
import { Net } from '../../net/net.js';
import { App, D, E, SND, ART, KEYS, esc, ic, $, $$, store, toast } from '../core.js';
import { UI } from '../ns.js';
import { show } from './base.js';
import { renderHome } from './home.js';
import { showWin } from './win.js';
import { endTour, startTour } from './tour.js';

// ---------- masuk / keluar game ----------
let resizeBound = false;
// ---------- undian giliran: sorotan berputar dari pemain ke pemain, melambat, lalu berhenti di yang jalan duluan ----------
// Hasilnya sudah ditentukan engine (S.turn.p); animasi hanya mengungkapkan, jadi semua perangkat online melihat hasil sama.
let drawEnd = null;
function closeDraw() {
  const ov = $('#drawOv');
  if (ov) ov.remove();
  if (drawEnd) {
    const f = drawEnd;
    drawEnd = null;
    f();
  }
}
function drawReveal(S) {
  return new Promise(resolve => {
    closeDraw();
    const n = S.players.length,
      win = S.turn.p,
      rm = UI.reduceMotion();
    const order = Array.from({ length: n }, (_, k) => S.players[(win + k) % n]).filter(p => !p.bankrupt);
    const ov = document.createElement('div');
    ov.className = 'draw-ov';
    ov.id = 'drawOv';
    ov.innerHTML =
      '<div class="draw-card" role="dialog" aria-modal="true" aria-labelledby="drawT">' +
      '<span class="draw-merpi" aria-hidden="true">' +
      ART.merpi('is-think') +
      '</span>' +
      '<div class="draw-k">' +
      ic('dice') +
      'Undian giliran</div>' +
      '<h2 class="draw-t" id="drawT">Siapa jalan duluan?</h2>' +
      '<div class="draw-row" aria-hidden="true">' +
      S.players
        .map(
          (p, i) =>
            '<span class="draw-p" data-dp="' +
            i +
            '" style="--c:' +
            p.color +
            '"><span class="dp-av">' +
            esc(p.avatar) +
            '</span><b>' +
            esc(p.name) +
            '</b><span class="dp-tag">' +
            ic('crown') +
            'Duluan!</span></span>'
        )
        .join('') +
      '</div>' +
      '<p class="draw-res" role="status" aria-live="polite"></p>' +
      '<div class="draw-order" hidden><span class="do-k">Urutan main</span><ol>' +
      order.map((p, k) => '<li style="--c:' + p.color + '"><b>' + (k + 1) + '</b>' + esc(p.avatar) + ' ' + esc(p.name) + '</li>').join('') +
      '</ol></div>' +
      '<button type="button" class="btn primary" id="drawGo"><span>Lewati</span></button>' +
      '</div>';
    document.body.appendChild(ov);
    const chips = $$('.draw-p', ov),
      go = $('#drawGo', ov);
    let timer = 0,
      done = false,
      closing = 0;
    const mark = k => chips.forEach((c, j) => c.classList.toggle('dp-on', j === k));
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      mark(win);
      chips[win].classList.add('dp-win');
      ov.classList.add('dw-done');
      $('.draw-merpi', ov).innerHTML = ART.merpi('is-love');
      $('#drawT', ov).textContent = S.players[win].name + ' jalan duluan!';
      $('.draw-res', ov).textContent =
        'Undian giliran: ' + S.players[win].name + ' jalan duluan. Urutan main: ' + order.map(p => p.name).join(', ') + '.';
      $('.draw-order', ov).hidden = n < 3;
      go.querySelector('span').textContent = 'Ayo main!';
      if (!rm)
        chips[win].insertAdjacentHTML(
          'beforeend',
          Array.from(
            { length: 10 },
            (_, k) => '<i class="dp-spark" style="--a:' + k * 36 + 'deg;--k:' + k + '" aria-hidden="true"></i>'
          ).join('')
        );
      SND.play('fanfare');
      closing = setTimeout(close, rm ? 2600 : 2400);
    };
    const close = () => {
      clearTimeout(timer);
      clearTimeout(closing);
      if (!ov.isConnected) return;
      ov.classList.add('dw-out');
      setTimeout(
        () => {
          ov.remove();
          if (drawEnd) {
            drawEnd = null;
            resolve();
          }
        },
        rm ? 0 : 320
      );
    };
    drawEnd = resolve;
    go.onclick = () => {
      if (!done) finish();
      else close();
    };
    setTimeout(() => {
      try {
        go.focus({ preventScroll: true });
      } catch (e) {
        /* abaikan */
      }
    }, 60);
    if (rm || n < 2) {
      finish();
      return;
    }
    // langkah sorotan: berakhir tepat di pemenang; jeda membesar (cepat → pelan) supaya terasa mendebarkan
    const base = 3 * n + 4,
      T = base + ((((win - base) % n) + n) % n);
    let k = 0;
    const step = () => {
      mark(k % n);
      SND.play('step');
      if (k >= T) {
        timer = setTimeout(finish, 380);
        return;
      }
      const x = k / T;
      k++;
      timer = setTimeout(step, 55 + 360 * Math.pow(x, 2.6));
    };
    step();
  });
}
function enterGame(mode, seat, S) {
  UI.cleanState(S);
  closeDraw();
  clearTimeout(App.aiTimer);
  UI.closeModal(true);
  closeOverlay();
  App.mode = mode;
  App.net = mode === 'online' ? Net : null;
  App.seat = mode === 'online' ? (seat >= 0 ? seat : Net.mySeat()) : -1;
  UI.clearFx();
  App.S = S;
  App.shown = S;
  App.pending = [];
  App.animating = false;
  App.focus = -1;
  App.lastLogN = S.logN;
  App.cam.zoomed = App.prefs.view3d !== false ? App.cam.pref3d === 'near' : App.cam.pref === 'near';
  App.cam.manualUntil = 0;
  App.cam.L = 0;
  show('scrGame');
  UI.buildBoard();
  UI.applyLayout(true);
  UI.bindCamDrag();
  UI.renderAll();
  requestAnimationFrame(() => {
    UI.sizeBoard();
    UI.renderTokens();
    const p = S.players[E.actor(S) >= 0 ? E.actor(S) : S.turn.p];
    if (p) UI.camFocus(p.pos, false, 0, true);
    UI.camApply(false);
  });
  if (!resizeBound) {
    resizeBound = true;
    let t = null;
    addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (App.S && !$('#scrGame').hidden) {
          UI.applyLayout();
          UI.renderAll();
        }
      }, 80);
    });
  }
  UI.persist();
  // Urutan pembuka di SETIAP perangkat: undian giliran (game baru) → tur (hanya perangkat yang belum pernah) → main.
  // Bot (dijalankan host) menunggu undian & tur di perangkat host saja; tur teman baru tidak menahan permainan
  // orang lain (bila teman itu yang jalan duluan, yang lain menunggu gilirannya seperti biasa).
  const drawn = !S.over && S.seq === 0 && S.log.some(l => /^Undian giliran:/.test(l.text));
  App.tourPending = !S.over && store.get(KEYS.tour, null) !== 'done';
  App.revealing = drawn;
  // nomor game (bukan objek state): state berganti tiap aksi, termasuk aksi pemain lain selama undian berjalan
  const gid = (App.gameId = (App.gameId || 0) + 1);
  afterSettle();
  if (drawn) {
    setTimeout(
      () => {
        if (App.gameId !== gid) return;
        drawReveal(S).then(() => {
          if (App.gameId !== gid) return;
          App.revealing = false;
          UI.merpiSay(S.players[S.start || 0].name + ' jalan duluan~ Semangat!', 'happy', 2400);
          if (App.tourPending) setTimeout(startTour, UI.reduceMotion() ? 50 : 350);
          else {
            UI.renderStage();
            UI.scheduleAI();
          }
        });
      },
      UI.reduceMotion() ? 50 : 450
    );
  } else {
    if (!S.over) setTimeout(startTour, UI.reduceMotion() ? 50 : 1300);
    setTimeout(() => {
      if (App.gameId === gid && !App.tour) UI.merpiSay(UI.pick(D.MERPI.hello), 'happy', 2600);
    }, 700);
  }
}
function exitToHome() {
  clearTimeout(App.aiTimer);
  App.tourPending = false;
  App.revealing = false;
  App.gameId = (App.gameId || 0) + 1;
  closeDraw();
  UI.closeModal(true);
  closeOverlay();
  endTour(false);
  if (App.mode === 'online') Net.teardown();
  UI.clearFx();
  App.S = null;
  App.shown = null;
  App.mode = 'local';
  App.net = null;
  App.pending = [];
  show('scrHome');
  renderHome();
}

// ---------- jeda ----------
function togglePause() {
  const S = App.S;
  if (!S || S.over) return;
  const v = UI.viewer();
  const p = UI.controls(v) ? v : S.players.findIndex(x => !x.bankrupt && UI.controls(x.i));
  if (p < 0) {
    toast('Kamu tidak mengendalikan pemain di permainan ini.', { kind: 'err' });
    return;
  }
  UI.act({ type: 'PAUSE', p });
}
function renderPause() {
  const root = $('#overlayRoot');
  const S = App.S;
  const exist = $('#pauseOv');
  if (S && S.paused && !S.over) {
    if (exist) return;
    const el = document.createElement('div');
    el.className = 'overlay';
    el.id = 'pauseOv';
    el.innerHTML =
      '<div class="pause-card" role="dialog" aria-modal="true" aria-labelledby="pauseT">' +
      ART.merpi('is-think') +
      '<h2 id="pauseT">Istirahat dulu</h2><p class="muted">Minum air, kirim stiker ke pasangan. Permainan menunggu.</p><button type="button" class="btn go" id="pResume">' +
      ic('play') +
      '<span>Lanjutkan</span></button><button type="button" class="btn ghost" id="pExit">' +
      ic('exit') +
      '<span>Keluar ke menu</span></button></div>';
    root.appendChild(el);
    $('#pResume', el).onclick = togglePause;
    $('#pExit', el).onclick = UI.openExit;
    setTimeout(() => {
      const b = $('#pResume', el);
      if (b && el.isConnected) b.focus();
    }, 50);
  } else if (exist) UI.leave(exist);
}
function closeOverlay() {
  $('#overlayRoot').innerHTML = '';
}

// ---------- setelah state stabil ----------
function afterSettle() {
  const S = App.S;
  if (!S) return;
  renderPause();
  if (S.over) {
    UI.renderStage();
    if (App.modal && App.modal.decision) UI.closeModal(true);
    UI.endPick(true);
    showWin();
    return;
  }
  if (!App.tour) UI.syncModal();
  UI.renderStage();
  UI.scheduleAI();
  UI.scheduleAutoEnd();
}
function onLetter(p) {
  const S = App.S;
  if (!S) return;
  const l = S.letters
    .slice()
    .reverse()
    .find(x => x.p === p);
  if (!l) return;
  if (UI.controls(p) && App.mode === 'online') {
    toast('Pesanmu terkirim dan tersimpan sampai akhir permainan.', { icon: 'letter', kind: 'good' });
    return;
  }
  toast(l.text, { title: 'Surat cinta dari ' + S.players[p].name, icon: 'letter', kind: 'love', ms: 6500 });
}

export { afterSettle, enterGame, exitToHome, onLetter, togglePause };
