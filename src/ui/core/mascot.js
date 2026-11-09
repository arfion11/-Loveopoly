/* LOVEOPOLY — UI inti › Merpi, reaksi emoji, Merpi besar di tengah papan, suasana (diekspor ulang lewat src/ui/core.js) */
import { ART } from '../../assets/art.js';
import { SND } from '../../assets/audio.js';
import { D } from '../../engine/data.js';
import { E } from '../../engine/engine.js';
import { $, App, esc, ic, pulse, reduceMotion, restart } from './base.js';
import { camInsets } from './layout.js';
import { is3d } from './camera.js';
import { tileAnchor, tokSize } from './pieces.js';
import { boardFx, boardPt } from './effects.js';
import { wakeCalm } from './power.js';

// ---------- Merpi ----------
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const MOODS = ['happy', 'sad', 'wow', 'love', 'think'];
let merpiTimer = null,
  merpiMood = '';
function merpiSay(text, mood, ms) {
  const m = $('#stage .merpi'),
    bub = $('#bubble');
  if (!m || !bub) return;
  const big = $('#mascot .merpi');
  const all = big ? [m, big] : [m];
  all.forEach(x => MOODS.forEach(k => x.classList.remove('is-' + k)));
  merpiMood = mood || '';
  if (mood) all.forEach(x => x.classList.add('is-' + mood));
  mascotWake();
  if (mood === 'happy' || mood === 'love') mascotAct('hop', 700);
  else if (mood === 'wow') mascotAct('cheer', 800);
  else if (mood === 'sad') mascotAct('droop', 1000);
  if (text) {
    bub.innerHTML = '<span>' + esc(text) + '</span>';
    restart(bub, 'show');
    trackBubble();
  }
  if (mood === 'happy' || mood === 'wow' || mood === 'love') pulse($('#merpiBtn'), 'jump', 700);
  else if (mood === 'sad') pulse($('#merpiBtn'), 'droop', 900);
  clearTimeout(merpiTimer);
  merpiTimer = setTimeout(() => {
    all.forEach(x => MOODS.forEach(k => x.classList.remove('is-' + k)));
    merpiMood = '';
    bub.classList.remove('show');
  }, ms || 2200);
}
function merpiPoke() {
  SND.play('chirp');
  merpiSay(pick(D.MERPI.poke), pick(['happy', 'love', 'wow']), 2600);
  mascotAct('spin', 900);
  mascotEmote(ic('heart'), 1400);
}

// ---------- reaksi emoji antar pemain (bukan bagian state permainan; online lewat field fx room) ----------
const EMOTES = ['😂', '😍', '😱', '😤', '👏', '🥺'];
const EMOTE_SAY = {
  '😂': 'Hahaha, kocak!',
  '😍': 'Uwu, manis banget~',
  '😱': 'Hah?! Serius?!',
  '😤': 'Awas ya, nanti dibalas!',
  '👏': 'Mantap! Tepuk tangan~',
  '🥺': 'Jangan jahat-jahat dong…',
};
let emoteAt = 0;
function emoteSender() {
  const S = App.S;
  if (!S || S.over) return -1;
  if (App.mode === 'online') return App.net ? App.net.mySeat() : -1;
  const cur = S.players[S.turn.p];
  if (cur && cur.kind === 'human' && !cur.bankrupt) return cur.i;
  const h = S.players.find(p => p.kind === 'human' && !p.bankrupt);
  return h ? h.i : -1;
}
function sendEmote(e) {
  const now = Date.now();
  if (now - emoteAt < 1200 || !EMOTES.includes(e)) return;
  emoteAt = now;
  const p = emoteSender();
  if (p < 0) return;
  if (App.mode === 'online' && App.net) App.net.emote(e);
  else showEmote(p, e);
}
function showEmote(p, e) {
  const S = App.S;
  if (!S || !S.players[p] || !EMOTES.includes(e)) return;
  SND.play('chirp');
  const pt = boardPt(p);
  if (pt) {
    if (is3d()) boardFx('emote-pop lift', pt.x, pt.y, '<span>' + e + '</span>', { '--lift': Math.round(tokSize * 1.45) + 'px' }, 2000);
    else boardFx('emote-pop', pt.x, pt.y - tokSize * 1.4, '<span>' + e + '</span>', null, 2000);
  }
  document.querySelectorAll('.pcard[data-p="' + p + '"]').forEach(el => pulse(el, 'emoted', 700));
  if (Math.random() < 0.35 && !merpiMood)
    merpiSay(EMOTE_SAY[e], e === '😍' || e === '👏' ? 'love' : e === '😱' ? 'wow' : e === '🥺' ? 'sad' : 'happy', 1600);
}
function bindEmote() {
  const btn = document.getElementById('emoteBtn'),
    pal = document.getElementById('emotePal');
  if (!btn || btn._b) return;
  btn._b = true;
  pal.innerHTML = EMOTES.map(
    e => '<button type="button" data-emo="' + e + '" aria-label="Reaksi ' + e + '"><span aria-hidden="true">' + e + '</span></button>'
  ).join('');
  // buka/tutup halus: tampilkan dulu (hidden=false), lalu transisi opacity+geser; tutup = transisi lalu hidden
  let tHide = 0;
  const open = () => {
    clearTimeout(tHide);
    pal.hidden = false;
    void pal.offsetWidth;
    pal.classList.add('on');
    btn.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    if (pal.hidden) return;
    pal.classList.remove('on');
    btn.setAttribute('aria-expanded', 'false');
    tHide = setTimeout(
      () => {
        pal.hidden = true;
      },
      reduceMotion() ? 0 : 180
    );
  };
  btn.addEventListener('click', () => {
    if (btn.getAttribute('aria-expanded') === 'true') close();
    else open();
  });
  pal.addEventListener('click', ev => {
    const t = ev.target.closest('[data-emo]');
    if (!t) return;
    sendEmote(t.dataset.emo);
    close();
  });
  document.addEventListener('pointerdown', ev => {
    if (!pal.hidden && !ev.target.closest('#emote')) close();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !pal.hidden) close();
  });
  pal.hidden = true;
}

