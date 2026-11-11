---
name: loveopoly-rilis
description: Alur rilis Loveopoly dari working tree sampai live & CI hijau — check, build, uji yang relevan, commit (format pesan + Co-Authored-By), push, deploy Firebase, verifikasi bundle live, pantau GitHub Actions, plus rollback & penanganan insiden produksi. Pakai setiap kali pengguna bilang "commit, push, dan deploy", "rilis", "deploy", "naikkan ke live", "cek CI", atau saat situs live bermasalah setelah deploy (layar putih, fitur tidak muncul, CI merah, kuota Firebase).
---

# Rilis Loveopoly

Pengguna hampir selalu menutup satu putaran kerja dengan "commit, push, dan deploy". Tujuan skill ini: rilis yang
tidak pernah membuat situs live rusak, dengan bukti di tiap langkah. **Commit/push/deploy hanya bila pengguna
memintanya secara eksplisit** — persetujuan sebelumnya tidak berlaku untuk perubahan berikutnya.

## Sebelum commit

1. `git status --short` — pastikan hanya berkas yang memang diubah (jangan ikutkan `test/out/`, berkas scratch).
2. Uji yang relevan sudah lulus **di build terbaru** (uji browser melayani `dist/`, jadi `npm run build` dulu):
   - selalu: `npm run check` (lint + prettier + typecheck)
   - engine/aturan: `npm run test:sim` (+ `test:progress` bila menyentuh `src/ui/progress.js`/`daily.js`/`backup.js`)
   - UI: `npm run test:flows` (harus "Tanpa error konsol"), `npm run test:a11y` (0 pelanggaran), `npm run test:ui`
   - online/net: `npm run test:online`; aturan Firestore/RTDB: `npm run test:rules`
   - data tersimpan / impor: `npm run test:migrate`
   Jalankan yang lama (flows, a11y, online, ui) di latar belakang dan tunggu notifikasinya.
3. CLAUDE.md diperbarui bila aturan/arsitektur berubah (CI tidak mengeceknya, reviewer manusia membacanya).

## Commit, push, deploy

```bash
git add <berkas> && git commit -q -F - <<'MSG'
<tipe>(<area>): <ringkasan bahasa Indonesia>

- poin perubahan (apa & kenapa), angka uji/simulasi bila ada
Co-Authored-By: <baris atribusi dari system reminder sesi ini>
MSG
git push -q origin main
npm run deploy -- --project prod     # build + hosting + aturan
```

- Tipe: `feat`, `fix`, `test`, `docs`, `perf`, `refactor`. Area contoh: `game`, `beranda`, `paspor`, `harian`, `online`.
- Berada di `main` adalah alur normal proyek ini (deploy langsung dari main).
- Deploy gagal karena API RTDB timeout (pernah terjadi) dan aturan tidak berubah → `npx firebase deploy --only hosting --project prod`, lalu jelaskan ke pengguna.

## Verifikasi (jangan klaim "live" tanpa ini)

```bash
.claude/skills/loveopoly-rilis/scripts/verify-live.sh "<teks khas fitur baru>"
.claude/skills/loveopoly-rilis/scripts/ci-status.sh --wait     # run_in_background, tunggu notifikasi
```

Laporkan: hash commit, URL live, bundle sama dengan build lokal, penanda fitur ada, status CI (atau "masih berjalan,
saya kabari"). Saat CI selesai, kabarkan hasilnya walau pengguna tidak bertanya.

## Waktu deploy yang sensitif

Perubahan yang bergantung tanggal (mis. `SWITCH` Pertanyaan Hari Ini, edisi khusus) harus live **sebelum** tanggal
berlakunya (00.00 WIB). Sebutkan tenggatnya ke pengguna saat meminta izin deploy.

## Insiden & rollback

| Gejala | Cek pertama |
| --- | --- |
| Fitur baru tidak muncul | `verify-live.sh`; service worker: halaman jaringan-dulu, coba muat ulang / tutup-buka PWA |
| Layar putih / error | konsol di build produksi (`npm run preview`), `reportError` di GA4 (event `exception`) |
| CI merah | buka URL run dari `ci-status.sh`; uji yang mengunci data harian/tanggal paling sering rapuh |
| Online macet | kuota Spark (Firestore 50 rb baca / 20 rb tulis per hari), Firebase Status, `npm run test:rules` |

Rollback cepat: Firebase Console → Hosting → riwayat rilis → **Rollback** ke versi sebelumnya (aturan Firestore/RTDB
tidak ikut mundur; deploy ulang aturan lama dari git bila perlu). Lalu perbaiki di main dengan commit `fix`, uji, deploy.
