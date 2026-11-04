# Loveopoly 💕

Board game keliling dunia untuk pasangan LDR. Beli kota romantis, bangun sampai landmark, adakan festival, lalu menangkan lewat monopoli warna, jalur penuh, atau tempat wisata. Bisa main berdua di satu perangkat, lawan AI, atau online dengan kode room.

Seluruh game dibangun menjadi **satu file HTML** (`dist/index.html`) yang dihosting gratis di **Firebase Hosting**. Mode online memakai Firestore + login anonim + Realtime Database (paket Spark, tanpa kartu kredit). Tidak ada framework atau bundler; pustaka luar hanya Three.js (latar & globe 3D) dan SDK Firebase (dimuat saat menu online dibuka).

## Mulai cepat

Butuh **Node.js 20+**. Python tidak diperlukan.

```bash
npm install          # Playwright, firebase-tools & alat uji
npm run setup        # unduh Chromium untuk Playwright (sekali saja)
npm run dev          # build + pratinjau di http://localhost:5173 (rebuild & reload otomatis)
```

Tanpa server: jalankan `npm run build`, lalu buka `dist/index.html` di browser (mode online butuh `src/firebase-config.js` terisi).

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run build` | Gabungkan `src/` → `dist/index.html` (di-deploy) + `dist/test.html` (salinan untuk uji) |
| `npm run dev` | Pratinjau lokal, build ulang & reload otomatis saat `src/` berubah |
| `npm test` | Build + semua uji (berhenti di uji pertama yang gagal) |
| `npm run test:sim` | 200 game AI vs AI + cek invariant engine (tanpa browser, ±15 detik) |
| `npm run test:flows` | 49 skenario alur di browser (beli, bangun, tol, festival, World Tour, pulau, kartu, panduan) |
| `npm run test:online` | Host & tamu di dua tab dengan mock database (room, aksi, keamanan, reconnect) |
| `npm run test:ui` | Monkey test desktop, HP tegak & HP mendatar (klik acak, harus 0 error) |
| `npm run test:rules` | Aturan keamanan Firestore & RTDB di Firebase Emulator (butuh Java 11+) |
| `npm run test:backend` | Adapter `src/backend.js` sungguhan terhadap emulator (auth, dokumen, lease host, presence) |
| `npm run deploy` | Build + deploy hosting & aturan ke project Firebase |

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
  firebase-config.js  config web Firebase (publik; keamanan di aturan)
  backend.js     adapter Firebase: LoveBackend.use('db' | 'user' | 'room')
  net.js         mode online (host-authoritative di atas Firestore)
  guide.js       Buku Panduan bergambar
  ui-screens.js  beranda, setup pemain, lobby online, tur pertama
fonts/           Fredoka & Nunito (SIL OFL), disematkan saat build
test/            sim.js, flows.js, online.js, ui.js, rules.js, backend.js, vendor/three.min.js
firestore.rules database.rules.json firebase.json   aturan & konfigurasi Firebase
tools/serve.mjs  server pratinjau lokal
build.mjs        skrip build
```

## Mode online

Satu orang membuat room, yang lain membuka link game yang sama dan bergabung dengan kode 6 hurufnya. Pemain masuk
otomatis secara anonim (tanpa daftar akun); identitasnya tersimpan di browser, jadi pakai browser yang sama untuk
kembali ke room.

- `rooms/<KODE>`: room & state game, hanya ditulis host (pemegang lease `rooms/<KODE>/locks/host`).
- `lobby/<uid>`, `inbox/<uid>/intents/<id>`: permintaan gabung & aksi pemain, hanya ditulis pemiliknya.
- Realtime Database `presence/<KODE>/<uid>`: status online/offline.

Host memvalidasi setiap aksi dengan engine. Dokumen disimpan sebagai JSON di field `__j`.

## Hosting di Firebase (sekali saja)

1. Buka <https://console.firebase.google.com> → **Add project** (Analytics boleh dimatikan). Paket **Spark** (gratis).
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**.
3. **Build → Firestore Database → Create database** → lokasi `asia-southeast2` (Jakarta) → mode produksi.
4. **Build → Realtime Database → Create database** → lokasi `asia-southeast1` (Singapura) → mode terkunci.
5. **Project settings → Your apps → Web (`</>`)** → daftarkan app → salin `firebaseConfig` ke `src/firebase-config.js`
   (termasuk `databaseURL`).
6. Di terminal: `npx firebase login`, lalu tambahkan project ke `.firebaserc` sebagai alias `prod`.

Deploy: `npm run deploy -- --project prod` → game tersedia di `https://<project-id>.web.app`.

Kuota gratis Spark (Firestore ±50 rb baca & 20 rb tulis per hari) jauh di atas pemakaian pribadi. Room lama tidak
terhapus otomatis (ukurannya kecil); bisa dibersihkan manual dari Firebase Console bila perlu.

## Lisensi aset

Ilustrasi, ikon, dan maskot Merpi adalah karya orisinal proyek ini. Font Fredoka & Nunito berlisensi SIL Open Font License 1.1. Three.js berlisensi MIT.
