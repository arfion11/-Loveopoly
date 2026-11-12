/* LOVEOPOLY — UI inti › toast, banner & kartu medali achievement (diekspor ulang lewat src/ui/core.js) */
import { ART } from '../../assets/art.js';
import { SND } from '../../assets/audio.js';
import { Icons } from '../../assets/icons.js';
import { D } from '../../engine/data.js';
import { E } from '../../engine/engine.js';
import { $, $$, App, SPD, avatarHTML, controls, esc, ic, pulse, reduceMotion, t, tLog } from './base.js';
import { tweens } from './effects.js';
import { merpiSay, merpiTimer, pick } from './mascot.js';
import { endPick } from './pick.js';
import { cancelAutoEnd } from './flow.js';

// ---------- toast & banner ----------
function toast(text, opts) {
  opts = opts || {};
  const host = $('#toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (opts.kind || '');
  el.setAttribute('role', opts.kind === 'err' ? 'alert' : 'status');
  el.innerHTML =
    '<span class="t-ic">' +
    ic(opts.icon || (opts.kind === 'err' ? 'alert' : 'heart')) +
    '</span><div>' +
    // jaring pengaman bahasa: teks tetap (kunci kamus) diterjemahkan di sini; teks yang sudah diterjemahkan pemanggil
    // tidak ada di kamus sehingga lewat apa adanya. tLog juga menerima pesan engine { text, k, a }
    (opts.title ? '<b>' + esc(t(opts.title)) + '</b>' : '') +
    '<span>' +
    esc(tLog(text)) +
    '</span></div>';
  host.appendChild(el);
  // batasi 3 toast biasa; kartu achievement di host yang sama tidak ikut terbuang
  const ts = host.querySelectorAll(':scope > .toast');
  for (let k = 0; k < ts.length - 3; k++) ts[k].remove();
  const ms = opts.ms || (opts.kind === 'err' ? 3600 : 2800);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, ms);
}
let bannerTimer = null;
function banner(title, sub, kind, ms, artName) {
  const host = $('#boardVP');
  if (!host) return;
  const old = host.querySelector('.banner');
  if (old) old.remove();
  clearTimeout(bannerTimer);
  const el = document.createElement('div');
  el.className = 'banner ' + (kind || '');
  el.setAttribute('role', 'status');
  el.innerHTML =
    '<div class="bn-in">' +
    (artName ? '<span class="bn-art">' + ART.art(artName) + '</span>' : '') +
    '<div class="bn-txt"><b>' +
    esc(t(title)) +
    '</b>' +
    (sub ? '<span>' + esc(t(sub)) + '</span>' : '') +
    '</div></div>';
  host.appendChild(el);
  bannerTimer = setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 420);
  }, ms || 2000);
}

// ---------- achievement: kartu medali (antre satu per satu) ----------
// medali roset emas + pita; tanpa id gradien supaya salinan yang terbang tetap utuh
const ROSETTE =
  'M40 9.5A5.6 5.6 0 0 1 49.75 11.22A5.6 5.6 0 0 1 58.32 16.17A5.6 5.6 0 0 1 64.68 23.75A5.6 5.6 0 0 1 68.07 33.05A5.6 5.6 0 0 1 68.07 42.95A5.6 5.6 0 0 1 64.68 52.25A5.6 5.6 0 0 1 58.32 59.83A5.6 5.6 0 0 1 49.75 64.78A5.6 5.6 0 0 1 40 66.5A5.6 5.6 0 0 1 30.25 64.78A5.6 5.6 0 0 1 21.68 59.83A5.6 5.6 0 0 1 15.32 52.25A5.6 5.6 0 0 1 11.93 42.95A5.6 5.6 0 0 1 11.93 33.05A5.6 5.6 0 0 1 15.32 23.75A5.6 5.6 0 0 1 21.68 16.17A5.6 5.6 0 0 1 30.25 11.22A5.6 5.6 0 0 1 40 9.5Z';
