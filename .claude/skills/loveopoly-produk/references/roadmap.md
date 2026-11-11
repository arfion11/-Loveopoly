# Roadmap Loveopoly (per 11 Nov 2026)

## Sudah rilis (urut terbaru)

- Momen Berdua: tantangan kerja sama tiap 5–7 ronde (≥ 2 manusia), hadiah sama untuk berdua; stempel paspor andal di HP.
- Main lagi cepat di beranda; rekap tahunan Paspor (`yr`, dicatat sejak 11 Nov 2026) untuk Kilas Balik.
- Pertanyaan Hari Ini: 365 soal + 9 edisi tanggal WIB, peralihan aman (`SWITCH` 11 Nov 2026).
- Cadangan & pulihkan Paspor lewat tautan, `storage.persist`, hari WIB; stempel karet saat paspor disetujui.
- Gamifikasi ala Duolingo versi pasangan: Api Cinta mingguan + Payung Rindu, Jam Terbang (XP/level), lencana
  Perunggu/Perak/Emas, layar perayaan, Merpi kangen, tema papan & Kartu Kenangan Edisi Emas, getar halus.
- Hemat daya (mode tenang, Hemat baterai), suasana Kabar Merpi/Musim Puncak, Kartu Kenangan pribadi, PWA.

## Antrean (rekomendasi urutan)

1. **Upgrade animasi** (pengguna sudah tertarik): transisi layar View Transitions, kamera sinematik di momen besar,
   koin terbang, pegas `linear()` — lihat skill `loveopoly-animasi`.
2. **Kilas Balik Cinta 2026** — kartu Story bergeser + kartu 9:16 untuk dibagikan, dari `yr`; tayang pertengahan
   Desember s.d. Januari. Memakai mesin gambar Kartu Kenangan.
3. **Misi Bersama** — satu target kerja sama per game, hadiah sama untuk semua (adil).
4. **Album Kartu Pos** — cap kota per wilayah, bingkai emas set lengkap.
5. **Login Google opsional** — sinkron Paspor antar-HP, Api Cinta berdua; butuh layar persetujuan OAuth dari pemilik,
   fitur hapus akun & teks Privasi/UU PDP.
6. **Setelah Blaze**: TTL Firestore (`expireAt`), App Check (reCAPTCHA Enterprise), pengingat push.
7. Ide cadangan: Pohon Cinta di beranda, baju musiman Merpi, "Jadwalkan Malam Main" (.ics).

## Menunggu keputusan pemilik produk

- **Keuntungan pemain pertama**: 56% (2 pemain) / 40% (3 pemain). Opsi: kompensasi uang awal +150 per urutan
  (→ ±52% / ±35%, melanggar aturan "modal sama persis") atau dibiarkan.
- **Comeback**: pemimpin ronde 15 menang 76%. Opsi: Love ikut skor akhir; Musim Puncak jadi "tantangan & Love ×2"
  (sekarang tol ×1,5 justru menguntungkan yang unggul). Pengguna sejauh ini hanya memilih Momen Berdua.
