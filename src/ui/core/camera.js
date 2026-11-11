/* LOVEOPOLY — UI inti › kamera ponsel & kamera 3D (diekspor ulang lewat src/ui/core.js) */
import { SND } from '../../assets/audio.js';
import { E } from '../../engine/engine.js';
import { $, App, N, ic, reduceMotion, setHTML, store } from './base.js';
import { tileBox } from './pieces.js';
import { newsPillHTML } from './hud.js';

// ---------- kamera (ponsel) ----------
function camActive() {
  const vp = $('#boardVP');
  return !!(vp && vp.classList.contains('cam'));
}
function camView() {
  const vp = $('#boardVP'),
    c = App.cam;
  const top = c.top || 0,
    bot = c.bot || 0;
  return { W: vp.clientWidth, H: vp.clientHeight, top, vh: Math.max(120, vp.clientHeight - top - bot) };
}
function camFit() {
  const v = camView();
  return Math.min(v.W, v.vh) / App.cam.L;
}
function camClamp() {
  const c = App.cam,
    v = camView(),
    sz = c.L * c.s;
  c.x = sz <= v.W ? (v.W - sz) / 2 : Math.min(0, Math.max(v.W - sz, c.x));
  c.y = sz <= v.vh ? v.top + (v.vh - sz) / 2 : Math.min(v.top, Math.max(v.top + v.vh - sz, c.y));
}
function markFar() {
  const b = $('#board');
  if (b) b.classList.toggle('far', camActive() && !App.cam.zoomed && (is3d() || camFit() < 0.82));
}
// ---------- kamera 3D ----------
// satu kemiringan & perspektif untuk "Semua" dan "Dekat" (berpindah mode tidak melompat / bikin pusing):
// layar tegak lebih landai (30°) supaya papan selebar mungkin, layar datar 38°.
// perspektif lemah (jarak pandang jauh) supaya baris belakang tidak mengecil banyak, mirip papan isometrik
const is3d = () => {
  const vp = $('#boardVP');
  return !!(vp && vp.classList.contains('cam3d'));
};
// HP (potret/mendatar) + papan 3D: saat pion berjalan / ada keputusan di petak, kamera mendekat & mengikuti pion
// (nama & ilustrasi petak jadi besar), lalu kembali menampilkan seluruh papan. Bisa dimatikan di Pengaturan
const phoneLay = () => App.layout === 'compact' || App.layout === 'land';
const auto3d = () => is3d() && App.cam.pref3d !== 'near' && phoneLay() && App.prefs.walkCam !== false && !reduceMotion();
function camRelax() {
  if (!is3d() || !App.cam.zoomed || App.cam.pref3d === 'near') return;
  clearTimeout(App.cam.outTimer);
  App.cam.zoomed = false;
  apply3d(true, 650);
}
const persp = v => Math.round(Math.max(1800, v.H * 3.2));
const tiltOf = v => (v.vh > v.W * 1.05 ? 30 : 38);
// ruang di atas baris terjauh untuk kartu pop-up yang berdiri (bagian papan, kali skala)
const HEAD = 0.05,
  FOOT = 0.018;
