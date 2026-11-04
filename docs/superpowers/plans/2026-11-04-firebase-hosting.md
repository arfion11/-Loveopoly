# Loveopoly di Firebase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loveopoly dihosting sendiri di Firebase (gratis) dengan mode online memakai Firestore + Auth anonim + RTDB, menggantikan database artifact Claude.

**Architecture:** Adapter baru `src/backend.js` (`window.LoveBackend.use('db'|'user'|'room')`) meniru API capability artifact, sehingga `net.js` hanya berubah di inisialisasi. SDK Firebase compat dimuat malas saat menu online dibuka. Build menghasilkan `dist/index.html` yang di-deploy ke Firebase Hosting.

**Tech Stack:** JS biasa (IIFE, global `window.Love*`), Firebase JS SDK compat 10.14.1 (CDN gstatic), firebase-tools 13.35.1 (emulator, deploy; mendukung Java 17), @firebase/rules-unit-testing 3.0.4 + firebase 10.14.1 (uji), Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-11-04-firebase-hosting-design.md`

## Global Constraints

- Semua teks UI Bahasa Indonesia, santai & hangat.
- Main lokal / lawan AI tidak boleh memuat Firebase (SDK baru dimuat saat `LoveBackend.use()` pertama).
- Pustaka luar runtime hanya Three.js r128 dan SDK Firebase compat `10.14.1` dari `https://www.gstatic.com/firebasejs/10.14.1/` (`firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-firestore-compat.js`, `firebase-database-compat.js`).
- Logika host/intent/ack/baseSeq di `net.js` tidak diubah; hanya `init()`, `joinPresence()`, header komentar, dan teks error.
- Dokumen Firestore ditulis `{ __j: JSON.stringify(data), ...kunci_indeks }`, kunci indeks = field skalar `hostUid`, `status`, `room`, `uid`, `exp`, `holder` bila ada.
- Lease: `rooms/<KODE>/locks/host` = `{uid, holder, exp}`; aturan menolak `exp > request.time + 60 s`.
- Lokasi: Firestore `asia-southeast2`, RTDB `asia-southeast1`. Project emulator: `demo-loveopoly`.
- Sebelum menyatakan selesai: `npm test` lulus tanpa error konsol (aturan CLAUDE.md).

## Review Focus

