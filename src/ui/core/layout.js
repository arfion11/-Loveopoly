/* LOVEOPOLY — UI inti › tata letak (wide/mid/compact/land) & penempatan panel (diekspor ulang lewat src/ui/core.js) */
import { $, $$, App } from './base.js';
import { camApply, camAuto, renderCamCtl } from './camera.js';
import { renderTokens } from './pieces.js';
import { trackBubble } from './mascot.js';
import { placePlayers } from './hud.js';

// ---------- tata letak ----------
function computeLayout() {
  const w = window.innerWidth,
    h = window.innerHeight;
  if (h < 600 && w > h) return 'land';
  if (w >= 960 && w >= h * 1.12) return 'wide';
  if (w >= 700 && h >= 700) return 'mid';
  return 'compact';
}
// strip kartu mini: ponsel, atau tablet/jendela yang tingginya terbatas
const miniStrip = () => App.layout === 'compact' || App.layout === 'land' || (App.layout === 'mid' && window.innerHeight < 940);
// papan 3D (POV ala Get Rich): papan dimiringkan, ilustrasi berdiri sebagai kartu pop-up; bawaannya seluruh papan
// terlihat & kamera diam ("Dekat" = opsi mengikuti pion), di semua tata letak
const view3d = () => App.prefs.view3d !== false;
const usesCam = () => view3d() || App.layout === 'compact' || App.layout === 'land';
let insetObs = null;
function watchInsets() {
  if (insetObs || !('ResizeObserver' in window)) return;
  let t = null;
  insetObs = new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (!App.S || !usesCam()) return;
      const ins = camInsets();
      if (ins.top === App.cam.top && ins.bot === App.cam.bot) return;
      sizeBoard();
    }, 60);
  });
  ['#strip', '#hud'].forEach(sel => {
    const el = $(sel);
    if (el) insetObs.observe(el);
  });
}
function applyLayout(force) {
  const g = $('#game');
  if (!g) return;
  watchInsets();
  const lay = computeLayout();
  const sameLay = lay === App.layout;
  App.layout = lay;
  const mini = miniStrip();
  const cls = 'game layout-' + lay + (view3d() ? ' v3d' : '');
  if (!force && sameLay && g.className === cls && App.lastMini === mini) {
    sizeBoard();
    return;
  }
  App.lastMini = mini;
  g.className = cls;
  placeStage();
  placePlayers();
  sizeBoard();
}
let stageEl = null,
  pickEl = null;
