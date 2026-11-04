# Loveopoly 💕

Board game keliling dunia untuk pasangan LDR. Beli kota romantis, bangun sampai landmark, adakan festival, lalu menangkan lewat monopoli warna, jalur penuh, atau tempat wisata. Bisa main berdua di satu perangkat, lawan AI, atau online lewat Claude.

Seluruh game dibangun menjadi **satu file HTML** (`dist/loveopoly.html`) yang dipublikasikan sebagai artifact di Claude. Tidak ada framework, bundler, atau dependensi runtime selain Three.js (dimuat dari CDN untuk latar & globe 3D).

## Mulai cepat

Butuh **Node.js 20+**. Python tidak diperlukan.

```bash
npm install          # Playwright untuk uji otomatis
npm run setup        # unduh Chromium untuk Playwright (sekali saja)
npm run dev          # build + pratinjau di http://localhost:5173 (rebuild & reload otomatis)
```

Tanpa server: jalankan `npm run build`, lalu buka `dist/test.html` di browser.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run build` | Gabungkan `src/` → `dist/loveopoly.html` (untuk dipublikasikan) + `dist/test.html` (pratinjau & uji) |
| `npm run dev` | Pratinjau lokal, build ulang & reload otomatis saat `src/` berubah |
| `npm test` | Build + semua uji (berhenti di uji pertama yang gagal) |
| `npm run test:sim` | 200 game AI vs AI + cek invariant engine (tanpa browser, ±15 detik) |
| `npm run test:flows` | 48 skenario alur di browser (beli, bangun, tol, festival, World Tour, pulau, kartu, panduan) |
| `npm run test:online` | Host & tamu di dua tab dengan mock database (room, aksi, keamanan, reconnect) |
| `npm run test:ui` | Monkey test desktop, HP tegak & HP mendatar (klik acak, harus 0 error) |

Screenshot hasil uji tersimpan di `test/out/` (diabaikan git).

## Struktur

```
src/
  index.html     templat halaman (penanda /*FONTS*/, /*STYLE*/, //SCRIPTS)
  style.css      semua gaya (token tema terang/gelap, papan 3D, HUD, modal)
  data.js        papan 32 petak, grup warna, kartu cinta, tantangan, teks Merpi
  engine.js      aturan murni: create(), dispatch(state, action) -> { ok, state }
  ai.js          AI easy / normal / hard
  icons.js art.js audio.js   ikon, ilustrasi SVG orisinal, suara (Web Audio)
  bg3d.js        latar langit & globe 3D (Three.js r128, dimuat malas)
  ui-core.js     tata letak, papan & kamera 3D, pion, dadu, animasi, alur giliran
  ui-modals.js   dialog beli/bangun/tol, portofolio, pengaturan
  net.js         mode online (host-authoritative di atas database artifact)
  guide.js       Buku Panduan bergambar
  ui-screens.js  beranda, setup pemain, lobby online, tur pertama
fonts/           Fredoka & Nunito (SIL OFL), disematkan saat build
test/            sim.js, flows.js, online.js, ui.js, vendor/three.min.js (untuk uji offline)
tools/serve.mjs  server pratinjau lokal
build.mjs        skrip build
```

## Mode online

Online memakai **database real-time & room milik artifact Claude** (`window.claude.use('db' | 'room' | 'user')`), jadi hanya berjalan saat game dibuka **di halaman artifact claude.ai dalam keadaan login**.

Tidak berjalan di: pratinjau lokal (`npm run dev` / file HTML), tab mandiri ("buka di tab baru"), pratinjau di chat, atau saat belum login. Di sana tombol **Main Online** menampilkan petunjuk.

Agar pasangan bisa ikut main:

1. Pemilik artifact membuka menu **Share** → matikan akses **"Anyone with the link"**.
2. Undang email pasangan sebagai **Editor**. Selama link publik aktif, orang dari luar organisasi hanya bisa melihat dan tidak bisa membuat/masuk room.
3. Pasangan login ke Claude dengan email itu, lalu membuka link artifact yang sama.
4. Satu orang membuat room, yang lain bergabung dengan kode 6 hurufnya.

Catatan: pengaturan organisasi (Team/Enterprise) bisa membatasi berbagi ke luar organisasi.

## Publikasi ke Claude

Artifact: <https://claude.ai/artifact/7JH3PBqsqkvgzQ5r6mFFcH>

1. `npm test` sampai semua lulus.
2. Di sesi Claude yang memiliki artifact ini, lampirkan `dist/loveopoly.html` dan minta: *"perbarui artifact https://claude.ai/artifact/7JH3PBqsqkvgzQ5r6mFFcH dengan file ini"*.
3. Kapabilitas runtime yang dipakai (sudah tersimpan di artifact; sertakan lagi hanya bila diminta):

```json
{
  "db": { "rules": [
    { "path": "lobby", "read": "view", "write": "owner" },
    { "path": "lobby/{self}", "read": "view", "write": "interact" },
    { "path": "inbox", "read": "view", "write": "owner" },
    { "path": "inbox/{self}", "read": "view", "write": "interact" }
  ] },
  "room": {},
  "user": {}
}
```

## Lisensi aset

Ilustrasi, ikon, dan maskot Merpi adalah karya orisinal proyek ini. Font Fredoka & Nunito berlisensi SIL Open Font License 1.1. Three.js berlisensi MIT.