1. **Muat ulang halaman / buka lagi besok** → uid anonim harus sama (persistensi Auth bawaan `LOCAL`), sehingga kursi di room tetap milik pemain. Uji: Task 2 `uid tetap setelah reload`.
2. **Internet putus lalu kembali saat main** → listener Firestore mengirim error/`unavailable` lalu pulih; `net.js` sudah resubscribe pada `unavailable`, jadi adapter harus meneruskan kode itu persis. Uji: Task 2 `error dinormalkan` (kode `unavailable`, `permission-denied`, `resource-exhausted`).
3. **CDN gstatic diblokir / offline saat membuka menu online** → layar "belum bisa dipakai" dengan tombol Coba lagi, bukan spinner abadi. Uji: Task 5 `sdk gagal dimuat → layar petunjuk + Coba lagi`.
4. **Dua klien merebut host bersamaan** (host lama kembali online) → tepat satu yang `acquired: true`. Uji: Task 3 `acquire bersaing`.
5. **Safari mode privat / penyimpanan diblokir** → Auth tetap jalan (persistensi jatuh ke memori), game tetap bisa online selama tab terbuka. Uji: Task 2 `auth jalan tanpa IndexedDB` (init script menghapus `indexedDB`).

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `src/firebase-config.js` (baru) | `window.LOVE_FIREBASE` = config web (+ `emulator` opsional untuk uji) |
| `src/backend.js` (baru) | `window.LoveBackend`: muat SDK, auth anonim, adapter db/user/room |
| `src/net.js` | ganti `G.claude.use` → `G.LoveBackend.use`, pesan error |
| `src/ui-screens.js` | layar online tidak tersedia + Coba lagi; hapus `G.claude.hot` |
| `src/index.html` | hapus meta `claude:` |
| `build.mjs`, `tools/serve.mjs` | ORDER baru, keluaran `dist/index.html` |
| `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `database.rules.json` (baru) | hosting + aturan |
| `test/rules.js` (baru) | uji aturan di emulator |
| `test/backend.js` (baru) | uji adapter sungguhan di emulator lewat Playwright |
| `test/online.js` | mock pindah ke `window.LoveBackend` |
| `package.json`, `CLAUDE.md`, `README.md` | skrip, dependensi, dokumentasi |

---

### Task 1: Build halaman mandiri + kerangka backend

**Files:**
- Create: `src/firebase-config.js`, `src/backend.js` (kerangka)
- Modify: `build.mjs`, `tools/serve.mjs`, `src/index.html`, `src/ui-screens.js:601-605`, `.gitignore`
- Test: uji yang ada (`npm run test:flows`, `npm run test:ui`)

**Interfaces:**
- Produces: `ORDER = ['data.js','engine.js','ai.js','icons.js','art.js','audio.js','bg3d.js','ui-core.js','ui-modals.js','firebase-config.js','backend.js','net.js','guide.js','ui-screens.js']`; `build()` menulis `dist/index.html` dan `dist/test.html` (isi identik: halaman lengkap), mengembalikan byte. `window.LOVE_FIREBASE = { apiKey:'', authDomain:'', projectId:'', databaseURL:'', appId:'' }` (diisi di Task 7). `window.LoveBackend = { use(name): Promise<object> }` — di task ini `use` menolak dengan `{ code: 'sdk-load' }`.

- [ ] **Step 1:** `build.mjs`: SKELETON jadi `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">` + style skeleton yang ada + `</head><body>`; tulis `dist/index.html` & `dist/test.html`; hentikan `dist/loveopoly.html` dan hapus file lama itu. Komentar kepala file diperbarui (bukan artifact lagi).
- [ ] **Step 2:** `src/index.html`: hapus `<meta name="claude:viewport-fit-sides" …>`. `src/ui-screens.js`: hapus `hot`; boot = `start({})` saat DOM siap (`DOMContentLoaded` atau langsung).
- [ ] **Step 3:** `tools/serve.mjs`: `/` menyajikan `dist/index.html`; komentar online diperbarui.
- [ ] **Step 4:** Run `npm run build && npm run test:flows && npm run test:ui` → Expected: `48/48 lulus`, `ERRORS (0)`.
- [ ] **Step 5:** Commit `build: halaman mandiri dist/index.html + kerangka backend`.

---

### Task 2: Adapter db + user (Firestore, Auth anonim)

**Files:**
- Modify: `src/backend.js`, `package.json`
- Create: `test/backend.js`, `firebase.json` (bagian `emulators` saja di task ini: auth 9099, firestore 8080, database 9000, ui nonaktif), `.firebaserc` (`{"projects":{"default":"demo-loveopoly"}}`)

**Interfaces:**
- Consumes: `window.LOVE_FIREBASE` (Task 1); bila `LOVE_FIREBASE.emulator = { host: '127.0.0.1' }`, sambungkan Auth `http://host:9099`, Firestore `host:8080`, RTDB `host:9000`.
- Produces:
  - `LoveBackend.use('user')` → `{ id(): Promise<string>, can(perm): Promise<true> }`
  - `LoveBackend.use('db')` → `db` dengan `doc(path) → DocRef`, `collection(path) → Query`
  - `DocRef`: `id, path, get(): Promise<Snap>, set(data), update(data), delete(), onSnapshot(next, err) → unsub, collection(sub) → Query, acquire(opts)` (acquire diisi Task 3)
  - `Query`: `where(field, '==', value) → Query, get(): Promise<QSnap>, onSnapshot(next, err) → unsub, doc(id?) → DocRef`
  - `Snap`: `{ id, exists, data() }` (`data()` mengurai `__j`); `QSnap`: `{ docs: Snap[], size, empty, docChanges(): [{type:'added'|'modified'|'removed', doc: Snap}] }`
  - Error yang dilempar/diteruskan: objek `{ code, message }`, `code` ∈ `unavailable | permission-denied | resource-exhausted | sdk-load | auth | <kode Firestore lain tanpa prefiks firestore/>`
  - `LoveBackend._reset()` (untuk tombol Coba lagi): lupakan promise muat/auth yang gagal.
  - `LoveBackend._normErr(e) → {code, message}`: buang prefiks `firestore/`/`auth/`, petakan `network-request-failed` → `unavailable`, `quota-exceeded` → `resource-exhausted`.
