# Loveopoly 💕

Board game keliling dunia untuk pasangan & teman. Beli kota romantis, bangun sampai landmark, adakan festival, lalu menangkan lewat Trio Warna, Raja Jalur, atau Kolektor Wisata. Bisa main bareng di satu perangkat, lawan AI, atau online dengan kode room. Main di **https://loveopoly.web.app**.

JS biasa (ES modules, tanpa framework UI) yang dibangun **Vite** dan dihosting gratis di **Firebase Hosting**. Mode online memakai Firestore + login anonim + Realtime Database (paket Spark). Pustaka luar di browser hanya SDK Firebase (dimuat saat menu online dibuka).

## Mulai cepat

Butuh **Node.js 22+** (Java 11+ hanya untuk uji emulator Firebase).

```bash
npm install          # Vite, ESLint, Prettier, TypeScript, Playwright, firebase-tools
npm run setup        # unduh Chromium untuk Playwright (sekali saja)
npm run dev          # pratinjau di http://localhost:5173 (muat ulang otomatis)
```

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan Vite (muat ulang otomatis) |
| `npm run build` | Build produksi ke `dist/` (JS, CSS & font bernama hash, source map) |
| `npm run preview` | Sajikan hasil build secara lokal |
| `npm run check` | Lint (ESLint) + cek format (Prettier) + cek tipe engine (TypeScript `checkJs`) |
| `npm run lint:fix` / `npm run format` | Perbaiki temuan lint / rapikan format otomatis |
| `npm test` | Build + semua uji (berhenti di uji pertama yang gagal) |
| `npm run test:sim` | 200 game AI vs AI + cek invariant & aturan engine (tanpa browser) |
| `npm run test:flows` | 81 skenario alur di browser (beli, bangun, tol, festival, World Tour, pulau, kartu, tantangan, panduan) |
| `npm run test:online` | Online 2 & 3 tab dengan mock database (room, aksi, keamanan, reconnect, voting, tebak serentak) |
| `npm run test:ui` | Monkey test desktop, HP tegak & HP mendatar (klik acak, harus 0 error) |
| `npm run test:a11y` | axe-core WCAG 2.1 AA di layar & dialog utama, terang/gelap, desktop/HP |
| `npm run test:migrate` | Pindah data dari alamat lama ke alamat baru |
| `npm run test:rules` | Aturan keamanan Firestore & RTDB di Firebase Emulator |
| `npm run test:backend` | Adapter `src/net/backend.js` terhadap emulator (auth, dokumen, lease host, presence) |
| `npm run og-image` | Buat ulang gambar pratinjau tautan `public/og-image.jpg` (setelah build) |
| `npm run deploy:preview` | Build + kanal pratinjau Firebase (alamat sementara 7 hari) |
| `npm run deploy` | Build + deploy hosting & aturan ke project Firebase |

Screenshot hasil uji tersimpan di `test/out/` (diabaikan git). CI GitHub Actions (`.github/workflows/ci.yml`) menjalankan `check`, build, dan semua uji di setiap push ke `main` & pull request.

## Struktur

```
index.html               halaman (tag SEO & ikon di <head>), memuat src/main.js
src/
  main.js                titik masuk: gaya, modul, kait uji window.Love*, start()
  engine/                aturan murni & deterministik (jalan di browser & Node)
    data.js              papan 32 petak, grup warna, kartu cinta, tantangan, teks Merpi
    engine.js            API E: create(), dispatch(state, action) -> { ok, state | error }
    rules/*.js           bagian engine: tol, gerak, tantangan, giliran, handler aksi, dispatch
    ai.js                AI easy / normal / hard
    types.js             tipe JSDoc (GameState, Action, DispatchResult)
  assets/                icons.js, art.js (ilustrasi SVG orisinal), audio.js (Web Audio), fonts/
  ui/
    ns.js                registri UI untuk panggilan antarlapisan
    core.js + core/      state aplikasi, tata letak, papan & kamera 3D, pion, Merpi, alur giliran
    modals.js + modals/  dialog keputusan, tantangan, info, menu & pengaturan
    screens.js + screens/  beranda, paspor, setup, lobi online, game, layar menang, tur
    guide.js             Buku Panduan bergambar
  net/                   firebase-config.js, backend.js (adapter Firebase), net.js (online host-authoritative)
  styles/                index.css + bagian-bagian (token tema, papan, modal, …; urutan = kaskade)
public/                  disalin apa adanya: ikon, og-image.jpg, robots.txt, sitemap.xml
test/                    uji (sim, flows, online, ui, a11y, migrate, rules, backend, smoke) + helpers/
tools/og-image.mjs       pembuat gambar pratinjau tautan
legacy/                  halaman pengalih alamat lama
firestore.rules database.rules.json firebase.json   aturan & konfigurasi Firebase
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
5. **Project settings → Your apps → Web (`</>`)** → daftarkan app → salin `firebaseConfig` ke `src/net/firebase-config.js`
   (termasuk `databaseURL`).
6. Di terminal: `npx firebase login`, lalu tambahkan project ke `.firebaserc` sebagai alias `prod`.

Deploy: `npm run deploy -- --project prod` → game tersedia di `https://loveopoly.web.app` (site `loveopoly`, target `main`); alamat lama `https://loveopoly-5b227.web.app` (target `legacy`) mengalihkan ke sana sambil membawa data perangkat.

Kuota gratis Spark (Firestore ±50 rb baca & 20 rb tulis per hari) jauh di atas pemakaian pribadi. Room lama tidak
terhapus otomatis (ukurannya kecil); bisa dibersihkan manual dari Firebase Console bila perlu.

## Lisensi aset

Ilustrasi, ikon, dan maskot Merpi adalah karya orisinal proyek ini. Font Fredoka & Nunito berlisensi SIL Open Font License 1.1.
