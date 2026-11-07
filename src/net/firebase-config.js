/* LOVEOPOLY — konfigurasi web Firebase. Nilai ini memang publik (dikirim ke browser); keamanan dijaga aturan
   di firestore.rules & database.rules.json. Uji memakai emulator: LOVE_FIREBASE.emulator = { host }.
   appCheckSiteKey: kunci situs reCAPTCHA Enterprise (Google Cloud Fraud Defense, publik) untuk Firebase App Check.
   Kosong = App Check mati & SDK-nya tidak dimuat. Isi setelah kunci didaftarkan di Firebase Console → App Check. */
window.LOVE_FIREBASE = window.LOVE_FIREBASE || {
  apiKey: 'AIzaSyD8tdvMNOBMeIDx3mTdcfphYauL-QxV3ww',
  authDomain: 'loveopoly-5b227.firebaseapp.com',
  databaseURL: 'https://loveopoly-5b227-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'loveopoly-5b227',
  appId: '1:392894236949:web:db735a0c9bbe40ff89c11c',
  appCheckSiteKey: '',
};
