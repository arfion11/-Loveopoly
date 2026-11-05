# CLAUDE.md — Loveopoly

Board game web untuk pasangan LDR (Bahasa Indonesia). Sumber di `src/`, digabung `build.mjs` menjadi satu file HTML (`dist/index.html`) yang dihosting di Firebase Hosting. JS biasa tanpa framework/bundler: tiap file IIFE yang memasang global `window.Love*` (`LoveEngine`, `LoveUI`, `LoveNet`, `LoveBG`, ...).

## Perintah

- Build: `npm run build` (wajib setelah mengubah `src/`; uji membaca `dist/test.html`)
- Pratinjau: `npm run dev` → http://localhost:5173
- Uji: `npm test`, atau per bagian `npm run test:sim | test:flows | test:online | test:ui | test:rules | test:backend` (dua terakhir menjalankan Firebase Emulator, butuh Java 11+)
- Deploy: `npm run deploy -- --project prod`
- Sebelum menyatakan selesai: build + uji yang relevan harus lulus dan **tanpa error konsol**. Perubahan tampilan: cek juga screenshot di `test/out/`, minimal ukuran 1366×768, 820×1180, 390×844, 844×390, tema terang & gelap.

## Aturan produk

- Semua teks UI Bahasa Indonesia, santai & hangat. Angka pakai format `id-ID` (`fmt()`).
- Seni orisinal (SVG di `src/art.js`). Jangan meniru aset, karakter, atau branding Get Rich / game lain.
- Satu file: jangan menambah dependensi runtime atau CDN baru. Pustaka luar hanya SDK Firebase compat 10.14.1 (gstatic) yang dimuat malas oleh `backend.js` saat menu online dibuka (uji memakai `node_modules/firebase`).
- Latar halaman diam & ringan (gradasi CSS `.page-sky`, tanpa animasi/WebGL). Tengah papan (kamera 3D & ponsel) memakai Merpi besar `#mascot` (SVG + CSS 3D, tanpa WebGL): alas globe & bayangan rebah di papan, Merpi berdiri tegak. Reaksi lewat `mascotAct()` (kelas `act-*`), `mascotEmote()`, `mascotLook(petak)`; mood ikut `merpiSay()`, tertidur setelah 30 detik diam. Teks tetap di gelembung panel (aria-live).
- Warna lewat token CSS di `:root` + dua blok tema gelap (media query & `[data-theme="dark"]`). Jangan menaruh warna literal yang hanya terbaca di satu tema.
- Aksesibilitas: target axe WCAG 2.1 AA 0 pelanggaran; hormati `prefers-reduced-motion` (`reduceMotion()`); tombol punya label.

## Arsitektur

- Urutan gabung: data → engine → ai → icons → art → audio → ui-core → ui-modals → firebase-config → backend → net → guide → ui-screens (`ORDER` di `build.mjs`).
- `engine.js` murni & deterministik: `dispatch(state, action)` mengembalikan `{ ok, state | error }`. UI dan online hanya memanggil ini; aturan baru masuk ke engine + `test/sim.js`.
- `SIDES` di `data.js` (petak 1–7, 9–15, 17–23, 25–31) dipakai syarat menang "jalur": papan harus tetap 7 petak per sisi (jangan ganti bentuk papan).
- Tata letak (`computeLayout()` di `ui-core.js`): `wide` (desktop/tablet mendatar, panel aksi di kolom kanan saat 3D), `mid` (tablet tegak, dok bawah), `compact` (HP tegak), `land` (HP mendatar).

## Papan 3D (`ui-core.js` bagian kamera + blok "papan 3D" di `style.css`)

- Kamera: `translate → rotateX(tilt) → scale3d(s) → translate(-fokus)` + `perspective` pada `#boardVP`. `fit3d()` mencari skala terbesar agar seluruh papan + kartu berdiri muat (ruang `HEAD`/`FOOT`). Tilt 30° (area tegak) / 38° (area datar), sama untuk semua mode.
- Mode: "Semua" (bawaan, diam) dan "Dekat" (ikuti pion, `pref3d = 'near'`). Di HP, `auto3d()` = "Sorot langkah": mendekat saat pion jalan / ada keputusan di petak, lalu kembali ke seluruh papan.
- Kartu pop-up `.t-pop` adalah billboard: `rotate: x calc(var(--tilt) * -1)`, `transform-origin` di bawah. `--px` / `--pb` / `--pw` = titik kaki & lebar kartu per sisi petak.
- **Isi elemen 3D harus tetap di dalam kotaknya.** Anak `position: absolute` yang menjulur keluar kotak elemen ber-transform 3D bisa terpotong kompositor Chrome (pernah terjadi pada mahkota & titik level). Perbesar kotak/padding, jangan mengandalkan overflow.
- Pion berdiri di depan kartu (baris atas/bawah & sudut) atau di sisi dalam petak (kolom kiri/kanan). Kartu tidak boleh menutupi pusat petak di belakangnya, karena ketukan harus mengenai petak yang benar.
- Mengangkat badge "ke atas layar" tanpa `transform` (supaya animasi tidak bentrok): `translate: x calc(L * -1 * cos(var(--tilt))) calc(L * sin(var(--tilt)))`.
- Efek datar di bidang papan (riak, debu) diberi `translate: 0 0 3px` agar tidak tertutup muka petak.

## Online (`net.js` + `backend.js`)

- Host-authoritative di atas Firestore: `rooms/<KODE>` (hanya pemegang lease menulis), `rooms/<KODE>/locks/host` (lease `{uid, holder, exp}`, maks 60 detik), `lobby/<uid>` & `inbox/<uid>/intents/<id>` (hanya pemilik uid). Host memvalidasi setiap intent dengan engine, menolak `baseSeq` basi, mencatat ack.
- `backend.js` = adapter `LoveBackend.use('db' | 'user' | 'room')` dengan API yang dipakai `net.js`. Dokumen disimpan `{ __j: JSON, ...kunci indeks }` (Firestore menolak array bersarang); kunci indeks `hostUid status room uid exp holder` dipakai `where` & aturan. Presence di RTDB `presence/<KODE>/<uid>`. Login anonim.
- Aturan di `firestore.rules` & `database.rules.json`; setiap perubahan aturan wajib diikuti `npm run test:rules`.
- `test/online.js` memakai mock `window.LoveBackend` berbasis localStorage (`backend.js` tidak menimpa backend yang sudah terpasang).

## Publikasi

- `npm run deploy -- --project prod` (build + hosting + aturan). Config web di `src/firebase-config.js` (publik), project di `.firebaserc`. Langkah setup project ada di README.
