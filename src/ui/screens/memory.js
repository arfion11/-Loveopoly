/* LOVEOPOLY — layar › Kartu Kenangan: gambar recap 1080×1920 (ukuran Story) setelah permainan selesai,
   untuk dibagikan (Web Share API) atau disimpan. Kartu PRIBADI: tokoh utamanya pemain yang membuka (online: kursi
   sendiri; satu HP: bisa dipilih), juara bermahkota, yang lain dengan peringkat & statistiknya sendiri. */
import { Icons } from '../../assets/icons.js';
import { App, ART, TILES, fmt, esc, ic, $, $$, toast, safeImg, reduceMotion, avatarHTML } from '../core.js';
import { holderSeat, passport } from './passport.js';
import { goldEdition, levelInfo } from '../progress.js';
import { UI } from '../ns.js';
import { track } from '../../analytics.js';

const W = 1080,
  H = 1920;
// kartu selalu bertema terang (gambar untuk dibagikan, bukan bagian UI bertema)
const C = { ink: '#3A2148', ink2: '#6B4A78', brand: '#E0356F', gold: '#F2B416', paper: '#FFFDF8', line: '#F3CFDD' };
const FD = "'Fredoka', 'Nunito', system-ui, sans-serif";
const FB = "'Nunito', system-ui, sans-serif";
const SITE = 'loveopoly.web.app';
// ekspresi Merpi diatur kelas CSS; saat SVG dijadikan gambar, aturannya disisipkan sendiri
const MERPI_CSS =
  '.mp-eyes,.mp-blink,.mp-sweat{display:none}.mp-eyes-open{display:inline}' +
  '.is-love .mp-eyes-open,.is-happy .mp-eyes-open{display:none}.is-love .mp-eyes-love,.is-happy .mp-eyes-happy{display:inline}';

const loadImage = src =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
// SVG seni game → gambar tajam di ukuran tujuan. Diurai parser HTML dulu (atribut ganda → yang pertama dipakai,
// sama seperti di papan), lalu diserialisasi jadi XML valid (+ xmlns) dengan lebar/tinggi & CSS opsional.
function svgImage(svg, w, h, css) {
  const t = document.createElement('template');
  t.innerHTML = svg;
  const el = t.content.firstElementChild;
  el.setAttribute('width', w);
  el.setAttribute('height', h);
  if (css) {
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.textContent = css;
    el.prepend(st);
  }
  return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(el)));
}

function wrapLines(x, text, maxW, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const t = cur ? cur + ' ' + word : word;
    if (!cur || x.measureText(t).width <= maxW) cur = t;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, '') + '…';
  }
  return lines;
}
function fitText(x, text, font, size, maxW) {
  let s = size;
  do x.font = font.replace('{s}', s);
  while (x.measureText(text).width > maxW && --s > 18);
}
function shadowed(x, fn, blur = 30, y = 14, col = 'rgba(90, 30, 70, 0.16)') {
  x.save();
  x.shadowColor = col;
  x.shadowBlur = blur;
  x.shadowOffsetY = y;
  fn();
  x.restore();
}
function crown(x, cx, cy, size) {
  const p = new Path2D(Icons.paths.crown);
  const k = size / 24;
  x.save();
  x.translate(cx - size / 2, cy - size / 2);
  x.scale(k, k);
  x.lineJoin = 'round';
  x.lineCap = 'round';
  x.fillStyle = '#FFD54A';
  x.strokeStyle = '#B9860B';
  x.lineWidth = 1.8;
  x.fill(p);
  x.stroke(p);
  x.restore();
}

