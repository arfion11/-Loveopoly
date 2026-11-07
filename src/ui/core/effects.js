/* LOVEOPOLY — UI inti › efek di atas papan & hitung naik uang (diekspor ulang lewat src/ui/core.js) */
import { ART } from '../../assets/art.js';
import { $, $$, App, SPD, esc, fmt, ic, pulse, reduceMotion } from './base.js';
import { is3d } from './camera.js';
import { tileEl } from './board.js';
import { tileBox, tokSize, tokenXY } from './pieces.js';

// ---------- efek di atas papan ----------
function boardFx(cls, x, y, html, vars, ms) {
  const host = $('#tokens');
  if (!host || reduceMotion()) return null;
  const el = document.createElement('div');
  el.className = cls;
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
  if (vars) Object.keys(vars).forEach(k => el.style.setProperty(k, vars[k]));
  if (html) el.innerHTML = html;
  host.appendChild(el);
  setTimeout(() => el.remove(), ms || 1400);
  return el;
}
function ripple(tile, color) {
  const b = tileBox(tile);
  boardFx('ripple', b.x, b.y, '', { '--c': color || 'var(--brand)', '--r': Math.round(Math.max(b.w, b.h) * 1.3) + 'px' }, 900);
}
// titik kaki & tinggi kartu berdiri sebuah petak (3D), dalam koordinat papan
function popFoot(tile) {
  const el = tileEl(tile),
    pop = el && el.querySelector('.t-pop');
  if (!pop || !pop.offsetHeight) return null;
  return { x: el.offsetLeft + pop.offsetLeft, y: el.offsetTop + pop.offsetTop + pop.offsetHeight, h: pop.offsetHeight };
}
function flagDrop(tile, color) {
  const b = tileBox(tile);
  const sz = Math.round(Math.max(34, Math.min(84, Math.min(b.w, b.h) * 0.95)));
  // 3D: bendera ditancapkan di atas kartu kota (bukan di titik pion yang menutupinya)
  const f = is3d() ? popFoot(tile) : null;
  if (f)
    boardFx(
      'flag-drop lift',
      f.x,
      f.y,
      ART.art('flag'),
      { '--oc': color, '--sz': Math.round(sz * 0.8) + 'px', '--lift': Math.round(f.h * 0.92) + 'px' },
      1400
    );
  else boardFx('flag-drop', b.x, b.y, ART.art('flag'), { '--oc': color, '--sz': sz + 'px' }, 1400);
  burst(tile, ['#FFD93D', color, '#FFFFFF'], 10);
}
function stampDrop(tile, color, text) {
  const b = tileBox(tile);
  const sz = Math.round(Math.max(44, Math.min(110, Math.min(b.w, b.h) * 1.2)));
  boardFx('stamp-drop', b.x, b.y, '<span>' + esc(text) + '</span>', { '--c': color, '--sz': sz + 'px' }, 1500);
}
function burst(tile, colors, n) {
  if (reduceMotion()) return;
  const b = tileBox(tile);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = Math.min(b.w, b.h) * (0.6 + Math.random() * 0.6);
    boardFx(
      'spark',
      b.x,
      b.y,
      '',
      {
        '--c': colors[k % colors.length],
        '--dx': Math.round(Math.cos(a) * d) + 'px',
        '--dy': Math.round(Math.sin(a) * d) + 'px',
        '--r': Math.round(Math.random() * 360) + 'deg',
      },
      900
    );
  }
}
function dust(tile) {
  if (reduceMotion()) return;
  const b = tileBox(tile);
  for (let k = 0; k < 6; k++) {
    boardFx(
      'dust',
      b.x + (k - 2.5) * b.w * 0.14,
      b.y + b.h * 0.22,
      '',
      { '--dx': Math.round((k - 2.5) * 9) + 'px', '--s': (0.6 + Math.random() * 0.6).toFixed(2) },
      900
    );
  }
}
function fireworks(tile) {
  const cols = ['#FF4F8B', '#FFD93D', '#3DDBD9', '#B79CFF', '#FF9F43'];
  burst(tile, cols, 14);
  setTimeout(() => burst(tile, cols, 12), 260 * SPD());
  setTimeout(() => burst(tile, cols, 10), 520 * SPD());
}
function stormFx(tile) {
  const b = tileBox(tile);
  boardFx('storm-cloud', b.x, b.y - b.h * 0.35, ic('storm'), { '--sz': Math.round(Math.min(b.w, b.h) * 0.9) + 'px' }, 1400);
}
function boardPt(who) {
  if (who === 'bank') {
    const c = $('#board .center');
    return c ? { x: c.offsetLeft + c.offsetWidth / 2, y: c.offsetTop + c.offsetHeight * 0.42 } : null;
  }
  const p = App.S && App.S.players[who];
  return p ? tokenXY(who, p.pos) : null;
}
const floatStack = {};
function bfloat(pi, html, cls) {
  const pt = boardPt(pi);
  if (!pt) return;
  const now = Date.now();
  const st = floatStack[pi] && now - floatStack[pi].t < 900 ? floatStack[pi] : { n: -1 };
  st.n++;
  st.t = now;
  floatStack[pi] = st;
  // 3D: diangkat ke atas kepala pion (arah atas layar), bukan digeser ke belakang ke deretan kartu
  if (is3d())
    boardFx(
      'bfloat lift ' + cls,
      pt.x,
      pt.y,
      html,
      { '--lift': Math.round(tokSize * 1.75 + st.n * Math.max(18, tokSize * 0.7)) + 'px' },
      1700
    );
  else boardFx('bfloat ' + cls, pt.x, pt.y - tokSize * 0.9 - st.n * Math.max(16, tokSize * 0.62), html, null, 1700);
}
function flyCoins(from, to, n) {
  if (reduceMotion() || !from || !to) return 0;
  const host = $('#tokens');
  if (!host || typeof host.animate !== 'function') return 0;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (dist < 6) return 0;
  const lift = Math.min(160, 40 + dist * 0.3);
  const dur = Math.round((600 + Math.min(420, dist * 0.5)) * SPD());
  const gap = Math.round(70 * SPD());
  for (let k = 0; k < n; k++) {
    const c = document.createElement('i');
    c.className = 'coin';
    host.appendChild(c);
    const jx = (Math.random() - 0.5) * 20,
      jy = (Math.random() - 0.5) * 14;
    const x0 = from.x + jx,
      y0 = from.y + jy;
    const cx = (from.x + to.x) / 2 + jx * 1.5,
      cy = Math.min(from.y, to.y) - lift;
    const frames = [];
    for (let s = 0; s <= 12; s++) {
      const u = s / 12,
        v = 1 - u;
      const x = v * v * x0 + 2 * v * u * cx + u * u * to.x;
      const y = v * v * y0 + 2 * v * u * cy + u * u * to.y;
      const sc = u < 0.15 ? 0.45 + (u / 0.15) * 0.55 : u > 0.82 ? 1 - ((u - 0.82) / 0.18) * 0.5 : 1;
      frames.push({
        transform:
          'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + sc.toFixed(2) + ') rotate(' + Math.round(u * 540) + 'deg)',
        opacity: s === 0 ? 0 : s === 12 ? 0.15 : 1,
      });
    }
    const a = c.animate(frames, { duration: dur, delay: k * gap, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' });
    a.onfinish = () => c.remove();
    a.oncancel = () => c.remove();
  }
  return dur + (n - 1) * gap;
}
function moneyFx(evs, idx, used) {
  const e = evs[idx];
  bfloat(e.p, (e.d > 0 ? '+' : '−') + fmt(Math.abs(e.d)), e.d > 0 ? 'plus' : 'minus');
  if (used.has(idx)) return;
  let partner = -1;
  if (e.d < 0) {
    for (let j = idx + 1; j < Math.min(evs.length, idx + 3); j++) {
      const f = evs[j];
      if (f.t === 'money' && f.d === -e.d && f.p !== e.p) {
        partner = f.p;
        used.add(j);
        break;
      }
    }
  }
  const amt = Math.abs(e.d);
  const n = Math.max(2, Math.min(8, Math.round(Math.log2(amt / 15 + 1)) + 1));
  let t = 0;
  if (partner >= 0) t = flyCoins(boardPt(e.p), boardPt(partner), n);
  else if (e.d > 0) t = flyCoins(boardPt('bank'), boardPt(e.p), n);
  else flyCoins(boardPt(e.p), boardPt('bank'), n);
  const dest = partner >= 0 ? partner : e.d > 0 ? e.p : -1;
  if (dest >= 0 && t)
    setTimeout(() => {
      const tok = $('#tok-' + dest);
      if (tok && !tok.classList.contains('hop')) pulse(tok, 'land', 560);
    }, t);
}

// ---------- hitung naik uang ----------
const tweens = {};
let tweenRaf = 0;
function tweenCash(pi, d) {
  const cur = App.cashShown[pi];
  if (cur == null) return;
  const to = (tweens[pi] ? tweens[pi].to : cur) + d;
  if (reduceMotion()) {
    App.cashShown[pi] = to;
    delete tweens[pi];
    $$('[data-cash="' + pi + '"]').forEach(el => {
      el.textContent = fmt(to);
    });
    return;
  }
  tweens[pi] = { from: cur, to, t0: performance.now(), dur: Math.round(850 * SPD()) };
  if (!tweenRaf) tweenRaf = requestAnimationFrame(stepTweens);
}
function stepTweens(now) {
  tweenRaf = 0;
  Object.keys(tweens).forEach(k => {
    const tw = tweens[k];
    const u = tw.dur ? Math.min(1, Math.max(0, (now - tw.t0) / tw.dur)) : 1;
    const v = Math.round(tw.from + (tw.to - tw.from) * (1 - Math.pow(1 - u, 3)));
    App.cashShown[k] = v;
    $$('[data-cash="' + k + '"]').forEach(el => {
      el.textContent = fmt(v);
      el.classList.toggle('up', u < 1 && tw.to > tw.from);
      el.classList.toggle('down', u < 1 && tw.to < tw.from);
    });
    if (u >= 1) delete tweens[k];
  });
  if (Object.keys(tweens).length) tweenRaf = requestAnimationFrame(stepTweens);
}

export { bfloat, boardFx, boardPt, burst, dust, fireworks, flagDrop, moneyFx, ripple, stampDrop, stormFx, tweenCash, tweens };
