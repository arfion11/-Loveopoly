/* LOVEOPOLY — UI inti › papan & petak (diekspor ulang lewat src/ui/core.js) */
import { ART } from '../../assets/art.js';
import { SND } from '../../assets/audio.js';
import { D } from '../../engine/data.js';
import { E } from '../../engine/engine.js';
import { $, $$, App, GROUPS, RULES, TILES, coin, controls, esc, fmt, hotseat, ic, pulse, reduceMotion } from './base.js';
import { banner, winLabel } from './notify.js';
import { placeStage, setStageEl, stageEl } from './layout.js';
import { is3d } from './camera.js';
import { setDieFace } from './pieces.js';
import { dust } from './effects.js';
import { bindEmote, mascotHTML, mascotWake, merpiPoke, merpiSay, pick } from './mascot.js';
import { onTileTap } from './pick.js';

// ---------- papan ----------
function tilePos(i) {
  if (i === 0) return { row: 9, col: 9, side: 'corner' };
  if (i < 8) return { row: 9, col: 9 - i, side: 'bottom' };
  if (i === 8) return { row: 9, col: 1, side: 'corner' };
  if (i < 16) return { row: 9 - (i - 8), col: 1, side: 'left' };
  if (i === 16) return { row: 1, col: 1, side: 'corner' };
  if (i < 24) return { row: 1, col: 1 + (i - 16), side: 'top' };
  if (i === 24) return { row: 1, col: 9, side: 'corner' };
  return { row: 1 + (i - 24), col: 9, side: 'right' };
}
function cornerSub(t) {
  if (t.type === 'start') return 'Gaji +' + RULES.salary;
  if (t.type === 'island') return 'Terdampar';
  if (t.type === 'fest') return 'Tol ×2';
  if (t.type === 'travel') return 'Terbang';
  return '';
}
function dieHTML(id) {
  const pips = {
    2: [
      [1, 1],
      [3, 3],
    ],
    3: [
      [1, 1],
      [2, 2],
      [3, 3],
    ],
    4: [
      [1, 1],
      [1, 3],
      [3, 1],
      [3, 3],
    ],
    5: [
      [1, 1],
      [1, 3],
      [2, 2],
      [3, 1],
      [3, 3],
    ],
    6: [
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 3],
      [2, 3],
      [3, 3],
    ],
  };
  let faces =
    '<div class="face f1"><i class="hrt">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.5c0 5.8-7.5 10.4-7.5 10.4z"/></svg>' +
    '</i></div>';
  for (let f = 2; f <= 6; f++)
    faces += '<div class="face f' + f + '">' + pips[f].map(([r, c]) => '<i style="grid-area:' + r + '/' + c + '"></i>').join('') + '</div>';
  return '<div class="die-slot"><div class="die" id="' + id + '">' + faces + '</div></div>';
}
// papan 3D: ilustrasi, nama & harga berdiri sebagai kartu "pop-up" menghadap kamera (tidak gepeng ikut kemiringan papan)
// susunan: label (harga/tol atau nama sudut) menempel di atas kartu; kartu berisi ilustrasi + keterangan (hanya saat dekat)
const popHTML = (t, tag, cap) =>
  '<span class="t-pop" aria-hidden="true">' +
  (tag || '') +
  '<span class="tp-card"><span class="tp-art">' +
  ART.art(t.art) +
  '</span>' +
  (cap ? '<span class="tp-cap">' + esc(cap) + '</span>' : '') +
  '</span></span>';