// proyeksi titik papan (bx, by) ke layar untuk fokus, skala, kemiringan & perspektif tertentu
function proj(bx, by, f, s, cx, cy, d, t) {
  const rx = s * (bx - f.x),
    ry = s * (by - f.y),
    z = ry * Math.sin(t),
    k = d / Math.max(1, d - z);
  return { x: cx + rx * k, y: cy + ry * Math.cos(t) * k };
}
// skala terbesar yang memuat seluruh papan miring + kartu berdiri di area terlihat (mode "Semua"),
// lalu konten dipusatkan rapat (atas & bawah sama), jadi tidak ada ruang kosong sebelah saja
function fit3d(v, d, t) {
  const L = App.cam.L,
    f = { x: L / 2, y: L / 2 },
    cx = v.W / 2,
    m = 10;
  const ext = s => {
    const q = [
      [0, 0],
      [L, 0],
      [0, L],
      [L, L],
    ].map(([x, y]) => proj(x, y, f, s, cx, 0, d, t));
    return {
      top: Math.min(q[0].y, q[1].y) - L * HEAD * s,
      bot: Math.max(q[2].y, q[3].y) + L * FOOT * s,
      left: Math.min(...q.map(p => p.x)),
      right: Math.max(...q.map(p => p.x)),
    };
  };
  let lo = 0.05,
    hi = 1.6;
  for (let k = 0; k < 24; k++) {
    const s = (lo + hi) / 2,
      e = ext(s);
    const ok = e.left >= m && e.right <= v.W - m && e.bot - e.top <= v.vh - 2 * m && s * (L / 2) * Math.sin(t) < d * 0.8;
    if (ok) lo = s;
    else hi = s;
  }
  const e = ext(lo);
  return { s: lo, cy: v.top + v.vh / 2 - (e.top + e.bot) / 2 };
}
// bidikan kamera per petak (pion berjalan searah jarum jam): perlihatkan petak di depan pion,
// ax = geser fokus (satuan petak), ay = letak fokus di area terlihat (0 atas .. 1 bawah)
function camAim(tile) {
  if (tile == null) return { ax: 0, ay: 0.56 };
  const i = ((tile % N) + N) % N;
  if (i < 8) return { ax: -1.3, ay: 0.56 }; // START & baris bawah: berjalan ke kiri
  if (i === 8) return { ax: 0.4, ay: 0.62 };
  if (i < 16) return { ax: 0, ay: 0.64 }; // sisi kiri: menjauh ke atas
  if (i < 24) return { ax: 1.3, ay: 0.57 }; // sudut kiri atas & baris atas: ke kanan
  if (i === 24) return { ax: -0.4, ay: 0.47 };
  return { ax: 0, ay: 0.45 }; // sisi kanan: mendekat ke bawah
}
function apply3d(anim, ms) {
  const b = $('#board'),
    vp = $('#boardVP'),
    c = App.cam,
    v = camView(),
    L = c.L,
    unit = L / 10;
  const d = persp(v),
    deg = tiltOf(v),
    t = (deg * Math.PI) / 180,
    cx = v.W / 2;
  c.deg = deg;
  let fx,
    fy,
    s,
    cy,
    rz = 0;
  if (c.cine) {
    // kamera sinematik (momen besar): dekati petak/titik + putar papan sedikit seperti meja putar
    const ft = fit3d(v, d, t);
    s = ft.s + (1 - ft.s) * c.cine.k;
    fx = c.cine.fx;
    fy = c.cine.fy;
    // titik fokus di bawah banner momen (banner di 34–40% tinggi papan), jadi yang disorot tidak tertutup
    cy = v.top + v.vh * 0.7;
    rz = c.cine.rz;
  } else if (c.zoomed) {
    if (c.fx == null) {
      const S = App.S,
        a = S ? E.actor(S) : -1,
        p = S ? S.players[a >= 0 ? a : S.turn.p] : null;
      const bx = p ? tileBox(p.pos) : { x: L / 2, y: L / 2 };
      c.fx = bx.x;
      c.fy = bx.y;
      c.ft = p ? p.pos : null;
    }
    // jangan terlalu jauh keluar papan
    c.fx = Math.max(L * 0.08, Math.min(L * 0.92, c.fx));
    c.fy = Math.max(L * 0.06, Math.min(L * 0.94, c.fy));
    const aim = camAim(c.ft);
    s = 1;
    fy = c.fy;
    cy = v.top + v.vh * aim.ay;
    // tepi kiri/kanan papan menempel ke tepi layar (tidak ada ruang kosong di samping papan saat di sudut)
    const m = 14,
      lo = (cx - m) / s,
      hi = L - (v.W - m - cx) / s;
    fx = c.fx + aim.ax * unit;
    fx = lo <= hi ? Math.max(lo, Math.min(hi, fx)) : L / 2;
    c.fx = fx - aim.ax * unit;
    // tepi dekat papan menempel ke bawah area terlihat (tidak ada langit kosong di bawahnya)
    const nearY = proj(fx, L, { x: fx, y: fy }, s, cx, cy, d, t).y,
      want = v.top + v.vh - 6;
    if (nearY < want) cy = Math.min(v.top + v.vh * 0.86, cy + (want - nearY));
  } else {
    fx = L / 2;
    fy = L / 2;
    const ft = fit3d(v, d, t);
    s = ft.s;
    cy = ft.cy;
  }
  c.s = s;
  const tr = anim && !reduceMotion() ? (ms || 420) + 'ms cubic-bezier(.3,.7,.2,1)' : '';
  // titik hilang ikut bergeser bersama papan (tanpa ini papan sempat "miring ke samping" saat berpindah mode)
  vp.style.transition = tr ? 'perspective-origin ' + tr : 'none';
  vp.classList.toggle('zoom', !!c.zoomed);
  vp.style.perspective = d + 'px';
  vp.style.perspectiveOrigin = cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px';
  b.style.setProperty('--tilt', deg + 'deg');
  b.style.left = '0px';
  b.style.top = '0px';
  b.style.transition = tr ? 'transform ' + tr + ', --tilt ' + tr : 'none';
  // scale3d (bukan scale 2D): benda yang berdiri di papan (pion, bangunan, globe) ikut mengecil ke arah z, tidak memanjang
  b.style.transform =
    'translate(' +
    cx.toFixed(1) +
    'px,' +
    cy.toFixed(1) +
    'px) rotateX(' +
    deg +
    'deg)' +
    (rz ? ' rotateZ(' + rz + 'deg)' : '') +
    ' scale3d(' +
    s.toFixed(4) +
    ',' +
    s.toFixed(4) +
    ',' +
    s.toFixed(4) +
    ') translate(' +
    (-fx).toFixed(1) +
    'px,' +
    (-fy).toFixed(1) +
    'px)';
  markFar();
}
// ---------- kamera sinematik ----------
// Sekali jalan di momen besar (landmark, ambil alih, menang instan, Momen Berdua): papan 3D mendekat ke titik itu sambil
// berputar sedikit, diam sebentar, lalu kembali ke kamera biasa. Semua panggilan kamera lain (camHold, camFocus,
// camSettle) tetap jalan tapi apply3d mendahulukan App.cam.cine, jadi tidak ada yang bentrok; setelah selesai kamera
// kembali ke keadaan terkini (Semua / Dekat / Sorot langkah). Mati saat gerak dikurangi, Hemat baterai, papan 2D.
// tile = indeks petak, atau null = tengah papan. Mengembalikan ms sampai kamera tiba (0 = tidak dijalankan).
function camCinema(tile, opt) {
  if (!is3d() || !camActive() || reduceMotion() || document.body.classList.contains('lowp') || document.hidden) return 0;
  const o = Object.assign({ k: 0.42, turn: 5, inMs: 760, hold: 1200, outMs: 950 }, opt);
  const c = App.cam,
    L = c.L,
    b = tile == null ? { x: L / 2, y: L / 2 } : tileBox(tile);
  clearTimeout(c.cineTimer);
  // putar menjauh dari sisi petak supaya petak itu bergeser ke tengah pandangan (tengah papan: putar ke kanan)
  const dir = tile == null ? 1 : b.x < L / 2 ? -1 : 1;
  c.cine = { fx: b.x, fy: b.y, k: o.k, rz: dir * o.turn };
  apply3d(true, o.inMs);
  c.cineTimer = setTimeout(() => {
    c.cine = null;
    if (camActive() && is3d()) apply3d(true, o.outMs);
  }, o.inMs + o.hold);
  return o.inMs;
}
function camCinemaStop() {
  const c = App.cam;
  if (!c || !c.cine) return;
  clearTimeout(c.cineTimer);
  c.cine = null;
  if (camActive() && is3d()) apply3d(false);
}
function camApply(anim, ms) {
  const b = $('#board');
  if (!b || !camActive()) return;
  if (is3d()) {
    apply3d(anim, ms);
    return;
  }
  const c = App.cam;
  c.s = c.zoomed ? 1 : camFit();
  camClamp();
  markFar();
  b.style.left = '0px';
  b.style.top = '0px';
  b.style.transition = anim && !reduceMotion() ? 'transform ' + (ms || 420) + 'ms cubic-bezier(.3,.7,.2,1)' : 'none';
  b.style.transform = 'translate(' + Math.round(c.x) + 'px,' + Math.round(c.y) + 'px) scale(' + c.s.toFixed(4) + ')';
}
const camAuto = () => App.cam.pref !== 'near';
function camFocus(tile, anim, ms, force) {
  if (!camActive() || !App.cam.zoomed) return;
  if (!force && Date.now() < App.cam.manualUntil) return;
  if (is3d()) {
    const t = tileBox(tile);
    App.cam.fx = t.x;
    App.cam.fy = t.y;
    App.cam.ft = tile;
    apply3d(anim, ms);
    return;
  }
  const v = camView(),
    bx = tileBox(tile);
  App.cam.x = v.W / 2 - bx.x;
  App.cam.y = v.top + v.vh / 2 - bx.y;
  camApply(anim, ms);
}
// mode otomatis: perbesar saat pion bergerak / ada keputusan di petak, lalu kembali melihat seluruh papan
function camHold(on, tile) {
  if (!camActive() || App.pick) return;
  if (is3d()) {
    if (!auto3d()) {
      if (on && tile != null && App.cam.zoomed) camFocus(tile, true, 480, true);
      return;
    }
    clearTimeout(App.cam.outTimer);
    if (on) {
      const was = App.cam.zoomed;
      if (!was) {
        App.cam.zoomed = true;
        App.cam.manualUntil = 0;
        App.cam.fx = null;
      }
      if (tile != null) camFocus(tile, true, was ? 480 : 640, true);
      else if (!was) apply3d(true, 640);
      return;
    }
    // kembali ke seluruh papan sebentar setelah semua beres (tidak langsung, supaya tidak "melompat-lompat")
    App.cam.outTimer = setTimeout(() => {
      if (!camActive() || !App.cam.zoomed || !auto3d() || App.pick || App.animating) return;
      App.cam.zoomed = false;
      apply3d(true, 720);
    }, 900);
    return;
  }
  clearTimeout(App.cam.outTimer);
  if (on) {
    if (!App.cam.zoomed) {
      App.cam.zoomed = true;
      App.cam.manualUntil = 0;
      renderCamCtl();
    }
    if (tile != null) camFocus(tile, true, 480, true);
    return;
  }
  if (!camAuto() || is3d()) return;
  App.cam.outTimer = setTimeout(() => {
    if (!camActive() || !App.cam.zoomed || !camAuto() || App.pick || App.animating) return;
    App.cam.zoomed = false;
    camApply(true, 560);
    renderCamCtl();
  }, 700);
}
function camSettle() {
  if (!camActive()) return;
  const S = App.S;
  if (!S) return;
  const it = S.queue[0];
  if (is3d()) {
    if (auto3d()) {
      if (it && it.tile != null && ['BUY', 'UPGRADE', 'RENT', 'TAKEOVER'].includes(it.type)) camHold(true, it.tile);
      else camHold(false);
      return;
    }
    if (!App.cam.zoomed || Date.now() < App.cam.manualUntil) return;
    const a = E.actor(S),
      p = S.players[a >= 0 ? a : S.turn.p];
    camFocus(it && it.tile != null ? it.tile : p.pos, true, 520, true);
    return;
  }
  if (!camAuto()) {
    const a = E.actor(S);
    const p = S.players[a >= 0 ? a : S.turn.p];
    camFocus(it && it.tile != null ? it.tile : p.pos, true, 450, true);
    return;
  }
  if (it && it.tile != null && ['BUY', 'UPGRADE', 'RENT', 'TAKEOVER'].includes(it.type)) camHold(true, it.tile);
  else camHold(false);
}
function camToggle() {
  if (is3d()) {
    App.cam.pref3d = App.cam.pref3d === 'near' ? 'all' : 'near';
    App.cam.zoomed = App.cam.pref3d === 'near';
    store.set('loveopoly.v3.cam3d', App.cam.pref3d);
    clearTimeout(App.cam.outTimer);
    App.cam.manualUntil = 0;
    if (App.cam.zoomed) {
      App.cam.fx = null;
      camSettle();
      apply3d(true, 520);
    } else apply3d(true, 520);
    renderCamCtl();
    SND.play('click');
    return;
  }
  App.cam.pref = camAuto() ? 'near' : 'auto';
  store.set('loveopoly.v2.cam', App.cam.pref);
  App.cam.manualUntil = 0;
  clearTimeout(App.cam.outTimer);
  if (App.cam.pref === 'near' && App.S) {
    App.cam.zoomed = true;
    const a = E.actor(App.S),
      p = App.S.players[a >= 0 ? a : App.S.turn.p];
    camFocus(p.pos, true, 420, true);
  } else {
    App.cam.zoomed = false;
    camApply(true, 420);
  }
  renderCamCtl();
  SND.play('click');
}
function renderCamCtl() {
  const el = $('#camCtl');
  if (!el) return;
  el.hidden = !camActive();
  const S = App.S,
    lim = S ? S.settings.roundLimit : 0;
  // 3D: tombol beralih antara "Semua" (lihat seluruh papan) dan "Dekat" (ikuti pion terus);
  // label mengikuti pilihan pemain, bukan zoom sementara saat pion berjalan
  const near = is3d() ? App.cam.pref3d === 'near' : !camAuto();
  setHTML(
    el,
    (S
      ? '<span class="round-chip vp" title="Ronde">' +
        ic('calendar') +
        '<span><span class="rc-w">Ronde </span><b>' +
        S.round +
        '</b>' +
        (lim ? '/' + lim : '') +
        '</span></span>' +
        newsPillHTML(S)
      : '') +
      '<button type="button" class="cam-btn" id="camBtn" aria-pressed="' +
      near +
      '" aria-label="' +
      (is3d()
        ? near
          ? 'Lihat seluruh papan'
          : 'Kamera dekat: ikuti pion'
        : near
          ? 'Kamera otomatis: lihat seluruh papan'
          : 'Kunci kamera dekat') +
      '">' +
      ic(near ? 'map' : 'zoomIn') +
      '<span>' +
      (near ? 'Semua' : 'Dekat') +
      '</span></button>'
  );
  const b = $('#camBtn');
  if (b) b.onclick = camToggle;
}
function bindCamDrag() {
  const vp = $('#boardVP');
  if (!vp || vp._drag) return;
  vp._drag = true;
  let st = null;
  vp.addEventListener('pointerdown', e => {
    if (!camActive() || (e.target.closest && e.target.closest('.cam-btn, .pickbar, .banner'))) return;
    st = { x: e.clientX, y: e.clientY, cx: App.cam.x, cy: App.cam.y, fx: App.cam.fx, fy: App.cam.fy, moved: false, id: e.pointerId };
  });
  vp.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.x,
      dy = e.clientY - st.y;
    if (!st.moved && Math.hypot(dx, dy) < 8) return;
    st.moved = true;
    App.cam.manualUntil = Date.now() + 5000;
    if (is3d()) {
      if (!App.cam.zoomed || st.fx == null) return;
      App.cam.fx = st.fx - dx / App.cam.s;
      App.cam.fy = st.fy - dy / (App.cam.s * Math.cos(((App.cam.deg || 34) * Math.PI) / 180));
      apply3d(false);
      return;
    }
    App.cam.x = st.cx + dx;
    App.cam.y = st.cy + dy;
    camApply(false);
  });
  const end = e => {
    if (!st || (e && e.pointerId !== st.id)) return;
    if (st.moved) {
      vp._swallow = Date.now();
    }
    st = null;
  };
  vp.addEventListener('pointerup', end);
  vp.addEventListener('pointercancel', end);
  vp.addEventListener(
    'click',
    e => {
      if (vp._swallow && Date.now() - vp._swallow < 250) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true
  );
}

export {
  auto3d,
  bindCamDrag,
  camActive,
  camApply,
  camAuto,
  camCinema,
  camCinemaStop,
  camFocus,
  camHold,
  camRelax,
  camSettle,
  is3d,
  renderCamCtl,
};
