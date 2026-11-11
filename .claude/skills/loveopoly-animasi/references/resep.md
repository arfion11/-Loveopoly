# Resep animasi ringan

Semua resep: progresif (browser lama = langsung tanpa animasi), mati saat gerak dikurangi, sekali jalan.

## 1. Transisi layar (View Transitions API)

Browser modern (Chrome/Edge 111+, Safari 18+, Firefox terbaru) bisa menganimasikan perpindahan layar di kompositor.

```js
// src/ui/screens/base.js — bungkus pergantian layar
function swapScreen(update) {
  if (!document.startViewTransition || UI.reduceMotion() || document.body.classList.contains('lowp')) return update();
  document.startViewTransition(update);
}
```

```css
/* elemen bersama berpindah mulus: kartu mode → kepala setup, kartu paspor → buku paspor */
.mode-card.mc-ai { view-transition-name: mode-ai; }
.setup-head      { view-transition-name: mode-ai; } /* hanya satu elemen bernama sama yang terlihat per waktu */
::view-transition-old(root), ::view-transition-new(root) { animation-duration: 0.28s; }
```

Catatan: selama transisi halaman tidak bisa disentuh → durasi pendek (≤ 350 ms). Jangan dipakai untuk pembaruan papan
saat bermain (renderStage sering). Uji axe & fokus setelah transisi.

## 2. Kamera sinematik di momen besar

Kamera 3D sudah ada (`src/ui/core/camera.js`: translate → rotateX(tilt) → scale3d → translate(-fokus)). Momen besar
(landmark berdiri, ancaman/menang instan, Momen Berdua, akhir game) bisa memakai "dorong & putar sedikit":

- target: fokus ke petak, skala ×1,15–1,25, `rotateZ` ±4–6°, durasi 1–1,5 dtk, lalu kembali ke `fit3d()`.
- tambah sebagai fungsi `cinematic(tile, ms)` di camera.js yang menyetel variabel CSS lalu kembali; jangan
  bentrok dengan `auto3d()` (Sorot langkah HP) — kunci lewat flag selama momen.
- matikan di gerak dikurangi & Hemat baterai; di mode "Semua" kamera kembali diam setelahnya.

## 3. Koin terbang melengkung

Untuk tol/gaji/hadiah: 3–6 koin kecil (`<i class="coin-fly">`) dari posisi token pembayar ke penerima.

```css
.coin-fly { position: absolute; animation: coinArc var(--ms, 700ms) cubic-bezier(.3,.7,.4,1) both; }
@keyframes coinArc {
  0%   { transform: translate(var(--x0), var(--y0)) scale(.6); opacity: 0; }
  15%  { opacity: 1; }
  50%  { transform: translate(var(--xm), var(--ym)) scale(1); }   /* titik puncak lengkung */
  100% { transform: translate(var(--x1), var(--y1)) scale(.7); opacity: 0; }
}
```

Posisi dari `tokenXY()` (pieces.js); jeda antar koin 60–80 ms; hapus elemen di `animationend`. Maks 6 koin.

## 4. Pegas tanpa JavaScript (CSS `linear()`)

`linear()` (Chrome 113+, Safari 17.2+, Firefox 112+) memberi pantulan alami:

```css
:root {
  --spring: cubic-bezier(.2, 1.2, .4, 1); /* cadangan */
}
@supports (transition-timing-function: linear(0, 1)) {
  :root {
    --spring: linear(0, .24 7.6%, .64 17.1%, .93 27.4%, 1.06 36.7%, 1.09 44.5%, 1.03 60.4%, .99 76.6%, 1);
  }
}
.modal { animation-timing-function: var(--spring); }
```

Pakai untuk muncul dialog, pion mendarat, kartu naik — jangan untuk hiasan berulang.

## 5. Suasana acara baru

Ikuti pola Kabar Merpi/Momen Berdua: `renderAmbience(S)` memilih `body[data-amb]`; pola latar `.sky-a/.sky-b`
(transform saja, lapisan lebih besar satu ubin), properti kecil dekat Merpi di `.ms-fx/.ms-orbit`; hilang/berganti
memudar lewat `body.amb-leave` (opacity) — jangan animasikan opacity di lapisan suasana. Daftarkan di `power.css`.