// ---------- Merpi besar di tengah papan (ponsel & kamera 3D, menggantikan globe) ----------
// berdiri tegak di atas alas globe; menoleh ke pion yang aktif, bereaksi lewat gerak (kelas act-*) & ikon emote,
// tertidur bila lama tidak ada kejadian. Teks tetap di gelembung panel aksi (wilayah aria-live).
// Semua isi berada di dalam kotak .ms-stand (elemen 3D tidak boleh menjulur keluar kotaknya).
function mascotHTML() {
  const land =
    '<g fill="#7FD9AE" stroke="#3A2B4A" stroke-width="2.5" stroke-linejoin="round"><path d="M50 60c10-12 30-14 40-6 6 5 2 12-6 14-8 2-6 10 2 14 6 3 4 12-6 12-10 0-16 8-24 4-10-5-14-26-6-38z"/><path d="M122 48c14-2 28 6 34 18 3 7-4 9-10 6-7-4-14 0-12 8 2 7-6 10-12 4-6-6-14-6-14-16 0-10 6-18 14-20z"/><path d="M104 126c10-4 24 0 30 10 5 9-2 22-12 26-9 4-16-2-16-10 0-6-8-8-8-14 0-6 0-10 6-12z"/><path d="M40 122c8-3 16 2 16 9s-8 10-14 7-8-13-2-16z"/></g>';
  // globe hidup: benua & awan berputar pelan di bawah bayangan siang-malam yang diam (terlihat seperti bola
  // dari atas), cincin putus-putus berputar berlawanan. Efek Kabar Merpi (pesawat promo, cincin Musim Puncak)
  // hanya tampil sesuai body[data-amb] / body.amb-peak (lihat renderAmbience)
  const plane =
    '<g fill="#fff" stroke="#3A2B4A" stroke-width="2" stroke-linejoin="round"><path d="M-12 0c0-2 2-3 4-3h14c4 0 8 1.4 8 3s-4 3-8 3H-8c-2 0-4-1-4-3z"/><path d="M0-3-6-12h4l7 9zM0 3l-6 9h4l7-9z" fill="#FF4F8B"/></g>';
  const clouds =
    '<g class="ms-clouds" fill="#fff" opacity=".8"><ellipse cx="70" cy="40" rx="18" ry="6"/><ellipse cx="80" cy="36" rx="9" ry="6"/><ellipse cx="150" cy="120" rx="16" ry="5"/><ellipse cx="60" cy="150" rx="14" ry="5"/><ellipse cx="135" cy="70" rx="10" ry="4"/></g>';
  const heart =
    '<svg viewBox="0 0 24 22"><path d="M12 21C5 15.6 1 11.8 1 7.2A5.7 5.7 0 0 1 12 4.6 5.7 5.7 0 0 1 23 7.2c0 4.6-4 8.4-11 13.8z" fill="#FF4F8B" stroke="#3A2B4A" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const many = (n, h, cls) => Array.from({ length: n }, (_, k) => '<i class="' + cls + '" style="--k:' + k + '">' + h + '</i>').join('');
  return (
    '<div class="mascot" id="mascot">' +
    '<div class="ms-mat" aria-hidden="true"><svg viewBox="0 0 200 200"><defs>' +
    '<radialGradient id="msOcean" cx="40%" cy="36%" r="72%"><stop offset="0" stop-color="#A9E0FF"/><stop offset=".6" stop-color="#5DB6F5"/><stop offset="1" stop-color="#3A8FDB"/></radialGradient>' +
    '<radialGradient id="msShade" cx="34%" cy="30%" r="80%"><stop offset=".5" stop-color="#1B1035" stop-opacity="0"/><stop offset="1" stop-color="#1B1035" stop-opacity=".42"/></radialGradient>' +
    '<clipPath id="msClip"><circle cx="100" cy="100" r="84"/></clipPath></defs>' +
    '<circle class="ms-peak" cx="100" cy="100" r="97" fill="none" stroke="#FFC93C" stroke-width="5"/>' +
    '<circle cx="100" cy="100" r="94" fill="#fff" stroke="#3A2B4A" stroke-width="3"/>' +
    '<circle cx="100" cy="100" r="84" fill="url(#msOcean)"/>' +
    '<g clip-path="url(#msClip)"><g class="ms-land">' +
    land +
    '</g>' +
    clouds +
    '</g>' +
    '<circle cx="100" cy="100" r="84" fill="url(#msShade)"/>' +
    '<ellipse cx="70" cy="62" rx="22" ry="12" fill="#fff" opacity=".28" transform="rotate(-32 70 62)"/>' +
    '<circle cx="100" cy="100" r="84" fill="none" stroke="#3A2B4A" stroke-width="2.5"/>' +
    '<g class="ms-ring"><circle cx="100" cy="100" r="89" fill="none" stroke="#FF7EAC" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/></g>' +
    '<g class="ms-orbit"><path d="M100 22a78 78 0 0 1 60 28" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round" opacity=".85"/><g transform="translate(100 22) scale(1.7)">' +
    plane +
    '</g></g>' +
    '</svg></div>' +
    '<div class="ms-shadow" aria-hidden="true"></div>' +
    '<div class="ms-stand">' +
    '<div class="ms-look"><div class="ms-body" title="Merpi">' +
    ART.merpi('') +
    '</div></div>' +
    // depan Merpi: payung & hujan, label diskon, koin, hati
    '<div class="ms-fx" aria-hidden="true">' +
    '<span class="fx-rain"><span class="fx-umb"><svg viewBox="0 0 64 44"><path d="M3 26C5 12 17 4 32 4s27 8 29 22c-4-3-8-3-12 0-4-3-8-3-12 0-4-3-8-3-12 0-4-3-8-3-12 0-4-3-8-3-11 0z" fill="#7B61FF" stroke="#3A2B4A" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 26c1-9 5-18 12-22M44 26c-1-9-5-18-12-22" fill="none" stroke="#3A2B4A" stroke-width="2" opacity=".5"/><path d="M32 4v32c0 5-7 5-7 0" fill="none" stroke="#3A2B4A" stroke-width="2.8" stroke-linecap="round"/></svg></span>' +
    many(4, '', 'fx-drop') +
    '</span>' +
    '<span class="fx-sale">' +
    many(4, '%', 'fx-tag') +
    '</span>' +
    '<span class="fx-bonus">' +
    many(5, '', 'fx-coin') +
    '</span>' +
    '<span class="fx-love">' +
    many(5, heart, 'fx-heart') +
    '</span>' +
    '</div>' +
    '<div class="ms-emote" aria-hidden="true"></div></div></div>'
  );
}
// suasana Kabar Merpi & Musim Puncak: satu atribut di <body> mengatur warna tengah papan, latar halaman (diam,
// hanya berganti warna lembut) dan efek di sekitar Merpi; kosong = kembali ke default
// Masuk: data-amb dipasang → lapisan memudar masuk (transisi opacity). Keluar / berganti: data-amb lama DIPERTAHANKAN
// (pola tetap bergerak) sambil body.amb-leave memudarkan semuanya, baru setelah AMB_FADE dilepas / diganti.
const AMB_FADE = 1200;
let ambTimer = 0,
  ambWant = '';
