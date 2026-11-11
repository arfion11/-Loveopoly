---
name: loveopoly-qa-visual
description: QA visual & HP untuk Loveopoly — screenshot 4 ukuran wajib terang/gelap, cek WebKit/iPhone & Android, aksesibilitas axe, halaman melebar, error konsol, merekam animasi per frame, dan mereproduksi bug yang "hanya terjadi di HP" (keyboard terbuka, visualViewport, Safari 3D, gerak dikurangi, Hemat baterai). Pakai setiap kali ada perubahan tampilan/CSS/animasi, atau pengguna melapor "di HP tidak muncul/kepotong/berkedip/beda", walau tidak menyebut kata QA.
---

# QA visual & HP

CLAUDE.md mewajibkan: build + uji relevan lulus **tanpa error konsol**, dan perubahan tampilan dicek di 1366×768,
820×1180, 390×844, 844×390, tema terang & gelap. Lihat sendiri gambarnya (Read pada PNG) — angka lulus tidak cukup.

## Alat cepat

```bash
npm run build                                   # uji browser melayani dist/
npm run shots -- --preset <home|home-lama|paspor|game|momen> [--themes light,dark] [--webkit]
npm run test:a11y                               # axe WCAG 2.1 AA, harus 0 pelanggaran
```

`tools/qa/shots.mjs` keluar dengan kode 1 bila ada error konsol atau halaman melebar ke samping. Tambah preset baru di
objek `PRESETS` (profil paspor awal, kode mutasi state game, atau langkah `run(page)`). Tampilan baru juga ditambahkan
ke `test/a11y.js`.

## Pola Playwright yang sudah terbukti

- Init script: `loveopoly.v1.prefs {sound:false}`, `loveopoly.v2.tour "done"`, profil `{skipped:true}` supaya paspor &
  tur tidak menghalangi. State game dibuat lewat `window.LoveEngine.create(...)` lalu `window.LoveUI.enterGame('local', -1, S)`;
  tunggu `!App.animating && !App.pending.length`.
- Mengukur tata letak beranda: `getBoundingClientRect().top + scrollY` tombol `#hOnline`; ubah urutan beranda → ukur
  ulang di 390×844 & 844×390. Cek `document.documentElement.scrollWidth > innerWidth` (teks `nowrap` pernah melebarkan
  kolom HP; obatnya `width: 0; min-width: 100%`).
- **Merekam animasi**: ambil sampel tiap ±40 ms (`getComputedStyle(el).opacity`, `getBoundingClientRect()`,
  `el.getAnimations()[0].playState/currentTime`) dan simpan beberapa screenshot. Untuk frame presisi: jeda semua animasi
  lalu set `currentTime`; ganti `setTimeout` ≥ 1000 ms jadi 0 bila overlay menutup sendiri.
- Perangkat: `devices['iPhone 14']` (webkit), `devices['Pixel 7']` (chromium), layar pendek `375×667` isMobile+hasTouch.

## Bug "hanya di HP": daftar periksa

1. **Keyboard virtual** — Playwright tidak menampilkannya. Safari iOS tidak memindahkan fokus ke tombol saat diketuk,
   jadi input tetap fokus & keyboard terbuka saat submit. Ukur keterlihatan dengan `window.visualViewport`
   (`offsetTop`, `height`), bukan `innerHeight`; blur input dulu; tunggu layar & guliran diam. Uji dengan
   `page.focus(input)` lalu `form.requestSubmit()`.
2. **Gerak dikurangi** (`emulateMedia({ reducedMotion: 'reduce' })`) — animasi hiasan mati; pastikan informasi tetap
   terlihat cukup lama.
3. **Hemat baterai / mode tenang** — `body.lowp` / `body.calm` menjeda hiasan berulang (lihat skill `loveopoly-animasi`).
4. **Safari 3D** — WebKit headless tanpa GPU meratakan 3D (urutan DOM), jadi tidak bisa membuktikan bug urutan 3D di
   iPhone asli; cari ketergantungan pada `preserve-3d`, lapisan tipis `translateZ`, `rotateY` + `backface-visibility`.
5. **Jarak aman** (iPhone PWA ±59/34 px) — `Emulation.setSafeAreaInsetsOverride` via CDP (lihat `test/flows.js`).
6. **Service worker / cache** — build produksi jaringan-dulu; uji SW hanya dengan `?uji-sw`.

Bila tetap tidak bisa direproduksi: perkuat titik rawan yang masuk akal, tambahkan uji yang meniru kondisinya, dan
minta pengguna menyebut HP/browser, baru/ubah, serta status "Kurangi gerakan".

## Performa (HP lemah)

Gunakan CDP `Emulation.setCPUThrottlingRate` (4–6×) + `Tracing`/`Performance.getMetrics` untuk membandingkan sebelum &
sesudah; diam 12 dtk di layar game → tidak boleh ada animasi berjalan (diuji `test/flows.js`).