- Pemuatan: sisipkan 4 `<script>` gstatic berurutan, satu Promise bersama; gagal → `{code:'sdk-load'}`. Auth: `signInAnonymously()` sekali (Promise bersama); gagal → `{code:'auth'}`. Firestore `experimentalAutoDetectLongPolling: true`.

- [ ] **Step 1: Tambah devDependency & skrip**: `firebase-tools@13.35.1`, `firebase@10.14.1`, `@firebase/rules-unit-testing@3.0.4`; skrip `"test:backend": "firebase-tools emulators:exec --project demo-loveopoly --only auth,firestore,database \"node test/backend.js\""`. Run `npm install`.
- [ ] **Step 2: Tulis `test/backend.js`** (Playwright, pola `test/online.js`): rute `https://www.gstatic.com/firebasejs/10.14.1/<f>` → `node_modules/firebase/<f>`; init script set `LOVE_FIREBASE = {apiKey:'demo', projectId:'demo-loveopoly', databaseURL:'http://127.0.0.1:9000?ns=demo-loveopoly', emulator:{host:'127.0.0.1'}}`. Kasus (assert, cetak `PASS/FAIL`, keluar 1 bila ada FAIL):
  - `uid ada`: `id()` string non-kosong.
  - `uid tetap setelah reload`: reload halaman → `id()` sama.
  - `round-trip __j`: `set({hostUid:uid, state:{grid:[[1,[2]],[3]]}, x:undefined})` lalu `get().data()` deep-equal `{hostUid:uid, state:{grid:[[1,[2]],[3]]}}`; dokumen mentah (lewat SDK langsung) punya field `hostUid` dan `__j`.
  - `where + docChanges`: dua dokumen `lobby/<uid>` & lain dengan `room:'ABC123'`/`'ZZZ999'`; `collection('lobby').where('room','==','ABC123').onSnapshot` → pertama `added` 1 dok; `delete()` → `removed`.
  - `error dinormalkan`: tulis ke `rooms/X` tanpa aturan izin (emulator tanpa aturan = semua boleh; pakai path yang aturan Task 4 tolak nanti — di task ini panggil helper internal `LoveBackend._normErr({code:'firestore/unavailable'})` → `code:'unavailable'`, juga `permission-denied`, `resource-exhausted`).
  - `auth jalan tanpa IndexedDB`: konteks baru dengan init script `delete window.indexedDB` → `id()` tetap string.
- [ ] **Step 3:** Run `npm run test:backend` → Expected: FAIL (`use` masih menolak `sdk-load`).
- [ ] **Step 4: Implementasikan** di `src/backend.js` sesuai Interfaces (encode/decode `__j`, pemetaan snapshot, `onSnapshot` meneruskan error lewat `_normErr`).
- [ ] **Step 5:** Run `npm run test:backend` → Expected: semua `PASS`, exit 0.
- [ ] **Step 6:** Commit `feat(backend): adapter Firestore + auth anonim`.

---

### Task 3: Lease host + presence (RTDB)

**Files:**
- Modify: `src/backend.js`, `test/backend.js`

**Interfaces:**
- Consumes: `DocRef` (Task 2).
- Produces:
  - `DocRef.acquire({ holder: string, ttlMs: number })` → `Promise<{ acquired: boolean, holder: string, expiresAt: string }>`; transaksi Firestore: tulis `{uid: authUid, holder, exp: Date.now()+min(ttlMs, 60000)}` bila dokumen tidak ada, `exp < Date.now()`, atau `holder` sama; selain itu `acquired:false`, `holder` & `expiresAt` dari dokumen lama.
  - `LoveBackend.use('room')` → `{ join(name) → Promise<Named> }`; nama `'lv-<kode kecil>'` → node `presence/<KODE BESAR>`.
  - `Named`: `presence(obj) → Promise` (tulis `presence/<KODE>/<uid>` = `{...obj, ts: serverTimestamp}` + `onDisconnect().remove()`), `onPeers(cb) → unsub` (`cb({peers:[{by: uid, presence: obj}]})`), `onConnection(cb) → unsub` (`.info/connected` boolean), `on(topic, cb) → unsub` (no-op), `emit() → Promise.resolve()`, `leave()` (hapus node, lepas semua listener).