/** Data kartu untuk pemain pi: posisi akhir, kota & foto miliknya (didahulukan), statistik, peringkat. */
function cardData(S, info, pi) {
  const o = S.over;
  const me = S.players[pi];
  const ranking = (o.ranking || S.players.map(p => p.i)).map(i => ({ p: S.players[i], worth: o.worth ? o.worth[i] : 0 }));
  const rank = ranking.findIndex(r => r.p.i === pi) + 1;
  const mine = S.tiles
    .map((t, i) => ({ t, i, d: TILES[i] }))
    .filter(x => x.t.owner === pi && (x.d.type === 'city' || x.d.type === 'spot'))
    .sort((a, b) => (b.d.price || 0) - (a.d.price || 0));
  // foto bukti: milik pemain ini dulu, lalu yang disahkan, terbaru dulu
  const photos = (S.photos || [])
    .filter(ph => safeImg(ph.img))
    .slice()
    .reverse()
    .sort((a, b) => Number(b.p === pi) - Number(a.p === pi) || Number(!!b.ok) - Number(!!a.ok))
    .slice(0, 2);
  // pesan romantis: milik pemain ini bila ada, selain itu pesan yang tampil di layar menang
  const words = me.msg ? { msg: me.msg, author: me } : { msg: info.msg, author: info.author };
  const st = me.stats || {};
  const stats = [
    ['🪙', me.bankrupt ? 'Bangkrut' : 'Aset ' + fmt(o.worth ? o.worth[pi] : 0)],
    ['🏙️', mine.length + ' kota'],
    ['🎯', (st.challenges || 0) + ' tantangan'],
    ['💗', 'Love ' + (me.love || 0)],
  ];
  return {
    o,
    me,
    pi,
    rank,
    winner: pi === o.winner,
    w: S.players[o.winner],
    owned: mine.slice(0, 6),
    photos,
    ranking,
    stats,
    reason: info.reason,
    ...words,
  };
}

/** Pemain bawaan kartu: online = kursi sendiri; satu HP = pemegang Paspor, lalu pemain manusia terbaik. */
function defaultViewer(S) {
  if (App.mode === 'online' && S.players[App.seat]) return App.seat;
  const humans = (S.over.ranking || S.players.map(p => p.i)).map(i => S.players[i]).filter(p => p.kind === 'human');
  const pp = passport();
  const holder = pp.name && humans.find(p => p.name.trim().toLowerCase() === pp.name.trim().toLowerCase());
  return (holder || humans[0] || S.players[S.over.winner]).i;
}

// Edisi Emas: hanya kartu milik pemegang paspor perangkat ini yang sudah Lv 5+, punya lencana Emas, atau rekor
// Api Cinta ≥ 4 minggu (progress.js goldEdition). Digambar sekali saat kartu dibuat: tanpa beban selama main.
function goldFor(S, pi) {
  const pp = passport();
  if (pi !== holderSeat(S, pp) || !goldEdition(pp)) return null;
  const lv = levelInfo(pp.xp);
  return { L: lv.L, title: lv.title };
}
// bingkai foil (di BAWAH isi kartu) — kaki kartu Edisi Emas naik 16 px supaya tombol ajakan tidak menabrak bingkai
function goldBorder(x) {
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#FFF3C4');
  g.addColorStop(0.22, '#E0A93A');
  g.addColorStop(0.45, '#FFF0B0');
  g.addColorStop(0.7, '#C48A10');
  g.addColorStop(1, '#FFE08A');
  x.save();
  x.strokeStyle = g;
  x.lineWidth = 18;
  x.beginPath();
  x.roundRect(26, 26, W - 52, H - 52, 58);
  x.stroke();
  x.lineWidth = 3;
  x.globalAlpha = 0.85;
  x.beginPath();
  x.roundRect(52, 52, W - 104, H - 104, 40);
  x.stroke();
  x.globalAlpha = 1;
  // kilau bintang di ruang kosong (bukan di dekat kaki/tombol ajakan)
  x.fillStyle = '#F7D47A';
  [
    [80, 80, 16],
    [150, 62, 8],
    [40, 760, 12],
    [W - 40, 1180, 12],
  ].forEach(([cx, cy, r]) => {
    x.beginPath();
    x.moveTo(cx, cy - r);
    x.quadraticCurveTo(cx, cy, cx + r, cy);
    x.quadraticCurveTo(cx, cy, cx, cy + r);
    x.quadraticCurveTo(cx, cy, cx - r, cy);
    x.quadraticCurveTo(cx, cy, cx, cy - r);
    x.fill();
  });
  x.restore();
}
// pita "EDISI EMAS" di sudut kanan atas (di ATAS isi kartu)
function goldRibbon(x) {
  x.save();
  x.translate(W - 150, 150);
  x.rotate(Math.PI / 4);
  const rb = x.createLinearGradient(-200, 0, 200, 0);
  rb.addColorStop(0, '#C48A10');
  rb.addColorStop(0.5, '#FFE08A');
  rb.addColorStop(1, '#C48A10');
  x.fillStyle = rb;
  x.fillRect(-200, -30, 400, 60);
  x.fillStyle = '#5A3A00';
  x.font = '800 26px ' + FB;
  x.textAlign = 'center';
  x.fillText('EDISI EMAS', 0, 9);
  x.restore();
}