function tileInner(t, pos) {
  if (pos.side === 'corner') {
    return (
      '<span class="t-face"><span class="t-art">' +
      ART.art(t.art) +
      '</span><span class="t-name">' +
      esc(t.short) +
      '</span><span class="t-sub">' +
      esc(cornerSub(t)) +
      '</span></span>' +
      popHTML(t, '<span class="tp-tag tp-cn">' + esc(t.short) + '</span>', cornerSub(t))
    );
  }
  const g = t.group ? GROUPS[t.group] : null;
  const band = '<span class="t-band"></span>';
  let price = '';
  if (t.price) price = '<span class="t-price">' + coin + '<b>' + fmt(t.price) + '</b></span>';
  else if (t.type === 'tax') price = '<span class="t-price muted"><b>10%</b></span>';
  else if (t.type === 'card') price = '<span class="t-price muted"><b>?</b></span>';
  const kind = t.type === 'spot' ? '<span class="t-kind">Wisata</span>' : '';
  void g;
  const tag = price ? price.replace('class="t-price', 'class="tp-tag t-price') : '';
  return (
    '<span class="t-face">' +
    band +
    '<span class="t-art">' +
    ART.art(t.art) +
    '</span><span class="t-txt">' +
    kind +
    '<span class="t-name">' +
    esc(t.short) +
    '</span>' +
    price +
    '</span></span>' +
    popHTML(t, tag, t.short) +
    '<span class="t-bld" aria-hidden="true"></span><span class="t-own" aria-hidden="true"></span><span class="t-fb" aria-hidden="true"></span>'
  );
}
function buildBoard() {
  const b = $('#board');
  b.innerHTML = '';
  // papan 3D: tekan & lepas jari bisa jatuh di elemen berbeda (petak sedikit bergerak), sehingga klik jatuh ke papan.
  // ambil petak di titik lepas supaya ketukan tetap terhitung
  if (!b._tapFix) {
    b._tapFix = true;
    b.addEventListener('click', e => {
      if (e.target !== b || !e.clientX) return;
      const hit = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map(el => el.closest && el.closest('#board .tile'))
        .find(Boolean);
      if (hit) onTileTap(Number(hit.dataset.i), e);
    });
  }
  TILES.forEach(t => {
    const pos = tilePos(t.i);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tile tt-' + t.type + ' s-' + pos.side + (pos.side === 'corner' ? ' corner' : '');
    el.style.gridArea = pos.row + ' / ' + pos.col;
    // urutan gambar = kedalaman (baris depan di atas). Chrome mengurutkan 3D sendiri, Safari memakai urutan
    // lukis: tanpa ini kartu kolom kiri yang lebih jauh (indeks lebih besar) menimpa label harga kartu di depannya
    el.style.setProperty('--row', pos.row);
    el.style.setProperty('--d', t.i * 22 + 'ms');
    if (t.group) {
      el.style.setProperty('--g', GROUPS[t.group].color);
      el.style.setProperty('--gi', GROUPS[t.group].ink);
    }
    el.dataset.i = t.i;
    el.setAttribute(
      'aria-label',
      t.name +
        (t.type === 'card'
          ? ', ambil Kartu Cinta'
          : t.type === 'tax'
            ? ', bayar 10% aset'
            : t.type === 'spot'
              ? ', tempat wisata'
              : cornerSub(t)
                ? ', ' + cornerSub(t)
                : '')
    );
    el.innerHTML = tileInner(t, pos);
    el.addEventListener('click', e => onTileTap(t.i, e));
    b.appendChild(el);
  });
  const c = document.createElement('div');
  c.className = 'center';
  const still = reduceMotion();
  const plane =
    '<g fill="#fff" stroke="#3A2B4A" stroke-width="2" stroke-linejoin="round"><path d="M-12 0c0-2 2-3 4-3h14c4 0 8 1.4 8 3s-4 3-8 3H-8c-2 0-4-1-4-3z"/><path d="M0-3-6-12h4l7 9zM0 3l-6 9h4l7-9z" fill="#FF4F8B"/></g>';
  c.innerHTML =
    '<div class="ctr-amb" aria-hidden="true"></div><div class="center-deco" aria-hidden="true"><svg class="cd-map" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">' +
    '<g class="cd-clouds" fill="#fff" opacity=".7"><ellipse cx="70" cy="80" rx="46" ry="15"/><ellipse cx="96" cy="70" rx="24" ry="15"/><ellipse cx="320" cy="330" rx="50" ry="15"/><ellipse cx="292" cy="320" rx="22" ry="14"/><ellipse cx="330" cy="150" rx="30" ry="10"/></g>' +
    '<path id="cdRoute" d="M70 290 C 120 170, 200 330, 250 210 S 330 90, 340 80" fill="none" stroke="#FF7EAC" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round" opacity=".75"/>' +
    '<path d="M70 300c-8-6-14-12-14-19a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 7-6 13-14 19z" fill="#FF4F8B" stroke="#3A2B4A" stroke-width="2"/>' +
    '<path d="M340 92c-8-6-14-12-14-19a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 7-6 13-14 19z" fill="#7B61FF" stroke="#3A2B4A" stroke-width="2"/>' +
    (still
      ? '<g class="cd-plane" transform="translate(250 210) rotate(-40)">' + plane + '</g>'
      : '<g class="cd-plane">' +
        plane +
        '<animateMotion dur="9s" repeatCount="indefinite" rotate="auto"><mpath href="#cdRoute"/></animateMotion></g>') +
    '</svg><div class="cd-logo">Loveopoly</div><div class="cd-tag">Long Distance · One Destination</div>' +
    mascotHTML() +
    '<i class="ctr-pt" data-c="tl"></i><i class="ctr-pt" data-c="tr"></i><i class="ctr-pt" data-c="bl"></i><i class="ctr-pt" data-c="br"></i>' +
    '<div class="deck" id="deck"><span class="dk dk3"></span><span class="dk dk2"></span><span class="dk dk1">' +
    ART.art('card') +
    '</span></div></div>';
  b.appendChild(c);
  const tk = document.createElement('div');
  tk.className = 'tokens';
  tk.id = 'tokens';
  b.appendChild(tk);
  buildStage();
  placeStage();
  bindEmote();
  const mbody = $('#mascot .ms-body');
  if (mbody) mbody.onclick = () => merpiPoke();
  mascotWake();
  if (!reduceMotion()) {
    b.classList.add('enter');
    setTimeout(() => b.classList.remove('enter'), 1600);
  }
}
function buildStage() {
  let st = stageEl || $('#stage');
  if (!st) {
    st = document.createElement('div');
    st.className = 'stage';
    st.id = 'stage';
  }
  setStageEl(st);
  const oldBub = $('#boardVP > #bubble');
  if (oldBub) oldBub.remove();
  st.innerHTML =
    '<div class="st-top"><span class="round-chip" id="roundChip"></span><span class="news-slot" id="newsSlot"></span></div>' +
    '<div class="st-merpi"><button type="button" class="merpi-btn" id="merpiBtn" aria-label="Merpi, maskot Loveopoly">' +
    ART.merpi('') +
    '</button><div class="bubble" id="bubble" role="status" aria-live="polite"></div></div>' +
    '<div class="st-main">' +
    '<div class="turn-line" id="turnLine"></div>' +
    '<div class="dice-tray" id="dice" role="img" aria-label="Dadu">' +
    dieHTML('die1') +
    dieHTML('die2') +
    '</div>' +
    '<div class="status-note" id="statusNote"></div>' +
    '<div class="center-actions" id="centerActions"></div>' +
    '</div>' +
    '<div class="ticker" id="ticker" aria-hidden="true"></div>';
  setDieFace($('#die1', st), 5, false);
  setDieFace($('#die2', st), 2, false);
  const mb = $('#merpiBtn', st);
  if (mb)
    mb.onclick = () => {
      merpiPoke();
    };
}

