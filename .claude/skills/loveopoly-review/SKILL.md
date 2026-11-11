---
name: loveopoly-review
description: Review kode tingkat lead untuk Loveopoly — daftar periksa khusus proyek (engine murni & deterministik, impor melingkar/TDZ, registri UI, data tak tepercaya, online host-authoritative, privasi/analitik, hemat daya, aksesibilitas, tema, uji & CLAUDE.md). Pakai saat pengguna minta "review", "cek kodenya", "sudah aman belum", sebelum commit perubahan besar, saat menilai PR/diff, atau saat memeriksa pekerjaan agen lain di repo ini.
---

# Review kode Loveopoly

Baca diff (`git diff`, atau `git diff main...HEAD`) lalu periksa poin yang relevan. Laporkan temuan **paling berat
dulu**, masing-masing: berkas:baris, masalah, skenario gagal yang konkret (input → akibat), saran perbaikan. Jangan
melaporkan selera gaya yang sudah ditangani Prettier/ESLint. Temuan tanpa skenario gagal = tandai "mungkin".

## Daftar periksa

**Engine (`src/engine/`)**
- Murni: tanpa DOM/`window`/`Date.now()`/`Math.random()`; acak lewat `rint(S, n)`. ESLint melarang global browser.
- `dispatch` mengklon state; handler gagal dengan `fail('pesan')` berbahasa Indonesia, tidak mengubah state setengah jalan.
- Setelan baru disalin di `rules/create.js`; save lama ditangani `migrate()`.
- Simetris antar kursi ("keadilan kursi"); hadiah 3–4 pemain tidak berlipat tanpa sengaja.
- Ada uji di `test/sim.js`; angka penting divalidasi simulasi (skill `loveopoly-keseimbangan`).

**Arsitektur UI**
- Panggilan inti → dialog/layar lewat registri `UI` (`src/ui/ns.js`), bukan impor melingkar baru.
- Tidak membaca `const`/`let` modul lain yang ikut siklus impor di tingkat atas modul (TDZ).
- Variabel milik modul lain diubah lewat setter.
- Menutup dialog/overlay lewat `UI.leave`/`closeModal`, bukan `remove()` langsung.

**Data tak tepercaya** (tautan `#tanya=`/`#pulihkan=`, state dari host online, impor, localStorage)
- Teks ke HTML lewat `esc()`; gambar lewat `UI.safeImg()` + `cleanState()`; profil lewat `normProfile` (field baru
  wajib ditambahkan di sana); tautan lewat `decodeLink`/`parseBackup` (validasi ketat, batas panjang).

**Online**
- Host-authoritative: tamu hanya mengirim intent; host memvalidasi dengan engine, menolak `baseSeq` basi.
- Pemeriksaan `seed` di `onRoomSnap` (game baru) tidak dihapus; perubahan `firestore.rules`/`database.rules.json`
  → `npm run test:rules`. Ingat kuota Spark (baca/tulis per hari).

**Privasi & analitik**
- `track()` params hanya angka/jenis — **tidak pernah** nama, pesan, surat, foto, kode room (`test/analytics.js`).
- Teks Privasi (`openPrivacy`) tidak menjanjikan hal yang belum berlaku (mis. TTL belum aktif); data baru di perangkat
  disebut di sana.

**Tampilan, gerak, aksesibilitas**
- Warna lewat token CSS, terbaca di dua tema; teks di atas `*-soft` pakai `*-ink`.
- Animasi: hanya transform/opacity, hiasan berulang terdaftar di `power.css`, gerak dikurangi dihormati, tanpa
  `backdrop-filter` (skill `loveopoly-animasi`).
- Tombol berlabel; nama aksesibel memuat teks yang terlihat; area gulir `tabindex="0"`; tampilan baru masuk `test/a11y.js`.
- Teks UI Bahasa Indonesia santai, angka `fmt()` (`id-ID`), tanpa kata "Monopoli/Monopoly".

**Uji & dokumentasi**
- Uji yang relevan diperbarui & lulus; uji tidak mengunci data yang berganti harian (soal hari ini, tanggal).
- CLAUDE.md diperbarui bila aturan/arsitektur/alur berubah.

Untuk review menyeluruh berbiaya lebih tinggi, ada juga plugin eksternal `code-review` / `pr-review-toolkit`
(lihat `.claude/skills/README.md`).
