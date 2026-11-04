/* LOVEOPOLY — backend online di Firebase (Firestore + Auth anonim + Realtime Database).
   LoveBackend.use('db' | 'user' | 'room') memberi objek dengan bentuk API yang dipakai net.js. */
(function (G) {
  'use strict';
  const LoveBackend = {
    use() { return Promise.reject({ code: 'sdk-load', message: 'Backend belum tersedia.' }); }
  };
  G.LoveBackend = LoveBackend;
})(typeof window !== 'undefined' ? window : globalThis);