- [ ] **Step 1: Tambah kasus di `test/backend.js`:**
  - `acquire pertama`: A `acquire({holder:'a',ttlMs:45000})` → `acquired:true`.
  - `acquire bersaing`: dua halaman (uid berbeda) memanggil `acquire` serentak pada lock baru → tepat satu `true`.
  - `acquire diperpanjang pemegang`: A lagi → `true`; B → `false`, `holder:'a'`.
  - `acquire setelah kedaluwarsa`: A dengan `ttlMs: 300`, tunggu 500 ms, B → `true`.
  - `presence`: A & B `join('lv-abc123')` + `presence({code:'ABC123',uid})` → `onPeers` A melihat 2 `by`; B `leave()` → A melihat 1.
- [ ] **Step 2:** Run `npm run test:backend` → Expected: kasus baru FAIL.
- [ ] **Step 3:** Implementasikan `acquire` dan `room` sesuai Interfaces.
- [ ] **Step 4:** Run `npm run test:backend` → Expected: semua PASS.
- [ ] **Step 5:** Commit `feat(backend): lease host + presence RTDB`.

---

### Task 4: Aturan keamanan + konfigurasi hosting

**Files:**
- Create: `firestore.rules`, `firestore.indexes.json` (`{"indexes":[],"fieldOverrides":[]}`), `database.rules.json`, `test/rules.js`
- Modify: `firebase.json` (tambah `hosting`, `firestore`, `database`), `package.json`

**Interfaces:**
- `firebase.json` hosting: `public: "dist"`, `ignore: ["test.html", "**/.*"]`, header `Cache-Control: no-cache` untuk `/index.html` dan `/`.
- Aturan sesuai tabel spec. Lease valid = `get(/databases/$(database)/documents/rooms/$(kode)/locks/host).data.uid == request.auth.uid && …exp > request.time.toMillis()`.
- Skrip: `"test:rules": "firebase-tools emulators:exec --project demo-loveopoly --only firestore,database \"node test/rules.js\""`.

- [ ] **Step 1: Tulis `test/rules.js`** dengan `initializeTestEnvironment({projectId:'demo-loveopoly', firestore:{rules}, database:{rules}})`, konteks `alice`, `bob`, anonim. Kasus (`assertSucceeds`/`assertFails`):
  - tanpa login: baca `rooms/R1` gagal.
  - alice buat `rooms/R1` dengan `hostUid:'alice'` berhasil; bob buat `rooms/R2` dengan `hostUid:'alice'` gagal.
  - alice ambil lock `{uid:'alice',holder:'a',exp:now+45000}` berhasil; `exp:now+600000` gagal.
  - alice update `rooms/R1` (punya lease) berhasil; bob update gagal.
  - bob ambil lock saat lease alice masih berlaku gagal; setelah lock di-set kedaluwarsa (`withSecurityRulesDisabled`) bob berhasil, lalu bob update room berhasil.
  - bob tulis `lobby/bob` berhasil, `lobby/alice` gagal; sama untuk `inbox/alice/intents/x`.
  - RTDB: bob tulis `presence/R1/bob` berhasil, `presence/R1/alice` gagal; tanpa login baca gagal.
  - path lain (`foo/bar`) tulis gagal.
- [ ] **Step 2:** Run `npm run test:rules` → Expected: FAIL (berkas aturan belum ada / izin terbuka).
- [ ] **Step 3:** Tulis `firestore.rules` & `database.rules.json`.
- [ ] **Step 4:** Run `npm run test:rules` → Expected: semua PASS. Run `npm run test:backend` → tetap PASS (emulator memuat aturan dari `firebase.json`; kasus Task 2/3 memakai path & uid yang diizinkan — sesuaikan data uji bila perlu, bukan aturannya).
- [ ] **Step 5:** Commit `feat: aturan keamanan Firestore/RTDB + konfigurasi hosting`.

---

### Task 5: Sambungkan net.js & layar online

**Files:**
- Modify: `src/net.js:1-60,191-212`, `src/ui-screens.js:205-235`, `test/online.js` (MOCK), `test/flows.js` atau `test/ui.js` (kasus layar gagal)

