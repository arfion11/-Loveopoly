/* LOVEOPOLY 2.0 — Buku Panduan bergambar dengan adegan animasi, dipandu Merpi */
import { UI } from './ns.js';
import { track } from '../analytics.js';
import { App, D, SND, ART, TILES, RULES, esc, ic, $, $$, coin } from './core.js';

const pawn = (c, av, cls) =>
  '<span class="g-pawn ' + (cls || '') + '" style="--c:' + c + '"><span class="tk-pin"></span><span class="tk-av">' + av + '</span></span>';
const mtile = (art, name, cls, extra) =>
  '<span class="g-tile ' +
  (cls || '') +
  '"' +
  (extra || '') +
  '><span class="gt-band"></span><span class="gt-art">' +
  ART.art(art) +
  '</span><b>' +
  esc(name) +
  '</b></span>';
const dice = () =>
  '<span class="g-dice"><span class="g-die d1"><i></i><i></i><i></i><i></i></span><span class="g-die d2"><i></i><i></i><i></i></span></span>';
const coins = n => Array.from({ length: n }, (_, k) => '<i class="g-coin" style="--k:' + k + '"></i>').join('');
const sparks = n =>
  Array.from({ length: n }, (_, k) => '<i class="g-spark" style="--a:' + Math.round((k * 360) / n) + 'deg;--k:' + k + '"></i>').join('');
const PINK = '#FF4F8B',
  VIOLET = '#7B61FF';

