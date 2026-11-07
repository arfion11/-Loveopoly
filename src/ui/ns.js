/* LOVEOPOLY — registri UI bersama.
   Modul UI mengimpor kebutuhannya secara eksplisit (import { … } from './core.js'). Objek ini hanya dipakai untuk
   panggilan "ke atas" yang dipasang belakangan oleh modul lain (mis. inti memanggil UI.syncModal dari modals.js,
   modals memanggil UI.enterGame dari screens.js), supaya tidak ada impor melingkar saat modul dievaluasi.
   src/main.js juga memasangnya di window.LoveUI sebagai kait uji & debug. */
export const UI = {};
