/* LOVEOPOLY — dialog permainan › infrastruktur dialog & kepala kartu kota (dikumpulkan lewat src/ui/modals.js) */
import { App, E, ART, TILES, GROUPS, RULES, fmt, esc, ic, $, $$, viewer, coin, avatarHTML, t, tile } from '../core.js';
import { UI } from '../ns.js';

// ---------- infrastruktur modal ----------
let escHandler = null;
function showModal(def) {
  const root = $('#modalRoot');
  UI.cancelAutoEnd();
  if (App.modal && App.modal.cleanup) {
    try {
      App.modal.cleanup();
    } catch (e) {
      /* abaikan */
    }
  }
  $$('.modal-root.leaving').forEach(g => g.remove()); // dialog baru langsung menggantikan sisa animasi tutup
  App.modal = def;
  root.hidden = false;
  paint(def, true);
  if (escHandler) document.removeEventListener('keydown', escHandler);
  escHandler = e => {
    if (e.key === 'Escape' && App.modal && App.modal.closable !== false) closeModal();
  };
  document.addEventListener('keydown', escHandler);
}
function paint(def, first) {
  const root = $('#modalRoot');
  const prevBody = root.querySelector('.modal-body');
  const scroll = prevBody ? prevBody.scrollTop : 0;
  const v = def.build();
  if (!v) {
    closeModal();
    return;
  }
  root.innerHTML =
    '<div class="scrim"></div><div class="modal ' +
    (def.size || '') +
    (v.tone ? ' tone-' + v.tone : '') +
    '" role="dialog" aria-modal="true" aria-labelledby="mTitle">' +
    (v.hero ? '<div class="modal-hero">' + v.hero + '</div>' : '') +
    '<div class="modal-head"><div class="mh-txt">' +
    (v.kicker ? '<div class="kicker">' + v.kicker + '</div>' : '') +
    '<h2 id="mTitle">' +
    esc(t(v.title)) +
    '</h2>' +
    (v.who ? '<div class="who">' + v.who + '</div>' : '') +
    '</div>' +
    (def.closable !== false
      ? '<button type="button" class="icon-btn" data-x aria-label="' + esc(t('Tutup')) + '">' + ic('x') + '</button>'
      : '') +
    '</div>' +
    '<div class="modal-body" tabindex="0">' +
    v.body +
    '</div>' +
    (v.foot ? '<div class="modal-foot">' + v.foot + '</div>' : '') +
    '</div>';
  if (!first) root.querySelector('.modal').classList.add('still');
  const body = root.querySelector('.modal-body');
  if (body && !first) body.scrollTop = scroll;
  const x = root.querySelector('[data-x]');
  if (x) x.onclick = () => closeModal();
  const scrim = root.querySelector('.scrim');
  if (scrim && def.closable !== false) scrim.onclick = () => closeModal();
  if (def.mount) def.mount(root.querySelector('.modal'));
  tilt3d(root);
  if (first) {
    const f =
      root.querySelector('[data-focus]') ||
      root.querySelector('.modal-foot .btn.primary:not(:disabled)') ||
      root.querySelector('.modal-foot .btn:not(:disabled)') ||
      root.querySelector('.modal-head .icon-btn');
    if (f)
      setTimeout(() => {
        try {
          f.focus({ preventScroll: true });
        } catch (e) {
          /* abaikan */
        }
      }, 40);
  }
}
// kartu 3D miring mengikuti pointer (hanya mouse/pena; layar sentuh & gerak dikurangi tetap diam)
const fineHover = () => {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch (e) {
    return false;
  }
};
function tilt3d(root) {
  if (UI.reduceMotion() || !fineHover()) return;
  $$('.tilt3d', root).forEach(el => {
    const max = Number(el.dataset.tilt) || 8;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = (e.clientX - r.left) / r.width - 0.5,
        y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', (x * 2 * max).toFixed(2) + 'deg');
      el.style.setProperty('--rx', (y * -2 * max).toFixed(2) + 'deg');
      el.classList.add('tilting');
    });
    el.addEventListener('pointerleave', () => {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
      el.classList.remove('tilting');
    });
  });
}
function refreshModal() {
  if (App.modal && App.modal.refreshable !== false) paint(App.modal, false);
}
function closeModal(quiet) {
  const root = $('#modalRoot');
  if (App.modal && App.modal.cleanup) {
    try {
      App.modal.cleanup();
    } catch (e) {
      /* abaikan */
    }
  }
  App.modal = null;
  if (!root.hidden && root.firstChild && !UI.reduceMotion()) {
    // animasi tutup: wadah lama jadi "bayangan" yang memudar/turun, #modalRoot baru langsung siap dipakai
    const fresh = root.cloneNode(false);
    fresh.hidden = true;
    root.parentNode.insertBefore(fresh, root);
    UI.leave(root, 280, true);
  } else {
    root.hidden = true;
    root.innerHTML = '';
  }
  if (quiet === true) return;
  UI.renderStage();
  UI.scheduleAI();
  UI.scheduleAutoEnd();
}
const on = (root, sel, fn) => {
  const el = root.querySelector(sel);
  if (el) el.addEventListener('click', fn);
};
const btn = (attrs, cls, icon, label, disabled) =>
  '<button type="button" class="btn ' +
  (cls || '') +
  '" ' +
  attrs +
  (disabled ? ' disabled' : '') +
  '>' +
  (icon ? ic(icon) : '') +
  '<span>' +
  esc(t(label)) +
  '</span></button>';
