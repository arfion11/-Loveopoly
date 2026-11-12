# Resep animasi ringan

Semua resep: progresif (browser lama = langsung tanpa animasi), mati saat gerak dikurangi, sekali jalan.

## 1. Transisi layar (sudah dipakai: `show(id, shared)` di `src/ui/screens/base.js`)

**Jangan pakai View Transitions API untuk pindah layar.** Sudah dicoba (Nov 2026): selama transisi ±0,45 dtk, titik
ketuk mengenai `<html>` di Chromium **dan** WebKit (`document.elementFromPoint` → HTML), jadi tombol di layar baru
tertelan — `::view-transition { pointer-events: none }` tidak menolong. Selain itu pergantian DOM jadi tertunda satu
frame (kode yang mengecek `.hidden` keliru; pakai `activeScreen()`), dan grup bernama selalu tergambar di atas root
(latar layar penuh yang diberi nama menutupi isi).

Pola yang dipakai sekarang — sinkron, langsung bisa disentuh:

- Pergantian layar tetap sinkron. Layar baru diberi `.scr-pre` (opacity 0) → pemanggil mengisi layar → di
  `requestAnimationFrame` kotak judul tujuan **diukur dulu**, baru `.scr-in`/`.scr-back` dipasang (naik + pegas,
  transform/opacity). Mengukur setelah kelas animasi terpasang membuat judul mendarat ±25 px meleset.
- Judul bersama dengan FLIP: salinan judul tujuan (`.title-fly`, `position: fixed`, `pointer-events: none`, gaya font
  disalin dari `getComputedStyle`) dianimasikan WAAPI dari kotak asal ke kotak tujuan; judul asli `opacity: 0` selama
  terbang; dibersihkan di `onfinish`/`oncancel` + `setTimeout` pengaman.
- Lewati semuanya saat gerak dikurangi / Hemat baterai / dari-ke layar game.
- Uji: ketukan `force` di tengah transisi harus mengenai layar baru (`test/flows.js`).

## 2. Kamera sinematik di momen besar (sudah dipakai: `camCinema(tile, opt)` di `src/ui/core/camera.js`)

- Zoom in & out modern, **tanpa putaran** (Nov 2026: meja putar `rotateZ` diganti atas permintaan pemilik produk).
  `App.cam.cine = { fx, fy, k }` didahulukan `apply3d(anim, ms, ease)`: skala `fit + (1 − fit)·k`, fokus ke petak
  (null = tengah papan), titik fokus di 70% tinggi area (di bawah banner momen yang ada di 34–40%). Tiga fase:
  masuk `inMs` dengan pegas `CINE_IN` (`linear()` sedikit lewat ±4% lalu diam; cadangan `cubic-bezier(.22,1.2,.36,1)`),
  tahan `hold` sambil `k += drift` (0,06) linear (dorongan ala Ken Burns), keluar `outMs` dengan `CINE_OUT`
  (`cubic-bezier(.65,0,.35,1)`). Struktur fungsi transform sama di semua fase, jadi interpolasi per komponen (mulus).
  Panggilan kamera lain tetap jalan; timer fase di `App.cam.cineTimers`, `camCinemaStop()` saat masuk/keluar game.
- Dipicu di `flow.js` hanya bila `fresh`: landmark (`build` level 4), `takeover`, menang instan (`gameover`: tengah
  jalur untuk Raja Jalur, pion juara untuk lainnya), `moment`. Durasi ikut `SPD()`.
- Mati: papan 2D, gerak dikurangi, Hemat baterai, tab tersembunyi. Biaya terukur (CPU 4×): main thread ±1,0 dtk dari
  3,2 dtk vs ±0,6 dtk giliran biasa — layout per frame selama kamera bergerak sudah ada sebelumnya (kandidat
  optimasi: pelacak gelembung Merpi).

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
