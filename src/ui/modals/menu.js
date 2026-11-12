/* LOVEOPOLY — dialog permainan › menu, keluar, pengaturan, privasi (dikumpulkan lewat src/ui/modals.js) */
import { App, SND, esc, ic, $, $$, toast, controls, viewer, act, canBuzz, t, getLang } from '../core.js';
import { BOARD_THEMES, levelOf, themeFor } from '../progress.js';
import { parseBackup } from '../backup.js';
import { UI } from '../ns.js';
import { btn, closeModal, on, refreshModal, showModal } from './base.js';
import { openHistory, openPortfolio } from './info.js';
import { installMode, promptInstall } from '../install.js';
import { analyticsOn, setAnalytics } from '../../analytics.js';

// ---------- menu permainan ----------
function onlineControls() {
  const N = App.mode === 'online' ? App.net : null;
  if (!N || !N.doc) return '';
  let h =
    '<div class="sec-title">' + esc(t(N.isHost() ? 'Room {c} · kamu host' : 'Room {c}', { c: N.code })) + '</div><div class="choice-list">';
  if (N.isHost()) {
    N.doc.seats.forEach((s, i) => {
      if (s.bot || i === App.seat) return;
      const on = N.isOnline(s.uid);
      h += btn(
        'data-afk="' + i + '"',
        'choice',
        'bot',
        s.afk
          ? t('Kembalikan kendali ke {n}', { n: s.name })
          : t(on === false ? 'Kendalikan {n} dengan AI (offline)' : 'Kendalikan {n} dengan AI', { n: s.name })
      );
    });
    h += '</div><div class="tiny muted">' + t('Pakai saat pasangan terputus lama supaya permainan tetap jalan.') + '</div>';
  } else {
    h +=
      btn('id="mTake"', 'choice', 'globe', 'Jadi host (kalau host offline)') +
      '</div><div class="tiny muted">' +
      t('Hanya berhasil bila host benar-benar tidak aktif (±45 detik).') +
      '</div>';
  }
  return h;
}
// sakelar suara di dalam menu (nama aksesibel = teks yang terlihat, status lewat aria-pressed)
const soundTile = () =>
  btn(
    'id="mSound" aria-pressed="' + App.prefs.sound + '"',
    'tile-btn',
    App.prefs.sound ? 'soundOn' : 'soundOff',
    App.prefs.sound ? 'Suara nyala' : 'Suara mati'
  );
