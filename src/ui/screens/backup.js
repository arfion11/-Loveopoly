/* LOVEOPOLY — layar › cadangan & pemulihan Paspor Cinta (dikumpulkan lewat src/ui/screens.js; logika di src/ui/backup.js)
   Semua progres hanya ada di browser perangkat ini. Supaya tidak hilang (pindah HP, data browser dihapus, Safari
   menghapus data situs yang lama tidak dibuka): (1) minta penyimpanan permanen saat ada progres (keepData),
   (2) tautan cadangan pribadi …/#pulihkan=… yang dibuka di HP mana pun → konfirmasi → paspor diganti. */
import { App, SND, esc, ic, $, store, toast, t } from '../core.js';
import { numLocale } from '../../i18n/i18n.js';
import { UI } from '../ns.js';
import { makeBackup, normProfile, parseBackup } from '../backup.js';
import { levelInfo, streakView, weekNo } from '../progress.js';

const PKEY = 'loveopoly.v1.profile',
  DKEY = 'loveopoly.v1.daily';

// minta browser tidak menghapus data situs ini (Chrome: otomatis untuk situs yang sering dipakai / terpasang;
// Firefox bertanya; Safari menilai sendiri). Sekali per sesi, hanya saat ada progres yang layak dijaga.
let asked = false;
function keepData() {
  if (asked) return;
  asked = true;
  try {
    const s = navigator.storage;
    if (s && s.persist && s.persisted)
      s.persisted()
        .then(ok => ok || s.persist())
        .catch(() => {});
  } catch (e) {
    /* opsional */
  }
}

const backupLink = () =>
  location.origin +
  '/#pulihkan=' +
  makeBackup({ profile: store.get(PKEY, null), prefs: App.prefs, daily: store.get(DKEY, null) }, Date.now());
const waHref = url =>
  'https://wa.me/?text=' + encodeURIComponent(t('Cadangan Paspor Cinta Loveopoly (simpan untuk diri sendiri)') + ': ' + url);

// bagikan / salin tautan cadangan (dipakai halaman paspor)
function shareBackup() {
  const url = backupLink();
  const done = () =>
    toast('Tautan cadangan disalin. Simpan di catatan atau kirim ke chat pribadimu.', { kind: 'good', icon: 'check', ms: 4200 });
  if (navigator.share)
    return navigator
      .share({ title: t('Cadangan Paspor Cinta'), text: t('Cadangan Paspor Cinta Loveopoly (simpan untuk diri sendiri)'), url })
      .catch(e => {
        if (e && e.name !== 'AbortError') copy(url, done);
      });
  copy(url, done);
}
const copy = (txt, done) =>
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
    .then(done)
    .catch(() => toast('Tidak bisa menyalin otomatis. Pakai tombol WhatsApp ya.', { kind: 'err' }));

const summary = p => {
  const lv = levelInfo(p.xp),
    v = streakView(p.wk, weekNo(Date.now()));
  return (
    '<div class="bk-card"><span class="bk-av" aria-hidden="true" style="--c:' +
    p.color +
    '">' +
    esc(p.avatar) +
    '</span><span class="grow"><b>' +
    esc(p.name) +
    '</b><small>Lv ' +
    lv.L +
    ' ' +
    esc(t(lv.title)) +
    ' · ' +
    esc(t('Api Cinta {n} minggu (rekor {b}) · {g} main · {c} cap kota', { n: v.n, b: p.wk.best, g: p.games, c: p.stamps.length })) +
    '</small></span></div>'
  );
};

// konfirmasi pemulihan dari tautan / kode cadangan (data tak tepercaya: sudah lewat parseBackup)
function openRestore(data) {
  const cur = normProfile(store.get(PKEY, null));
  const replacing = cur.name && (cur.games || cur.xp) && !(cur.name === data.p.name && cur.since === data.p.since);
  const when = data.t ? new Date(data.t).toLocaleDateString(numLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  UI.showModal({
    key: 'restore',
    size: 'mid',
    build: () => ({
      kicker: ic('book') + esc(t('Cadangan Paspor Cinta')),
      title: 'Pulihkan paspor ini?',
      body:
        summary(data.p) +
        (when ? '<p class="muted">' + esc(t('Dicadangkan {d}.', { d: when })) + '</p>' : '') +
        (replacing
          ? '<div class="note warn">' +
            ic('alert') +
            '<span>' +
            esc(
              t('Paspor di perangkat ini ({n}, Lv {l}) akan diganti. Cadangkan dulu kalau masih ingin menyimpannya.', {
                n: cur.name,
                l: levelInfo(cur.xp).L,
              })
            ) +
            '</span></div>'
          : '') +
        '<p class="muted">' +
        esc(t('Pengaturan tampilan & Pertanyaan Hari Ini ikut dipulihkan. Simpanan game yang sedang berjalan tidak ikut.')) +
        '</p>',
      foot:
        UI.btn('id="bkNo"', 'ghost', 'x', 'Batal') +
        '<span class="grow"></span>' +
        UI.btn('id="bkYes" data-focus', 'primary', 'check', 'Pulihkan'),
    }),
    mount: m => {
      $('#bkNo', m).onclick = () => UI.closeModal();
      $('#bkYes', m).onclick = () => {
        const p = Object.assign({}, data.p, { seen: Date.now(), skipped: false });
        store.set(PKEY, p);
        Object.assign(App.prefs, data.s);
        UI.savePrefs();
        if (data.d) store.set(DKEY, data.d);
        keepData();
        UI.applyTheme();
        UI.closeModal(true);
        if (!App.S || $('#scrGame').hidden) UI.renderHome();
        SND.play('stamp');
        toast(t('Paspor {n} dipulihkan. Selamat datang kembali!', { n: p.name }), {
          kind: 'good',
          icon: 'heart',
          title: t('Paspor kembali'),
          ms: 4500,
        });
      };
    },
  });
}

// tautan cadangan di alamat (#pulihkan=…): dibaca saat boot / hashchange lalu dihapus dari alamat.
// null = tidak ada, false = rusak, selain itu isi cadangan tervalidasi
function restoreFromHash() {
  const m = /[#&]pulihkan=([A-Za-z0-9_-]+)/.exec(location.hash || '');
  if (!m) return null;
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {
    /* abaikan */
  }
  return parseBackup(m[1]) || false;
}

export { backupLink, keepData, openRestore, restoreFromHash, shareBackup, waHref };