const achIcon = id => {
  const a = E.ACH[id];
  return a && a.icon in Icons.paths ? a.icon : 'trophy';
};
function medalHTML(icon) {
  return (
    '<span class="medal-art"><svg class="ma-svg" viewBox="0 0 80 92" aria-hidden="true">' +
    '<path d="M28 46 40 53 31 90 25 82 17 86z" fill="#FF4F8B"/><path d="M52 46 40 53 49 90 55 82 63 86z" fill="#7B61FF"/>' +
    '<path d="M34 49.5 40 53 37.6 63z M46 49.5 40 53 42.4 63z" fill="#2A0F3A" opacity=".18"/>' +
    '<path d="' +
    ROSETTE +
    '" fill="#FFC93C" stroke="#D38D08" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="40" cy="38" r="21.5" fill="#FFE07A"/>' +
    '<path d="M18.6 40.5a21.5 21.5 0 0 0 42.8 0A24 24 0 0 1 18.6 40.5z" fill="#F2B01F" opacity=".55"/>' +
    '<circle cx="40" cy="38" r="21.5" fill="none" stroke="#FFF6D6" stroke-width="2.2"/>' +
    '<circle cx="40" cy="38" r="17.2" fill="none" stroke="#DE9E12" stroke-width="1.1" stroke-dasharray="1.4 3"/>' +
    '<ellipse cx="31" cy="27.5" rx="6.5" ry="3.4" transform="rotate(-32 31 27.5)" fill="#fff" opacity=".6"/>' +
    '</svg><span class="ma-ic">' +
    ic(icon) +
    '</span></span>'
  );
}
const achQ = [];
let achCur = null,
  achTimer = null,
  achWait = null;