async function drawCard(S, info, pi) {
  const d = cardData(S, info, pi == null ? defaultViewer(S) : pi);
  d.gold = goldFor(S, d.pi);
  const fonts = ['700 64px Fredoka', '600 84px Fredoka', '800 40px Nunito', 'italic 600 42px Nunito', '700 32px Nunito'];
  await Promise.all(fonts.map(f => document.fonts.load(f).catch(() => null)));
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const x = cv.getContext('2d');
  x.textBaseline = 'alphabetic';

  // latar: gradasi permen + lingkaran lembut
  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#FFF6FA');
  bg.addColorStop(0.55, '#FFE4EF');
  bg.addColorStop(1, '#EFE4FF');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  const fy = d.gold ? 16 : 0;
  [
    [930, 300, 260, 'rgba(255, 158, 196, 0.22)'],
    [120, 1250, 300, 'rgba(183, 156, 255, 0.18)'],
    [980, 1640, 220, 'rgba(255, 213, 74, 0.16)'],
  ].forEach(([cx, cy, r, col]) => {
    x.fillStyle = col;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  });
  if (d.gold) goldBorder(x);

  // merek
  const [logo, merpi] = await Promise.all([
    loadImage('/icon.svg').catch(() => null),
    svgImage(ART.merpi(d.winner ? 'is-love' : 'is-happy'), 230, 230, MERPI_CSS),
  ]);
  x.font = '700 64px ' + FD;
  const brandW = x.measureText('Loveopoly').width + 96;
  const bx = (W - brandW) / 2;
  if (logo) x.drawImage(logo, bx, 82, 76, 76);
  x.fillStyle = C.brand;
  x.textAlign = 'left';
  x.fillText('Loveopoly', bx + 96, 142);
  x.textAlign = 'center';
  x.fillStyle = d.gold ? '#9A6A00' : C.ink2;
  x.font = '800 30px ' + FB;
  x.fillText(d.gold ? 'EDISI EMAS · LV ' + d.gold.L + ' ' + d.gold.title.toUpperCase() : 'KENANGAN KELILING DUNIA', W / 2, 206);

  // tata letak vertikal: hitung tinggi isi dulu (bagian bawah gugur bila tidak muat: foto > kota > peringkat),
  // lalu letakkan di tengah ruang antara judul & kaki supaya tidak ada ruang kosong besar
  x.font = 'italic 600 40px ' + FB;
  const lines = wrapLines(x, '“' + d.msg + '”', 790, 4);
  const mh = 64 + lines.length * 54 + (d.author ? 48 : 0);
  const TOP = 218,
    FOOT = H - 196,
    PH = 372,
    TS = 112;
  let need = 182 + 430 + mh + 46; // puncak mahkota/peringkat → bawah kartu pesan (+ jarak)
  const plan = { photos: false, cities: false, rank: false };
  if (d.photos.length && TOP + need + PH + 20 < FOOT) {
    plan.photos = true;
    need += PH + 34;
  }
  if (d.owned.length && TOP + need + TS + 84 < FOOT) {
    plan.cities = true;
    need += TS + 96;
  }
  if (TOP + need + 56 < FOOT) {
    plan.rank = true;
    need += 64;
  }
  const shift = Math.max(0, Math.floor((FOOT - TOP - need) / 2));

  // tokoh utama: pemain ini (juara bermahkota, yang lain dengan pita peringkat) + Merpi
  const ay = TOP + 182 + shift;
  shadowed(x, () => {
    x.fillStyle = '#FFFFFF';
    x.beginPath();
    x.arc(W / 2, ay, 116, 0, Math.PI * 2);
    x.fill();
  });
  x.lineWidth = 13;
  x.strokeStyle = d.me.color || C.brand;
  x.beginPath();
  x.arc(W / 2, ay, 110, 0, Math.PI * 2);
  x.stroke();
  x.font = '128px ' + FB;
  x.textBaseline = 'middle';
  x.fillText(d.me.avatar || '💕', W / 2, ay + 8);
  x.textBaseline = 'alphabetic';
  if (d.winner) crown(x, W / 2, ay - 138, 88);
  else {
    const label = d.me.bankrupt ? 'BANGKRUT' : 'PERINGKAT ' + d.rank + ' DARI ' + d.ranking.length;
    x.font = '800 28px ' + FB;
    const pw = x.measureText(label).width + 56;
    x.fillStyle = d.me.bankrupt ? '#B8282E' : C.ink;
    x.beginPath();
    x.roundRect((W - pw) / 2, ay - 178, pw, 50, 25);
    x.fill();
    x.fillStyle = '#FFFFFF';
    x.fillText(label, W / 2, ay - 143);
  }
  x.drawImage(merpi, W / 2 + 108, ay - 50, 210, 210);

  x.fillStyle = C.ink;
  fitText(x, d.me.name, '600 {s}px ' + FD, 80, W - 160);
  x.fillText(d.me.name, W / 2, ay + 206);
  x.fillStyle = C.brand;
  x.font = '800 38px ' + FB;
  x.fillText(d.o.titles[d.pi] || (d.winner ? 'Juragan Cinta' : 'Penjelajah Cinta'), W / 2, ay + 264);
  x.fillStyle = C.ink2;
  const sub = d.winner ? d.reason : 'Juara kali ini: ' + d.w.name;
  fitText(x, sub, '700 {s}px ' + FB, 30, W - 160);
  x.fillText(sub, W / 2, ay + 312);

  // statistik pribadi: empat pil
  x.font = '800 26px ' + FB;
  const pills = d.stats.map(([e, t]) => ({ t: e + ' ' + t, w: x.measureText(e + ' ' + t).width + 36 }));
  const gapP = 12;
  let total = pills.reduce((a, b) => a + b.w, 0) + gapP * (pills.length - 1);
  const k = Math.min(1, (W - 140) / total);
  total *= k;
  let px = (W - total) / 2;
  pills.forEach(pl => {
    const w = pl.w * k;
    x.fillStyle = 'rgba(255, 255, 255, 0.78)';
    x.beginPath();
    x.roundRect(px, ay + 340, w, 52, 26);
    x.fill();
    x.fillStyle = C.ink;
    fitText(x, pl.t, '800 {s}px ' + FB, 26, w - 20);
    x.fillText(pl.t, px + w / 2, ay + 375);
    px += w + gapP * k;
  });

  // pesan romantis di kertas
  x.font = 'italic 600 40px ' + FB;
  const my = ay + 430;
  shadowed(x, () => {
    x.fillStyle = C.paper;
    x.beginPath();
    x.roundRect(110, my, W - 220, mh, 34);
    x.fill();
  });
  x.strokeStyle = C.line;
  x.lineWidth = 3;
  x.beginPath();
  x.roundRect(110, my, W - 220, mh, 34);
  x.stroke();
  x.fillStyle = C.ink;
  lines.forEach((l, k) => x.fillText(l, W / 2, my + 72 + k * 54));
  if (d.author) {
    x.fillStyle = C.brand;
    x.font = '700 30px ' + FB;
    x.fillText('— ' + d.author.name, W / 2, my + 72 + lines.length * 54 + 18);
  }
  let y = my + mh + 46;

  // foto bukti (polaroid)
  if (plan.photos) {
    const imgs = await Promise.all(d.photos.map(ph => loadImage(safeImg(ph.img)).catch(() => null)));
    const n = imgs.filter(Boolean).length;
    let k = 0;
    d.photos.forEach((ph, i) => {
      const img = imgs[i];
      if (!img) return;
      const pw = 330,
        cx = n === 1 ? W / 2 : W / 2 + (k === 0 ? -190 : 190),
        rot = (k === 0 ? -4 : 4) * (Math.PI / 180);
      k++;
      x.save();
      x.translate(cx, y + PH / 2);
      x.rotate(rot);
      shadowed(x, () => {
        x.fillStyle = '#FFFFFF';
        x.fillRect(-pw / 2, -PH / 2, pw, PH);
      });
      const iw = pw - 32,
        ih = iw * 0.75;
      const s = Math.max(iw / img.width, ih / img.height);
      const sw = iw / s,
        sh = ih / s;
      x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, -iw / 2, -PH / 2 + 16, iw, ih);
      x.fillStyle = C.ink;
      x.textAlign = 'center';
      x.font = '700 24px ' + FB;
      const cap = wrapLines(x, ph.text || 'Foto bukti', iw, 2);
      cap.forEach((l, j) => x.fillText(l, 0, -PH / 2 + 16 + ih + 36 + j * 28));
      x.fillStyle = ph.ok ? '#1F7A4A' : '#B8282E';
      x.font = '800 22px ' + FB;
      x.fillText((ph.ok ? '✓ Disahkan' : '✗ Ditolak') + ' · Ronde ' + (ph.r || '-'), 0, PH / 2 - 18);
      x.restore();
    });
    y += PH + 34;
  }

  // kota yang dikuasai pemain ini
  if (plan.cities) {
    x.fillStyle = C.ink2;
    x.font = '800 28px ' + FB;
    fitText(x, 'KOTA ' + d.me.name.toUpperCase(), '800 {s}px ' + FB, 28, W - 200);
    x.fillText('KOTA ' + d.me.name.toUpperCase(), W / 2, y + 24);
    const gap = 18,
      total = d.owned.length * TS + (d.owned.length - 1) * gap;
    const arts = await Promise.all(d.owned.map(o => svgImage(ART.art(o.d.art), TS - 22, TS - 22).catch(() => null)));
    d.owned.forEach((o, i) => {
      const tx = (W - total) / 2 + i * (TS + gap),
        ty = y + 44;
      shadowed(
        x,
        () => {
          x.fillStyle = '#FFFFFF';
          x.beginPath();
          x.roundRect(tx, ty, TS, TS, 24);
          x.fill();
        },
        16,
        7
      );
      x.strokeStyle = d.me.color || C.brand;
      x.lineWidth = 5;
      x.beginPath();
      x.roundRect(tx, ty, TS, TS, 24);
      x.stroke();
      if (arts[i]) x.drawImage(arts[i], tx + 11, ty + 9, TS - 22, TS - 22);
      x.fillStyle = C.ink;
      fitText(x, o.d.short || o.d.name, '700 {s}px ' + FB, 22, TS + gap - 4);
      x.fillText(o.d.short || o.d.name, tx + TS / 2, ty + TS + 30);
    });
    y += TS + 96;
  }

  // peringkat: satu baris medali
  if (plan.rank) {
    const medal = ['🥇', '🥈', '🥉', '4.'];
    const text = d.ranking.map((r, i) => medal[i] + ' ' + r.p.avatar + ' ' + r.p.name).join('   ');
    x.fillStyle = 'rgba(255, 255, 255, 0.7)';
    x.beginPath();
    x.roundRect(110, y, W - 220, 64, 32);
    x.fill();
    x.fillStyle = C.ink;
    fitText(x, text, '700 {s}px ' + FB, 30, W - 280);
    x.fillText(text, W / 2, y + 43);
  }

  // kaki: ronde, tanggal, ajakan main
  x.fillStyle = C.ink2;
  x.font = '700 30px ' + FB;
  const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  x.fillText(d.o.round + ' ronde · ' + date, W / 2, H - 150 - fy);
  const cta = 'Main gratis bareng pasangan & teman · ' + SITE;
  x.font = '800 30px ' + FB;
  const cw = x.measureText(cta).width + 80;
  x.fillStyle = C.brand;
  x.beginPath();
  x.roundRect((W - cw) / 2, H - 112 - fy, cw, 70, 35);
  x.fill();
  x.fillStyle = '#FFFFFF';
  x.fillText(cta, W / 2, H - 66 - fy);

  if (d.gold) goldRibbon(x);

  const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) throw new Error('canvas kosong');
  return { blob, data: d };
}

