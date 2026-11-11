---
name: loveopoly-produk
description: Kerja product manager untuk Loveopoly — memilah ide fitur, menulis spesifikasi singkat yang sesuai aturan proyek (keadilan kursi, mode lokal/AI/online, privasi data di perangkat, kuota Firebase gratis, aksesibilitas), menyusun prioritas & roadmap, dan merencanakan rilis bertanggal. Pakai saat pengguna bertanya "planning kita apa lagi", "usulan fitur", "prioritas", "roadmap", "riset gamifikasi", minta PRD/spec, atau saat sebuah ide perlu dinilai sebelum dikerjakan.
---

# Produk Loveopoly

Pengguna (pemilik produk) suka usulan yang **berbasis data, berurutan prioritas, dengan rekomendasi jelas**, lalu
memutuskan dengan kalimat pendek ("kerjakan", "nomor 1 saja", "commit, push, dan deploy"). Jangan mengerjakan hal yang
belum dipilih; ajukan pilihan yang benar-benar butuh keputusan dia.

## Menilai ide (tanya ini dulu)

1. **Masalah nyata?** Bukti: simulasi (`loveopoly-keseimbangan`), analitik GA4 (`loveopoly-bisnis`), keluhan pengguna.
2. **Untuk siapa?** Pasangan LDR (online, utama), pasangan satu HP, teman 3–4 orang, solo lawan AI.
3. **Adil?** Tidak memberi keuntungan permainan ke kursi/pemain tertentu; hadiah progres hanya kosmetik.
4. **Semua mode?** Lokal, Lawan AI, Online (host-authoritative), 2 vs 3–4 pemain, HP & desktop.
5. **Data & privasi?** Tetap di perangkat bila bisa; masuk `normProfile` + Cadangan Paspor; teks Privasi jujur.
6. **Biaya?** Paket Spark gratis (Firestore 50 rb baca/20 rb tulis per hari, RTDB 100 koneksi, Hosting ±360 MB/hari).
   Fitur yang butuh server berbayar (push, TTL, Cloud Functions) menunggu Blaze.
7. **Ringan?** HP lemah: animasi transform/opacity, tanpa pustaka runtime baru.

## Format spesifikasi singkat

```
# <Nama fitur>
Masalah & bukti: …
Tujuan (angka): mis. tantangan per pemain 1 → 3–4; Soulmate 3% → ±25%
Bukan tujuan: …
Perilaku: aturan engine / alur UI per mode (lokal, AI, online; 2 dan 3–4 pemain)
Data & privasi: apa yang disimpan, di mana, ikut cadangan?
Dampak keadilan & keseimbangan: hasil simulasi sebelum/sesudah
Risiko & mitigasi: HP lemah, Safari, kuota, data lama (migrasi)
Uji: sim / flows / a11y / online / screenshot
Rilis: tenggat tanggal (mis. 00.00 WIB), urutan deploy, cara mematikan (sakelar)
```

Bila pengguna minta dokumen untuk dibagikan, tulis untuk pembacanya (skill eksternal `product-management:write-spec`
atau `doc-coauthoring` bisa dipakai), dan sebut audiensnya di baris pertama balasan.

## Prioritas

Urutkan dengan: dampak ke jiwa game pasangan (momen berdua, rasa kangen, kebiasaan mingguan) × kepastian bukti ÷
biaya/risiko. Waktu kalender penting (rekap akhir tahun, edisi tanggal khusus WIB) — sebutkan tenggatnya.

## Roadmap

`references/roadmap.md` berisi yang sudah rilis, antrean, dan keputusan yang menunggu pemilik produk. Baca sebelum
menjawab "planning kita apa lagi"; perbarui setelah fitur rilis atau keputusan diambil.