function renderAmbience(S) {
  const b = document.body;
  const n = S && !S.over ? E.newsInfo(S) : null,
    peak = !!(S && !S.over && E.peakOn(S));
  const want = n ? n.id : peak ? 'peak' : '';
  b.classList.toggle('amb-peak', peak);
  const cur = b.dataset.amb || '';
  ambWant = want;
  if (cur === want) {
    if (b.classList.contains('amb-leave')) {
      clearTimeout(ambTimer);
      ambTimer = 0;
      b.classList.remove('amb-leave');
    }
    return;
  }
  if (!cur) {
    b.dataset.amb = want;
    return;
  }
  if (ambTimer) return; // sedang memudar keluar; tujuan terbaru dipakai saat selesai
  b.classList.add('amb-leave');
  ambTimer = setTimeout(
    () => {
      ambTimer = 0;
      if (ambWant) b.dataset.amb = ambWant;
      else delete b.dataset.amb;
      // satu frame dengan opacity 0 dulu supaya suasana baru memudar masuk, bukan muncul tiba-tiba
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!ambTimer) b.classList.remove('amb-leave');
        })
      );
    },
    reduceMotion() ? 0 : AMB_FADE
  );
}
const MS_ACTS = ['hop', 'droop', 'spin', 'fly', 'cheer', 'shake', 'peek'];
let msActT = null,
  msEmoT = null,
  msSleepT = null;
