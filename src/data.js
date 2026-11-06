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
    peakRounds: 3, peakMult: 1.5,            // Musim Puncak: N ronde terakhir, tol ×1,5
    newsEvery: 3, newsLasts: 2,              // Kabar Merpi tiap 3 ronde, berlaku 2 ronde
    newsRain: 0.5, newsHoliday: 1.5, newsSale: 0.2, newsBonus: 100,
    meetLove: 3, meetCash: 40,               // Ketemuan! (berhenti di petak yang sama dengan pemain lain)
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
    T(3,  'card',   { name: 'Kartu Cinta', short: 'Kartu Cinta', art: 'card', desc: 'Ambil Kartu Cinta: kejutan manis, tiket perjalanan, atau tantangan yang harus dibuktikan.' }),
    T(4,  'city',   { group: 'jawa', name: 'Yogyakarta', short: 'Jogja', art: 'jogja', price: 90, blurb: 'Sunrise di stupa dan angkringan tengah malam.' }),
    T(5,  'spot',   { name: 'Bianglala', short: 'Bianglala', art: 'ferris', price: 150, blurb: 'Kincir raksasa untuk foto berdua di puncak.' }),
    T(6,  'city',   { group: 'jawa', name: 'Bromo', short: 'Bromo', art: 'bromo', price: 90, blurb: 'Menunggu matahari terbit di lautan pasir.' }),
    T(7,  'city',   { group: 'jawa', name: 'Lombok', short: 'Lombok', art: 'lombok', price: 110, blurb: 'Ayunan di laut jernih Gili.' }),
    T(8,  'island', { name: 'Pulau Rindu', short: 'Pulau Rindu', art: 'island', desc: 'Terdampar sampai 3 giliran. Keluar dengan dadu kembar, bayar 100, Tiket Pulang, atau lulus Rindu Challenge.' }),
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

  // ===== KARTU CINTA (67) =====
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

    C('K35', 'Tantangan', 'Tantangan Kilat', 'Tantangan acak yang dinilai: skor game atau lawan yang mengesahkan.', { fx: [{ challenge: 'any' }] }),
    C('K36', 'Tantangan', 'Tebak Isi Hati', 'Lawan menjawab 3 pertanyaan diam-diam, kamu menebak. Butuh 2 cocok.', { fx: [{ challenge: 'secret' }] }),
    C('K37', 'Tantangan', 'Aksi Berani', 'Lakukan aksi dengan syarat jelas. Lawan yang menilai sah atau tidak.', { fx: [{ challenge: 'dare' }] }),
    C('K38', 'Tantangan', 'Surat Bersyarat', 'Tulis pesan yang lolos syarat (dicek otomatis). Pesannya tersimpan sampai akhir.', { fx: [{ challenge: 'message' }] }),
    C('K39', 'Tantangan', 'Dua Fakta Satu Bohong', 'Tulis 3 pernyataan, satu bohong. Kecoh lawanmu!', { fx: [{ challenge: 'bluff' }] }),
    C('K40', 'Tantangan', 'Dilema Lucu', 'Pilihan sulit yang mengubah strategimu.', { fx: [{ challenge: 'dilemma' }] }),
    C('K41', 'Tantangan', 'Uji Skill', 'Mini-game berwaktu yang dinilai otomatis oleh game.', { fx: [{ challenge: 'skill' }] }),
    C('K42', 'Tantangan', 'Peragakan!', 'Peragakan kata rahasia tanpa bicara. Lawan harus menebaknya.', { fx: [{ challenge: 'charades' }] }),

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
    ] }),
    // --- tambahan: variasi untung & rugi untuk permainan panjang ---
    C('K48', 'Kejutan Manis', 'Cashback Tiket Pesawat', 'Promo maskapai cair! Terima 180.', { fx: [{ gain: 180 }] }),
    C('K49', 'Kejutan Manis', 'Konten Viral', 'Video jalan-jalanmu FYP. Endorse masuk 250, tapi kamu sibuk: kehilangan giliran berikutnya.', { fx: [{ gain: 250 }, { skipTurn: 1 }] }),
    C('K50', 'Surat Cinta', 'Paket Misterius', 'Isinya surat manis dan uang saku. +80 dan Love +6.', { fx: [{ gain: 80 }, { love: 6 }] }),
    C('K51', 'Kejutan Manis', 'Arisan Keluarga', 'Kamu menang arisan! Setiap pemain memberimu 60.', { fx: [{ collectEach: 60 }] }),
    C('K52', 'Perjalanan', 'Nebeng Kapal Pesiar', 'Maju ke Kapal Pesiar. Lewat START? Ambil gaji.', { fx: [{ moveTo: 27 }] }),
    C('K53', 'Perjalanan', 'Mampir Kyoto', 'Musim sakura! Maju ke Kyoto.', { fx: [{ moveTo: 15 }] }),
    C('K54', 'Perjalanan', 'Jalan Pintas', 'Ada jalan tikus! Maju ke tempat wisata terdekat dan dapat 40.', { fx: [{ nearest: 'spot' }, { gain: 40 }] }),
    C('K55', 'Masalah LDR', 'Koper Tertukar', 'Bolak-balik ke bandara. Mundur 2 petak dan bayar 40.', { fx: [{ moveBack: 2 }, { pay: 40 }] }),
    C('K56', 'Masalah LDR', 'Kena Tilang', 'Lupa bawa SIM. Bayar 120.', { fx: [{ pay: 120 }] }),
    C('K57', 'Masalah LDR', 'Ulang Tahun Semua Orang', 'Kamu lupa hari ulang tahun! Bayar 50 ke setiap pemain sebagai kado telat.', { fx: [{ payEach: 50 }] }),
    C('K58', 'Masalah LDR', 'Renovasi Dadakan', 'Atap bocor di semua properti. Bayar 30 per tingkat bangunan.', { fx: [{ repairs: 30 }] }),
    C('K59', 'Masalah LDR', 'Salah Kirim Stiker', 'Stiker aneh terkirim ke grup keluarga. Love −6.', { fx: [{ love: -6 }] }),
    C('K60', 'Kartu Aksi', 'Badai Rindu Ganda', 'Pilih satu kota lawan (bukan landmark): turunkan 1 tingkat.', { fx: [{ target: 'storm' }] }),
    C('K61', 'Kartu Aksi', 'Festival Dadakan', 'Pilih satu kotamu jadi tuan rumah Festival Cinta sekarang.', { fx: [{ target: 'festival' }] }),
    C('K62', 'Kejutan Manis', 'Robin Hood Cinta', 'Pemain terkaya memberi 200 ke pemain termiskin.', { fx: [{ richToPoor: 200 }] }),
    C('K63', 'Masalah LDR', 'Taruhan Nekat', 'Pilih nasibmu.', { choice: [
      { label: 'Main aman: bayar 50', fx: [{ pay: 50 }] },
      { label: 'Nekat: dapat 200, tapi ke Pulau Rindu', fx: [{ gain: 200 }, { goIsland: true }] }
    ] }),
    C('K64', 'Kejutan Manis', 'Diskon Akhir Tahun', 'Pembelian atau pembangunan berikutnya diskon 40%, plus 50 tunai.', { fx: [{ discount: 0.4 }, { gain: 50 }] }),
    C('K65', 'Tantangan', 'Foto Bukti', 'Buka kamera dan buktikan aksimu. Fotonya dipajang di papan!', { fx: [{ challenge: 'photo' }] }),
    C('K66', 'Tantangan', 'Tebak Emoji', 'Tebak tempat di papan dari deretan emoji.', { fx: [{ challenge: 'emoji' }] }),
    C('K67', 'Tantangan', 'Tantangan Kilat', 'Tantangan acak yang dinilai: skor game atau lawan yang mengesahkan.', { fx: [{ challenge: 'any' }] })
  ];

  // ===== TANTANGAN =====
  // Setiap tantangan punya cara pembuktian (verify), tidak ada lagi "klik Selesai" tanpa bukti:
  //   auto   = mini-game berwaktu; soal dibuat engine dari seed, jawaban dinilai engine (skor & waktu jadi bukti)
  //   duel   = lawan ikut main (jawaban rahasia, tebakan, peragaan); engine membandingkan jawaban keduanya
  //   judge  = aksi nyata dengan syarat jelas; lawan (manusia) yang mengesahkan, namanya tercatat di log
  //   choice = dilema strategi (tanpa benar/salah)
  // duel & judge butuh lawan manusia lain; main lawan bot hanya memakai auto, message (cek otomatis) & dilema.
  // need/of/secs = syarat lulus; *Isle = varian Rindu Challenge (Pulau Rindu) yang lebih ringan.
  const CH_TYPES = {
    trivia:   { label: 'Kuis Keliling Dunia', verify: 'auto', icon: 'globe', reward: { gain: 150, love: 3 }, skip: { love: -2 }, of: 4, need: 3, secs: 30, ofIsle: 3, needIsle: 2, secsIsle: 30, how: 'Jawab soal tentang papan ini: harga, grup warna, jalur, dan urutan petak.' },
    price:    { label: 'Tebak Harga Kota', verify: 'auto', icon: 'coins', reward: { gain: 150, love: 3 }, skip: { love: -2 }, of: 3, need: 2, secs: 25, tol: 0.15, ofIsle: 3, needIsle: 2, secsIsle: 30, tolIsle: 0.2, how: 'Ketik harga beli tiap kota tanpa melihat papan. Selisih maksimal 15%.' },
    recall:   { label: 'Ingat Urutan', verify: 'auto', icon: 'sparkle', reward: { gain: 160, love: 3 }, skip: { love: -2 }, of: 6, secs: 20, ofIsle: 4, secsIsle: 20, how: 'Hafalkan urutan gambar selama beberapa detik, lalu ulangi persis sama.' },
    math:     { label: 'Hitung Ongkos Kilat', verify: 'auto', icon: 'scale', reward: { gain: 160, love: 3 }, skip: { love: -2 }, of: 3, need: 3, secs: 30, ofIsle: 2, needIsle: 2, secsIsle: 35, how: 'Hitung ongkos perjalanan di kepala. Semua jawaban harus tepat.' },
    emoji:    { label: 'Tebak Emoji', verify: 'auto', icon: 'sparkle', reward: { gain: 140, love: 4 }, skip: { love: -2 }, of: 4, need: 3, secs: 25, ofIsle: 3, needIsle: 2, secsIsle: 30, how: 'Tebak tempat di papan dari deretan emoji. Cepat sebelum waktu habis!' },
    scramble: { label: 'Susun Nama Kota', verify: 'auto', icon: 'map', reward: { gain: 150, love: 3 }, skip: { love: -2 }, of: 2, need: 2, secs: 35, ofIsle: 2, needIsle: 1, secsIsle: 40, how: 'Huruf nama tempat di papan diacak. Susun kembali dengan benar.' },
    secret:   { label: 'Tebak Isi Hati', verify: 'duel', icon: 'heart', reward: { gain: 140, love: 10 }, judgeReward: { love: 5 }, skip: { love: -3 }, of: 3, need: 2, how: '{j} menjawab 3 pertanyaan diam-diam, lalu {n} menebak. Butuh 2 cocok. Kalau berhasil, kalian berdua dapat hadiah.' },
    bluff:    { label: 'Dua Fakta Satu Bohong', verify: 'duel', icon: 'question', reward: { gain: 170, love: 6 }, judgeReward: { gain: 80, love: 3 }, skip: { love: -2 }, how: '{n} menulis 3 pernyataan tentang dirinya, satu bohong. {j} menebak yang bohong. Kecoh {j} = {n} menang. Ketahuan = {j} yang dapat hadiah.' },
    charades: { label: 'Peragakan!', verify: 'duel', icon: 'users', reward: { gain: 150, love: 8 }, judgeReward: { love: 4 }, skip: { love: -2 }, secs: 60, tries: 3, how: '{n} memperagakan kata rahasia tanpa suara dan tanpa menunjuk benda. {j} menebak dalam 60 detik, maksimal 3 tebakan. Tebakan benar = kalian berdua dapat hadiah.' },
    message:  { label: 'Surat Bersyarat', verify: 'auto', icon: 'letter', reward: { gain: 130, love: 10 }, skip: { love: -2 }, how: 'Tulis pesan untuk {j}. Semua syarat dicek otomatis. Kalau ada lawan manusia, ia ikut mengesahkan.' },
    dare:     { label: 'Aksi Berani', verify: 'judge', icon: 'bolt', reward: { gain: 160, love: 8 }, judgeReward: { love: 3 }, skip: { love: -3 }, how: 'Lakukan aksinya sesuai syarat. {j} menonton (langsung atau lewat video call) lalu memutuskan sah atau tidak.' },
    photo:    { label: 'Foto Bukti', verify: 'judge', icon: 'polaroid', reward: { gain: 180, love: 8 }, judgeReward: { love: 3 }, skip: { love: -3 }, how: 'Buka kamera, lakukan aksinya, lalu cekrek! Fotonya dinilai {j} dan dipajang di papan untuk semua pemain.' },
    dilemma:  { label: 'Pilihan Dilematis', verify: 'choice', icon: 'scale', reward: {}, skip: { love: -2 }, how: 'Pilih salah satu. Tidak ada jawaban salah, hanya strategi.' }
  };
  const AUTO_TYPES = ['trivia', 'price', 'recall', 'math', 'scramble', 'emoji'];
  // petunjuk emoji Tebak Emoji (indeks petak → emoji); sengaja tanpa bendera supaya tidak terlalu mudah
  const EMOJI_CLUES = { 1: '🚲📷🏛️', 2: '🍵⛰️🛍️', 4: '🛕🌅🍢', 5: '🎡🌃📸', 6: '🌋🌄🐎', 7: '🏝️🌊🛶', 8: '🏝️😢⛵', 9: '🌺🛕🌅', 10: '🦎⛰️🛥️', 11: '🌷🌻🌸', 12: '🔒🗼🍜', 13: '🍊🌊🪨', 14: '🚡🏔️😱', 15: '⛩️🌸🍵', 16: '🎉🎆💃', 17: '🏟️🍦🛵', 19: '🏰📜🌉', 20: '🎈🌄🧺', 21: '🗼🥐💕', 22: '🛶🎭🍝', 23: '🏛️💙🌇', 24: '✈️🌍🎫', 25: '🏔️🧀⌚', 26: '🌌❄️♨️', 27: '🛳️🍽️🌊', 29: '🏝️🐠🛖', 30: '💸😭🧾', 31: '🏄🌺🍍' };

  // bank soal Tebak Isi Hati: umum, cocok untuk pasangan, teman, maupun PDKT
  const HEART_QS = [
    { q: 'Liburan paling ideal buat {j}?', o: ['Pantai', 'Gunung', 'Kota besar', 'Di rumah saja'] },
    { q: 'Kalau dapat uang kaget 1 juta, {j} akan…', o: ['Menabung', 'Traktir teman', 'Belanja online', 'Beli tiket jalan-jalan'] },
    { q: 'Camilan begadang favorit {j}?', o: ['Mi instan', 'Keripik', 'Cokelat', 'Buah'] },
    { q: 'Minuman yang paling mungkin dipesan {j}?', o: ['Kopi susu', 'Matcha', 'Teh manis', 'Air putih'] },
    { q: '{j} paling kesal kalau…', o: ['Chat dibalas lama', 'Orang telat', 'Rencana mendadak batal', 'Lapar'] },
    { q: 'Genre film yang paling dipilih {j}?', o: ['Komedi', 'Horor', 'Romantis', 'Aksi'] },
    { q: 'Jam paling produktif {j}?', o: ['Pagi', 'Siang', 'Sore', 'Tengah malam'] },
    { q: 'Kalau jadi hewan, {j} merasa paling mirip…', o: ['Kucing', 'Anjing', 'Panda', 'Burung'] },
    { q: 'Cara {j} menghilangkan stres?', o: ['Tidur', 'Makan', 'Olahraga', 'Ngobrol'] },
    { q: 'Hadiah yang paling bikin {j} senang?', o: ['Barang lucu', 'Makanan', 'Surat tulisan tangan', 'Pengalaman bareng'] },
    { q: 'Musim favorit {j}?', o: ['Hujan', 'Kemarau cerah', 'Salju (impian)', 'Semua sama'] },
    { q: 'Di pesta, {j} biasanya…', o: ['Jadi pusat perhatian', 'Ngobrol di pojok', 'Dekat meja makanan', 'Pulang duluan'] },
    { q: 'Tempat di papan yang paling ingin dikunjungi {j}?', o: ['Paris', 'Kyoto', 'Bali', 'Islandia'] },
    { q: 'Kalau main game, {j} tipe…', o: ['Ambisius', 'Santai', 'Curang dikit', 'Gampang ngambek'] },
    { q: 'Sarapan ideal {j}?', o: ['Nasi', 'Roti', 'Bubur', 'Skip sarapan'] },
    { q: 'Lagu yang cocok jadi soundtrack hidup {j}?', o: ['Galau', 'Semangat', 'Santai akustik', 'Dangdut'] },
    { q: 'Kalau terjebak zombie apocalypse, {j} akan…', o: ['Jadi pemimpin', 'Sembunyi', 'Jadi zombie duluan', 'Cari makanan dulu'] },
    { q: 'Emoji yang paling sering dipakai {j}?', o: ['😂', '🥺', '😭', '❤️'] },
    { q: 'Superpower yang paling diinginkan {j}?', o: ['Teleportasi', 'Baca pikiran', 'Menghentikan waktu', 'Terbang'] },
    { q: 'Kalau bangun jam 4 pagi tanpa alasan, {j}…', o: ['Main HP', 'Tidur lagi', 'Ke dapur', 'Overthinking'] },
    { q: 'Martabak pilihan {j}?', o: ['Manis cokelat keju', 'Telur', 'Pandan', 'Dua-duanya!'] },
    { q: 'Tipe {j} kalau nyasar di jalan?', o: ['Buka maps', 'Tanya orang', 'Nekat jalan terus', 'Panik'] },
    { q: 'Kebiasaan {j} sebelum tidur?', o: ['Scroll medsos', 'Dengar musik', 'Baca', 'Langsung pingsan'] },
    { q: 'Kalau jadi karakter film, {j} itu…', o: ['Tokoh utama', 'Sahabat lucu', 'Penjahat keren', 'Figuran yang lewat'] }
  ];
  // kata Peragakan!: tempat di papan, kegiatan perjalanan, dan hal sehari-hari
  const CHARADES = ['Selancar', 'Gondola', 'Naik komodo', 'Main bianglala', 'Kereta gantung', 'Balon udara', 'Bermain salju', 'Melihat aurora', 'Makan gelato', 'Naik sepeda onthel',
    'Mendaki gunung', 'Foto selfie', 'Menangkap ikan', 'Memetik bunga', 'Sunrise', 'Ketinggalan pesawat', 'Koper hilang', 'Mabuk laut', 'Video call sinyal jelek', 'Menunggu balasan chat',
    'Menari hula', 'Memanggang sate', 'Berdayung', 'Menyelam', 'Pakai sumpit', 'Menara Eiffel', 'Gladiator', 'Ninja', 'Penyanyi opera', 'Pemadam kebakaran',
    'Kucing jatuh dari meja', 'Tukang parkir', 'Kehujanan tanpa payung', 'Ngantuk di kelas', 'Main gitar', 'Superhero', 'Robot', 'Pelayan restoran', 'Tersengat lebah', 'Diet gagal',
    'Pinguin', 'Kepiting', 'Joget TikTok', 'Lupa password', 'Selfie dengan monyet', 'Pesawat turbulensi', 'Masak mi instan', 'Pengantin', 'Kehabisan baterai', 'Dikejar angsa'];

  const CHALLENGES = [
    // --- auto: soal dibuat engine ---
    { id: 'tv', type: 'trivia', text: 'Kuis Keliling Dunia: jawab soal tentang papan Loveopoly.' },
    { id: 'pr', type: 'price', text: 'Tebak Harga Kota: berapa harga beli kota-kota ini?' },
    { id: 'rc', type: 'recall', text: 'Ingat Urutan: hafalkan urutan gambar, lalu ulangi persis.' },
    { id: 'mt', type: 'math', text: 'Hitung Ongkos Kilat: hitung tanpa kalkulator.' },
    { id: 'sc', type: 'scramble', text: 'Susun Nama Kota: huruf-hurufnya diacak.' },
    { id: 'em', type: 'emoji', text: 'Tebak Emoji: tempat mana yang digambarkan emoji ini?' },
    // --- duel ---
    { id: 'hs', type: 'secret', text: 'Tebak Isi Hati: seberapa kenal kamu dengan {j}?' },
    { id: 'bl', type: 'bluff', text: 'Dua Fakta Satu Bohong: tulis 3 pernyataan tentang dirimu, satu di antaranya bohong.' },
    { id: 'cr', type: 'charades', text: 'Peragakan! Tanpa suara, tanpa menunjuk benda, tanpa mengeja huruf.' },
    // --- surat bersyarat: syarat dicek otomatis ---
    { id: 'ms1', type: 'message', text: 'Akrostik: tulis 5 baris untuk {j}, baris ke-1 sampai ke-5 diawali huruf C, I, N, T, A.', rule: { acrostic: 'CINTA' } },
    { id: 'ms2', type: 'message', text: 'Tulis pesan penyemangat untuk {j} yang memuat nama 3 kota berbeda di papan ini.', rule: { cities: 3, minWords: 12 } },
    { id: 'ms3', type: 'message', text: 'Tulis pesan manis minimal 10 kata untuk {j} tanpa memakai huruf "a" sama sekali.', rule: { noLetter: 'a', minWords: 10 } },
    { id: 'ms4', type: 'message', text: 'Pantun 4 baris untuk {j}: rima a-b-a-b (baris 1 & 3 berakhiran sama, baris 2 & 4 berakhiran sama).', rule: { lines: 4, rhyme: 'abab' } },
    { id: 'ms5', type: 'message', text: 'Akrostik: tulis 4 baris untuk {j}, diawali huruf R, I, N, D.', rule: { acrostic: 'RIND' } },
    { id: 'ms6', type: 'message', text: 'Tulis 3 alasan kamu senang main bareng {j}, tiap alasan di baris sendiri dan minimal 5 kata.', rule: { lines: 3, wordsPerLine: 5 } },
    { id: 'ms7', type: 'message', text: 'Tulis ulasan bintang 5 tentang {j} seolah {j} adalah restoran. Minimal 15 kata dan tanpa huruf "e".', rule: { noLetter: 'e', minWords: 15 } },
    { id: 'ms8', type: 'message', text: 'Akrostik nama tempat: tulis 4 baris untuk {j}, diawali huruf B, A, L, I.', rule: { acrostic: 'BALI' } },
    { id: 'ms9', type: 'message', text: 'Tulis rencana liburan impian bareng {j}: tepat 4 baris dan memuat 2 nama kota di papan.', rule: { lines: 4, cities: 2 } },
    // --- aksi berani: syarat lulus jelas, lawan yang mengesahkan ---
    { id: 'dr1', type: 'dare', secs: 20, text: 'Sebutkan 10 nama kota/tempat di papan ini dalam 20 detik tanpa melihat papan.', crit: 'Sah bila 10 nama benar diucapkan sebelum waktu habis.' },
    { id: 'dr2', type: 'dare', secs: 30, text: 'Bicara 30 detik tentang "kenapa mi instan adalah makanan terhebat" tanpa jeda lebih dari 2 detik dan tanpa bilang "eh/hmm".', crit: 'Sah bila tidak ada jeda panjang dan tidak ada "eh/hmm".' },
    { id: 'dr3', type: 'dare', secs: 20, text: 'Tahan tidak tertawa atau tersenyum selama {j} melawak 20 detik.', crit: 'Sah bila tidak ada tawa atau senyum sedikit pun.' },
    { id: 'dr4', type: 'dare', secs: 30, text: '{j} menyebut 3 ekspresi (misal: kaget, curiga, jatuh cinta). Peragakan berurutan, masing-masing 5 detik.', crit: 'Sah bila ketiga ekspresi jelas terlihat dan berurutan.' },
    { id: 'dr5', type: 'dare', secs: 45, text: 'Nyanyikan reff lagu yang judulnya dipilih {j}. Lirik minimal 80% benar.', crit: 'Sah bila lirik hampir semuanya benar dan nadanya bisa dikenali.' },
    { id: 'dr6', type: 'dare', secs: 30, text: 'Tatap mata {j} (langsung atau di kamera) selama 30 detik tanpa tertawa dan tanpa membuang muka.', crit: 'Sah bila tatapan bertahan 30 detik penuh.' },
    { id: 'dr7', type: 'dare', secs: 40, text: 'Lakukan 15 squat sambil mengucapkan alfabet mundur dari Z. Salah urut = ulang dari Z.', crit: 'Sah bila 15 squat selesai dan alfabet mundur benar.' },
    { id: 'dr8', type: 'dare', secs: 30, text: 'Ceritakan kisah 4 kalimat yang memuat kata "komodo", "gelato", "aurora", dan "onthel".', crit: 'Sah bila keempat kata muncul dan ceritanya nyambung.' },
    { id: 'dr9', type: 'dare', secs: 20, text: 'Berpose seperti 3 landmark berbeda (misal menara, gerbang, patung). {j} harus menebak semuanya.', crit: 'Sah bila {j} berhasil menebak ketiga landmark.' },
    { id: 'dr10', type: 'dare', secs: 30, text: 'Gombali {j} dengan pantun spontan 4 baris, berima a-b-a-b, tanpa melihat catatan.', crit: 'Sah bila 4 baris, rimanya benar, dan {j} tersenyum.' },
    { id: 'dr11', type: 'dare', secs: 30, text: 'Pura-pura jadi pemandu wisata salah satu kota di papan selama 30 detik, lengkap dengan 3 fakta tentang kotanya.', crit: 'Sah bila ada 3 fakta dan gaya pemandunya meyakinkan.' },
    { id: 'dr12', type: 'dare', secs: 15, text: 'Ucapkan "kereta gantung goyang-goyang di Kyoto" 3 kali secepatnya tanpa salah.', crit: 'Sah bila 3 kali berturut-turut tanpa keseleo.' },
    { id: 'dr13', type: 'dare', secs: 30, text: 'Jadi komentator bola yang heboh untuk 30 detik terakhir permainan ini.', crit: 'Sah bila heboh tanpa berhenti dan {j} tertawa minimal sekali.' },
    { id: 'dr14', type: 'dare', secs: 20, text: 'Tirukan suara 5 hewan berbeda berturut-turut dalam 20 detik.', crit: 'Sah bila 5 suara berbeda dan bisa dikenali.' },
    { id: 'dr15', type: 'dare', secs: 30, text: 'Bacakan berita palsu yang serius tentang "Merpi kehilangan surat cinta", gaya presenter TV.', crit: 'Sah bila tanpa tertawa dan ada pembuka & penutup berita.' },
    { id: 'dr16', type: 'dare', secs: 20, text: 'Jelaskan cara memakai sendok kepada alien dalam 20 detik, tanpa memakai kata "makan".', crit: 'Sah bila kata "makan" tidak terucap sama sekali.' },
    // --- foto bukti: buka kamera, cekrek, dinilai lawan, dipajang di papan ---
    { id: 'ph1', type: 'photo', text: 'Foto dirimu berpose seperti patung landmark di papan (pilih sendiri, {j} harus bisa menebaknya).', crit: 'Sah bila {j} bisa menebak landmark-nya dari foto.' },
    { id: 'ph2', type: 'photo', text: 'Foto ekspresi "baru sadar uang habis kena tol Hawaii". Makin dramatis makin bagus.', crit: 'Sah bila ekspresinya dramatis dan bikin {j} tertawa.' },
    { id: 'ph3', type: 'photo', text: 'Foto 3 benda berwarna merah muda di sekitarmu dalam satu frame. Waktu 45 detik!', crit: 'Sah bila ada 3 benda merah muda yang jelas di foto.' },
    { id: 'ph4', type: 'photo', text: 'Selfie meniru ekspresi avatar pionmu.', crit: 'Sah bila mirip menurut {j}.' },
    { id: 'ph5', type: 'photo', text: 'Foto tanganmu membentuk hati dengan latar benda paling random di ruanganmu.', crit: 'Sah bila bentuk hatinya jelas dan bendanya memang random.' },
    { id: 'ph6', type: 'photo', text: 'Foto "oleh-oleh" dari kota terakhir yang kamu kunjungi di papan, pakai benda apa saja di sekitarmu.', crit: 'Sah bila {j} paham hubungannya dengan kota itu.' },
    { id: 'ph7', type: 'photo', text: 'Foto pose superhero lengkap dengan "jubah" dari benda apa pun.', crit: 'Sah bila ada jubah dan posenya meyakinkan.' },
    { id: 'ph8', type: 'photo', text: 'Foto wajah dengan tulisan tangan "Loveopoly" di kertas, dalam 40 detik.', crit: 'Sah bila tulisannya terbaca dan wajahmu kelihatan.' },
    // --- dilema ---
    { id: 'dl1', type: 'dilemma', text: 'Tiket promo muncul jam 3 pagi! Beli sekarang atau tidur?', options: [
      { label: 'Beli: bayar 100, maju ke wisata terdekat', fx: [{ pay: 100 }, { nearest: 'spot' }] },
      { label: 'Tidur: Love −3, hemat begadang +60', fx: [{ love: -3 }, { gain: 60 }] }
    ] },
    { id: 'dl2', type: 'dilemma', text: 'Ada yang minta video call saat kamu sedang rapat penting.', options: [
      { label: 'Angkat sebentar: Love +8, bayar 50', fx: [{ love: 8 }, { pay: 50 }] },
      { label: 'Chat "nanti ya": dapat 100, Love −4', fx: [{ gain: 100 }, { love: -4 }] }
    ] },
    { id: 'dl3', type: 'dilemma', text: 'Uang kado: hadiah mewah atau tabung untuk tiket ketemu?', options: [
      { label: 'Hadiah mewah: bayar 150, Love +12', fx: [{ pay: 150 }, { love: 12 }] },
      { label: 'Tabung: dapat 100, Love +2', fx: [{ gain: 100 }, { love: 2 }] }
    ] },
    { id: 'dl4', type: 'dilemma', text: 'Kamu dapat voucher makan berdua, tapi kalian beda kota.', options: [
      { label: 'Pakai bareng teman: dapat 80', fx: [{ gain: 80 }] },
      { label: 'Simpan sampai ketemu: Love +8', fx: [{ love: 8 }] }
    ] },
    { id: 'dl5', type: 'dilemma', text: 'Ada yang ngambek karena kamu lupa kabar. Cara baikan?', options: [
      { label: 'Kirim makanan: bayar 60, Love +10', fx: [{ pay: 60 }, { love: 10 }] },
      { label: 'Telepon 3 jam: Love +6, kehilangan giliran berikutnya', fx: [{ love: 6 }, { skipTurn: 1 }] }
    ] },
    { id: 'dl6', type: 'dilemma', text: 'Ada promo "beli 1 dapat bonus" untukmu.', options: [
      { label: 'Investasi kota: diskon 30% untuk beli/bangun berikutnya', fx: [{ discount: 0.3 }] },
      { label: 'Investasi hubungan: Love +10', fx: [{ love: 10 }] }
    ] }
  ];

  const ACHIEVEMENTS = [
    { id: 'landmark',  name: 'Landmark Pertama',     icon: 'crown',   text: 'Membangun landmark' },
    { id: 'tycoon',    name: 'Juragan Kota',         icon: 'house',   text: 'Memiliki 8 kota sekaligus' },
    { id: 'monopoly2', name: 'Dua Warna Penuh',        icon: 'trophy',  text: 'Menguasai 2 grup warna penuh' },
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
    WIN_MESSAGES, AI_LETTERS, MERPI, AUTO_TYPES, HEART_QS, CHARADES, EMOJI_CLUES, AVATARS, TOKEN_COLORS, AI_NAMES
  };
})(typeof window !== 'undefined' ? window : globalThis);
