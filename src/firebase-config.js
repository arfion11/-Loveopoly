/* LOVEOPOLY — konfigurasi web Firebase. Nilai ini memang publik (dikirim ke browser); keamanan dijaga aturan
   di firestore.rules & database.rules.json. Uji memakai emulator: LOVE_FIREBASE.emulator = { host }. */
(function (G) {
  'use strict';
  G.LOVE_FIREBASE = G.LOVE_FIREBASE || { apiKey: '', authDomain: '', projectId: '', databaseURL: '', appId: '' };
})(typeof window !== 'undefined' ? window : globalThis);