function mascotAct(act, ms) {
  const m = $('#mascot');
  if (!m || reduceMotion()) return;
  MS_ACTS.forEach(a => m.classList.remove('act-' + a));
  void m.offsetWidth;
  m.classList.add('act-' + act);
  clearTimeout(msActT);
  msActT = setTimeout(() => m.classList.remove('act-' + act), ms || 800);
}
function mascotEmote(html, ms) {
  const e = $('#mascot .ms-emote');
  if (!e) return;
  mascotWake();
  e.innerHTML = html;
  restart(e, 'show');
  clearTimeout(msEmoT);
  msEmoT = setTimeout(() => e.classList.remove('show'), ms || 1600);
}
// tertidur setelah 30 detik tanpa kejadian; bangun lagi saat ada kejadian atau diketuk
function mascotWake() {
  wakeCalm();
  const m = $('#mascot');
  if (!m) return;
  if (m.classList.contains('sleep')) {
    m.classList.remove('sleep');
    const mp = $('.merpi', m);
    if (mp) mp.classList.remove('is-sleep');
    const e = $('.ms-emote', m);
    if (e) e.classList.remove('show', 'zz');
  }
  clearTimeout(msSleepT);
  msSleepT = setTimeout(() => {
    const mm = $('#mascot');
    if (!mm || !App.S || App.S.over || merpiMood) return;
    mm.classList.add('sleep');
    const mp = $('.merpi', mm);
    if (mp) mp.classList.add('is-sleep');
    const e = $('.ms-emote', mm);
    if (e) {
      e.innerHTML = '<span class="ms-zz">z<i>z</i><b>Z</b></span>';
      e.classList.add('show', 'zz');
    }
  }, 30000);
}
// gelembung kata di atas kepala Merpi besar: 2D di atas papan (teks tetap tajam & seukuran, tidak ikut
// kemiringan/skala kamera), posisinya mengikuti Merpi tiap frame selama tampil. Gelembung selalu di dalam
// area tengah papan (tidak menutupi petak) dan tidak menutupi Merpi: batasnya trapesium dari 4 titik sudut
// .center (.ctr-pt) yang sudah terproyeksi kamera, dipotong area papan yang terlihat; dicoba beberapa letak
// (atas-kanan, atas, atas-kiri, bawah kaki). Bila tidak ada yang muat (kamera mendekat ke pion),
// gelembung cukup menempel di tepi area terlihat.
let bubRaf = 0;
function trackBubble() {
  cancelAnimationFrame(bubRaf);
  const step = () => {
    const bub = $('#bubble'),
      body = $('#mascot .ms-body'),
      vp = $('#boardVP');
    if (!bub || !body || !vp || !bub.classList.contains('ms-say') || !bub.classList.contains('show')) return;
    const r = body.getBoundingClientRect(),
      v = vp.getBoundingClientRect(),
      ins = camInsets() || { top: 0, bot: 0 };
    const m = 8,
      pad = 8;
    const pt = k => {
      const e = $('#board .center .ctr-pt[data-c="' + k + '"]');
      if (!e) return null;
      const q = e.getBoundingClientRect();
      return { x: q.left - v.left, y: q.top - v.top };
    };
    const tl = pt('tl'),
      tr = pt('tr'),
      bl = pt('bl'),
      br = pt('br');
    const vTop = ins.top + m,
      vBot = v.height - ins.bot - m;
    // kotak Merpi (diciutkan sedikit: ujung sayap & ruang kosong SVG boleh tertutup)
    const mx = r.left - v.left,
      my = r.top - v.top,
      mw = r.width,
      mh = r.height;
    const mb = { l: mx + mw * 0.2, t: my + mh * 0.16, r: mx + mw * 0.8, b: my + mh * 0.95 };
    let bw = bub.offsetWidth,
      bh = bub.offsetHeight;
    let x = mx + mw * 0.6,
      y = my + mh * 0.16;
    let placed = false;
    if (tl && tr && bl && br) {
      const yMin = Math.max(tl.y + pad, vTop),
        yMax = Math.min(bl.y - pad, vBot);
      const span = yt => {
        const t = (yt - tl.y) / Math.max(1, bl.y - tl.y);
        return [Math.max(m, tl.x + (bl.x - tl.x) * t + pad), Math.min(v.width - m, tr.x + (br.x - tr.x) * t - pad)];
      };
      // lebar maksimum = lebar area tengah setinggi kepala Merpi
      const [hl, hr] = span(Math.max(yMin, my));
      if (hr - hl >= 110) {
        const maxW = Math.min(260, Math.floor(hr - hl));
        if (bub._mw !== maxW) {
          bub._mw = maxW;
          bub.style.maxWidth = maxW + 'px';
          bw = bub.offsetWidth;
          bh = bub.offsetHeight;
        }
        // kandidat (x kiri, y bawah gelembung): atas-kanan kepala, atas tengah, atas-kiri, di bawah kaki
        const cands = [
          [mx + mw * 0.58, my + mh * 0.16],
          [mx + mw / 2 - bw / 2, my + mh * 0.12],
          [mx + mw * 0.42 - bw, my + mh * 0.16],
          [mx + mw / 2 - bw / 2, my + mh + bh + 4],
        ];
        for (const [cx0, cy0] of cands) {
          if (cy0 - bh < yMin || cy0 > yMax) continue;
          const [xl, xr] = span(cy0 - bh);
          if (xr - xl < bw) continue;
          const cx = Math.max(xl, Math.min(xr - bw, cx0));
          const hit = cx < mb.r && cx + bw > mb.l && cy0 - bh < mb.b && cy0 > mb.t;
          if (hit) continue;
          x = cx;
          y = cy0;
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      if (bub._mw) {
        bub._mw = 0;
        bub.style.maxWidth = '';
        bw = bub.offsetWidth;
        bh = bub.offsetHeight;
      }
      x = Math.max(m, Math.min(v.width - bw - m, x));
      y = Math.max(vTop + bh, Math.min(vBot, y));
    }
    bub.style.left = x.toFixed(1) + 'px';
    bub.style.top = y.toFixed(1) + 'px';
    bubRaf = requestAnimationFrame(step);
  };
  step();
}
// menoleh ke petak: --lx -1 (kiri) .. 1 (kanan), --ly -1 (belakang/atas) .. 1 (depan/bawah)
function mascotLook(tile) {
  const m = $('#mascot'),
    b = $('#board');
  if (!m || !b) return;
  let lx = 0,
    ly = 0;
  if (tile != null) {
    const a = tileAnchor(tile),
      W = b.offsetWidth || 1,
      H = b.offsetHeight || 1;
    lx = Math.max(-1, Math.min(1, (a.x - W / 2) / (W * 0.36)));
    ly = Math.max(-1, Math.min(1, (a.y - H / 2) / (H * 0.36)));
  }
  m.style.setProperty('--lx', lx.toFixed(2));
  m.style.setProperty('--ly', ly.toFixed(2));
}
const fill = (s, S) => s.replace('{n}', S && S.players[S.turn.p] ? S.players[S.turn.p].name : '');

export {
  EMOTES,
  bindEmote,
  fill,
  mascotAct,
  mascotEmote,
  mascotHTML,
  mascotLook,
  mascotWake,
  merpiMood,
  merpiPoke,
  merpiSay,
  merpiTimer,
  pick,
  renderAmbience,
  sendEmote,
  showEmote,
  trackBubble,
};