const setStageEl = el => {
  stageEl = el;
};
// desktop/tablet mendatar + papan 3D: panel aksi menjadi panel samping di kolom kanan (seperti HP mendatar),
// jadi papan memakai seluruh tinggi layar
const sideHud = () => view3d() && App.layout === 'wide';
function placeStage() {
  const st = stageEl || $('#stage');
  if (!st) return;
  // tombol reaksi: di pojok papan; HP mendatar → pojok kiri bawah layar (kolom pemain) supaya tidak menutupi petak
  const emo = $('#emote'),
    gEl = $('#game'),
    vpE = $('#boardVP');
  if (emo && gEl && vpE) {
    const want = App.layout === 'land' ? gEl : vpE;
    if (emo.parentNode !== want) want.appendChild(emo);
  }
  const hud0 = $('#hud'),
    col = $('.board-col'),
    right = $('.seat-col.right');
  if (hud0 && col && right) {
    if (sideHud()) {
      if (hud0.parentNode !== right) right.insertBefore(hud0, $('#slotBR'));
    } else if (hud0.parentNode !== col) col.appendChild(hud0);
  }
  const host = usesCam() ? $('#hud') : $('#board .center');
  if (host && st.parentNode !== host) host.appendChild(st);
  // Merpi besar tampil di tengah papan: Merpi kecil di panel disembunyikan (CSS), gelembung katanya
  // pindah ke atas papan dan mengikuti kepala Merpi besar (lihat trackBubble)
  const bub = $('#bubble'),
    vpB = $('#boardVP'),
    slot = $('.st-merpi', st),
    big = $('#mascot');
  if (bub && vpB && slot) {
    const onBig = !!(big && big.offsetWidth);
    const want = onBig ? vpB : slot;
    if (bub.parentNode !== want) want.appendChild(bub);
    bub.classList.toggle('ms-say', onBig);
    if (onBig && bub.classList.contains('show')) trackBubble();
  }
  const b = $('#board');
  if (b) b.classList.toggle('staged', !usesCam());
  // kontrol kamera tidak boleh menutup petak: ponsel potret -> header, ponsel mendatar & panel samping -> panel
  const cc = $('#camCtl'),
    hud = $('#hud'),
    vp = $('#boardVP'),
    mid = $('#hdrMid');
  if (cc && hud && vp && mid) {
    const want = App.layout === 'land' || sideHud() ? hud : App.layout === 'compact' ? mid : vp;
    if (cc.parentNode !== want) {
      if (want === hud) hud.insertBefore(cc, hud.firstChild);
      else want.appendChild(cc);
    }
  }
  // bilah pilih-petak menggantikan panel aksi, tidak pernah menutupi papan
  // (referensi disimpan: papan yang dibangun ulang ikut menghapus isi .center)
  const pb = pickEl || (pickEl = $('#pickbar')),
    ctr = $('#board .center');
  if (pb && hud && ctr) {
    const want = usesCam() ? hud : ctr;
    if (pb.parentNode !== want) want.appendChild(pb);
  }
}
// area papan yang tidak tertutup HUD/strip (ponsel potret: keduanya melayang di atas papan)
function camInsets() {
  const hud = $('#hud');
  if (App.layout === 'compact') {
    const st = $('#strip');
    return { top: st ? st.offsetHeight + 8 : 0, bot: hud ? hud.offsetHeight + 8 : 0 };
  }
  if (sideHud()) return { top: 0, bot: 0 };
  // tablet tegak 3D: dok aksi di bawah papan, tombol kamera di atas
  if (view3d() && App.layout === 'mid') {
    const cc = $('#camCtl');
    return { top: cc && !cc.hidden ? 52 : 0, bot: hud ? hud.offsetHeight + 14 : 0 };
  }
  return { top: 0, bot: 0 };
}
function sizeBoard() {
  const vp = $('#boardVP'),
    b = $('#board');
  if (!vp || !b) return;
  const W = vp.clientWidth,
    H = vp.clientHeight;
  if (!W || !H) return;
  const ins = camInsets();
  App.cam.top = ins.top;
  App.cam.bot = ins.bot;
  const col = $('.board-col');
  if (col) {
    col.style.setProperty('--hudH', ins.bot + 'px');
    col.style.setProperty('--stripH', ins.top + 'px');
  }
  const Hv = Math.max(120, H - ins.top - ins.bot);
  // ukuran papan dari ukuran layar saja (bukan tinggi HUD yang berubah-ubah) supaya tidak melompat
  const Hn = App.layout === 'compact' ? Math.max(200, H - 250) : H;
  let L;
  if (view3d()) {
    // ukuran tata letak dipilih supaya saat mengikuti pion skalanya ±1: petak besar & teks tetap tajam
    const tile = Math.max(80, Math.min(118, W / 4.3, Hv / 3.4));
    L = Math.round(tile * 10);
  } else if (usesCam()) {
    L = Math.round(Math.max(560, Math.min(760, Math.min(W, Hn) * 1.8)));
    if (L <= Math.min(W, Hv) * 1.08) L = Math.min(W, Hv);
  } else L = Math.floor(Math.min(W, H - 12));
  const changed = App.cam.L !== L;
  if (changed && App.cam.L) {
    const k = L / App.cam.L;
    if (App.cam.fx != null) {
      App.cam.fx *= k;
      App.cam.fy *= k;
    }
  }
  App.cam.L = L;
  b.style.width = L + 'px';
  b.style.height = L + 'px';
  b.classList.toggle('mini', L < 470);
  vp.classList.toggle('cam3d', view3d());
  b.classList.toggle('b3d', view3d());
  if (!view3d()) {
    vp.style.perspective = '';
    vp.style.perspectiveOrigin = '';
  }
  if (view3d()) {
    const wasCam = vp.classList.contains('cam');
    vp.classList.add('cam');
    // bawaan: seluruh papan terlihat & diam (tidak terpotong, tidak bikin pusing); "Dekat" bila dipilih pemain
    if (!wasCam) {
      App.cam.zoomed = App.cam.pref3d === 'near';
      App.cam.fx = null;
    }
    camApply(false);
  } else if (usesCam() && L > Math.min(W, Hv) * 1.08) {
    const wasCam = vp.classList.contains('cam');
    vp.classList.add('cam');
    if (!wasCam) App.cam.zoomed = !camAuto();
    camApply(false);
  } else {
    vp.classList.remove('cam');
    b.classList.remove('far');
    b.style.transform = '';
    b.style.left = Math.round((W - L) / 2) + 'px';
    b.style.top = Math.round(ins.top + Math.max(0, Hv - L) / 2) + 'px';
  }
  renderCamCtl();
  if (changed && App.S) {
    $$('.token').forEach(t => {
      t.style.transition = 'none';
    });
    renderTokens();
  }
}

export { applyLayout, camInsets, miniStrip, pickEl, placeStage, setStageEl, sizeBoard, stageEl, view3d };