// kartu menunggu sampai layar tenang: tidak saat animasi berjalan, dialog keputusan terbuka, atau overlay aktif
const achOverlay = () => !!(App.modal || $('#pauseOv') || $('#guideOv') || $('#tourOv') || $('#winOv'));
function achievementFx(e, ns, fresh) {
  const a = E.ACH[e.id],
    p = ns.players[e.p];
  if (!a || !p) return;
  if (controls(e.p)) {
    achQ.push({ id: e.id, p: e.p, n: Math.max(1, p.achievements.indexOf(e.id) + 1), first: !achQ.length && !achCur, fresh });
    achKick(80);
  } else if (p.kind === 'human') {
    // pencapaian pasangan (online): cukup kabar singkat
    SND.play('ding');
    toast(t(a.name) + ' — ' + t(a.text), { title: t('{n} dapat achievement!', { n: p.name }), icon: achIcon(e.id), kind: 'gold' });
  }
}
function achKick(ms) {
  clearTimeout(achWait);
  achWait = setTimeout(tryAch, ms);
}
function tryAch() {
  if (achCur || !achQ.length) return;
  if ($('#winOv') || !App.S || !$('#toasts')) {
    achQ.length = 0;
    return;
  }
  if (App.animating || App.pending.length || achOverlay()) {
    achKick(300);
    return;
  }
  showAch(achQ.shift());
}
function showAch(it) {
  const host = $('#toasts');
  const a = E.ACH[it.id],
    p = App.S.players[it.p],
    total = D.ACHIEVEMENTS.length;
  if (!a || !p) {
    achKick(0);
    return;
  }
  const pct = n => Math.round((Math.min(n, total) / total) * 100);
  const el = document.createElement('div');
  el.className = 'ach-pop';
  el.setAttribute('role', 'status');
  el.innerHTML =
    '<div class="ap-card">' +
    '<span class="ap-badge" aria-hidden="true"><span class="ap-rays"></span><span class="ap-medal">' +
    medalHTML(achIcon(it.id)) +
    '</span>' +
    '<span class="ap-tw t1">' +
    ic('sparkle') +
    '</span><span class="ap-tw t2">' +
    ic('sparkle') +
    '</span></span>' +
    '<span class="ap-txt">' +
    '<span class="ap-kick">' +
    esc(t('Achievement terbuka!')) +
    '</span>' +
    '<b class="ap-name">' +
    esc(t(a.name)) +
    '</b>' +
    '<span class="ap-desc">' +
    esc(t(a.text)) +
    '</span>' +
    '<span class="ap-foot"><span class="ap-who">' +
    avatarHTML(p, 'xs') +
    '<span>' +
    esc(p.name) +
    '</span></span>' +
    '<span class="ap-prog" title="' +
    esc(t('Koleksi achievement')) +
    '"><span class="meter gold"><i style="--v:' +
    pct(it.n - 1) +
    '%"></i></span><b>' +
    it.n +
    '/' +
    total +
    '</b></span></span>' +
    '</span>' +
    '<span class="ap-shine" aria-hidden="true"></span>' +
    '</div>' +
    '<span class="ap-fx" aria-hidden="true"></span>';
  el._p = it.p;
  host.prepend(el);
  achCur = el;
  SND.play('achieve');
  if (it.first && it.fresh) merpiSay(pick(D.MERPI.achieve), 'love', 2200);
  // meter koleksi naik tepat setelah medali mendarat
  setTimeout(() => {
    const m = el.querySelector('.ap-prog i');
    if (m) m.style.setProperty('--v', pct(it.n) + '%');
  }, 700);
  if (!reduceMotion()) {
    const cols = ['#FF4F8B', '#FFC93C', '#7B61FF', '#16C2A3', '#47AEFF', '#FF9F43'];
    let h = '';
    for (let k = 0; k < 18; k++) {
      const ang = (k / 18) * Math.PI * 2 + Math.random() * 0.4,
        sp = 50 + Math.random() * 90;
      const w = k % 3 === 0 ? 8 : 6,
        ht = k % 3 === 0 ? 8 : 11;
      h +=
        '<i style="--c:' +
        cols[k % cols.length] +
        ';--dx:' +
        Math.round(Math.cos(ang) * sp * 1.5) +
        'px;--dy:' +
        Math.round(Math.sin(ang) * sp * 0.7 - 24) +
        'px;--r:' +
        Math.round(Math.random() * 720 - 360) +
        'deg;--w:' +
        w +
        'px;--h:' +
        ht +
        'px;--br:' +
        (k % 3 === 0 ? '50%' : '2px') +
        ';--d:' +
        (0.32 + Math.random() * 0.12).toFixed(2) +
        's"></i>';
    }
    el.querySelector('.ap-fx').innerHTML = h;
  }
  el.addEventListener('click', () => achDone(el));
  // dialog yang muncul belakangan tidak boleh tertutup kartu: kartu diselesaikan lebih awal
  el._watch = setInterval(() => {
    if (achOverlay()) achDone(el);
  }, 250);
  achTimer = setTimeout(() => achDone(el), Math.round(3600 * Math.max(0.75, SPD())));
}
function achDone(el) {
  if (!el || el._done) return;
  el._done = true;
  clearTimeout(achTimer);
  clearInterval(el._watch);
  const live = el.isConnected;
  if (live) {
    el.classList.add('out');
    achFly(el, App.S);
  }
  setTimeout(
    () => {
      el.remove();
      if (achCur === el) {
        achCur = null;
        achKick(380);
      }
    },
    live ? 460 : 0
  );
}
// medali "dikoleksi": terbang ke kartu pemain pemiliknya
function achFly(el, S) {
  if (reduceMotion() || !S || el._p == null) return;
  const src = el.querySelector('.medal-art'),
    idx = el._p;
  const card = Array.from(document.querySelectorAll('.pcard[data-p="' + idx + '"]')).find(c => c.offsetParent !== null);
  if (!src || !card || typeof src.animate !== 'function') return;
  const tgt = card.querySelector('.av') || card;
  const a = src.getBoundingClientRect(),
    b = tgt.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const fly = document.createElement('div');
  fly.className = 'ap-fly';
  fly.setAttribute('aria-hidden', 'true');
  fly.innerHTML = src.outerHTML;
  fly.style.cssText = 'left:' + a.left.toFixed(1) + 'px;top:' + a.top.toFixed(1) + 'px;width:' + a.width.toFixed(1) + 'px';
  fly.firstChild.style.setProperty('--mw', a.width.toFixed(1) + 'px');
  document.body.appendChild(fly);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2),
    dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const s = Math.max(0.28, Math.min(1, (b.width / a.width) * 0.95));
  const lift = Math.min(70, 24 + Math.abs(dx) * 0.12);
  const anim = fly.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      {
        transform: 'translate(' + (dx * 0.4).toFixed(1) + 'px,' + (dy * 0.4 - lift).toFixed(1) + 'px) scale(.8) rotate(-14deg)',
        opacity: 1,
        offset: 0.42,
      },
      { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + s.toFixed(2) + ') rotate(0deg)', opacity: 0.35 },
    ],
    { duration: 760, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' }
  );
  anim.onfinish = () => {
    fly.remove();
    const now = card.isConnected
      ? card
      : Array.from(document.querySelectorAll('.pcard[data-p="' + idx + '"]')).find(c => c.offsetParent !== null);
    pulse(now, 'ach-got', 1100);
    SND.play('ding');
  };
  anim.oncancel = () => fly.remove();
}
function clearAch() {
  achQ.length = 0;
  clearTimeout(achTimer);
  clearTimeout(achWait);
  if (achCur) clearInterval(achCur._watch);
  achCur = null;
  $$('.ach-pop, .ap-fly').forEach(x => x.remove());
}
// label cara menang (bahasa aktif): Trio Warna / Kolektor Wisata / Raja <jalur>
const winLabel = x =>
  x.kind === 'triple' ? t('Trio Warna') : x.kind === 'spots' ? t('Kolektor Wisata') : t('Raja {s}', { s: { t: E.sideName(x.side) } });
function clearFx() {
  const bn = $('#boardVP .banner');
  if (bn) bn.remove();
  clearTimeout(bannerTimer);
  clearTimeout(merpiTimer);
  clearAch();
  cancelAutoEnd();
  endPick(true);
  App.aim = null;
  App.threatKeys = null;
  Object.keys(tweens).forEach(k => delete tweens[k]);
  App.cashShown = {};
  App.loveShown = {};
  App.turnKey = '';
}

export { achievementFx, banner, clearFx, toast, winLabel };