let closeMem = null;
/** Buka pratinjau Kartu Kenangan (overlay di atas layar menang). info: { reason, msg, author } dari layar menang. */
async function openMemoryCard(S, info) {
  if (!S || !S.over || $('#memOv')) return;
  let pi = defaultViewer(S);
  // satu HP dengan beberapa pemain manusia: pilih kartu siapa (online: selalu kursi sendiri)
  const choices = App.mode === 'online' ? [] : S.players.filter(p => p.kind === 'human');
  const picker =
    choices.length > 1
      ? '<div class="mem-who"><span class="label" id="memWhoL">Kartu untuk</span><div class="partner-pick" role="group" aria-labelledby="memWhoL">' +
        choices
          .map(
            p =>
              '<button type="button" data-mp="' +
              p.i +
              '" aria-pressed="' +
              (p.i === pi) +
              '">' +
              avatarHTML(p, 'xs') +
              esc(p.name) +
              '</button>'
          )
          .join('') +
        '</div></div>'
      : '';
  const ov = document.createElement('div');
  ov.className = 'overlay mem-ov';
  ov.id = 'memOv';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'memT');
  ov.innerHTML =
    '<div class="mem-card"><div class="mem-head"><h2 id="memT">' +
    ic('polaroid') +
    'Kartu Kenangan <span class="mem-gold" id="memGold" hidden>' +
    ic('sparkle') +
    'Edisi Emas</span></h2><button type="button" class="icon-btn" id="memClose" aria-label="Tutup">' +
    ic('x') +
    '</button></div>' +
    picker +
    '<div class="mem-prev"></div>' +
    '<p class="mem-note muted">Bagikan ke Story atau chat. Foto bukti ikut tampil, jadi pastikan semua pemain nyaman.</p>' +
    '<div class="mem-foot"><button type="button" class="btn soft" id="memSave" disabled>' +
    ic('download') +
    '<span>Simpan</span></button><button type="button" class="btn primary" id="memShare" disabled>' +
    ic('share') +
    '<span>Bagikan</span></button></div></div>';
  ($('#overlayRoot') || document.body).appendChild(ov);
  let url = '',
    file = null,
    seq = 0,
    canShare = null;
  const name = 'kenangan-loveopoly-' + new Date().toISOString().slice(0, 10) + '.jpg';
  const prev = $('.mem-prev', ov),
    save = $('#memSave', ov),
    share = $('#memShare', ov);
  const key = e => {
    if (e.key === 'Escape') close();
  };
  const close = () => {
    document.removeEventListener('keydown', key);
    closeMem = null;
    seq++;
    UI.leave(ov);
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    const b = $('#wShare');
    if (b) b.focus({ preventScroll: true });
  };
  closeMem = close;
  document.addEventListener('keydown', key);
  ov.addEventListener('click', e => {
    if (e.target === ov) close();
  });
  $('#memClose', ov).onclick = close;
  setTimeout(() => $('#memClose', ov) && $('#memClose', ov).focus({ preventScroll: true }), reduceMotion() ? 0 : 60);

  save.onclick = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Kartu Kenangan tersimpan.', { kind: 'good', icon: 'check' });
    track('memory_card', { action: 'save' });
  };
  share.onclick = async () => {
    if (!file) return;
    try {
      await navigator.share({
        files: [file],
        title: 'Kenangan Loveopoly',
        text: 'Kami baru selesai keliling dunia di Loveopoly 💕 Main gratis: https://' + SITE,
      });
      track('memory_card', { action: 'share' });
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('Gagal membagikan. Coba Simpan lalu kirim manual.', { kind: 'err' });
    }
  };

  async function render() {
    const my = ++seq;
    prev.setAttribute('aria-busy', 'true');
    prev.innerHTML = '<div class="spinner"></div><span class="muted">Menyiapkan kartu…</span>';
    save.disabled = share.disabled = true;
    let res;
    try {
      res = await drawCard(S, info, pi);
    } catch (e) {
      console.warn('kartu kenangan gagal dibuat', e);
      if (my === seq) prev.innerHTML = '<span class="muted">Kartu belum bisa dibuat di browser ini.</span>';
      return;
    }
    if (my !== seq || !ov.isConnected) return;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(res.blob);
    file = new File([res.blob], name, { type: 'image/jpeg' });
    const d = res.data;
    prev.removeAttribute('aria-busy');
    const gb = $('#memGold', ov);
    if (gb) gb.hidden = !d.gold;
    prev.innerHTML =
      '<img src="' +
      url +
      '" alt="Kartu Kenangan ' +
      esc(d.me.name) +
      ': ' +
      (d.winner ? 'juara' : 'peringkat ' + d.rank + ' dari ' + d.ranking.length) +
      ', ' +
      esc(d.o.titles[d.pi] || 'Penjelajah Cinta') +
      ', ' +
      esc(d.stats.map(st => st[1]).join(', ')) +
      '">';
    save.disabled = false;
    if (canShare == null) canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    share.hidden = !canShare;
    share.disabled = !canShare;
    track('memory_card', { action: 'open', winner: d.winner, rank: d.rank, photos: (S.photos || []).length });
  }
  $$('[data-mp]', ov).forEach(b =>
    b.addEventListener('click', () => {
      const v = Number(b.dataset.mp);
      if (v === pi) return;
      pi = v;
      $$('[data-mp]', ov).forEach(x => x.setAttribute('aria-pressed', String(Number(x.dataset.mp) === pi)));
      render();
    })
  );
  await render();
  if (ov.isConnected) (canShare ? share : save).focus({ preventScroll: true });
}
const closeMemoryCard = () => closeMem && closeMem();

export { openMemoryCard, closeMemoryCard, drawCard };
