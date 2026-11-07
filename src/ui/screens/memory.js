/* LOVEOPOLY — layar › Kartu Kenangan: gambar recap 1080×1920 (ukuran Story) setelah permainan selesai,
   untuk dibagikan (Web Share API) atau disimpan. Digambar di canvas dari seni & font game sendiri. */
import { Icons } from '../../assets/icons.js';
import { ART, TILES, esc, ic, $, toast, safeImg, reduceMotion } from '../core.js';
import { UI } from '../ns.js';

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
  '.is-love .mp-eyes-open{display:none}.is-love .mp-eyes-love{display:inline}';

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

/** Data kartu dari state akhir: pemenang, kota, foto terbaik, peringkat. */
function cardData(S, info) {
  const o = S.over;
  const w = S.players[o.winner];
  const owned = S.tiles
    .map((t, i) => ({ t, i, d: TILES[i] }))
    .filter(x => x.t.owner === o.winner && (x.d.type === 'city' || x.d.type === 'spot'))
    .sort((a, b) => (b.d.price || 0) - (a.d.price || 0))
    .slice(0, 6);
  const photos = (S.photos || [])
    .filter(ph => safeImg(ph.img))
    .slice()
    .reverse()
    .sort((a, b) => Number(!!b.ok) - Number(!!a.ok))
    .slice(0, 2);
  const ranking = (o.ranking || S.players.map(p => p.i)).map(i => ({
    p: S.players[i],
    worth: o.worth ? o.worth[i] : 0,
    title: o.titles[i],
  }));
  return { o, w, owned, photos, ranking, ...info };
}

