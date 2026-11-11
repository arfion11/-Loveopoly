# Penulisan UX Loveopoly

## Nada

Bahasa Indonesia santai & hangat, seperti teman yang menyemangati pasangan: "Yuk main minggu ini 🔥",
"Kangen! 9 hari nggak ketemu." Tidak kaku, tidak lebay, tidak menyalahkan. Emoji secukupnya di kabar/pesan Merpi,
bukan di label tombol.

## Istilah baku (pakai persis)

Paspor Cinta · Jam Terbang (XP & level) · Api Cinta (minggu beruntun) · Payung Rindu · Kartu Cinta · Kabar Merpi ·
Musim Puncak · Momen Berdua · Ketemuan! · Pulau Rindu · World Tour · Festival Cinta · Trio Warna · Raja Jalur ·
Kolektor Wisata · Tebak Isi Hati · Peragakan! · Aksi Berani · Foto Bukti · Surat Bersyarat · Dua Fakta Satu Bohong ·
Love (meter) dengan tingkat Kenalan → PDKT → Jadian → Bucin → Soulmate · Kartu Kenangan · Pertanyaan Hari Ini ·
Cadangan Paspor · Hemat baterai.

**Jangan** memakai "Monopoli/Monopoly" (merek dagang) atau nama/karakter game lain.

## Pola

- **Tombol** = kata kerja hasilnya: "Terbitkan Paspor", "Kirim foto ke Nadia", "Main lagi", "Simpan". Nama aksi sama
  di seluruh alur (tombol "Terbitkan" → toast "Paspor terbit!").
- **Toast/kabar**: apa yang terjadi + dampaknya: "Api Cinta: 4 minggu beruntun! +10 XP Jam Terbang."
- **Error**: apa yang salah + cara memperbaiki, tanpa minta maaf: "Isi nama kamu dulu.", "Tautan ini rusak atau sudah
  kedaluwarsa. Minta pasanganmu mengirim ulang."
- **Kosong**: ajakan bertindak: "Belum ada foto bukti. Selesaikan tantangan Foto Bukti untuk memajang di sini."
- **Angka**: `fmt()` (titik ribuan `id-ID`), desimal pakai koma ("×1,5", "1,6 dtk").
- **Privasi**: jujur & spesifik tentang apa yang disimpan dan di mana; jangan menjanjikan yang belum berlaku.
- **Nama orang** dari pengguna selalu `esc()`; sapaan pakai nama bila ada ("Serahkan ke Nadia").

## Panjang

Label tombol ≤ 3 kata bila bisa; pilihan Pertanyaan Hari Ini ≤ 30 karakter; kartu beranda satu baris di HP (potong "…").