// menu beranda (belum ada permainan berjalan)
function openHomeMenu() {
  showModal({
    key: 'menu-home',
    size: 'mid',
    build: () => ({
      title: 'Menu',
      kicker: ic('menu') + 'Loveopoly',
      body:
        '<div class="menu-grid">' +
        btn('id="mGuide"', 'tile-btn', 'book', 'Buku Panduan') +
        soundTile() +
        btn('id="mSet"', 'tile-btn', 'sliders', 'Pengaturan') +
        btn('id="mPass"', 'tile-btn', 'user', 'Paspor Cinta') +
        btn('id="mPriv"', 'tile-btn', 'shield', 'Privasi & data') +
        (installMode() ? btn('id="mInstall"', 'tile-btn', 'download', 'Pasang Aplikasi') : '') +
        '</div>',
      foot: '',
    }),
    mount: m => {
      on(m, '#mGuide', () => {
        closeModal(true);
        UI.openGuide();
      });
      on(m, '#mInstall', async () => {
        if (installMode() === 'ios') {
          closeModal();
          toast('Di Safari: ketuk tombol Bagikan, lalu pilih "Tambah ke Layar Utama".', {
            title: 'Pasang Loveopoly',
            icon: 'download',
            ms: 9000,
          });
          return;
        }
        closeModal();
        if (await promptInstall()) toast('Loveopoly sudah ada di layar utama. Sampai ketemu di sana!', { kind: 'good', icon: 'heart' });
      });
      on(m, '#mSound', () => UI.toggleSound());
      on(m, '#mSet', openSettings);
      on(m, '#mPass', () => {
        closeModal(true);
        UI.openPassport();
      });
      on(m, '#mPriv', openPrivacy);
    },
  });
}
function openMenu() {
  if (!App.S || $('#scrGame').hidden) {
    openHomeMenu();
    return;
  }
  let confirm = '';
  showModal({
    key: 'menu',
    size: 'mid',
    build: () => {
      const S = App.S,
        cur = S.turn.p;
      const canEndNow = controls(cur) && !S.queue.length && !S.over;
      return {
        title: 'Menu',
        kicker: ic('menu') + esc(t('Ronde {r}', { r: S.round })),
        body:
          '<div class="menu-grid">' +
          btn('id="mGuide"', 'tile-btn', 'book', 'Buku Panduan') +
          btn('id="mHist"', 'tile-btn', 'history', 'Riwayat') +
          btn('id="mPf"', 'tile-btn', 'briefcase', 'Asetku') +
          soundTile() +
          btn('id="mSet"', 'tile-btn', 'sliders', 'Pengaturan') +
          btn('id="mPause"', 'tile-btn', S.paused ? 'play' : 'pause', S.paused ? 'Lanjutkan' : 'Jeda') +
          '</div><div class="choice-list">' +
          btn('id="mExit"', 'choice', 'exit', 'Keluar ke beranda (progres tersimpan)') +
          btn(
            'id="mFinish"',
            'choice',
            'trophy',
            confirm === 'finish' ? 'Yakin? Pemenang = aset terbesar sekarang' : 'Akhiri & hitung aset',
            !canEndNow
          ) +
          btn(
            'id="mResign"',
            'choice danger',
            'flag',
            confirm === 'resign' ? 'Yakin menyerah? Kotamu kembali ke bank' : t('Menyerah ({n})', { n: S.players[cur].name }),
            !canEndNow
          ) +
          '</div>' +
          (!canEndNow
            ? '<div class="tiny muted">' + t('Akhiri/menyerah hanya di giliran pemain manusia tanpa keputusan tertunda.') + '</div>'
            : '') +
          onlineControls(),
        foot: '',
      };
    },
    mount: m => {
      const S = App.S,
        cur = S.turn.p;
      on(m, '#mGuide', () => {
        closeModal();
        UI.openGuide();
      });
      on(m, '#mHist', openHistory);
      on(m, '#mPf', () => openPortfolio(viewer()));
      on(m, '#mSet', openSettings);
      on(m, '#mSound', () => UI.toggleSound());
      on(m, '#mPause', () => {
        closeModal();
        UI.togglePause();
      });
      on(m, '#mFinish', () => {
        if (confirm !== 'finish') {
          confirm = 'finish';
          refreshModal();
          return;
        }
        closeModal();
        act({ type: 'FINISH_NOW', p: cur });
      });
      on(m, '#mResign', () => {
        if (confirm !== 'resign') {
          confirm = 'resign';
          refreshModal();
          return;
        }
        closeModal();
        act({ type: 'RESIGN', p: cur });
      });
      on(m, '#mExit', openExit);
      $$('[data-afk]', m).forEach(b =>
        b.addEventListener('click', () => {
          const i = Number(b.dataset.afk);
          const seat = App.net.doc.seats[i];
          App.net.setAfk(i, !seat.afk);
          refreshModal();
        })
      );
      on(m, '#mTake', async () => {
        await App.net.takeOver();
        refreshModal();
      });
    },
  });
}
function openExit() {
  showModal({
    key: 'exit',
    size: 'mid',
    build: () => ({
      title: 'Keluar ke Menu?',
      kicker: ic('exit') + esc(t('Keluar')),
      body:
        App.mode === 'online'
          ? '<div class="note">' +
            ic('info') +
            '<span>' +
            t('Kamu bisa kembali kapan saja dengan kode room {c}.', { c: '<b class="mono">' + esc(App.net ? App.net.code : '') + '</b>' }) +
            '</span></div>'
          : '<div class="note">' +
            ic('info') +
            ' ' +
            esc(t('Progres tersimpan otomatis di perangkat ini. Lanjutkan dari menu utama kapan saja.')) +
            '</div>',
      foot: btn('id="xNo"', 'ghost', 'back', 'Tetap Main') + '<span class="grow"></span>' + btn('id="xYes"', 'primary', 'exit', 'Keluar'),
    }),
    mount: m => {
      on(m, '#xNo', () => closeModal());
      on(m, '#xYes', () => {
        closeModal();
        UI.exitToHome();
      });
    },
  });
}
function seg(id, opts, val) {
  return (
    '<div class="seg" role="group" id="' +
    id +
    '">' +
    opts
      .map(([k, l]) => '<button type="button" data-v="' + k + '" aria-pressed="' + (val === k) + '">' + esc(t(l)) + '</button>')
      .join('') +
    '</div>'
  );
}
const tr = t;
// baris sakelar Pengaturan: judul + keterangan; nama aksesibel = judul yang terlihat
const toggleRow = (id, title, note, on) =>
  '<div class="toggle-row"><div><b>' +
  esc(t(title)) +
  '</b><div class="tiny muted">' +
  esc(t(note)) +
  '</div></div><button type="button" class="switch" role="switch" id="' +
  id +
  '" aria-checked="' +
  !!on +
  '" aria-label="' +
  esc(t(title)) +
  '"></button></div>';
