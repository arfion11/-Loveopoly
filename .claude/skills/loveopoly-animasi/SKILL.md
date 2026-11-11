---
name: loveopoly-animasi
description: Aturan & resep animasi Loveopoly yang keren tapi ringan di HP lemah — gerak 3D CSS (papan, kamera, kartu berdiri, Merpi), transisi layar, kamera sinematik, koin terbang, pegas, efek suasana; plus daftar larangan yang pernah membuat HP panas atau Safari berkedip. Pakai sebelum membuat/mengubah animasi, @keyframes, transition, efek 3D, atau saat pengguna minta "animasi lebih keren/mewah/smooth", "revamp animasi", atau melapor animasi patah-patah/berkedip/hilang.
---

# Animasi Loveopoly

Target: terasa mewah di HP kelas bawah. Animasi yang salah pernah membuat main thread sibuk ±30–40% saat diam dan
header berkedip hitam di Safari. Aturan di bawah lahir dari kejadian nyata — ikuti, atau jelaskan ke pengguna kenapa
perlu menyimpang.

## Aturan inti

1. **Hanya `transform` & `opacity`** (plus `filter` ringan pada lapisan kecil). Jangan menganimasikan `box-shadow`,
   `background-position`, `width/height/top/left`, `stroke-opacity` pada SVG besar — itu cat ulang tiap frame.
2. **Sekali jalan untuk permainan, berulang hanya untuk hiasan.** Hiasan berulang (`animation … infinite`) **wajib**
   didaftarkan di `src/styles/power.css` supaya dijeda oleh `body.calm` (diam 12 dtk) dan `body.lowp` (Hemat baterai).
   Animasi permainan sekali jalan di elemen yang sama dikecualikan dengan `:not()`.
3. **Gerak dikurangi**: hormati `prefers-reduced-motion` (`UI.reduceMotion()`); informasi tetap tampil (diam), dan
   bila overlay menutup sendiri beri waktu cukup untuk dibaca.
4. **Jangan `backdrop-filter`** di header/scrim/overlay dan jangan `filter: blur` pada lapisan yang bergerak; blur lembut
   taruh di dalam SVG pola.
5. **3D aman untuk Safari**: tanpa lapisan berjarak tipis `translateZ` di elemen berdiri; kartu `.t-pop` & Merpi sengaja
   `transform-style: flat`; isi elemen 3D tidak boleh menjulur keluar kotaknya (terpotong kompositor Chrome); balikan
   kartu dialog memakai `scale` 2D, bukan `rotateY` + `backface-visibility`. Ratakan ruang 3D (`flat`) saat tidak perlu.
6. **Logika tidak menunggu animasi.** State berubah dulu; animasi hanya menceritakan perubahan (`flow.js` memutar event
   `S.lastEvents`). Menutup dialog/overlay lewat `UI.leave(el, ms)`, bukan `el.remove()`.
7. **Satu momen besar, bukan efek di mana-mana.** Animasi yang menjawab aksi pemain (lempar, beli, menang) boleh
   menonjol; hiasan latar tetap tenang. Getar halus `buzz()` hanya untuk aksi pemain sendiri.
8. **SMIL** (`<animate>` di SVG) tidak ikut CSS: jeda lewat `pauseAnimations()` (`syncSmil()`).

## Sebelum selesai

- `npm run test:flows` (termasuk "diam 12 dtk → tidak ada animasi berjalan") & `npm run test:a11y`.
- Rekam per frame di Chromium **dan** WebKit HP (skill `loveopoly-qa-visual`), cek gerak dikurangi & Hemat baterai.
- Ukur beban di HP lemah: CDP `Emulation.setCPUThrottlingRate` 4–6×, bandingkan main thread sebelum/sesudah.
- Perbarui CLAUDE.md bila menambah pola animasi baru (bagian "Papan 3D" atau "Hemat daya").

## Resep

Lihat `references/resep.md`: transisi layar sinkron + judul terbang FLIP (sudah dipakai; **bukan** View Transitions
API — menelan ketukan), kamera sinematik `camCinema` (sudah dipakai), koin terbang melengkung, pegas CSS `linear()`,
dan cara menambah suasana (`renderAmbience`).
