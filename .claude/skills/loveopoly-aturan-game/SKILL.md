---
name: loveopoly-aturan-game
description: Cara menambah atau mengubah aturan permainan Loveopoly di engine murni (src/engine) sampai tampil di UI — kejadian ronde (seperti Kabar Merpi, Musim Puncak, Momen Berdua), petak, kartu, tantangan, hadiah, Love, syarat menang, setelan baru. Pakai skill ini setiap kali tugas menyentuh src/engine/rules, RULES di data.js, E.dispatch/aksi baru, keseimbangan hadiah, atau "tambah fitur di papan/alur permainan", walau pengguna tidak menyebut kata "engine".
---

# Menambah aturan permainan

Engine (`src/engine/`) murni & deterministik: UI lokal, bot, dan host online semuanya hanya memanggil
`E.dispatch(state, action)`. Karena itu setiap aturan harus hidup di engine, bukan di UI — kalau tidak, permainan
online (host-authoritative) dan satu HP akan berbeda hasilnya.

## Peta berkas

| Kebutuhan | Tempat |
| --- | --- |
| Angka/konstanta aturan | `RULES` di `src/engine/data.js` (beri komentar alasannya) |
| Helper bersama (tanpa impor bagian lain) | `src/engine/rules/base.js` → ekspor |
| Awal ronde / giliran | `startRound`, `beginTurn`, `nextTurn` di `rules/turns.js` |
| Bergerak & mendarat | `rules/move.js` (`land`, `meetUp`) |
| Tol, ambil alih, menang instan | `rules/tolls.js` |
| Aksi pemain baru | handler `H.NAMA` di `rules/actions.js` / `rules/challenge-actions.js` |
| Tantangan (jenis, penilai, hadiah) | `rules/challenges.js` (`chType`, `chItem`, `chFinish`) + `CH_TYPES` di data.js |
| Setelan game baru | **`rules/create.js`** — `E.create` hanya menyalin setelan yang dikenal |
| API untuk UI | objek `E` di `rules/dispatch.js` (mis. `newsInfo`, `momentInfo`) |
| Bot | `src/engine/ai.js` (`decide`) |
| Save lama / item buatan tangan | `migrate()` di `rules/challenges.js` |

## Langkah

1. **Tentukan dampak ke keadilan.** Aturan baru wajib simetris antar kursi ("keadilan kursi" di CLAUDE.md): semua
   pemain dapat peluang sama (contoh: Momen Berdua memberi tantangan ke *setiap* pemain di ronde itu). Bonus untuk
   kursi tertentu butuh keputusan pemilik produk.
2. **Tulis aturan di engine.** Kejadian ronde: tandai di state (mis. `S.moment = S.round`) saat `startRound`, lalu
   bertindak di `beginTurn` — keputusan yang disimpan di state membuat semua pemain di ronde itu konsisten walau ada yang
   bangkrut di tengah ronde. Pakai `log()` untuk riwayat dan `ev(S, { t: 'nama' })` untuk animasi UI.
3. **Setelan baru → `create.js`.** Pernah terjadi: sakelar `moment` tidak disalin `E.create`, jadi mematikannya tidak
   berpengaruh; simulasi yang menemukannya. Tambahkan `nama: st.nama !== false` (atau validasi angka dengan `clampInt`).
   Setelan setup lokal juga ikut `KEYS.last` (`enterGame` di `screens/game.js`) & `lastSetup()` di `screens/setup.js`.
4. **Impor melingkar.** `turns.js` ↔ `challenges.js` ↔ `move.js` saling impor; aman selama hanya fungsi yang dipanggil
   saat runtime. Jangan membaca `const` modul lain di tingkat atas modul (TDZ).
5. **Ekspor untuk UI** lewat objek `E` di `dispatch.js` (fungsi info murni, mis. `{ now, next }`), jangan biarkan UI
   menghitung ulang aturan.
6. **Uji engine** di `test/sim.js` (blok IIFE baru dengan `ok(nama, kondisi, detail)`): kasus muncul/tidak muncul,
   semua pemain kebagian, hadiah tepat, setelan mati, 2 vs 3–4 pemain, bot, batas ronde & Musim Puncak. Pola cepat untuk
   membuka ronde r: buat state, set `S.round = r - 1`, `S.turn = { p: terakhir, rolled: true }`, dispatch `END_TURN`.
7. **Setel angka dengan simulasi** (skill `loveopoly-keseimbangan`): `npm run balance:couple` untuk apa pun yang
   menyentuh tantangan/Love, `balance:flow` untuk ekonomi & tempo, `balance:seat` untuk keadilan urutan.
8. **UI**: event di `src/ui/core/flow.js` (`banner`, `merpiSay`, `mascotAct`), status di `core/hud.js` (pil & kartu
   info), suasana di `core/mascot.js` (`renderAmbience`), dialog di `src/ui/modals/*`, sakelar di `screens/setup.js`,
   teks Buku Panduan di `src/ui/guide.js`. Semua teks Bahasa Indonesia santai (skill `loveopoly-desain`).
9. **Uji UI**: `test/flows.js` (alur nyata sampai hadiah), `test/a11y.js` (tampilan baru), screenshot (`npm run shots`).
10. **Dokumentasi**: satu butir ringkas di CLAUDE.md bagian "Aturan peluncuran" (apa, kapan, angka hasil simulasi).

## Jebakan yang sudah pernah terjadi

- Hadiah "semua penilai" di 3–4 pemain melipatgandakan Love → batasi pembagi hadiah sesuai maksud aturan.
- Uji UI yang lama bisa tersandung kejadian ronde baru (mis. tantangan muncul di awal giliran ronde 6) — jalankan
  `test:flows` penuh setelah menambah kejadian.
- Online: tamu hanya menerima state; jangan menaruh keacakan di UI. Semua acak lewat `rint(S, n)` (seed di state).