// Bahasa: label dwibahasa supaya selalu bisa ditemukan walau sedang di bahasa yang tidak dimengerti
function langOpt() {
  const cur = App.prefs.lang === 'id' || App.prefs.lang === 'en' ? App.prefs.lang : 'auto';
  return (
    '<div class="opt"><span class="label" id="sLangL">Bahasa · Language</span>' +
    seg(
      'sLang',
      [
        ['auto', 'Otomatis (ikut perangkat)'],
        ['id', 'Indonesia'],
        ['en', 'English'],
      ],
      cur
    ).replace('role="group"', 'role="group" aria-labelledby="sLangL"') +
    (cur === 'auto'
      ? '<div class="tiny muted">' + esc(t('Sekarang: {l}', { l: getLang() === 'en' ? 'English' : 'Indonesia' })) + '</div>'
      : '') +
    '</div>'
  );
}
// pilihan tema papan: yang belum terbuka tampil terkunci dengan level syaratnya (hadiah Jam Terbang di Paspor Cinta)
function boardThemeOpt() {
  const pp = UI.passport();
  const L = pp.name ? levelOf(pp.xp) : 1;
  const cur = themeFor(App.prefs.board, L);
  return (
    '<div class="opt"><span class="label" id="sBoardL">' +
    esc(t('Tema papan')) +
    '</span><div class="bt-grid" role="group" aria-labelledby="sBoardL">' +
    BOARD_THEMES.map(t => {
      const open = L >= t.lv;
      return (
        '<button type="button" class="bt" data-board="' +
        t.id +
        '" aria-pressed="' +
        (cur === t.id) +
        '"' +
        (open ? '' : ' disabled') +
        '><span class="bt-sw" data-b="' +
        t.id +
        '" aria-hidden="true"></span><b>' +
        esc(tr(t.name)) +
        '</b><small>' +
        (open
          ? cur === t.id
            ? ic('check') + esc(tr('Dipakai'))
            : esc(tr('Terbuka'))
          : ic('lock') + esc(tr('Terbuka di Lv {l}', { l: t.lv }))) +
        '</small></button>'
      );
    }).join('') +
    '</div><div class="tiny muted">' +
    esc(
      pp.name
        ? tr('Tema baru terbuka lewat Jam Terbang di Paspor Cinta (kamu sekarang Lv {l}). Hanya mengubah warna papan di perangkat ini.', {
            l: L,
          })
        : tr('Buat Paspor Cinta untuk membuka tema papan lewat Jam Terbang.')
    ) +
    '</div></div>'
  );
}
// cadangan paspor (pindah HP / data browser terhapus): tautan pribadi #pulihkan=… (src/ui/screens/backup.js)
function backupOpt() {
  const has = !!UI.passport().name;
  const wa = has
    ? 'https://wa.me/?text=' + encodeURIComponent(t('Cadangan Paspor Cinta Loveopoly (simpan untuk diri sendiri):') + ' ' + UI.backupLink())
    : '';
  return (
    '<div class="opt"><span class="label">' +
    esc(t('Cadangan Paspor')) +
    '</span><div class="tiny muted">' +
    esc(
      t(
        'Jam Terbang, Api Cinta, lencana & cap kota hanya tersimpan di perangkat ini. Simpan tautan cadangan di catatan atau chat pribadimu supaya bisa dipulihkan di HP lain atau setelah data browser terhapus. Siapa pun yang memegang tautannya bisa memulihkan paspormu.'
      )
    ) +
    '</div>' +
    (has
      ? '<div class="bk-row">' +
        btn('id="sBackup"', 'soft', 'share', 'Cadangkan') +
        '<a class="btn soft" id="sBackupWa" target="_blank" rel="noopener" href="' +
        esc(wa) +
        '">' +
        ic('chat') +
        '<span>' +
        esc(t('WhatsApp ke diri sendiri')) +
        '</span></a></div>'
      : '<div class="tiny muted">' + esc(t('Buat Paspor Cinta dulu untuk bisa mencadangkan.')) + '</div>') +
    '<label class="label" for="sRestoreIn">' +
    esc(t('Pulihkan dari tautan cadangan')) +
    '</label><div class="bk-row"><input class="input" id="sRestoreIn" placeholder="loveopoly.web.app/#pulihkan=…" autocomplete="off" spellcheck="false">' +
    btn('id="sRestoreGo"', 'ghost', 'refresh', 'Pulihkan') +
    '</div></div>'
  );
}
function openSettings() {
  showModal({
    key: 'settings',
    size: 'mid',
    build: () => ({
      title: 'Pengaturan',
      kicker: ic('sliders') + esc(t('Tersimpan di perangkat ini')),
      body:
        '<div class="opt-list">' +
        langOpt() +
        toggleRow('sSound', 'Efek suara', 'Dadu, koin, kartu, dan musik kecil.', App.prefs.sound) +
        toggleRow(
          'sView3d',
          'Papan 3D',
          'Papan miring dengan ilustrasi berdiri seperti pop-up. Matikan untuk papan datar.',
          App.prefs.view3d !== false
        ) +
        (canBuzz()
          ? toggleRow(
              'sHaptic',
              'Getar halus',
              'Getaran singkat saat kamu melempar dadu, membeli kota, menang & naik level. Mati otomatis saat Hemat baterai.',
              App.prefs.haptics !== false
            )
          : '') +
        toggleRow(
          'sWalkCam',
          'Sorot langkah (HP)',
          'Saat pion berjalan, papan mendekat mengikuti pion supaya nama & gambar petak besar, lalu kembali menampilkan seluruh papan.',
          App.prefs.walkCam !== false
        ) +
        toggleRow(
          'sAutoEnd',
          'Akhiri giliran otomatis',
          'Giliran selesai sendiri ±2 detik setelah semua beres. Sentuh layar untuk menahan.',
          App.prefs.autoEnd !== false
        ) +
        toggleRow(
          'sStats',
          'Bantu kembangkan Loveopoly',
          'Kirim statistik pemakaian anonim (Google Analytics) & laporan error. Tanpa nama, pesan, foto, atau kode room.',
          analyticsOn()
        ) +
        boardThemeOpt() +
        backupOpt() +
        '<div class="opt"><span class="label">' +
        esc(t('Hemat baterai')) +
        '</span>' +
        seg(
          'sPower',
          [
            ['auto', 'Otomatis'],
            ['save', 'Nyala'],
            ['full', 'Mati'],
          ],
          App.prefs.power || 'auto'
        ) +
        '<div class="tiny muted opt-note">' +
        esc(
          t(
            'Hiasan yang terus bergerak (Merpi, bola dunia) diam & latar Kabar Merpi bergerak pelan supaya HP tidak cepat panas & baterai awet. Langkah pion, dadu & kartu tetap beranimasi. Otomatis: nyala di HP yang lebih ringan atau saat HP sedang berat (diukur ulang tiap kali dibuka).'
          ) +
            ' ' +
            t(UI.lowPower() ? 'Di perangkat ini sekarang: nyala.' : 'Di perangkat ini sekarang: mati.')
        ) +
        '</div></div>' +
        '<div class="opt"><span class="label">' +
        esc(t('Kecepatan animasi')) +
        '</span>' +
        seg(
          'sSpeed',
          [
            ['normal', 'Normal'],
            ['fast', 'Cepat'],
          ],
          App.prefs.speed
        ) +
        '</div>' +
        '<div class="opt"><span class="label">' +
        esc(t('Kecepatan AI')) +
        '</span>' +
        seg(
          'sAi',
          [
            ['slow', 'Santai'],
            ['normal', 'Normal'],
            ['fast', 'Cepat'],
          ],
          App.prefs.aiSpeed
        ) +
        '</div>' +
        '<div class="opt"><span class="label">' +
        esc(t('Tema')) +
        '</span>' +
        seg(
          'sTheme',
          [
            ['system', 'Ikuti sistem'],
            ['light', 'Terang'],
            ['dark', 'Gelap'],
          ],
          App.prefs.theme
        ) +
        '</div>' +
        '</div>',
      foot:
        btn('id="sPrivacy"', 'ghost', 'shield', 'Privasi & data') +
        '<span class="grow"></span>' +
        btn('id="sDone"', 'primary', 'check', 'Selesai'),
    }),
    mount: m => {
      on(m, '#sSound', () => {
        App.prefs.sound = !App.prefs.sound;
        SND.setEnabled(App.prefs.sound);
        UI.savePrefs();
        UI.syncSoundBtn && UI.syncSoundBtn();
        refreshModal();
      });
      on(m, '#sStats', () => {
        App.prefs.analytics = !analyticsOn();
        UI.savePrefs();
        setAnalytics(App.prefs.analytics);
        refreshModal();
      });
      on(m, '#sHaptic', () => {
        App.prefs.haptics = App.prefs.haptics === false;
        UI.savePrefs();
        if (App.prefs.haptics) UI.buzz('dice');
        refreshModal();
      });
      $$('[data-board]', m).forEach(b =>
        b.addEventListener('click', () => {
          if (b.disabled) return;
          App.prefs.board = b.dataset.board;
          UI.savePrefs();
          UI.applyTheme();
          SND.play('click');
          refreshModal();
        })
      );
      on(m, '#sBackup', () => UI.shareBackup());
      const rin = $('#sRestoreIn', m);
      const restore = () => {
        const data = parseBackup(rin.value);
        if (!data) {
          toast('Tautan cadangan tidak dikenali. Tempel tautan lengkap yang diawali loveopoly.web.app/#pulihkan=…', { kind: 'err' });
          rin.focus();
          return;
        }
        UI.openRestore(data);
      };
      on(m, '#sRestoreGo', restore);
      if (rin)
        rin.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            restore();
          }
        });
      on(m, '#sAutoEnd', () => {
        App.prefs.autoEnd = App.prefs.autoEnd === false;
        UI.savePrefs();
        refreshModal();
      });
      on(m, '#sView3d', () => {
        App.prefs.view3d = App.prefs.view3d === false;
        UI.savePrefs();
        if (App.S) {
          UI.applyLayout(true);
          UI.renderTokens && UI.renderTokens();
          UI.renderStage && UI.renderStage();
        }
        refreshModal();
      });
      on(m, '#sWalkCam', () => {
        App.prefs.walkCam = App.prefs.walkCam === false;
        UI.savePrefs();
        if (!App.prefs.walkCam && UI.camRelax) UI.camRelax();
        refreshModal();
      });
      [
        ['#sSpeed', 'speed'],
        ['#sAi', 'aiSpeed'],
        ['#sTheme', 'theme'],
        ['#sPower', 'power'],
        ['#sLang', 'lang'],
      ].forEach(([sel, k]) =>
        $$(sel + ' [data-v]', m).forEach(b =>
          b.addEventListener('click', () => {
            App.prefs[k] = b.dataset.v;
            UI.savePrefs();
            UI.applyTheme();
            UI.wakeCalm();
            if (k === 'lang') UI.relang().then(() => refreshModal());
            else refreshModal();
          })
        )
      );
      on(m, '#sDone', () => closeModal());
      on(m, '#sPrivacy', () => openPrivacy());
    },
  });
}