**Interfaces:**
- Consumes: `LoveBackend.use`, `LoveBackend._reset` (Task 2/3).
- Produces: `Net.init()` memakai `G.LoveBackend`; pada gagal `Net.initErr` = salah satu teks persis:
  - `sdk-load`/`unavailable`: `Layanan online tidak bisa dihubungi. Periksa koneksi internetmu, lalu coba lagi.`
  - `auth`: `Gagal masuk ke server game. Coba lagi sebentar lagi.`
  - `resource-exhausted`: `Server sedang penuh untuk hari ini. Coba lagi besok, ya.`
  - lainnya: `Gagal menyiapkan mode online: <pesan>`
- `onDbError`: `permission-denied` → toast `Aksi ditolak server.`; `resource-exhausted` → toast teks penuh di atas.
- `renderOnlineUnavailable()`: judul tetap, `initErr`, catatan "Cara main online" diganti: (1) pastikan internet aktif, (2) bagikan link game ke pasangan, (3) satu orang buat room, yang lain gabung dengan kodenya. Tombol `#oRetry` "Coba lagi" (`Net.initDone=false; LoveBackend._reset(); openOnline()`), plus tombol yang ada.

- [ ] **Step 1:** `test/online.js`: MOCK memasang `window.LoveBackend = { use: async n => ({db, user, room}[n]), _reset(){} }` (objek mock yang sama, tanpa `window.claude`). Tambah kasus di `test/flows.js`: `layar online gagal`: init script `window.LoveBackend = {use: () => Promise.reject({code:'sdk-load'}), _reset(){}}` → buka online → teks `Layanan online tidak bisa dihubungi` dan `#oRetry` terlihat.
- [ ] **Step 2:** Run `npm run build && npm run test:online && npm run test:flows` → Expected: FAIL (net.js masih `G.claude`).
- [ ] **Step 3:** Ubah `net.js` & `ui-screens.js` sesuai Interfaces; komentar kepala `net.js` menyebut Firestore.
- [ ] **Step 4:** Run `npm test` → Expected: semua lulus, `ERRORS (0)`, tanpa error konsol. Pastikan `grep -n "claude" src/*.js` kosong.
- [ ] **Step 5:** Commit `feat(net): mode online lewat Firebase`.

---

### Task 6: Skrip deploy & dokumentasi

**Files:**
- Modify: `package.json`, `CLAUDE.md`, `README.md`

- [ ] **Step 1:** `package.json`: `"deploy": "npm run build && firebase-tools deploy --only hosting,firestore,database"`; `"test"` menambah `test:rules` dan `test:backend` di akhir; deskripsi tanpa "artifact Claude".
- [ ] **Step 2:** `CLAUDE.md`: bagian Online (Firestore/RTDB/Auth, `backend.js`, format `__j`, emulator), Publikasi (`npm run deploy`, URL hosting), aturan CDN (Three.js + SDK Firebase dimuat malas), hapus rujukan artifact/`window.claude`. `README.md`: setup project Firebase langkah demi langkah (6 langkah dari spec), perintah dev/uji/deploy.
- [ ] **Step 3:** Run `npm test` → Expected: semua lulus.
- [ ] **Step 4:** Commit `docs: hosting Firebase`.

---

### Task 7: Setup project, deploy, uji asap (bersama pengguna)

**Files:**
- Modify: `src/firebase-config.js`, `.firebaserc` (tambah alias `prod`)

- [ ] **Step 1:** Pandu pengguna di console.firebase.google.com: buat project; Authentication → Anonymous aktif; Firestore (`asia-southeast2`, mode produksi); Realtime Database (`asia-southeast1`, mode terkunci); daftarkan app web; salin config. Cek ulang kuota Spark di halaman Usage.
- [ ] **Step 2:** Isi `src/firebase-config.js` dengan config; `.firebaserc` `"prod": "<projectId>"`; pengguna menjalankan `! npx firebase-tools login`.
- [ ] **Step 3:** Run `npm run deploy -- --project prod` → Expected: `Deploy complete!` + `Hosting URL: https://<projectId>.web.app`.
- [ ] **Step 4:** Uji asap: Playwright dua konteks pada URL hosting — host buat room, tamu gabung, mulai, masing-masing 2 giliran; tutup tamu → chip Offline di host. Tanpa error konsol.
- [ ] **Step 5:** Commit `chore: config project Firebase` dan push ke GitHub (dengan persetujuan).
