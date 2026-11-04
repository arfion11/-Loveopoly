# Loveopoly di Firebase (hosting sendiri, gratis) — desain

Tanggal: 2026-11-04 · Status: menunggu review

## Tujuan

Loveopoly bisa dimainkan online dari URL sendiri (`https://<project>.web.app`) tanpa bergantung pada artifact Claude,
dengan biaya Rp0 (paket Firebase Spark, tanpa kartu kredit).

**Pemakai:** pribadi + teman (paling banyak belasan room per hari).

**Berhasil bila:**
- dua orang di jaringan berbeda bisa membuat & bergabung room dengan kode lalu main sampai selesai;
- main lokal / lawan AI tetap jalan tanpa memuat Firebase;
- aturan database menolak penulisan yang tidak sah (diuji di emulator);
- semua uji lama lulus tanpa error konsol.

**Keputusan yang sudah diambil**
- Login: anonim otomatis (Firebase Auth Anonymous). Tanpa daftar akun.
- Versi artifact Claude ditinggalkan; kode khusus `window.claude` dihapus.
- Semua di Firebase: Hosting + Firestore + Auth + Realtime Database (presence).

**Di luar cakupan:** login Google, domain sendiri, pembersihan otomatis room lama (Cloud Functions butuh paket berbayar),
batas penyalahgunaan untuk publik besar.

## Arsitektur

```
Browser: dist/index.html (satu file, Firebase Hosting, CDN + HTTPS)
 ├─ game lokal/AI (engine, ui)  → tidak memuat Firebase
 └─ mode online: net.js (logika host/intent/ack/baseSeq TIDAK berubah)
      └─ backend.js (BARU) — adapter dengan bentuk API seperti capability artifact lama
           ├─ user  : Auth anonim            → id()
           ├─ db    : Firestore              → doc/collection/where/get/set/update/delete/onSnapshot/acquire
           └─ room  : Realtime Database      → join(name) → presence/onPeers/onConnection/on/emit/leave
```

### `src/firebase-config.js` (baru)
`window.LOVE_FIREBASE = { apiKey, authDomain, projectId, databaseURL, appId, ... }`. Nilai ini publik (memang dikirim
ke browser); keamanan dijaga aturan database. Disertakan di build sebelum `backend.js`.

### `src/backend.js` (baru) — `window.LoveBackend`
- `LoveBackend.use(name)` → Promise capability (`'db' | 'user' | 'room'`), meniru `claude.use` supaya `net.js` hampir
  tidak berubah.
- **Pemuatan malas:** SDK Firebase compat versi tetap (app, auth, firestore, database) dimuat dari
  `https://www.gstatic.com/firebasejs/<versi>/…-compat.js` lewat `<script>` saat `use()` pertama dipanggil (masuk menu
  online). Gagal muat → Promise ditolak dengan kode `sdk-load`.
- **Auth:** `signInAnonymously()` sekali; `user.id()` = `auth.currentUser.uid`; `user.can()` selalu `true`.
- **Penyimpanan dokumen:** Firestore menolak array bersarang & `undefined`, sementara state game memakainya. Setiap
  dokumen ditulis sebagai `{ __j: JSON.stringify(data), ...kunci_indeks }`. `kunci_indeks` = salinan field skalar
  `hostUid`, `status`, `room`, `uid`, `exp`, `holder` bila ada (dipakai `where` dan aturan keamanan). `data()` mengurai
  `__j`. Dokumen tanpa `__j` dikembalikan apa adanya.
- **API db** yang dipakai `net.js`: `doc(path)` → `{get, set, update, delete, onSnapshot, acquire, collection}`,
  `collection(path)` → `{where(f,'==',v), get, onSnapshot, doc}`; snapshot `{exists, id, data()}`, query
  `{docs, docChanges()}` dengan tipe `added|modified|removed`. `onSnapshot(next, err)` → fungsi berhenti langganan.
- **Kode error** dinormalkan ke yang dipakai `net.js`: `unavailable`, `permission-denied`, `resource-exhausted`,
  `sdk-load`, `auth`.
- **Lease host (`acquire({holder, ttlMs})`)**: transaksi Firestore pada `rooms/<KODE>/locks/host` berisi
  `{uid, holder, exp}` (exp = ms epoch). Berhasil bila dokumen tidak ada, sudah kedaluwarsa, atau `holder` sama.
  Hasil `{acquired, holder, expiresAt}`. `exp` memakai `Date.now()` klien; aturan juga membatasi `exp` maksimal
  `request.time + 60 detik` supaya lease tidak bisa dibuat abadi.
- **Presence (`room.join('lv-<kode>')`)**: RTDB `presence/<KODE>/<uid>` = `{code, uid, client, ts}` dengan
  `onDisconnect().remove()`; `onPeers(cb)` dari nilai `presence/<KODE>`; `onConnection(cb)` dari `.info/connected`;
  `on('sync'|'nudge')` & `emit()` jadi no-op (listener Firestore sudah real-time; polling 6 detik di `net.js` tetap
  sebagai cadangan); `leave()` menghapus node & melepas listener.

### Perubahan `src/net.js`
Hanya `init()` dan `joinPresence()`: `G.claude.use` → `G.LoveBackend.use`, pesan error baru (lihat bawah). Header
komentar diperbarui. Selebihnya tetap.

### Perubahan lain
- `src/ui-screens.js`: `renderOnlineUnavailable()` berisi petunjuk baru (cek internet, coba lagi, bagikan link) +
  tombol **Coba lagi** (reset `Net.initDone`). Hapus pemakaian `G.claude.hot` (boot langsung).