const PAGES = [
  {
    id: 'hello',
    title: 'Halo! Aku Merpi',
    say: 'Aku kurir cinta kalian. Yuk keliling dunia berdua!',
    pts: [
      'Keliling 19 kota romantis dan 5 tempat wisata.',
      'Beli kota, bangun sampai landmark, tarik tol dari lawan.',
      'Menang instan dengan Trio Warna, Raja Jalur, atau Kolektor Wisata, atau bikin lawan bangkrut.',
      'Semua pemain mulai dari START dengan modal yang sama. Siapa yang jalan duluan diundi di awal permainan.',
    ],
    scene: () =>
      '<div class="sc sc-hello"><div class="g-orbit">' +
      ['paris', 'bali', 'kyoto', 'santorini', 'hawaii', 'swiss']
        .map((a, k) => '<span class="go-item" style="--k:' + k + '">' + ART.art(a) + '</span>')
        .join('') +
      '</div><span class="g-merpi">' +
      ART.merpi('is-happy') +
      '</span><span class="g-hearts"><i></i><i></i><i></i><i></i></span></div>',
  },
  {
    id: 'dice',
    title: 'Lempar dadu',
    say: 'Dadu kembar? Lempar lagi!',
    pts: [
      'Tekan Lempar, pion jalan searah jarum jam.',
      'Kontrol dadu: bidik Kecil 2–5, Sedang 6–8, atau Besar 9–12 (berhasil ' + Math.round(RULES.aimChance * 100) + '%).',
      'Lewat START = gaji ' + RULES.salary + '. Tiga kali kembar berturut-turut = Pulau Rindu.',
    ],
    scene: () =>
      '<div class="sc sc-dice">' +
      dice() +
      '<div class="g-aim"><span>Kecil</span><span class="on">Sedang</span><span>Besar</span></div><div class="g-row">' +
      ['kotatua', 'bandung', 'card', 'jogja', 'ferris']
        .map((a, k) => mtile(a, TILES.find(t => t.art === a).short, 'sm', ' style="--k:' + k + '"'))
        .join('') +
      pawn(PINK, '🐻', 'walk') +
      '</div></div>',
  },
  {
    id: 'buy',
    title: 'Beli kota + bangun sekaligus',
    say: 'Tanah, villa, gedung, hotel. Sekali jalan!',
    pts: [
      'Mendarat di kota kosong: beli tanahnya dan langsung bangun.',
      'Villa → Gedung → Hotel: makin tinggi, tolnya makin besar.',
      'Hotel terbuka setelah kamu melewati START sekali. Mampir lagi ke kotamu untuk menambah bangunan.',
    ],
    scene: () =>
      '<div class="sc sc-buy" style="--oc:' +
      PINK +
      '"><span class="g-big">' +
      mtile('bali', 'Bali', 'lg') +
      '<span class="gb-flag">' +
      ART.art('flag') +
      '</span><span class="gb-b b1">' +
      ART.art('b1') +
      '</span><span class="gb-b b2">' +
      ART.art('b2') +
      '</span><span class="gb-b b3">' +
      ART.art('b3') +
      '</span></span>' +
      '<div class="g-steps"><span class="s0">Tanah</span><span class="s1">Villa</span><span class="s2">Gedung</span><span class="s3">Hotel</span></div><span class="g-cost">' +
      coin +
      '−585</span></div>',
  },
  {
    id: 'landmark',
    title: 'Landmark: puncak segalanya',
    say: 'Landmark kebal diambil alih. Aman!',
    pts: [
      'Kota yang sudah punya Hotel bisa jadi Landmark saat kamu mampir lagi, atau saat berhenti tepat di START.',
      'Tol Landmark paling besar.',
      'Grup warna penuh membuat tol semua kotanya ×2.',
    ],
    scene: () =>
      '<div class="sc sc-landmark" style="--oc:' +
      PINK +
      '"><span class="g-big">' +
      mtile('paris', 'Paris', 'lg gold') +
      '<span class="gb-b b3 out">' +
      ART.art('b3') +
      '</span><span class="gb-b b4 in">' +
      ART.art('b4') +
      '</span>' +
      sparks(10) +
      '</span><span class="g-shield">' +
      ic('shield') +
      '<b>Kebal</b></span></div>',
  },
  {
    id: 'toll',
    title: 'Bayar tol & ambil alih',
    say: 'Bayar dulu, lalu rebut kotanya!',
    pts: [
      'Mendarat di kota lawan = bayar tol ke pemiliknya.',
      'Setelah bayar, kamu boleh merebut kota itu seharga ' + RULES.takeoverMult + '× nilainya. Bangunan ikut pindah.',
      'Kartu Malaikat Cinta membebaskan tol, Kupon memotongnya setengah.',
    ],
    scene: () =>
      '<div class="sc sc-toll"><span class="g-owner">' +
      UI.avatarHTML({ color: VIOLET, avatar: '🐰' }, 'sm') +
      '</span><span class="g-big">' +
      mtile('seoul', 'Seoul', 'lg owned') +
      '<span class="gb-b b2">' +
      ART.art('b2') +
      '</span><span class="g-stamp">DIAMBIL ALIH</span></span>' +
      pawn(PINK, '🐻', 'drop') +
      '<span class="g-coins">' +
      coins(5) +
      '</span><span class="g-toll">Tol 450</span></div>',
  },
  {
    id: 'spots',
    title: 'Tempat wisata',
    say: 'Kumpulkan kelimanya = menang!',
    pts: [
      'Bianglala, Kebun Bunga, Kereta Gantung, Balon Udara, dan Kapal Pesiar.',
      'Tol wisata naik sesuai jumlah wisata yang kamu punya (' + RULES.spotRent.join(' / ') + ').',
      'Wisata tidak bisa diambil alih. Punya kelimanya = Kolektor Wisata!',
    ],
    scene: () =>
      '<div class="sc sc-spots"><div class="g-row">' +
      ['ferris', 'garden', 'cablecar', 'balloon', 'cruise']
        .map((a, k) => '<span class="g-spot" style="--k:' + k + '">' + ART.art(a) + '</span>')
        .join('') +
      '</div><span class="g-trophy">' +
      ic('trophy') +
      '<b>MENANG!</b></span></div>',
  },
  {
    id: 'fest',
    title: 'Festival Cinta',
    say: 'Pesta! Tol jadi berlipat!',
    pts: [
      'Berhenti di pojok Festival: pilih satu kotamu jadi tuan rumah.',
      'Tol kota itu ×2. Festival lagi di kota yang sama: ×3.',
      'Hanya ada satu festival di papan, jadi lawan bisa memindahkannya.',
    ],
    scene: () =>
      '<div class="sc sc-fest" style="--oc:' +
      PINK +
      '"><span class="g-big">' +
      mtile('santorini', 'Santorini', 'lg owned') +
      '<span class="gb-b b3">' +
      ART.art('b3') +
      '</span><span class="g-mult"><b class="m2">×2</b><b class="m3">×3</b></span>' +
      sparks(12) +
      '</span><span class="g-fest-art">' +
      ART.art('festival') +
      '</span></div>',
  },
  {
    id: 'tour',
    title: 'World Tour',
    say: 'Kencangkan sabuk pengaman~',
    pts: [
      'Berhenti di World Tour: giliran berikutnya kamu boleh terbang ke petak mana pun (tiket ' + RULES.travelFee + ').',
      'Pilih tujuan langsung dengan mengetuk papan.',
      'Lewat START tetap dapat gaji. Boleh juga lempar dadu biasa.',
    ],
    scene: () =>
      '<div class="sc sc-tour"><span class="g-globe">' +
      ART.art('plane') +
      '</span><svg class="g-arc" viewBox="0 0 300 160" aria-hidden="true"><path d="M30 130 Q150 -20 270 120" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round"/></svg><span class="g-flyer">' +
      pawn(PINK, '🐻', '') +
      '<span class="g-plane">' +
      ic('plane') +
      '</span></span>' +
      mtile('maldives', 'Maldives', 'sm dest') +
      '</div>',
  },
  {
    id: 'island',
    title: 'Pulau Rindu',
    say: 'Hiks… tapi ada banyak cara pulang!',
    pts: [
      'Terdampar maksimal ' + RULES.islandTurns + ' giliran.',
      'Dadu kembar = langsung keluar dan jalan. Atau bayar perahu ' + RULES.islandFee + ', atau pakai Tiket Pulang.',
      'Rindu Challenge (sekali per terdampar): selesaikan satu tantangan. Lulus = keluar gratis, gagal = tetap di pulau.',
    ],
    scene: () =>
      '<div class="sc sc-island"><span class="g-isl">' +
      ART.art('island') +
      '</span>' +
      pawn(PINK, '🐻', 'bob') +
      '<span class="g-waves"><i></i><i></i></span><div class="g-opts"><span>' +
      ic('dice') +
      'Kembar</span><span>' +
      ic('boat') +
      RULES.islandFee +
      '</span><span>' +
      ic('heart') +
      'Tantangan</span></div></div>',
  },
  {
    id: 'cards',
    title: 'Kartu Cinta',
    say: 'Kartu apa ya kali ini?',
    pts: [
      'Berhenti di petak Kartu Cinta untuk mengambil 1 dari ' +
        D.CARDS.length +
        ' kartu: rezeki, masalah LDR, perjalanan, aksi, dan tantangan.',
      'Simpan: Malaikat Cinta, Kupon Tol 50%, Tiket Pulang. Aksi: Badai Rindu, Tukar Kota, Festival Kilat, Renovasi Gratis.',
      'Ada juga pilihan nekat, misalnya Taruhan Nekat: dapat 200 tapi ke Pulau Rindu.',
    ],
    scene: () =>
      '<div class="sc sc-cards">' +
      [
        ['Malaikat Cinta', 'Tol jadi 0', 'angel'],
        ['Badai Rindu', 'Bangunan lawan turun 1', 'storm'],
        ['Tukar Kota', 'Tukar kotamu dengan kota lawan', 'swap'],
      ]
        .map(
          (c, k) =>
            '<span class="g-lc" style="--k:' +
            k +
            '"><span class="gc-back">' +
            ART.art('card') +
            '</span><span class="gc-front">' +
            ic(c[2]) +
            '<b>' +
            c[0] +
            '</b><small>' +
            c[1] +
            '</small></span></span>'
        )
        .join('') +
      '</div>',
  },
  {
    id: 'proof',
    title: 'Tantangan wajib terbukti',
    say: 'Tidak ada lagi klik "Selesai". Buktikan!',
    pts: [
      'Mini-game berwaktu dinilai otomatis: Kuis Keliling Dunia, Tebak Harga, Ingat Urutan, Hitung Ongkos, Susun Nama Kota, Tebak Emoji.',
      'Lawan ikut main: Tebak Isi Hati, Dua Fakta Satu Bohong, Peragakan!. Main bertiga atau berempat? Semua lawan ikut menebak, dan hadiah hanya untuk yang benar.',
      'Aksi Berani, Foto Bukti & Surat punya syarat sah yang jelas, dan lawan yang mengesahkan. Bertiga/berempat: semua lawan memilih, suara terbanyak menang (seri = sah). Semua hasil tercatat sebagai bukti di log.',
    ],
    scene: () =>
      '<div class="sc sc-proof">' +
      '<span class="gp-card c1"><span class="gp-tag">' +
      ic('clock') +
      'Dinilai game</span><span class="gp-timer"><i></i></span><span class="gp-emoji">🗼🥐💕</span><b class="gp-res">4/4 benar · 17,3 dtk</b></span>' +
      '<span class="gp-card c2"><span class="gp-tag">' +
      ic('users') +
      'Lawan ikut main</span><span class="gp-duo"><span class="gp-av" style="--c:' +
      PINK +
      '">🐻</span><b>?</b><span class="gp-av" style="--c:' +
      VIOLET +
      '">🐰</span></span><b class="gp-res">2/3 cocok</b></span>' +
      '<span class="gp-card c3"><span class="gp-tag">' +
      ic('check') +
      'Disahkan lawan</span><span class="gp-stamp">SAH!</span><b class="gp-res">Aksi Berani</b></span></div>',
  },
  {
    id: 'photo',
    title: 'Foto Bukti & main berdua',
    say: 'Senyum… 3, 2, 1, cekrek!',
    pts: [
      'Kartu Foto Bukti membuka kamera dengan hitungan 3-2-1 (atau unggah foto dari galeri).',
      'Lawan menilai fotonya. Foto dipajang sebagai polaroid di tengah papan. Ketuk polaroid untuk melihat galeri bukti.',
      'Main berdua di satu HP? Layar "Serahkan ke…" muncul supaya jawaban rahasia aman. Online: tiap pemain menjawab di HP-nya sendiri.',
    ],
    scene: () =>
      '<div class="sc sc-photo"><span class="gph-cam"><span class="gph-lens">' +
      ART.merpi('is-happy') +
      '</span><b class="gph-cd"><i>3</i><i>2</i><i>1</i></b><span class="gph-flash"></span></span>' +
      '<span class="gph-board"></span><span class="gph-pola"><span class="gph-img">' +
      ART.merpi('is-love') +
      '</span><small>Arfi ✓ Sah</small></span></div>',
  },
  {
    id: 'love',
    title: 'Love Meter & tantangan',
    say: 'Kemesraan juga strategi!',
    pts: [
      'Love naik dari tantangan yang lulus, kartu manis, dan lewat START. Melewati tantangan mengurangi Love.',
      'Jadian, Bucin, Soulmate: gaji +20/+30/+40 dan tol +5–15%.',
      'Penilai yang adil juga ikut dapat Love, jadi main jujur itu menguntungkan.',
      'Momen Berdua: tiap ' +
        RULES.momentGap.short +
        '–' +
        RULES.momentGap.long +
        ' ronde (bila ada minimal 2 pemain manusia), tiap pemain dapat satu tantangan kerja sama sebelum melempar dadu. Berhasil = +' +
        RULES.momentReward.gain +
        ' dan Love untuk pemain itu dan pasangannya.',
    ],
    scene: () =>
      '<div class="sc sc-love"><div class="g-meter">' +
      ic('heart') +
      '<span class="gm-bar"><i></i></span><span class="gm-tiers"><b>PDKT</b><b>Jadian</b><b>Bucin</b><b>Soulmate</b></span></div><div class="g-note">Tebak Isi Hati: 2/3 cocok! Kalian berdua dapat hadiah.</div><span class="g-reward">' +
      coin +
      '+140 · ' +
      ic('heart') +
      '+10</span></div>',
  },
  {
    id: 'events',
    title: 'Kejutan di jalan',
    say: 'Tiap ronde bisa beda ceritanya!',
    pts: [
      'Ketemuan! Berhenti di petak yang sama dengan pemain lain: kalian berdua dapat ' +
        RULES.meetCash +
        ' dan Love +' +
        RULES.meetLove +
        '.',
      'Kabar Merpi tiap ' +
        RULES.newsGap.short +
        '–' +
        RULES.newsGap.long +
        ' ronde (makin panjang durasi, makin jarang): Musim Hujan, Musim Liburan, Diskon Properti, Promo Maskapai, Bonus Tahunan, Pekan Kasih Sayang (berlaku ' +
        RULES.newsLasts +
        ' ronde).',
      'Musim Puncak: ' +
        RULES.peakRounds +
        ' ronde terakhir semua tol ×1,5, jadi masih bisa menyalip. Kirim reaksi 😂😍😱 kapan saja lewat tombol di pojok papan.',
    ],
    scene: () =>
      '<div class="sc sc-proof">' +
      '<span class="gp-card c1"><span class="gp-tag">' +
      ic('heart') +
      'Ketemuan!</span><span class="gp-duo"><span class="gp-av" style="--c:' +
      PINK +
      '">🐻</span><b>❤</b><span class="gp-av" style="--c:' +
      VIOLET +
      '">🐰</span></span><b class="gp-res">+' +
      RULES.meetCash +
      ' · Love +' +
      RULES.meetLove +
      '</b></span>' +
      '<span class="gp-card c2"><span class="gp-tag">' +
      ic('sparkle') +
      'Kabar Merpi</span><span class="gp-emoji">☀️🏖️</span><b class="gp-res">Musim Liburan<br>tol ×1,5</b></span>' +
      '<span class="gp-card c3"><span class="gp-tag">' +
      ic('bolt') +
      'Musim Puncak</span><span class="gp-stamp">×1,5</span><b class="gp-res">3 ronde terakhir</b></span></div>',
  },
  {
    id: 'win',
    title: 'Cara menang',
    say: 'Siap jadi juragan cinta dunia?',
    pts: [
      'Trio Warna: kuasai 3 grup warna penuh, minimal satu grup 3 kota.',
      'Raja Jalur: kuasai semua kota dan wisata di satu sisi papan.',
      'Kolektor Wisata: kuasai 5 tempat wisata. Atau buat lawan bangkrut, atau punya aset terbesar saat ronde habis.',
      'Selesai main? Ketuk Bagikan Kenangan di layar menang untuk membuat kartu Story berisi pemenang, kota, dan foto bukti.',
    ],
    scene: () =>
      '<div class="sc sc-win"><div class="g-wrow r1"><span class="gw-ic">' +
      ic('trophy') +
      '</span>' +
      ['#FF8FB1', '#2EC4B6', '#4D96FF'].map((c, k) => '<i style="--c:' + c + ';--k:' + k + '"></i>').join('') +
      '<b>Trio</b></div>' +
      '<div class="g-wrow r2"><span class="gw-ic">' +
      ic('map') +
      '</span>' +
      Array.from({ length: 6 }, (_, k) => '<i style="--c:#FFC93C;--k:' + k + '"></i>').join('') +
      '<b>Jalur</b></div>' +
      '<div class="g-wrow r3"><span class="gw-ic">' +
      ic('ferris') +
      '</span>' +
      Array.from({ length: 5 }, (_, k) => '<i style="--c:#B79CFF;--k:' + k + '"></i>').join('') +
      '<b>Wisata</b></div><span class="g-merpi sm">' +
      ART.merpi('is-love') +
      '</span></div>',
  },
];

