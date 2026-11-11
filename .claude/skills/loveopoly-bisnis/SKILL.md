---
name: loveopoly-bisnis
description: Sisi bisnis & pertumbuhan Loveopoly — membaca metrik GA4 tanpa melanggar privasi, mendefinisikan retensi (Api Cinta, Pertanyaan Hari Ini), biaya & batas paket gratis Firebase (kapan perlu Blaze), SEO/pratinjau tautan/PWA, ide monetisasi yang tidak merusak keadilan, positioning vs aplikasi pasangan lain. Pakai saat pengguna bertanya soal pengguna/pertumbuhan/biaya/kuota/monetisasi/promosi/SEO/analytics, atau saat fitur baru perlu event analitik atau berdampak ke kuota.
---

# Bisnis & pertumbuhan Loveopoly

Produk gratis, web/PWA di **https://loveopoly.web.app**, Firebase paket **Spark** (gratis), pasar Indonesia.
Jangan mengarang angka pengguna: minta data GA4/Firebase Console dari pengguna atau katakan belum ada datanya.

## Analitik (GA4 `G-E5VSWC5YXW`, `src/analytics.js`)

- Event: `game_start`, `game_end`, `room_create`, `room_join`, `memory_card`, `guide_open`, `pwa_prompt`,
  `pwa_installed`, plus `exception` (`reportError`). Params **hanya angka/jenis** — tidak pernah nama, pesan, surat,
  foto, kode room (dijaga `test/analytics.js`). Event/params baru → perbarui teks Privasi (`openPrivacy`).
- Pengguna bisa mematikan ("Bantu kembangkan Loveopoly"); Global Privacy Control = mati bawaan → angka GA4 = batas bawah.
- Metrik berguna: game selesai/mulai (`game_end ÷ game_start`), konversi online (`room_join ÷ room_create`), durasi
  (`rounds`), mode populer (`mode`, `players`, `ai_players`), alasan menang (`reason`), pemasangan PWA, error teratas.
- Retensi produk: Api Cinta (main ≥ 1×/minggu) & Pertanyaan Hari Ini adalah mesin kebiasaan; ukur lewat GA4
  (pengguna kembali D7/D28) — progres paspor sendiri hanya ada di perangkat, tidak terkirim.

## Biaya & kuota (Spark)

| Layanan | Batas | Pemakaian Loveopoly |
| --- | --- | --- |
| Hosting | ±360 MB/hari transfer | kunjungan pertama ±230 KB, ulang ±2 KB (`/assets/*` cache 1 tahun) |
| Firestore | 50 rb baca, 20 rb tulis /hari | hanya main online; lease host 60 dtk diperpanjang tiap 25 dtk, polling cadangan 10 dtk |
| RTDB | 100 koneksi serentak | presence kosmetik saja |

Tanda perlu **Blaze** (bayar sesuai pemakaian, ada kuota gratis yang sama): online sering kena batas harian, butuh TTL
Firestore (hapus otomatis 7 hari — janji privasi), App Check (reCAPTCHA Enterprise), push notifikasi. Rencana: Blaze +
TTL + App Check bersamaan (CLAUDE.md "Publikasi").

## Distribusi

- SEO & pratinjau tautan: meta di `index.html` (judul, deskripsi, Open Graph/Twitter, JSON-LD `VideoGame` tanpa rating
  palsu), `public/robots.txt`, `public/sitemap.xml`, `public/og-image.jpg` (`npm run og-image` setelah seni/teks berubah).
- Viral alami: tautan Pertanyaan Hari Ini (`#tanya=`), Kartu Kenangan 9:16 (Web Share), kode room online, nanti Kilas
  Balik Cinta (akhir tahun = momen berbagi).
- PWA: tombol "Pasang Aplikasi" (Android prompt / petunjuk iOS); aplikasi terpasang kebal penghapusan data Safari 7 hari.

## Monetisasi (belum ada; pagar pengaman)

Boleh: kosmetik (tema papan, bingkai Kartu Kenangan, baju Merpi), paket soal/kartu tematik, dukungan sukarela.
**Tidak boleh**: apa pun yang memberi keuntungan permainan (melanggar keadilan kursi), iklan yang mengganggu giliran,
data pribadi untuk iklan (Google Signals & personalisasi iklan sengaja mati).

## Positioning

Aplikasi pasangan populer berbasis pertanyaan harian/streak (mis. Paired, Agape) — Loveopoly membedakan diri sebagai
**board game** (strategi + tantangan berdua) yang bisa jarak jauh, gratis, tanpa akun, privasi di perangkat, dan streak
**mingguan** (tidak menghukum). Untuk analisis pesaing mendalam pakai skill eksternal
`product-management:competitive-brief`; untuk tinjauan metrik `product-management:metrics-review`.
