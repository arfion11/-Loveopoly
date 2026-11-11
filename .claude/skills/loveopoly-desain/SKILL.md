---
name: loveopoly-desain
description: Sistem desain & identitas Loveopoly untuk desainer/pengembang UI — token warna & dua tema, tipografi Fredoka/Nunito, maskot Merpi, seni SVG orisinal, tata letak 4 mode (wide/mid/compact/land), kesan "mewah tapi ringan", aksesibilitas, dan penulisan UX Bahasa Indonesia yang hangat. Pakai saat merancang layar/komponen/dialog baru, mengubah gaya CSS, menulis teks UI/tombol/toast/error, membuat aset (ikon, og-image, ilustrasi), atau menilai apakah tampilan "sudah bagus".
---

# Desain Loveopoly

Board game pasangan LDR & teman: hangat, main-main, sedikit mewah, **bukan** tiruan Get Rich/Monopoly (aset, nama,
branding). Pengguna mayoritas di HP; banyak HP kelas bawah → indah tapi hemat.

## Fondasi

| Bagian | Aturan |
| --- | --- |
| Warna | Hanya token di `src/styles/tokens.css` (`--brand`, `--mint`, `--gold`, `--sky`, `--violet`, `--danger`, `--ink`, `--surface`, …) dengan blok tema gelap ganda (media query & `[data-theme="dark"]`). Teks berwarna di atas `*-soft` pakai `*-ink`; `*-d` hanya untuk bayangan/ikon. Tanpa warna literal yang cuma terbaca di satu tema. |
| Tipografi | Display `--fd` Fredoka (judul, tombol, angka besar), isi `--fb` Nunito; font lokal di `src/assets/fonts` (tanpa CDN). Angka lewat `fmt()` format `id-ID`. |
| Tema papan | `BOARD_THEMES` (Klasik, Senja Bali, Paris Malam, Sakura Kyoto) mengganti token papan di `.game` saja; tema baru → `themes.css` + audit kontras `test:a11y`. |
| Seni | SVG orisinal di `src/assets/art.js` (`ART.art(nama)`, `ART.merpi(mood)`); ikon garis di `src/assets/icons.js` (`ic(nama)`); ikon aplikasi satu sumber `public/icon.svg` → `npm run icons`. |
| Maskot | Merpi (merpati pos): mood `is-happy/is-wow/is-think/is-love/…`, reaksi `mascotAct()`, `mascotEmote()`, ucapan `merpiSay()`; Merpi besar di tengah papan saat 3D/HP. Ia penyampai kabar & penyemangat, bukan wasit. |
| Paspor | Benda fisik bergaya tetap (kulit marun, foil emas, kertas krem) di kedua tema. |

## Tata letak

`computeLayout()` (`src/ui/core/layout.js`): `wide` (desktop/tablet mendatar, panel kanan saat 3D), `mid` (tablet
tegak, dok bawah), `compact` (HP tegak), `land` (HP mendatar). Tinggi selalu dikurangi jarak aman iPhone; layar game
tidak pernah tergulir. Header hanya satu tombol menu `#hMenu` — fitur baru masuk menu, bukan tombol header baru. Beranda
pengguna lama: tombol main harus terlihat di layar pertama HP (ukur `#hOnline` di 390×844 & 844×390).

## Arah "mewah tapi ringan"

- Kedalaman dari bayangan bertingkat yang **diam**, gradien halus, foil emas pada momen penting (paspor, Edisi Emas),
  bukan blur kaca (`backdrop-filter` dilarang) atau partikel terus-menerus.
- Satu momen besar per aksi (layar perayaan, stempel, banner acara); hiasan latar tenang dan berhenti saat diam.
- Kartu & tombol: sudut membulat konsisten, tekanan terasa (bayangan bawah tebal yang mengecil saat ditekan).
- Selalu cek dengan mata: `npm run shots -- --preset <…>` (skill `loveopoly-qa-visual`).

## Aksesibilitas (wajib, bukan bonus)

axe WCAG 2.1 AA 0 pelanggaran; tombol berlabel dan nama aksesibel memuat teks terlihat (`.sr-only` sebagai pelengkap);
area gulir `tabindex="0"`; fokus terlihat; gerak dikurangi dihormati; kontras teks petak per tema papan diaudit.

## Teks UI

Ikuti `references/ux-writing.md` (nada, istilah baku permainan, pola tombol/toast/error, kata terlarang).

Untuk kritik desain umum atau arah estetika baru, gabungkan dengan skill eksternal `frontend-design` dan
`design:design-critique` / `design:accessibility-review` / `design:ux-copy` (lihat `.claude/skills/README.md`) —
tapi aturan proyek di atas yang menang bila bertentangan.
