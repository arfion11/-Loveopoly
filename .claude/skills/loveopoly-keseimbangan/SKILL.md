---
name: loveopoly-keseimbangan
description: Mengukur & menyetel keseimbangan Loveopoly dengan simulasi ribuan game — keuntungan pemain pertama, efek bola salju/comeback, durasi, frekuensi tantangan, Love & Soulmate, ekonomi. Pakai saat pengguna bertanya "apakah game ini adil/seru/terlalu lama", minta revamp alur permainan, mengubah angka RULES, hadiah, atau menambah kejadian ronde; juga sebelum mengusulkan perubahan aturan apa pun supaya usulannya berbasis data, bukan tebakan.
---

# Simulasi keseimbangan

Keputusan aturan di proyek ini selalu didukung angka simulasi (contoh: Momen Berdua disetel sampai tantangan per
pemain ±3,8 dan Soulmate ±23%). Tiga alat di `tools/balance/` (deterministik, seed tetap, berjalan di Node):

| Perintah | Mengukur | Kapan |
| --- | --- | --- |
| `npm run balance:flow -- --games 600 --levels normal,normal --rounds 25 --players 2` | cara selesai, ronde selesai, pemimpin aset di ronde 5/10/15/20 yang akhirnya menang, comeback, keputusan per giliran, tantangan, Love, kepadatan papan, kas seret | revamp alur, ekonomi, tempo |
| `npm run balance:couple -- --games 500 --rounds 25 --p 0.7 --players 2 --moment on` | model pasangan manusia (tantangan berdua berhasil dengan peluang `--p`): tantangan/pemain, Love, Bucin+, Soulmate | apa pun yang menyentuh tantangan/Love/hadiah |
| `npm run balance:seat -- --games 2000 --players 2 --comp 0,150` | pemain pertama menang % per cara selesai; efek kompensasi uang per urutan | keadilan urutan duduk |

## Cara membaca hasil

- **Sampel**: pakai ≥ 500 game untuk keputusan; galat baku ±2 poin persen di 600 game. Sampel 60 hanya uji asap.
- **AI vs AI ≠ manusia.** Bot tidak memainkan tantangan berdua (diganti mini-game) dan bermain lebih rapi. Untuk hal
  yang melibatkan manusia pakai `balance:couple`, dan cek kepekaan `--p 0.5` & `--p 0.9`.
- **Ukur sebelum & sesudah** dengan seed sama (bandingkan `--moment on/off`, atau ubah `D.RULES` sementara di skrip).
- **Cek 2, 3, dan 4 pemain** serta durasi 15/25/35 — aturan yang pas untuk berdua sering kebablasan di game ramai.

## Angka acuan (25 ronde, 2 pemain, November 2026)

| Metrik | Nilai | Catatan |
| --- | --- | --- |
| Pemain pertama menang | ±55–56% (adil 50%); 3 pemain ±40% (adil 33%) | keuntungan tempo beli kota; kompensasi +150/urutan → ±52%; **belum diputuskan** pemilik produk |
| Pemimpin aset ronde 15 akhirnya menang | ±76% | tertinggal >30% di ronde 15 → comeback hanya 7–9% |
| Tantangan per pemain | ±1 tanpa Momen → ±3,8 dengan Momen Berdua | model pasangan, berhasil 70% |
| Love akhir (median) / Soulmate | 56 / 3% → 70 / 23% dengan Momen | 3–4 pemain ±38% Soulmate |
| Giliran tanpa keputusan | ±22% | sehat |

Perbarui tabel ini bila aturan berubah (angka lama menyesatkan keputusan berikutnya).

## Melaporkan ke pengguna

Ringkas dalam Bahasa Indonesia: temuan (angka + artinya bagi pemain), usulan berurutan prioritas, dan apa yang butuh
keputusan pengguna (terutama apa pun yang bertentangan dengan "keadilan kursi"). Sebutkan bahwa simulasi memakai bot
sehingga pola besarnya yang dipercaya, bukan angka persisnya.
