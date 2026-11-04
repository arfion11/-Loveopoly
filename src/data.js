/* LOVEOPOLY 2.0 — data: papan 32 petak, kota wisata romantis, kartu cinta, tantangan pasangan, achievement */
(function (G) {
  'use strict';

  const RULES = {
    startCash: 2500,
    salary: 250,                 // gaji tiap melewati START
    loveStart: 30,
    loveTiers: [
      { min: 0,  name: 'Kenalan',  salary: 0,  rentPct: 0 },
      { min: 20, name: 'PDKT',     salary: 10, rentPct: 0 },
      { min: 40, name: 'Jadian',   salary: 20, rentPct: 5 },
      { min: 60, name: 'Bucin',    salary: 30, rentPct: 10 },
      { min: 80, name: 'Soulmate', salary: 40, rentPct: 15 }
    ],
    // bangunan: 0 tanah · 1 villa · 2 gedung · 3 hotel · 4 landmark
    buildMult: [1, 0.5, 1, 1.5, 2],          // biaya tiap tingkat × harga tanah
    rentMult: [0.25, 0.75, 1.5, 2.75, 4],    // tol per tingkat × harga tanah
    hotelLaps: 1,                            // hotel boleh dibangun setelah 1 putaran
    groupMult: 2,                            // tol ×2 bila satu grup warna dikuasai penuh
    spotRent: [50, 110, 220, 420, 800],      // tol wisata menurut jumlah wisata yang dimiliki
    takeoverMult: 2,                         // ambil alih = 2× nilai kota
    sellRate: 0.5,                           // jual ke bank saat utang = 50% nilai
    taxRate: 0.1,                            // Pajak Rindu = 10% total aset
    islandFee: 100,
    islandTurns: 3,
    travelFee: 100,
    festivalMax: 3,                          // festival di kota yang sama naik ×2 → ×3
    aimChance: 0.55,
    aimRanges: { low: [2, 5], mid: [6, 8], high: [9, 12] },
    tripleGroups: 3,
    maxRedraws: 2,
    maxRounds: 300
  };

  const SIDES = [
    { id: 'bottom', name: 'Jalur Nusantara', from: 1, to: 7 },
    { id: 'left', name: 'Jalur Tropis & Asia', from: 9, to: 15 },
    { id: 'top', name: 'Jalur Eropa', from: 17, to: 23 },
    { id: 'right', name: 'Jalur Bulan Madu', from: 25, to: 31 }
  ];

  const GROUPS = {
    kota:    { id: 'kota',    name: 'Kencan Kota',       color: '#FF8FB1', ink: '#B4285A' },
    jawa:    { id: 'jawa',    name: 'Petualangan Alam',  color: '#FFA94D', ink: '#A9530A' },
    tropis:  { id: 'tropis',  name: 'Surga Nusantara',   color: '#2EC4B6', ink: '#0E7C72' },
    asia:    { id: 'asia',    name: 'Asia Romantis',     color: '#FF6B6B', ink: '#B3262B' },
    klasik:  { id: 'klasik',  name: 'Eropa Klasik',      color: '#B794F6', ink: '#6B3FC4' },
    cinta:   { id: 'cinta',   name: 'Kota Cinta',        color: '#4D96FF', ink: '#1F5FC2' },
    salju:   { id: 'salju',   name: 'Negeri Salju',      color: '#5BC26A', ink: '#2C7A37' },
    madu:    { id: 'madu',    name: 'Bulan Madu',        color: '#FFC93C', ink: '#9A6B00' }
  };

  // 32 petak searah jarum jam dari START (pojok kanan bawah)
  const T = (i, type, o) => Object.assign({ i, type }, o);
  const TILES = [
    T(0,  'start',  { name: 'START', short: 'START', art: 'start', desc: 'Lewat START dapat gaji. Berhenti tepat di sini: bangun 1 tingkat di salah satu kotamu.' }),
    T(1,  'city',   { group: 'kota', name: 'Kota Tua', short: 'Kota Tua', art: 'kotatua', price: 60, blurb: 'Sepeda onthel dan foto vintage di alun-alun.' }),
    T(2,  'city',   { group: 'kota', name: 'Bandung', short: 'Bandung', art: 'bandung', price: 70, blurb: 'Udara sejuk, kebun teh, dan jalan kaki di Braga.' }),
    T(3,  'card',   { name: 'Kartu Cinta', short: 'Kartu Cinta', art: 'card', desc: 'Ambil Kartu Cinta: kejutan manis, tiket perjalanan, atau tantangan pasangan.' }),
    T(4,  'city',   { group: 'jawa', name: 'Yogyakarta', short: 'Jogja', art: 'jogja', price: 90, blurb: 'Sunrise di stupa dan angkringan tengah malam.' }),
    T(5,  'spot',   { name: 'Bianglala', short: 'Bianglala', art: 'ferris', price: 150, blurb: 'Kincir raksasa untuk foto berdua di puncak.' }),
    T(6,  'city',   { group: 'jawa', name: 'Bromo', short: 'Bromo', art: 'bromo', price: 90, blurb: 'Menunggu matahari terbit di lautan pasir.' }),
    T(7,  'city',   { group: 'jawa', name: 'Lombok', short: 'Lombok', art: 'lombok', price: 110, blurb: 'Ayunan di laut jernih Gili.' }),
    T(8,  'island', { name: 'Pulau Rindu', short: 'Pulau Rindu', art: 'island', desc: 'Terdampar sampai 3 giliran. Keluar dengan dadu kembar, bayar 100, Tiket Pulang, atau Rindu Challenge.' }),
    T(9,  'city',   { group: 'tropis', name: 'Bali', short: 'Bali', art: 'bali', price: 130, blurb: 'Gerbang pura, pantai, dan sunset Uluwatu.' }),
    T(10, 'city',   { group: 'tropis', name: 'Labuan Bajo', short: 'Labuan Bajo', art: 'komodo', price: 140, blurb: 'Bukit Padar dan si komodo yang (agak) ramah.' }),
    T(11, 'spot',   { name: 'Kebun Bunga', short: 'Kebun Bunga', art: 'garden', price: 160, blurb: 'Jalan bergandengan di antara ladang bunga.' }),
    T(12, 'city',   { group: 'asia', name: 'Seoul', short: 'Seoul', art: 'seoul', price: 150, blurb: 'Gembok cinta di menara Namsan.' }),
    T(13, 'city',   { group: 'asia', name: 'Jeju', short: 'Jeju', art: 'jeju', price: 150, blurb: 'Jeruk hallabong dan tebing laut.' }),
    T(14, 'spot',   { name: 'Kereta Gantung', short: 'Kereta Gantung', art: 'cablecar', price: 170, blurb: 'Melayang berdua di atas lembah.' }),
    T(15, 'city',   { group: 'asia', name: 'Kyoto', short: 'Kyoto', art: 'kyoto', price: 170, blurb: 'Gerbang torii di musim sakura.' }),
    T(16, 'fest',   { name: 'Festival Cinta', short: 'Festival', art: 'festival', desc: 'Pilih satu kotamu jadi tuan rumah: tolnya ×2. Diadakan lagi di kota yang sama: ×3.' }),
    T(17, 'city',   { group: 'klasik', name: 'Roma', short: 'Roma', art: 'roma', price: 190, blurb: 'Gelato di depan Colosseum.' }),
    T(18, 'card',   { name: 'Kartu Cinta', short: 'Kartu Cinta', art: 'card', desc: 'Ambil Kartu Cinta.' }),
    T(19, 'city',   { group: 'klasik', name: 'Praha', short: 'Praha', art: 'praha', price: 200, blurb: 'Menara dongeng di kota tua.' }),
    T(20, 'spot',   { name: 'Balon Udara', short: 'Balon Udara', art: 'balloon', price: 180, blurb: 'Terbang pagi bersama ratusan balon.' }),
    T(21, 'city',   { group: 'cinta', name: 'Paris', short: 'Paris', art: 'paris', price: 210, blurb: 'Piknik di bawah menara besi.' }),
    T(22, 'city',   { group: 'cinta', name: 'Venesia', short: 'Venesia', art: 'venice', price: 210, blurb: 'Gondola menyusuri kanal.' }),
    T(23, 'city',   { group: 'cinta', name: 'Santorini', short: 'Santorini', art: 'santorini', price: 230, blurb: 'Kubah biru dan senja terbaik di Aegea.' }),
    T(24, 'travel', { name: 'World Tour', short: 'World Tour', art: 'plane', desc: 'Giliran berikutnya, terbang ke petak mana pun (tiket 100), atau lempar dadu biasa.' }),
    T(25, 'city',   { group: 'salju', name: 'Swiss', short: 'Swiss', art: 'swiss', price: 250, blurb: 'Pondok kayu di kaki gunung bersalju.' }),
    T(26, 'city',   { group: 'salju', name: 'Islandia', short: 'Islandia', art: 'aurora', price: 260, blurb: 'Berburu aurora sambil berpelukan.' }),
    T(27, 'spot',   { name: 'Kapal Pesiar', short: 'Kapal Pesiar', art: 'cruise', price: 200, blurb: 'Makan malam romantis di tengah laut.' }),
    T(28, 'card',   { name: 'Kartu Cinta', short: 'Kartu Cinta', art: 'card', desc: 'Ambil Kartu Cinta.' }),
    T(29, 'city',   { group: 'madu', name: 'Maldives', short: 'Maldives', art: 'maldives', price: 290, blurb: 'Vila di atas laut sebening kaca.' }),
    T(30, 'tax',    { name: 'Pajak Rindu', short: 'Pajak Rindu', art: 'tax', desc: 'Bayar 10% dari total asetmu (uang + nilai kota).' }),
    T(31, 'city',   { group: 'madu', name: 'Hawaii', short: 'Hawaii', art: 'hawaii', price: 320, blurb: 'Selancar, bunga sepatu, dan aloha selamanya.' })
  ];

  const LEVELS = [
    { k: 0, name: 'Tanah', short: 'Tanah' },
    { k: 1, name: 'Villa', short: 'Villa' },
    { k: 2, name: 'Gedung', short: 'Gedung' },
    { k: 3, name: 'Hotel', short: 'Hotel' },
    { k: 4, name: 'Landmark', short: 'Landmark' }
  ];

  const POWER = {
    angel:    { name: 'Malaikat Cinta', icon: 'angel', desc: 'Dipakai saat harus bayar tol: tolnya jadi 0.' },
    discount: { name: 'Kupon Tol 50%', icon: 'ticket', desc: 'Dipakai saat harus bayar tol: tolnya dipotong setengah.' },
    escape:   { name: 'Tiket Pulang', icon: 'key', desc: 'Keluar dari Pulau Rindu tanpa biaya.' }
  };

  // ===== KARTU CINTA (47) =====
  const C = (id, cat, title, text, more) => Object.assign({ id, cat, title, text }, more);
  const CARDS = [
    C('K01', 'Kartu Simpan', 'Malaikat Cinta', 'Simpan kartu ini. Saat harus bayar tol, kamu boleh memakainya: tol jadi 0.', { power: 'angel' }),
    C('K02', 'Kartu Simpan', 'Malaikat Cinta', 'Simpan kartu ini. Saat harus bayar tol, kamu boleh memakainya: tol jadi 0.', { power: 'angel' }),
    C('K03', 'Kartu Simpan', 'Malaikat Cinta', 'Simpan kartu ini. Saat harus bayar tol, kamu boleh memakainya: tol jadi 0.', { power: 'angel' }),
    C('K04', 'Kartu Simpan', 'Kupon Tol 50%', 'Simpan kartu ini. Pakai saat bayar tol untuk memotongnya setengah.', { power: 'discount' }),
    C('K05', 'Kartu Simpan', 'Kupon Tol 50%', 'Simpan kartu ini. Pakai saat bayar tol untuk memotongnya setengah.', { power: 'discount' }),
    C('K06', 'Kartu Simpan', 'Tiket Pulang', 'Simpan kartu ini. Keluar dari Pulau Rindu tanpa biaya.', { power: 'escape' }),
    C('K07', 'Kartu Simpan', 'Tiket Pulang', 'Simpan kartu ini. Keluar dari Pulau Rindu tanpa biaya.', { power: 'escape' }),

    C('K08', 'Perjalanan', 'Pulang ke START', 'Kangen rumah! Maju ke START, ambil gaji, lalu bangun di salah satu kotamu.', { fx: [{ moveTo: 0 }] }),
    C('K09', 'Perjalanan', 'Liburan ke Bali', 'Maju ke Bali. Lewat START? Ambil gaji.', { fx: [{ moveTo: 9 }] }),
    C('K10', 'Perjalanan', 'Bulan Madu ke Hawaii', 'Maju ke Hawaii. Aloha!', { fx: [{ moveTo: 31 }] }),
    C('K11', 'Perjalanan', 'Kencan di Paris', 'Maju ke Paris. Lewat START? Ambil gaji.', { fx: [{ moveTo: 21 }] }),
    C('K12', 'Masalah LDR', 'Terdampar Rindu', 'Kapal tertunda badai. Langsung ke Pulau Rindu tanpa lewat START.', { fx: [{ goIsland: true }] }),
    C('K13', 'Perjalanan', 'Undangan Festival', 'Maju ke Festival Cinta dan jadikan kotamu tuan rumah.', { fx: [{ moveTo: 16 }] }),
    C('K14', 'Perjalanan', 'Tiket Keliling Dunia', 'Maju ke World Tour. Giliran depan, terbang ke mana saja.', { fx: [{ moveTo: 24 }] }),
    C('K15', 'Perjalanan', 'Wisata Terdekat', 'Maju ke tempat wisata terdekat.', { fx: [{ nearest: 'spot' }] }),
    C('K16', 'Masalah LDR', 'Salah Naik Bus', 'Waduh, arah sebaliknya! Mundur 3 petak.', { fx: [{ moveBack: 3 }] }),

    C('K17', 'Surat Cinta', 'Transferan Kejutan', '"Buat jajan kopi ya." Kamu menerima 150.', { fx: [{ gain: 150 }] }),
    C('K18', 'Surat Cinta', 'Ditemani Saat Deadline', 'Pasangan menemanimu begadang lewat video call. Bonus cair 200!', { fx: [{ gain: 200 }, { love: 3 }] }),
    C('K19', 'Kejutan Manis', 'Menang Undian Mal', 'Struk belanjamu menang undian. Dapat 100.', { fx: [{ gain: 100 }] }),
    C('K20', 'Surat Cinta', 'Voice Note Jam 2 Pagi', 'Suaranya serak, isinya manis. +50 dan Love +10.', { fx: [{ gain: 50 }, { love: 10 }] }),
    C('K21', 'Kejutan Manis', 'Monthsary Bersama', 'Semua ikut merayakan. Setiap pemain memberimu 40.', { fx: [{ collectEach: 40 }] }),
    C('K22', 'Masalah LDR', 'Kuota Habis Pas Video Call', 'Beli paket darurat. Bayar 60.', { fx: [{ pay: 60 }] }),
    C('K23', 'Masalah LDR', 'Ongkir Lebih Mahal dari Kado', 'Bayar 100 untuk ongkos kirim kado.', { fx: [{ pay: 100 }] }),
    C('K24', 'Masalah LDR', 'Lupa Balas Chat Seharian', 'Traktir semua pemain kopi virtual: bayar 30 ke setiap pemain.', { fx: [{ payEach: 30 }] }),
    C('K25', 'Masalah LDR', 'Servis AC Villa', 'Bayar 20 untuk setiap tingkat bangunan yang kamu punya.', { fx: [{ repairs: 20 }] }),
    C('K26', 'Kejutan Manis', 'Yang Paling Kaya Traktir', 'Pemain dengan uang terbanyak memberi 150 ke pemain dengan uang tersedikit.', { fx: [{ richToPoor: 150 }] }),
    C('K27', 'Surat Cinta', 'Restu Calon Mertua', 'Keluarga pasangan ikut senang. +100 dan Love +5.', { fx: [{ gain: 100 }, { love: 5 }] }),
    C('K28', 'Masalah LDR', 'Dompet Ketinggalan di Kafe', 'Balik lagi naik ojek. Bayar 80.', { fx: [{ pay: 80 }] }),

    C('K29', 'Kartu Aksi', 'Badai Rindu', 'Pilih satu kota lawan yang punya bangunan (bukan landmark): turunkan 1 tingkat.', { fx: [{ target: 'storm' }] }),
    C('K30', 'Kartu Aksi', 'Tukar Kota', 'Tukar satu kotamu dengan satu kota lawan (bukan landmark). Bangunannya ikut pindah.', { fx: [{ target: 'swap' }] }),
    C('K31', 'Kartu Aksi', 'Festival Kilat', 'Pilih satu kotamu jadi tuan rumah Festival Cinta sekarang.', { fx: [{ target: 'festival' }] }),
    C('K32', 'Kartu Aksi', 'Renovasi Gratis', 'Naikkan 1 tingkat bangunan di salah satu kotamu, gratis.', { fx: [{ target: 'renov' }] }),
    C('K33', 'Kartu Aksi', 'Renovasi Gratis', 'Naikkan 1 tingkat bangunan di salah satu kotamu, gratis.', { fx: [{ target: 'renov' }] }),
    C('K34', 'Kejutan Manis', 'Voucher Bangun', 'Pembelian atau pembangunan kota berikutnya diskon 50%.', { fx: [{ discount: 0.5 }] }),

    C('K35', 'Tantangan', 'Tantangan Kilat', 'Selesaikan satu tantangan pasangan untuk hadiah.', { fx: [{ challenge: 'any' }] }),
    C('K36', 'Tantangan', 'Seberapa Kenal Kamu?', 'Jawab pertanyaan tentang pasanganmu.', { fx: [{ challenge: 'quiz' }] }),
    C('K37', 'Tantangan', 'Truth or Dare Romantis', 'Pilih jujur atau berani. Hadiahnya lumayan.', { fx: [{ challenge: 'truthdare' }] }),
    C('K38', 'Tantangan', 'Tulis Pesan Cinta', 'Tulis pesan untuk pasangan. Pesannya tersimpan sampai akhir permainan.', { fx: [{ challenge: 'message' }] }),
    C('K39', 'Tantangan', 'Tebak Preferensi', 'Seberapa paham kamu selera pasangan?', { fx: [{ challenge: 'guess' }] }),
    C('K40', 'Tantangan', 'Dilema Lucu', 'Pilihan sulit yang mengubah strategimu.', { fx: [{ challenge: 'dilemma' }] }),
    C('K41', 'Tantangan', 'Mini-game Pasangan', 'Main cepat di layar ini. Berhasil = hadiah penuh.', { fx: [{ challenge: 'minigame' }] }),
    C('K42', 'Tantangan', 'Deep Talk', 'Ngobrol serius tentang masa depan kalian.', { fx: [{ challenge: 'deeptalk' }] }),

    C('K43', 'Masalah LDR', 'Salah Hitung Zona Waktu', 'Kamu ketiduran pas jadwal call. Love −8.', { fx: [{ love: -8 }] }),
    C('K44', 'Masalah LDR', 'Sinyal Putus-putus', '"Halo? Halo?" Kamu sibuk cari sinyal dan kehilangan giliran berikutnya.', { fx: [{ skipTurn: 1 }] }),
    C('K45', 'Masalah LDR', 'Harga Tiket Melonjak', 'Rencana ketemu terancam. Pilih cara menghadapinya.', { choice: [
      { label: 'Tetap beli: bayar 150', fx: [{ pay: 150 }] },
      { label: 'Tunda dulu: Love −10', fx: [{ love: -10 }] }
    ] }),
    C('K46', 'Kejutan Manis', 'Hujan Deras Pas Kencan', 'Naik taksi atau hujan-hujanan berdua?', { choice: [
      { label: 'Naik taksi: bayar 60', fx: [{ pay: 60 }] },
      { label: 'Hujan-hujanan: mundur 2 petak, Love +6', fx: [{ love: 6 }, { moveBack: 2 }] }
    ] }),
    C('K47', 'Kejutan Manis', 'Rezeki Anak Rantau', 'Pilih hadiahmu.', { choice: [
      { label: 'Ambil 120', fx: [{ gain: 120 }] },
      { label: 'Renovasi gratis 1 tingkat', fx: [{ target: 'renov' }] }
    ] })
  ];

  // ===== TANTANGAN PASANGAN =====
  const CH_TYPES = {
    quiz:      { label: 'Seberapa Kenal Kamu?', reward: { gain: 100, love: 6 },  skip: { love: -3 }, mode: 'honor', judge: true },
    memory:    { label: 'Tebak Kenangan Favorit', reward: { gain: 110, love: 7 }, skip: { love: -3 }, mode: 'honor', judge: true },
    truthdare: { label: 'Truth or Dare Romantis', reward: { gain: 120, love: 8 }, skip: { love: -4 }, mode: 'honor' },
    deeptalk:  { label: 'Deep Talk', reward: { gain: 150, love: 12 }, skip: { love: 0 }, mode: 'honor' },
    message:   { label: 'Tantangan Pesan Cinta', reward: { gain: 120, love: 10 }, skip: { love: -2 }, mode: 'text' },
    guess:     { label: 'Tebak Preferensi Pasangan', reward: { gain: 140, love: 8 }, fail: { love: 2 }, skip: { love: -3 }, mode: 'guess' },
    dilemma:   { label: 'Pilihan Dilematis', reward: {}, skip: { love: -2 }, mode: 'choice' },
    minigame:  { label: 'Mini-game Pasangan', reward: { gain: 180, love: 6 }, fail: { gain: 40 }, skip: { love: -2 }, mode: 'game' }
  };

  const CHALLENGES = [
    { id: 'q1', type: 'quiz', text: 'Sebutkan 3 makanan favorit pasanganmu. Pasangan menilai benar atau salah.' },
    { id: 'q2', type: 'quiz', text: 'Lagu apa yang paling sering pasanganmu putar akhir-akhir ini?' },
    { id: 'q3', type: 'quiz', text: 'Jam berapa biasanya pasanganmu tidur? Toleransi 30 menit.' },
    { id: 'q4', type: 'quiz', text: 'Apa ketakutan kecil pasanganmu yang jarang diketahui orang?' },
    { id: 'q5', type: 'quiz', text: 'Sebutkan nama sahabat terdekat pasanganmu dan satu cerita tentang mereka.' },
    { id: 'q6', type: 'quiz', text: 'Minuman apa yang selalu dipesan pasanganmu di kafe?' },
    { id: 'q7', type: 'quiz', text: 'Berapa ukuran sepatu pasanganmu?' },
    { id: 'q8', type: 'quiz', text: 'Hal kecil apa yang paling cepat bikin pasanganmu bad mood?' },

    { id: 'm1', type: 'memory', text: 'Tebak momen favorit pasanganmu dari pertemuan terakhir kalian.' },
    { id: 'm2', type: 'memory', text: 'Tebak foto berdua yang paling disukai pasanganmu.' },
    { id: 'm3', type: 'memory', text: 'Ceritakan ulang kencan pertama kalian dalam 3 kalimat. Pasangan menilai detailnya.' },
    { id: 'm4', type: 'memory', text: 'Tebak kalimat dari chat pertama kalian yang masih diingat pasangan.' },
    { id: 'm5', type: 'memory', text: 'Tebak hadiah darimu yang paling berkesan buat pasangan.' },
    { id: 'm6', type: 'memory', text: 'Sebutkan tanggal jadian kalian dan sedang di mana kalian saat itu.' },

    { id: 't1', type: 'truthdare', text: 'Truth: Kapan pertama kali kamu sadar benar-benar sayang dia?' },
    { id: 't2', type: 'truthdare', text: 'Truth: Hal apa dari pasanganmu yang paling kamu rindukan saat jauh?' },
    { id: 't3', type: 'truthdare', text: 'Truth: Kebiasaan lucu apa yang diam-diam kamu tiru dari pasangan?' },
    { id: 't4', type: 'truthdare', text: 'Truth: Hal paling nekat apa yang pernah kamu lakukan demi bertemu dia?' },
    { id: 'd1', type: 'truthdare', text: 'Dare: Kirim voice note berisi nyanyian 10 detik untuk pasangan.' },
    { id: 'd2', type: 'truthdare', text: 'Dare: Pasang foto berdua sebagai foto profil selama 24 jam.' },
    { id: 'd3', type: 'truthdare', text: 'Dare: Ucapkan 5 pujian berbeda untuk pasangan tanpa jeda.' },
    { id: 'd4', type: 'truthdare', text: 'Dare: Tirukan cara pasanganmu menyapa saat video call.' },

    { id: 'dt1', type: 'deeptalk', text: 'Di kota mana kalian ingin tinggal bersama nanti, dan kenapa?' },
    { id: 'dt2', type: 'deeptalk', text: 'Satu hal apa yang ingin kalian perbaiki dari cara berkomunikasi saat jauh?' },
    { id: 'dt3', type: 'deeptalk', text: 'Seperti apa hari Minggu ideal kalian 5 tahun lagi?' },
    { id: 'dt4', type: 'deeptalk', text: 'Target bersama apa yang ingin kalian capai sebelum LDR selesai?' },
    { id: 'dt5', type: 'deeptalk', text: 'Kapan kamu merasa paling didukung pasangan selama LDR?' },
    { id: 'dt6', type: 'deeptalk', text: 'Apa arti "rumah" buat kamu, dan di mana posisi pasangan di dalamnya?' },
    { id: 'dt7', type: 'deeptalk', text: 'Bagaimana kalian ingin merayakan hari pertama tidak LDR lagi?' },
    { id: 'dt8', type: 'deeptalk', text: 'Kalau bisa liburan berdua ke satu kota di papan ini, pilih yang mana dan kenapa?' },

    { id: 'ms1', type: 'message', text: 'Tulis pesan cinta singkat untuk dibaca pasangan sebelum tidur.' },
    { id: 'ms2', type: 'message', text: 'Tulis 3 alasan kamu bangga pada pasanganmu.' },
    { id: 'ms3', type: 'message', text: 'Tulis pesan penyemangat untuk hari tersibuk pasangan minggu ini.' },
    { id: 'ms4', type: 'message', text: 'Tulis "surat dari masa depan" untuk kalian berdua.' },
    { id: 'ms5', type: 'message', text: 'Tulis pantun gombal untuk pasangan.' },

    { id: 'g1', type: 'guess', text: 'Kalau ada kencan dadakan malam ini, pasangan pilih apa?', options: ['Nonton film', 'Makan enak', 'Jalan sore', 'Rebahan sambil video call'] },
    { id: 'g2', type: 'guess', text: 'Minuman yang paling mungkin dipesan pasangan?', options: ['Kopi susu', 'Matcha', 'Teh manis', 'Air putih saja'] },
    { id: 'g3', type: 'guess', text: 'Destinasi liburan impian pasangan?', options: ['Pantai', 'Gunung', 'Kota besar', 'Luar negeri'] },
    { id: 'g4', type: 'guess', text: 'Bahasa cinta utama pasangan?', options: ['Kata-kata manis', 'Waktu berkualitas', 'Hadiah', 'Pelukan', 'Bantuan nyata'] },
    { id: 'g5', type: 'guess', text: 'Camilan begadang favorit pasangan?', options: ['Mi instan', 'Keripik', 'Cokelat', 'Buah'] },
    { id: 'g6', type: 'guess', text: 'Kalau dapat uang kaget satu juta, pasangan akan…', options: ['Menabung', 'Traktir kamu', 'Belanja online', 'Beli tiket ketemu kamu'] },

    { id: 'dl1', type: 'dilemma', text: 'Tiket promo muncul jam 3 pagi! Beli sekarang atau tidur?', options: [
      { label: 'Beli: bayar 100, maju ke wisata terdekat', fx: [{ pay: 100 }, { nearest: 'spot' }] },
      { label: 'Tidur: Love −3, hemat begadang +60', fx: [{ love: -3 }, { gain: 60 }] }
    ] },
    { id: 'dl2', type: 'dilemma', text: 'Pasangan minta video call saat kamu sedang rapat penting.', options: [
      { label: 'Angkat sebentar: Love +8, bayar 50', fx: [{ love: 8 }, { pay: 50 }] },
      { label: 'Chat "nanti ya": dapat 100, Love −4', fx: [{ gain: 100 }, { love: -4 }] }
    ] },
    { id: 'dl3', type: 'dilemma', text: 'Uang kado anniversary: hadiah mewah atau tabung untuk tiket ketemu?', options: [
      { label: 'Hadiah mewah: bayar 150, Love +12', fx: [{ pay: 150 }, { love: 12 }] },
      { label: 'Tabung: dapat 100, Love +2', fx: [{ gain: 100 }, { love: 2 }] }
    ] },
    { id: 'dl4', type: 'dilemma', text: 'Kamu dapat voucher makan berdua, tapi kalian beda kota.', options: [
      { label: 'Pakai bareng teman: dapat 80', fx: [{ gain: 80 }] },
      { label: 'Simpan sampai ketemu: Love +8', fx: [{ love: 8 }] }
    ] },
    { id: 'dl5', type: 'dilemma', text: 'Pasangan ngambek karena kamu lupa kabar. Cara baikan?', options: [
      { label: 'Kirim makanan: bayar 60, Love +10', fx: [{ pay: 60 }, { love: 10 }] },
      { label: 'Telepon 3 jam: Love +6, kehilangan giliran berikutnya', fx: [{ love: 6 }, { skipTurn: 1 }] }
    ] },
    { id: 'dl6', type: 'dilemma', text: 'Ada promo "beli 1 dapat bonus" untukmu.', options: [
      { label: 'Investasi kota: diskon 30% untuk beli/bangun berikutnya', fx: [{ discount: 0.3 }] },
      { label: 'Investasi hubungan: Love +10', fx: [{ love: 10 }] }
    ] },

    { id: 'mg1', type: 'minigame', game: 'match', pairs: 6, seconds: 40, text: 'Memory Match Kenangan: cocokkan 6 pasang kartu dalam 40 detik.' },
    { id: 'mg2', type: 'minigame', game: 'match', pairs: 4, seconds: 20, text: 'Memory Match Kilat: cocokkan 4 pasang kartu dalam 20 detik.' },
    { id: 'mg3', type: 'minigame', game: 'heartbeat', taps: 5, need: 3, text: 'Sinkronkan Detak: ketuk saat hati berada di zona merah muda. Butuh 3 dari 5 ketukan tepat.' }
  ];

  const ACHIEVEMENTS = [
    { id: 'landmark',  name: 'Landmark Pertama',     icon: 'crown',   text: 'Membangun landmark' },
    { id: 'tycoon',    name: 'Juragan Kota',         icon: 'house',   text: 'Memiliki 8 kota sekaligus' },
    { id: 'monopoly2', name: 'Monopoli Hati',        icon: 'trophy',  text: 'Menguasai 2 grup warna penuh' },
    { id: 'festival',  name: 'Tuan Rumah Festival',  icon: 'party',   text: 'Mengadakan Festival Cinta' },
    { id: 'globe',     name: 'Keliling Dunia',       icon: 'plane',   text: 'Terbang dengan World Tour' },
    { id: 'takeover',  name: 'Pencuri Hati',         icon: 'swap',    text: 'Mengambil alih kota lawan' },
    { id: 'tourist',   name: 'Kolektor Wisata',      icon: 'ferris',  text: 'Memiliki 3 tempat wisata' },
    { id: 'rentking',  name: 'Raja Tol',             icon: 'coins',   text: 'Mengumpulkan 3.000 tol' },
    { id: 'romantic',  name: 'Si Paling Romantis',   icon: 'heart',   text: 'Menyelesaikan 5 tantangan' },
    { id: 'escape',    name: 'Pejuang Rindu',        icon: 'key',     text: 'Keluar dari Pulau Rindu lewat tantangan' },
    { id: 'angel',     name: 'Dilindungi Malaikat',  icon: 'angel',   text: 'Memakai Malaikat Cinta' },
    { id: 'goals',     name: 'Couple Goals',         icon: 'ring',    text: 'Love Meter mencapai 100' },
    { id: 'doubles5',  name: 'Lucky Double',         icon: 'dice',    text: 'Mendapat dadu kembar 5 kali' },
    { id: 'writer',    name: 'Penulis Surat',        icon: 'letter',  text: 'Menulis 3 pesan cinta' },
    { id: 'survivor',  name: 'Survivor',             icon: 'shield',  text: 'Lolos dari utang tanpa bangkrut' }
  ];

  const TITLES = {
    winner: ['Juragan Cinta Dunia', 'Sultan Rindu', 'Bucin Tycoon', 'Raja Bulan Madu'],
    rent: 'Raja Tol Rindu',
    challenges: 'Bucin Paling Totalitas',
    love: 'Soulmate Bersertifikat',
    landmarks: 'Arsitek Cinta',
    takeovers: 'Penakluk Hati Lawan',
    travels: 'Traveler Romantis',
    doubles: 'Si Hoki Dadu Kembar',
    island: 'Langganan Pulau Rindu',
    default: ['Pejuang Jarak Jauh', 'Penabung Rindu', 'Kurir Kangen', 'Pemanis Hubungan']
  };

  const WIN_MESSAGES = [
    'Sejauh apa pun jaraknya, kita tetap satu tujuan.',
    'Menang atau kalah, kamu tetap rumah tempatku pulang.',
    'Keliling dunia pun, tujuanku tetap kamu.',
    'Terima kasih sudah sabar menunggu, sampai jarak cuma tinggal cerita.',
    'Hari ini aku menang game, tapi kamu yang memenangkan hatiku.'
  ];

  const AI_LETTERS = [
    'Setiap hari aku hitung mundur sampai kita ketemu lagi. Semangat ya!',
    'Jarak bikin aku belajar sabar, kamu bikin aku belajar sayang.',
    'Jangan lupa makan, jangan lupa minum, jangan lupa aku.',
    'Aku bangga sama kamu, hari ini dan setiap hari.',
    'Kalau rindu ini bisa dikirim lewat paket, sudah overload ekspedisinya.'
  ];

  // kalimat maskot Merpi
  const MERPI = {
    hello: ['Hai! Aku Merpi, kurir cinta kalian.', 'Siap keliling dunia berdua?', 'Surat cinta siap diantar!', 'Jarak cuma angka, ayo main!', 'Paspor cinta sudah dicap?', 'Hari ini kita ke mana, ya?'],
    turn: ['Giliran {n}! Lempar dadunya~', '{n}, ayo jalan-jalan!', 'Semangat, {n}!', '{n}, tujuan berikutnya menunggu!', 'Dadu sudah gatal, {n}!', 'Koper siap, {n}?', '{n}, semoga mendarat di tempat manis!', 'Ayo {n}, kejar landmark!'],
    buy: ['Yay, kota baru!', 'Bendera dipasang!', 'Investasi cinta, mantap!', 'Satu kota lagi jadi milikmu!', 'Koleksi bertambah~', 'Nanti kita kencan di sini, ya!'],
    build: ['Bangunannya makin tinggi!', 'Wah, makin mewah!', 'Tukang bangunan cinta beraksi!', 'Tolnya ikut naik, hehe.', 'Fondasi kuat, hubungan kuat!', 'Makin cozy buat bulan madu!'],
    landmark: ['LANDMARK! Keren banget!', 'Kebal diambil alih. Aman!', 'Ikon kota baru lahir!', 'Turis pasti antre di sini!'],
    rent: ['Aduh, bayar tol…', 'Dompet menangis sedikit.', 'Tidak apa, nanti balas dendam!', 'Anggap saja traktir pasangan~', 'Mahal juga liburan di sini.', 'Sabar, rezeki nggak ke mana.'],
    takeover: ['Kotanya direbut!', 'Wah, berani sekali!', 'Bendera berganti warna!', 'Persaingan makin panas!'],
    island: ['Hiks, terdampar…', 'Pulau Rindu lagi sepi.', 'Kirim surat dari pulau dulu, ya.', 'Cari dadu kembar buat pulang!'],
    festival: ['Pesta! Tol jadi berlipat!', 'Kembang api cinta!', 'Semua diundang ke festival!', 'Kota ini jadi pusat keramaian!'],
    travel: ['Terbang~!', 'Kencangkan sabuk pengaman!', 'Pilih tujuan paling romantis!', 'Paspor siap, ayo berangkat!'],
    card: ['Kartu apa ya?', 'Semoga kartunya manis!', 'Deg-degan buka kartunya…', 'Ada surat buat kamu!'],
    doubles: ['Kembar! Lempar lagi!', 'Hoki dobel!', 'Dadunya kompak kayak kalian!', 'Sekali lagi, sekali lagi!'],
    salary: ['Gajian!', 'Cair, cair!', 'Uang saku perjalanan masuk!', 'Satu putaran lagi, makin kaya!'],
    threat: ['Awas! Ada yang hampir menang!', 'Hati-hati, tinggal satu petak!', 'Blokir kota itu sebelum terlambat!'],
    win: ['Selamat! Kalian luar biasa!', 'Juara cinta sudah ditentukan!', 'Perjalanan yang indah, ya!'],
    achieve: ['Lencana baru! Keren!', 'Koleksi prestasimu nambah!', 'Wah, achievement baru!', 'Bangga banget sama kamu!', 'Prestasi cinta terbuka!', 'Simpan baik-baik medalinya!'],
    think: ['Hmm…', 'Sedang berpikir…', 'Menghitung tol dulu…', 'Ke mana, ya, enaknya?'],
    poke: ['Hihi, geli!', 'Aku antar surat dulu ya!', 'Tip: hotel bisa dibangun setelah satu putaran.', 'Tip: landmark kebal diambil alih.', 'Tip: kuasai 3 grup warna untuk menang instan!', 'Tip: Festival bikin tol kota ×2.', 'Tip: punya 5 tempat wisata = menang!', 'Kangen itu tanda sayang~']
  };

  const AVATARS = ['🐻', '🐰', '🦊', '🐱', '🐼', '🐨', '🐧', '🦄', '🐶', '🐹', '🐯', '🐸'];
  const TOKEN_COLORS = ['#FF4F8B', '#7B61FF', '#12B5A6', '#FF8A3D', '#3D8BFF', '#D946C8', '#5CB82E', '#C27B36'];
  const AI_NAMES = ['Bot Rindu', 'Bot Gombal', 'Bot Bucin', 'Bot Manis'];

  G.LOVE_DATA = {
    RULES, SIDES, GROUPS, TILES, LEVELS, POWER, CARDS, CH_TYPES, CHALLENGES, ACHIEVEMENTS, TITLES,
    WIN_MESSAGES, AI_LETTERS, MERPI, AVATARS, TOKEN_COLORS, AI_NAMES
  };
})(typeof window !== 'undefined' ? window : globalThis);