const tileEl = i => $('#board .tile[data-i="' + i + '"]');
const LEVEL_ART = ['', 'b1', 'b2', 'b3', 'b4'];
function tollText(S, i) {
  const r = E.rentInfo(S, i);
  return r ? fmt(r.amount) : '';
}
function renderTile(el, S, fx) {
  const i = Number(el.dataset.i),
    t = TILES[i],
    st = S.tiles[i];
  if (!t.price) return;
  const owned = st.owner >= 0;
  const o = owned ? S.players[st.owner] : null;
  el.classList.toggle('owned', owned);
  el.classList.toggle('landmark', owned && st.level === 4);
  el.style.setProperty('--oc', owned ? o.color : 'transparent');
  // lencana pemilik
  const own = el.querySelector('.t-own');
  const ownKey = owned ? o.i + ':' + o.avatar + ':' + (st.level === 4 ? 'L' : '') : '';
  if (own && own.dataset.k !== ownKey) {
    own.dataset.k = ownKey;
    own.innerHTML = owned
      ? '<span style="--c:' +
        o.color +
        '">' +
        esc(o.avatar) +
        '</span>' +
        (st.level === 4 ? '<i class="crown">' + ic('crown') + '</i>' : '')
      : '';
    if (fx && owned) pulse(own, 'pop', 700);
  }
  // bangunan
  const b = el.querySelector('.t-bld');
  const lv = owned && t.type === 'city' ? st.level : 0;
  if (b && b.dataset.l !== String(lv)) {
    const before = Number(b.dataset.l || 0);
    b.dataset.l = lv;
    b.innerHTML = lv ? ART.art(LEVEL_ART[lv]) + '<span class="lv-dots">' + '<i></i>'.repeat(lv) + '</span>' : '';
    if (fx && lv > before) {
      pulse(b, 'rise', 900);
      dust(i);
    }
    if (fx && lv < before) pulse(b, 'shrink', 700);
  }
  // harga / tol
  const txt = owned ? tollText(S, i) : fmt(t.price);
  const html = owned ? '<b>' + txt + '</b>' : coin + '<b>' + txt + '</b>';
  // label kartu 3D: avatar pemilik + tol (mahkota bila landmark), jadi lencana terpisah tidak perlu
  const popH = owned
    ? (st.level === 4 ? '<i class="tp-crown">' + ic('crown') + '</i>' : '') + '<i class="tp-av">' + esc(o.avatar) + '</i><b>' + txt + '</b>'
    : html;
  el.querySelectorAll('.t-price').forEach(pr => {
    const h = pr.classList.contains('tp-tag') ? popH : html;
    if (pr._h !== h) {
      pr.innerHTML = h;
      pr._h = h;
      if (fx && owned && pr.classList.contains('tp-tag') && is3d()) pulse(pr, 'pop', 700);
    }
    pr.classList.toggle('toll', owned);
  });
  // festival
  const fe = el.querySelector('.t-fb');
  const fv = S.festival.tile === i ? '×' + S.festival.mult : '';
  if (fe && fe.dataset.v !== fv) {
    fe.dataset.v = fv;
    fe.innerHTML = fv ? ic('party') + '<b>' + fv + '</b>' : '';
    el.classList.toggle('fest', !!fv);
  }
  const lvName = E.LEVEL_NAME[st.level];
  el.setAttribute(
    'aria-label',
    t.name +
      (owned
        ? ', milik ' + o.name + (t.type === 'city' ? ', ' + lvName : '') + ', tol ' + tollText(S, i)
        : ', kosong, harga ' + fmt(t.price)) +
      (fv ? ', festival ' + fv : '')
  );
}
function renderBoard(S) {
  S = S || App.S;
  $$('#board .tile').forEach(el => renderTile(el, S, false));
  renderThreats(S);
}
function renderThreats(S) {
  const th = E.winThreats(S);
  const mark = {};
  th.forEach(x => {
    if (!mark[x.tile]) mark[x.tile] = x;
  });
  $$('#board .tile').forEach(el => {
    const x = mark[el.dataset.i];
    el.classList.toggle('threat', !!x);
    if (x) el.style.setProperty('--tc', S.players[x.p].color);
  });
  const keys = th
    .map(x => x.p + ':' + x.tile)
    .sort()
    .join('|');
  if (App.threatKeys === keys) return;
  const prev = new Set(App.threatKeys ? App.threatKeys.split('|') : []);
  const fresh = App.threatKeys == null ? [] : th.filter(x => !prev.has(x.p + ':' + x.tile));
  App.threatKeys = keys;
  if (!fresh.length || S.over) return;
  const x = fresh[0],
    who = S.players[x.p];
  if (controls(x.p) && !hotseat())
    banner('Satu petak lagi!', 'Dapatkan ' + TILES[x.tile].name + ' untuk ' + winLabel(x) + '.', 'goal', 2800);
  else banner('Awas, ' + who.name + '!', 'Tinggal ' + TILES[x.tile].name + ' menuju ' + winLabel(x) + '.', 'warn', 2800);
  merpiSay(pick(D.MERPI.threat), 'wow', 2400);
  SND.play('event');
}
function flashTile(i) {
  pulse(tileEl(i), 'flash', 1150);
}

export { buildBoard, flashTile, renderBoard, renderTile, tileEl, tilePos };