- `src/index.html`: hapus meta `claude:viewport-fit-sides`.
- `build.mjs`: `ORDER` + `firebase-config.js`, `backend.js` sebelum `net.js`. Keluaran `dist/index.html` (halaman lengkap:
  `<!doctype html><html lang="id">`, meta charset/viewport, skeleton CSS) dan `dist/test.html` (sama, untuk uji).
  `dist/loveopoly.html` tidak dibuat lagi.
- `tools/serve.mjs`: sajikan `dist/index.html`; komentar tentang mode online diperbarui.
- `CLAUDE.md`, `README.md`: bagian Publikasi/Online diganti Firebase; pengecualian CDN: Three.js r128 + SDK Firebase
  (dimuat malas). Petunjuk setup project.

## Aturan keamanan

`firestore.rules` (semua butuh `request.auth != null`):

| Path | Baca | Tulis |
|---|---|---|
| `rooms/{kode}` | login | create: `hostUid == auth.uid`; update/delete: `auth.uid` = `uid` lease host yang belum kedaluwarsa (ambil alih host = ambil lease dulu, baru tulis `hostUid`) |
| `rooms/{kode}/locks/host` | login | create/update: data baru `uid == auth.uid`, `exp <= now+60s`, dan (dokumen lama kosong / kedaluwarsa / `uid` lama == `auth.uid`); delete: `uid` lama == `auth.uid` atau kedaluwarsa |
| `lobby/{uid}` | login | `uid == auth.uid` |
| `inbox/{uid}/intents/{id}` | login | `uid == auth.uid` |
| lainnya | — | ditolak |

Room baru: `net.js` menulis dokumen room dulu, baru `acquire()`. Aturan create room cukup `hostUid == auth.uid` dan
dokumen belum ada (kode 6 karakter acak). Update sesudahnya butuh lease.

`database.rules.json`: `presence/$code/$uid` baca: login; tulis: `auth.uid == $uid`. Selain itu ditolak.

Validasi aksi game tetap dilakukan host dengan engine (lapis kedua).

## Deploy

- File baru: `firebase.json` (hosting `public: dist`, abaikan `test.html`; header `cache-control: no-cache` untuk
  `index.html`; aturan Firestore & RTDB), `.firebaserc`, `firestore.rules`, `database.rules.json`,
  `firestore.indexes.json` (kosong; `where` satu field tidak butuh indeks komposit).
- `package.json`: `deploy` = `npm run build && npx firebase-tools deploy`; devDependency `firebase-tools`,
  `@firebase/rules-unit-testing`, `firebase` (untuk uji aturan).
- Langkah manual sekali (dipandu): buat project; Authentication → Anonymous aktif; Firestore (`asia-southeast2`);
  Realtime Database (`asia-southeast1`, mode terkunci); daftarkan app web → isi `firebase-config.js`;
  `npx firebase-tools login`.

## Penanganan error (teks UI)

| Kondisi | Pesan |
|---|---|
| `sdk-load` / offline | "Layanan online tidak bisa dihubungi. Periksa koneksi internetmu, lalu coba lagi." |
| `auth` (anonim gagal / belum diaktifkan) | "Gagal masuk ke server game. Coba lagi sebentar lagi." |
| `permission-denied` | "Aksi ditolak server." (lewat `onDbError`/toast yang sudah ada) |
| `resource-exhausted` | "Server sedang penuh untuk hari ini. Coba lagi besok, ya." |

Mode lokal & AI tidak terpengaruh kegagalan Firebase.

## Pengujian

1. **`test/online.js`**: mock pindah dari `window.claude` ke `window.LoveBackend` (API sama, berbasis localStorage).
   Semua skenario host/tamu/ack/baseSeq/reconnect tetap.
2. **`test/rules.js` (baru)**: Firebase Emulator (Firestore + RTDB) + `@firebase/rules-unit-testing`. Kasus: tamu tidak
   bisa update room; host dengan lease bisa; lease tidak bisa direbut sebelum kedaluwarsa, bisa sesudahnya; `exp`
   terlalu jauh ditolak; tidak bisa menulis `lobby`/`inbox`/`presence` milik uid lain; tanpa login semua ditolak.
   Butuh Java (terpasang: OpenJDK 17; bila versi `firebase-tools` meminta Java 21, pakai versi `firebase-tools`
   yang masih mendukung 17 atau pasang JDK 21 dengan izin).
3. **`test/backend.js` (baru, emulator)**: adapter sungguhan terhadap emulator: round-trip `__j` (array bersarang),
   `where`+`docChanges`, `acquire` bersaing antar dua klien, presence muncul/hilang.
4. Semua uji lama (`sim`, `flows`, `ui`) lulus, tanpa error konsol.
5. **Uji asap setelah deploy**: dua browser (biasa + incognito) buat/gabung room, main beberapa giliran, tutup satu
   tab → status offline muncul.

## Risiko

- Kuota Spark (50 rb baca / 20 rb tulis Firestore per hari) jauh di atas pemakaian pribadi; tiap aksi ≈ 1 tulis room
  + 1 intent + baca oleh pemain.
- Room lama menumpuk (tanpa Cloud Functions). Ukuran kecil; host bisa menghapus room. Bisa ditambah pembersihan
  manual nanti.
- Jam klien yang melenceng memengaruhi `exp` lease; dibatasi aturan `≤ now+60s`, dan lease tetap diperpanjang tiap 15
  detik seperti sekarang.