async function drawCard(S, info) {
  const d = cardData(S, info);
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

  // merek
  const [logo, merpi] = await Promise.all([loadImage('/icon.svg').catch(() => null), svgImage(ART.merpi('is-love'), 230, 230, MERPI_CSS)]);
  x.font = '700 64px ' + FD;
  const brandW = x.measureText('Loveopoly').width + 96;
  const bx = (W - brandW) / 2;
  if (logo) x.drawImage(logo, bx, 82, 76, 76);
  x.fillStyle = C.brand;
  x.textAlign = 'left';
  x.fillText('Loveopoly', bx + 96, 142);
  x.textAlign = 'center';
  x.fillStyle = C.ink2;
  x.font = '800 30px ' + FB;
  x.fillText('KENANGAN KELILING DUNIA', W / 2, 206);

  // pemenang: avatar bermahkota + Merpi
  const ay = 400;
  shadowed(x, () => {
    x.fillStyle = '#FFFFFF';
    x.beginPath();
    x.arc(W / 2, ay, 116, 0, Math.PI * 2);
    x.fill();
  });
  x.lineWidth = 13;
  x.strokeStyle = d.w.color || C.brand;
  x.beginPath();
  x.arc(W / 2, ay, 110, 0, Math.PI * 2);
  x.stroke();
  x.font = '128px ' + FB;
  x.textBaseline = 'middle';
  x.fillText(d.w.avatar || '💕', W / 2, ay + 8);
  x.textBaseline = 'alphabetic';
  crown(x, W / 2, ay - 138, 88);
  x.drawImage(merpi, W / 2 + 108, ay - 50, 210, 210);

  x.fillStyle = C.ink;
  fitText(x, d.w.name, '600 {s}px ' + FD, 80, W - 160);
  x.fillText(d.w.name, W / 2, 606);
  x.fillStyle = C.brand;
  x.font = '800 38px ' + FB;
  x.fillText(d.o.titles[d.o.winner] || 'Juragan Cinta', W / 2, 664);
  x.fillStyle = C.ink2;
  fitText(x, d.reason, '700 {s}px ' + FB, 30, W - 160);
  x.fillText(d.reason, W / 2, 712);

  // pesan romantis di kertas
  x.font = 'italic 600 40px ' + FB;
  const lines = wrapLines(x, '“' + d.msg + '”', 790, 4);
  const mh = 64 + lines.length * 54 + (d.author ? 48 : 0);
  const my = 752;
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
  const FOOT = H - 196;

  // foto bukti (polaroid)
  const PH = 372;
  if (d.photos.length && y + PH + 20 < FOOT) {
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

  // kota yang dikuasai pemenang
  const TS = 112;
  if (d.owned.length && y + TS + 84 < FOOT) {
    x.fillStyle = C.ink2;
    x.font = '800 28px ' + FB;
    fitText(x, 'KOTA ' + d.w.name.toUpperCase(), '800 {s}px ' + FB, 28, W - 200);
    x.fillText('KOTA ' + d.w.name.toUpperCase(), W / 2, y + 24);
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
      x.strokeStyle = d.w.color || C.brand;
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
  if (y + 56 < FOOT) {
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
  x.fillText(d.o.round + ' ronde · ' + date, W / 2, H - 150);
  const cta = 'Main gratis bareng pasangan & teman · ' + SITE;
  x.font = '800 30px ' + FB;
  const cw = x.measureText(cta).width + 80;
  x.fillStyle = C.brand;
  x.beginPath();
  x.roundRect((W - cw) / 2, H - 112, cw, 70, 35);
  x.fill();
  x.fillStyle = '#FFFFFF';
  x.fillText(cta, W / 2, H - 66);

  const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) throw new Error('canvas kosong');
  return { blob, data: d };
}

let closeMem = null;
/** Buka pratinjau Kartu Kenangan (overlay di atas layar menang). info: { reason, msg, author } dari layar menang. */
async function openMemoryCard(S, info) {
  if (!S || !S.over || $('#memOv')) return;
  const ov = document.createElement('div');
  ov.className = 'overlay mem-ov';
  ov.id = 'memOv';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'memT');
  ov.innerHTML =
    '<div class="mem-card"><h2 id="memT">' +
    ic('polaroid') +
    'Kartu Kenangan</h2><div class="mem-prev" aria-busy="true"><div class="spinner"></div><span class="muted">Menyiapkan kartu…</span></div>' +
    '<p class="mem-note muted">Bagikan ke Story atau chat. Foto bukti ikut tampil, jadi pastikan semua pemain nyaman.</p>' +
    '<div class="mem-foot"><button type="button" class="btn ghost" id="memClose">' +
    ic('x') +
    '<span>Tutup</span></button><button type="button" class="btn soft" id="memSave" disabled>' +
    ic('download') +
    '<span>Simpan</span></button><button type="button" class="btn primary" id="memShare" disabled>' +
    ic('share') +
    '<span>Bagikan</span></button></div></div>';
  ($('#overlayRoot') || document.body).appendChild(ov);
  let url = '';
  const key = e => {
    if (e.key === 'Escape') close();
  };
  const close = () => {
    document.removeEventListener('keydown', key);
    closeMem = null;
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

  let res;
  try {
    res = await drawCard(S, info);
  } catch (e) {
    console.warn('kartu kenangan gagal dibuat', e);
    $('.mem-prev', ov).innerHTML = '<span class="muted">Kartu belum bisa dibuat di browser ini.</span>';
    return;
  }
  if (!ov.isConnected) return;
  url = URL.createObjectURL(res.blob);
  const name = 'kenangan-loveopoly-' + new Date().toISOString().slice(0, 10) + '.jpg';
  const file = new File([res.blob], name, { type: 'image/jpeg' });
  const prev = $('.mem-prev', ov);
  prev.removeAttribute('aria-busy');
  prev.innerHTML =
    '<img src="' +
    url +
    '" alt="Kartu Kenangan: ' +
    esc(res.data.w.name) +
    ' menang sebagai ' +
    esc(res.data.o.titles[res.data.o.winner] || 'Juragan Cinta') +
    ', ' +
    esc(res.data.reason) +
    '">';
  const save = $('#memSave', ov),
    share = $('#memShare', ov);
  save.disabled = false;
  save.onclick = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Kartu Kenangan tersimpan.', { kind: 'good', icon: 'check' });
  };
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  if (!canShare) share.hidden = true;
  else {
    share.disabled = false;
    share.onclick = async () => {
      try {
        await navigator.share({
          files: [file],
          title: 'Kenangan Loveopoly',
          text: 'Kami baru selesai keliling dunia di Loveopoly 💕 Main gratis: https://' + SITE,
        });
      } catch (e) {
        if (e && e.name !== 'AbortError') toast('Gagal membagikan. Coba Simpan lalu kirim manual.', { kind: 'err' });
      }
    };
  }
  (canShare ? share : save).focus({ preventScroll: true });
}
const closeMemoryCard = () => closeMem && closeMem();

export { openMemoryCard, closeMemoryCard, drawCard };