let k = 0,
  keyH = null,
  touch = null;
function render() {
  const ov = $('#guideOv');
  if (!ov) return;
  const pg = PAGES[k];
  $('.g-scene', ov).innerHTML = pg.scene();
  $('.g-step', ov).textContent = k + 1 + ' / ' + PAGES.length;
  $('#gTitle', ov).textContent = pg.title;
  $('.g-say', ov).textContent = pg.say;
  $('.g-pts', ov).innerHTML = pg.pts.map(x => '<li>' + esc(x) + '</li>').join('');
  $('.g-dots', ov).innerHTML = PAGES.map(
    (p, j) =>
      '<button type="button" data-g="' +
      j +
      '" aria-label="Halaman ' +
      (j + 1) +
      ': ' +
      esc(p.title) +
      '" aria-current="' +
      (j === k) +
      '"></button>'
  ).join('');
  $$('[data-g]', ov).forEach(b => (b.onclick = () => go(Number(b.dataset.g))));
  $('#gPrev', ov).disabled = k === 0;
  $('#gNext', ov).innerHTML =
    k === PAGES.length - 1
      ? ic('check') + '<span>' + (App.S ? 'Lanjut main' : 'Siap main!') + '</span>'
      : '<span>Lanjut</span>' + ic('chevron');
  const card = $('.g-card', ov);
  card.classList.remove('flip-in');
  void card.offsetWidth;
  card.classList.add('flip-in');
}
function go(n) {
  if (n < 0 || n >= PAGES.length || n === k) return;
  k = n;
  SND.play('page');
  render();
}
function close() {
  UI.leave($('#guideOv'));
  if (keyH) document.removeEventListener('keydown', keyH);
  keyH = null;
  UI.store.set(UI.KEYS.guide, 'seen');
  if (App.S) {
    UI.syncModal();
    UI.renderStage();
    UI.scheduleAI();
    UI.scheduleAutoEnd();
  }
}
function openGuide(start) {
  track('guide_open', { page: start || 0 });
  if ($('#guideOv')) return;
  k = Math.max(0, Math.min(PAGES.length - 1, start || 0));
  UI.cancelAutoEnd();
  const ov = document.createElement('div');
  ov.className = 'guide';
  ov.id = 'guideOv';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'gTitle');
  ov.innerHTML =
    '<div class="g-card"><div class="g-top"><span class="g-book">' +
    ic('book') +
    'Buku Panduan</span><span class="g-step"></span><button type="button" class="icon-btn" id="gClose" aria-label="Tutup panduan">' +
    ic('x') +
    '</button></div>' +
    '<div class="g-body"><div class="g-scene" aria-hidden="true"></div><div class="g-text"><div class="g-merpi-say"><span class="gm">' +
    ART.merpi('is-happy') +
    '</span><span class="g-say"></span></div><h2 id="gTitle"></h2><ul class="g-pts"></ul></div></div>' +
    '<div class="g-nav"><button type="button" class="btn ghost" id="gPrev" aria-label="Kembali ke halaman sebelumnya">' +
    ic('back') +
    '<span>Kembali</span></button><div class="g-dots"></div><button type="button" class="btn primary" id="gNext"></button></div></div>';
  document.body.appendChild(ov);
  $('#gClose', ov).onclick = close;
  $('#gPrev', ov).onclick = () => go(k - 1);
  $('#gNext', ov).onclick = () => {
    if (k === PAGES.length - 1) close();
    else go(k + 1);
  };
  ov.addEventListener('click', e => {
    if (e.target === ov) close();
  });
  ov.addEventListener(
    'touchstart',
    e => {
      const t = e.touches[0];
      touch = { x: t.clientX, y: t.clientY };
    },
    { passive: true }
  );
  ov.addEventListener('touchend', e => {
    if (!touch) return;
    const t = e.changedTouches[0],
      dx = t.clientX - touch.x,
      dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(k + (dx < 0 ? 1 : -1));
  });
  keyH = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(k + 1);
    else if (e.key === 'ArrowLeft') go(k - 1);
  };
  document.addEventListener('keydown', keyH);
  clearTimeout(App.aiTimer);
  render();
  setTimeout(() => {
    const b = $('#gNext', ov);
    if (b) b.focus({ preventScroll: true });
  }, 60);
}
Object.assign(UI, { openGuide, closeGuide: close, GUIDE_PAGES: PAGES });