// ---------- privasi: data apa yang disimpan, di mana, berapa lama; hapus data perangkat ----------
function openPrivacy() {
  let confirmDel = false;
  showModal({
    key: 'privacy',
    size: 'mid',
    build: () => {
      const row = (icon, title, text) =>
        '<div class="pv-row">' + ic(icon) + '<div><b>' + esc(t(title)) + '</b><p>' + esc(t(text)) + '</p></div></div>';
      return {
        kicker: ic('shield') + esc(t('Privasi')),
        title: 'Data kamu di Loveopoly',
        body:
          '<div class="pv-list">' +
          row('heart', 'Tanpa iklan', 'Loveopoly tidak memakai iklan dan tidak menjual data apa pun.') +
          row(
            'level',
            'Statistik pemakaian anonim',
            'Untuk memperbaiki game, kami memakai Google Analytics: jenis kejadian (mulai/selesai main, mode, jumlah pemain, ronde) dan laporan error, dengan pengenal acak di browser (cookie). Tidak pernah nama, pesan, surat, foto, atau kode room; fitur iklan Google dimatikan. Matikan kapan saja di Pengaturan → Bantu kembangkan Loveopoly.'
          ) +
          row(
            'user',
            'Paspor Cinta & simpanan game',
            'Nama, avatar, warna pion, statistik, cap kota, Jam Terbang, Api Cinta, lencana, rekap tahunan (jumlah main, nama lawan main, kota & cara menang, untuk Kilas Balik), setelan game terakhir, dan game yang sedang berjalan hanya tersimpan di perangkat ini (penyimpanan browser). Menghapus data browser atau pindah HP berarti mulai dari awal, kecuali kamu menyimpan tautan cadangan (Pengaturan → Cadangan Paspor): isinya paspor & pengaturan tampilanmu (bagian setelah tanda #, tidak dikirim ke server kami), jadi simpan untuk dirimu sendiri.'
          ) +
          row(
            'letter',
            'Pertanyaan Hari Ini',
            'Jawabanmu tersimpan di perangkat ini. Saat kamu membagikannya, nama & jawabanmu ikut di tautan itu (bagian setelah tanda #, tidak dikirim ke server kami), jadi siapa pun yang menerima tautannya bisa melihatnya. Kirim hanya ke pasanganmu.'
          ) +
          row(
            'globe',
            'Main online',
            t(
              'Saat main online kamu masuk tanpa akun (login anonim Firebase: kode acak, tanpa email/nomor HP). Nama, avatar, isi permainan, surat, dan Foto Bukti disimpan di room (Google Firebase) dan hanya bisa dibuka oleh orang yang tahu kode room-nya.'
            ) +
              (window.LOVE_FIREBASE && window.LOVE_FIREBASE.appCheckSiteKey
                ? ' ' + t('Untuk menangkal bot, main online memakai Google reCAPTCHA.')
                : '')
          ) +
          row(
            'polaroid',
            'Foto Bukti',
            'Foto hanya diambil saat kamu menekan tombol kamera, dikecilkan sebelum dikirim, dan hanya dilihat pemain di permainan yang sama. Di perangkat: maksimal 4 foto terakhir per permainan.'
          ) +
          row(
            'clock',
            'Berapa lama disimpan',
            'Room online beserta Foto Bukti dan surat di dalamnya dihapus dari server saat host kembali ke menu setelah permainan selesai. Room yang ditinggal sebelum selesai tetap tersimpan, jadi kirim hanya foto yang kamu nyaman dibagikan ke pemain lain di room.'
          ) +
          '</div>' +
          '<div class="pv-del">' +
          (confirmDel
            ? '<div class="note warn">' +
              ic('alert') +
              '<span>' +
              esc(
                t(
                  'Hapus Paspor Cinta, simpanan game, dan pengaturan di perangkat ini? Tidak bisa dibatalkan. Simpan tautan cadangan dulu (Pengaturan → Cadangan Paspor) kalau ingin memulihkannya nanti.'
                )
              ) +
              '</span></div>'
            : '') +
          btn(
            'id="pvDel"',
            confirmDel ? 'danger' : 'ghost',
            'x',
            confirmDel ? 'Ya, hapus data perangkat ini' : 'Hapus data di perangkat ini'
          ) +
          '</div>',
        foot: '<span class="grow"></span>' + btn('id="pvOk" data-focus', 'primary', 'check', 'Mengerti'),
      };
    },
    mount: m => {
      on(m, '#pvOk', () => closeModal());
      on(m, '#pvDel', () => {
        if (!confirmDel) {
          confirmDel = true;
          refreshModal();
          return;
        }
        try {
          Object.keys(localStorage)
            .filter(k => k.indexOf('loveopoly.') === 0)
            .forEach(k => localStorage.removeItem(k));
        } catch (e) {
          /* abaikan */
        }
        closeModal(true);
        toast('Data Loveopoly di perangkat ini sudah dihapus.', { kind: 'good', icon: 'check' });
        if (UI.exitToHome) UI.exitToHome(true);
        setTimeout(() => location.reload(), 900);
      });
    },
  });
}

export { openExit, openMenu, openPrivacy, openSettings };