const whoLine = (i, extra) => {
  const p = App.S.players[i];
  return avatarHTML(p, 'xs') + '<span>' + esc(p.name) + (extra ? ' · ' + t(extra) : '') + '</span>';
};
// terjemahan untuk fungsi yang memakai nama t sebagai petak lokal
const T = (x, p) => t(x, p);
// koin + angka satu unit (tidak menempel, tidak terpisah baris)
const money = n => '<span class="amt">' + coin + '<b>' + fmt(n) + '</b></span>';
// ringkasan "Uangmu [koin 2.500] → sisa [koin 2.340]"
const sumRow = (cash, cost, can) =>
  '<div class="sum-row"><span class="sr-side"><span class="sr-label">' +
  esc(t('Uangmu')) +
  '</span>' +
  money(cash) +
  '</span>' +
  '<span class="arrow" aria-hidden="true">→</span>' +
  '<span class="sr-side">' +
  (can
    ? '<span class="sr-label sub">' + esc(t('sisa')) + '</span>' + money(cash - cost)
    : '<em>' + esc(t('kurang {n}', { n: cost - cash })) + '</em>') +
  '</span></div>';
const head = () => App.S.queue[0];

// ---------- kepala kartu kota ----------
function cityHero(S, ti, opts) {
  opts = opts || {};
  const t = TILES[ti],
    st = S.tiles[ti];
  const g = t.group ? GROUPS[t.group] : null;
  const kind = t.type === 'spot' ? 'Tempat Wisata' : g ? g.name : '';
  const owner = st.owner >= 0 ? S.players[st.owner] : null;
  return (
    '<div class="city-hero" style="--g:' +
    (g ? g.color : '#B79CFF') +
    ';--gi:' +
    (g ? g.ink : '#6B3FC4') +
    (owner ? ';--oc:' + owner.color : '') +
    '">' +
    '<span class="ch-art">' +
    ART.art(t.art) +
    (st.owner >= 0 && t.type === 'city' && st.level
      ? '<span class="ch-bld">' + ART.art(['', 'b1', 'b2', 'b3', 'b4'][st.level]) + '</span>'
      : '') +
    '</span>' +
    '<span class="ch-txt"><span class="ch-kind">' +
    esc(T(kind)) +
    (t.type === 'city' ? ' · ' + esc(T('{n} kota', { n: E.GROUP_TILES[t.group].length })) : '') +
    '</span><b class="ch-name">' +
    esc(tile(t.i)) +
    '</b>' +
    (t.blurb ? '<span class="ch-blurb">' + esc(T(t.blurb)) + '</span>' : '') +
    (opts.owner !== false && owner
      ? '<span class="ch-owner">' +
        avatarHTML(owner, 'xs') +
        esc(T('Milik {n}', { n: owner.name })) +
        (t.type === 'city' ? ' · ' + esc(T(E.LEVEL_NAME[st.level])) : '') +
        '</span>'
      : '') +
    '</span></div>'
  );
}
// deret petak satu grup / semua wisata: bingkai warna pemilik, label hitungan milik pemain p
function groupProgress(S, p, ti) {
  const t = TILES[ti];
  const spots = t.type === 'spot';
  const tiles = spots ? E.SPOTS : E.GROUP_TILES[t.group];
  const mine = tiles.filter(x => S.tiles[x].owner === p).length;
  const who = p >= 0 && p !== viewer() ? S.players[p].name + ': ' : '';
  const dots = tiles
    .map(x => {
      const o = S.tiles[x].owner,
        op = o >= 0 ? S.players[o] : null;
      return (
        '<span class="pg-dot' +
        (op ? ' own' : '') +
        (o === p ? ' mine' : '') +
        (x === ti && !op ? ' this' : '') +
        '"' +
        (op ? ' style="--c:' + op.color + '"' : '') +
        ' title="' +
        esc(TILES[x].name + (op ? ' · ' + op.name : '')) +
        '">' +
        ART.art(TILES[x].art) +
        '</span>'
      );
    })
    .join('');
  const txt = spots
    ? T('{a}/{b} wisata', { a: mine, b: tiles.length }) + (S.settings.instantWin ? ' · ' + T('5 = menang!') : '')
    : T('{a}/{b} {g} · grup penuh = tol ×2', { a: mine, b: tiles.length, g: { t: GROUPS[t.group].name } });
  return '<div class="progress-row">' + dots + '<span class="pg-txt">' + esc(who + txt) + '</span></div>';
}
// tol bila kota ti dimiliki p pada tingkat k
function tollIf(S, p, ti, k) {
  const t = TILES[ti];
  let r = t.price * RULES.rentMult[k];
  if (E.GROUP_TILES[t.group].every(x => x === ti || S.tiles[x].owner === p)) r *= RULES.groupMult;
  if (S.festival.tile === ti) r *= S.festival.mult;
  r *= 1 + E.tierInfo(S.players[p].love).rentPct / 100;
  return Math.round(r / 5) * 5;
}
const LV_ART = ['flag', 'b1', 'b2', 'b3', 'b4'];
// kartu pilihan tingkat (beli / bangun)
function levelCards(S, p, ti, from, sel, allowed, costFn) {
  const P = S.players[p];
  const cap = E.capLevel(S, p);
  const maxShow = from === 3 || from === 4 ? 4 : 3;
  let h = '<div class="lv-cards" role="radiogroup" aria-label="' + esc(T('Pilih tingkat bangunan')) + '">';
  for (let k = 0; k <= maxShow; k++) {
    const done = k <= from;
    const ok = allowed.includes(k);
    const cost = ok ? costFn(k) : 0;
    const afford = ok && cost <= P.cash;
    const locked = !done && !ok;
    let note;
    if (done) note = T('Sudah ada');
    else if (locked) note = k === 3 && cap < 3 ? T('Setelah 1 putaran') : k === 4 ? T('Butuh Hotel') : '—';
    else note = fmt(E.levelCost(ti, k) * (1 - (P.discount || 0)));
    const isSel = !done && ok && k <= sel;
    h +=
      '<button type="button" class="lv-card tilt3d' +
      (done ? ' done' : '') +
      (isSel ? ' sel' : '') +
      (locked ? ' locked' : '') +
      (ok && !afford ? ' poor' : '') +
      (k === 4 ? ' lm' : '') +
      '" data-lv="' +
      k +
      '" role="radio" aria-checked="' +
      (k === sel) +
      '"' +
      (done || locked || !afford ? ' disabled' : '') +
      '>' +
      '<span class="lv-art">' +
      ART.art(LV_ART[k]) +
      '</span><b>' +
      esc(T(E.LEVEL_NAME[k])) +
      '</b><span class="lv-cost">' +
      (done ? ic('check') : locked ? ic('lock') : coin) +
      esc(note) +
      '</span>' +
      '<span class="lv-toll">' +
      esc(T('Tol {n}', { n: tollIf(S, p, ti, k) })) +
      '</span>' +
      (isSel ? '<span class="lv-check">' + ic('check') + '</span>' : '') +
      '</button>';
  }
  return h + '</div>';
}
function defaultLevel(S, p, ti, allowed, costFn) {
  const P = S.players[p];
  let best = allowed[0];
  allowed.forEach(k => {
    if (costFn(k) <= Math.max(P.cash - 400, costFn(allowed[0]))) best = k;
  });
  return best;
}

export {
  LV_ART,
  btn,
  cityHero,
  closeModal,
  defaultLevel,
  groupProgress,
  head,
  levelCards,
  on,
  refreshModal,
  showModal,
  sumRow,
  tollIf,
  whoLine,
};
