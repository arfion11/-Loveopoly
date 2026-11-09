/* LOVEOPOLY — layar › Pertanyaan Hari Ini (dikumpulkan lewat src/ui/screens.js; logika murni di src/ui/daily.js)
   Alur: pilih jawabanmu → tebak pilihan pasangan → kirim tautan (Bagikan / WhatsApp / salin) ATAU jawab bergantian di
   HP ini. Pasangan membuka tautan → menjawab & menebak → hasil terbuka, bisa dikirim balik. Keadaan hari ini disimpan
   di perangkat (loveopoly.v1.daily). Nama & jawaban dari tautan = data tak tepercaya: divalidasi decodeLink & di-escape. */
import { SND, esc, ic, $, $$, store, toast } from '../core.js';
import { UI } from '../ns.js';
import { dailyNo, dailyQ, dayNo, decodeLink, encodeLink, score } from '../daily.js';
import { XP } from '../progress.js';
import { addXp, passport } from './passport.js';

const DKEY = 'loveopoly.v1.daily';
const pickOk = v => Number.isInteger(v) && v >= 0 && v <= 3;
// keadaan tersimpan (disaring: bisa rusak / dari versi lain)
function loadState() {
  const s = store.get(DKEY, null);
  if (!s || typeof s !== 'object' || !Number.isInteger(s.d)) return null;
  const o = {
    d: s.d,
    n: typeof s.n === 'string' ? s.n.slice(0, 16) : '',
    a: pickOk(s.a) ? s.a : null,
    g: pickOk(s.g) ? s.g : null,
    p: null,
    xp: !!s.xp,
  };
  if (s.p && typeof s.p.n === 'string' && pickOk(s.p.a) && pickOk(s.p.g)) o.p = { n: s.p.n.slice(0, 16), a: s.p.a, g: s.p.g };
  return o;
}
const saveState = st => store.set(DKEY, st);
const myName = st => passport().name || (st && st.n) || '';
const linkFor = o => location.origin + '/#tanya=' + encodeLink(o);
const share = (text, url) => {
  if (navigator.share)
    return navigator.share({ title: 'Pertanyaan Hari Ini · Loveopoly', text, url }).catch(e => {
      if (e && e.name !== 'AbortError') copy(text + ' ' + url);
    });
  copy(text + ' ' + url);
};
const copy = t =>
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
    .then(() => toast('Tautan disalin. Tempel ke chat pasanganmu ya.', { kind: 'good', icon: 'check' }))
    .catch(() => toast('Tidak bisa menyalin otomatis. Bagikan lewat WhatsApp saja ya.', { kind: 'err' }));
const waHref = (text, url) => 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);

// kartu di beranda
function dailyCard() {
  const today = dayNo(Date.now()),
    q = dailyQ(today),
    st = loadState();
  const mine = st && st.d === today && st.a != null && st.g != null;
  const done = mine && st.p;
  const status = done
    ? 'Tebakan cocok ' + score({ a: st.a, g: st.g, b: st.p.a, h: st.p.g }).n + '/2 · lihat hasilnya'
    : mine
      ? 'Menunggu jawaban ' + (st.p ? st.p.n : 'pasanganmu') + '… kirim lagi tautannya'
      : 'Jawab, lalu tebak pilihan pasanganmu';
  return (
    '<button type="button" class="daily-card' +
    (done ? ' done' : '') +
    '" id="hDaily"><span class="dc-ic" aria-hidden="true">' +
    ic('letter') +
    '</span><span class="grow"><span class="dc-k">Pertanyaan Hari Ini #' +
    dailyNo(today) +
    '</span><b>' +
    esc(q.q) +
    '</b><span class="dc-st">' +
    esc(status) +
    '</span></span>' +
    ic('chevron') +
    '</button>'
  );
}

// tautan di alamat (#tanya=…): dibaca sekali saat boot lalu dihapus dari alamat. null = tidak ada, false = rusak
function dailyFromHash() {
  const m = /[#&]tanya=([A-Za-z0-9_-]+)/.exec(location.hash || '');
  if (!m) return null;
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {
    /* abaikan */
  }
  return decodeLink(m[1], dayNo(Date.now())) || false;
}

// beri XP sekali per hari soal saat jawabanmu lengkap
function rewardOnce(st) {
  if (st.xp) return;
  st.xp = true;
  const r = addXp(XP.daily);
  if (r)
    toast(
      '+' +
        XP.daily +
        ' XP Jam Terbang.' +
        (r.lv.L > r.L0 ? ' Naik ke Level ' + r.lv.L + ': ' + r.lv.title + '!' : '') +
        r.themes.map(t => ' Tema papan ' + t.name + ' terbuka.').join(''),
      { kind: 'good', icon: 'sparkle', ms: 3200 }
    );
}

const COMMENT = [
  'Wah, banyak yang baru ketahuan hari ini 🤭',
  'Hampir! Masih ada yang bikin penasaran 😄',
  'Kalian saling kenal banget! 💞',
];

/** Buka Pertanyaan Hari Ini. link = isi tautan tervalidasi (opsional). */
function openDaily(link) {
  const today = dayNo(Date.now());
  let st = loadState();
  // view: name → pick → guess → send | gate → p2pick → p2guess → reveal
  const ui = { view: 'pick', tmp: null, p2: { n: '', a: null, g: null }, name: '' };
  if (link && link.m != null) {
    // tautan hasil: jawaban berdua sudah lengkap
    ui.view = 'reveal';
    ui.res = { d: link.d, A: link.n, a: link.a, g: link.g, B: link.m, b: link.b, h: link.h };
    const me = myName(st).toLowerCase();
    if (st && st.d === link.d && me && me === link.n.toLowerCase() && st.a === link.a) {
      st.p = { n: link.m, a: link.b, g: link.h };
      saveState(st);
    }
  } else if (link) {
    const me = myName(st).toLowerCase();
    if (st && st.d === link.d && me && me === link.n.toLowerCase() && st.a === link.a)
      ui.view = 'send'; // tautan milik sendiri
    else {
      ui.view = 'pick';
      ui.from = link; // menjawab tautan pasangan
      if (!st || st.d !== link.d) st = { d: link.d, n: myName(st), a: null, g: null, p: null, xp: false };
      if (st.a != null && st.g != null && !st.p) {
        // sudah menjawab soal ini sendiri sebelumnya: langsung tunjukkan hasil
        st.p = { n: link.n, a: link.a, g: link.g };
        saveState(st);
        ui.view = 'reveal';
      }
    }
  } else {
    if (!st || st.d !== today) st = { d: today, n: myName(st), a: null, g: null, p: null, xp: false };
    ui.view = st.a != null && st.g != null ? (st.p ? 'reveal' : 'send') : 'pick';
  }
  const day = (ui.res && ui.res.d) || st.d;
  const q = dailyQ(day);
  const partnerName = () => (ui.from ? ui.from.n : st.p ? st.p.n : ui.p2.n || 'pasanganmu');

  const opts = (sel, attr, label) =>
    '<div class="dq-opts' +
    (attr === 'data-dqg' ? ' guess' : '') +
    '" role="group" aria-label="' +
    esc(label) +
    '">' +
    q.o
      .map(
        (o, i) =>
          '<button type="button" class="dq-opt" ' +
          attr +
          '="' +
          i +
          '" aria-pressed="' +
          (sel === i) +
          '"><span class="dq-l" aria-hidden="true">' +
          'ABCD'[i] +
          '</span><span>' +
          esc(o) +
          '</span></button>'
      )
      .join('') +
    '</div>';
  const result = () => {
    if (ui.res) return ui.res;
    const A = myName(st) || 'Kamu';
    if (ui.from) return { d: day, A: ui.from.n, a: ui.from.a, g: ui.from.g, B: A, b: st.a, h: st.g };
    return { d: day, A, a: st.a, g: st.g, B: st.p.n, b: st.p.a, h: st.p.g };
  };
  // kolom nama (hanya bila belum punya paspor & belum mengisi): nama ikut di tautan supaya pasangan tahu siapa
  const nameField = () =>
    myName(st)
      ? ''
      : '<label class="label" for="dqName">Namamu (terlihat oleh pasangan)</label><input class="input" id="dqName" maxlength="16" autocomplete="nickname" value="' +
        esc(st.n || '') +
        '">';
  const shareTextQ = () => 'Pertanyaan Hari Ini #' + dailyNo(day) + ' 💌 Aku sudah jawab & menebak pilihanmu. Giliranmu!';

  UI.showModal({
    key: 'daily',
    size: 'mid',
    build: () => {
      const v = ui.view;
      const step = v === 'pick' || v === 'p2pick' ? ' · Langkah 1 dari 2' : v === 'guess' || v === 'p2guess' ? ' · Langkah 2 dari 2' : '';
      const kicker = ic('letter') + 'Pertanyaan Hari Ini #' + dailyNo(day) + step;
      let body = '<p class="dq-q">' + esc(q.q) + '</p>',
        foot = '',
        title = 'Pilihanmu';
      if (v === 'pick' || v === 'p2pick') {
        const p2 = v === 'p2pick';
        title = p2 ? 'Pilihan ' + (ui.p2.n || 'pasangan') : 'Pilihanmu';
        if (ui.from && !p2)
          body =
            '<p class="note gold">' +
            ic('heart') +
            '<span>' +
            esc(ui.from.n) +
            ' sudah menjawab. Sekarang giliranmu, nanti hasilnya terbuka untuk kalian berdua.</span></p>' +
            body;
        body += opts(p2 ? ui.p2.a : ui.tmp, 'data-dqa', 'Pilihanmu');
      } else if (v === 'guess' || v === 'p2guess') {
        const p2 = v === 'p2guess';
        const who = p2 ? myName(st) || 'pasanganmu' : partnerName();
        title = 'Tebak pilihan ' + who;
        // ringkasan langkah 1 + warna berbeda: jelas ini tebakan tentang pasangan, bukan memilih ulang
        body +=
          '<p class="dq-mine">' +
          ic('check') +
          '<span>' +
          (p2 ? 'Pilihan ' + esc(ui.p2.n || 'pasangan') : 'Pilihanmu') +
          ': <b>' +
          esc(q.o[p2 ? ui.p2.a : st.a]) +
          '</b></span></p>' +
          '<p class="dq-hint">Sekarang tebak: menurutmu, <b>' +
          esc(who) +
          '</b> pilih yang mana?</p>' +
          opts(p2 ? ui.p2.g : ui.tmp, 'data-dqg', 'Tebakanmu tentang ' + who);
      } else if (v === 'send') {
        title = 'Kirim ke pasanganmu';
        body +=
          '<p class="dq-mine">' +
          ic('check') +
          '<span>Pilihanmu: <b>' +
          esc(q.o[st.a]) +
          '</b> · tebakanmu tentang pasangan: <b>' +
          esc(q.o[st.g]) +
          '</b></span></p>' +
          '<p class="muted">Kirim tautan ini. Setelah pasanganmu menjawab, hasilnya terbuka untuk kalian berdua. Jawabanmu hanya ada di tautan, tidak dikirim ke server.</p>' +
          nameField() +
          '<div class="dq-share"><button type="button" class="btn primary" id="dqShare">' +
          ic('share') +
          '<span>Bagikan</span></button><a class="btn soft" id="dqWa" target="_blank" rel="noopener" href="' +
          esc(waHref(shareTextQ(), linkFor({ d: day, n: myName(st), a: st.a, g: st.g }))) +
          '">' +
          ic('chat') +
          '<span>WhatsApp</span></a></div>';
        foot = UI.btn('id="dqHot"', 'ghost', 'users', 'Jawab bergantian di HP ini');
      } else if (v === 'gate') {
        title = 'Serahkan ke pasanganmu';
        body =
          '<p class="dq-gate">' +
          ic('users') +
          '<span>Giliran pasanganmu menjawab. Jangan intip ya 🙈</span></p>' +
          '<label class="label" for="dqP2">Nama pasangan</label><input class="input" id="dqP2" maxlength="16" autocomplete="off" value="' +
          esc(ui.p2.n) +
          '">';
        foot = UI.btn('id="dqP2Go"', 'primary', 'play', 'Aku pasangannya, mulai');
      } else if (v === 'reveal') {
        const r = result(),
          sc = score(r);
        title = sc.same ? 'Kalian sama-sama pilih ' + q.o[r.a] + '!' : 'Hasil Pertanyaan Hari Ini';
        const row = (who, pickI, guessWho, guessI, ok) =>
          '<li><span class="dq-who"><b>' +
          esc(who) +
          '</b> pilih <b>' +
          esc(q.o[pickI]) +
          '</b></span><span class="dq-g ' +
          (ok ? 'ok' : 'no') +
          '">' +
          ic(ok ? 'check' : 'x') +
          'tebak ' +
          esc(guessWho) +
          ': ' +
          esc(q.o[guessI]) +
          '</span></li>';
        body +=
          '<ul class="dq-res">' +
          row(r.A, r.a, r.B, r.g, sc.g1) +
          row(r.B, r.b, r.A, r.h, sc.g2) +
          '</ul><p class="dq-score"><b>Tebakan cocok ' +
          sc.n +
          '/2</b> · ' +
          esc(COMMENT[sc.n]) +
          '</p>';
        const resText =
          'Pertanyaan Hari Ini #' + dailyNo(r.d) + ' 💌 Tebakan kami cocok ' + sc.n + '/2' + (sc.n === 2 ? ' 💞' : '') + '. Main gratis:';
        const site = location.origin + '/';
        // yang menjawab tautan pasangan bisa mengirim hasil balik; selain itu bagikan skor tanpa bocoran
        const back = ui.from ? linkFor({ d: r.d, n: r.A, a: r.a, g: r.g, m: r.B, b: r.b, h: r.h }) : '';
        body +=
          (back ? nameField() : '') +
          '<div class="dq-share">' +
          (back
            ? '<a class="btn primary" id="dqBack" target="_blank" rel="noopener" href="' +
              esc(waHref('Hasil Pertanyaan Hari Ini kita sudah keluar 💌', back)) +
              '">' +
              ic('chat') +
              '<span>Kirim hasil ke ' +
              esc(r.A) +
              '</span></a>'
            : '') +
          '<button type="button" class="btn ' +
          (back ? 'soft' : 'primary') +
          '" id="dqScore">' +
          ic('share') +
          '<span>Bagikan skor</span></button></div>';
        ui.shareScore = () => share(resText, site);
      }
      return { kicker, title, body, foot };
    },
    mount: m => {
      // nama diketik → tersimpan & tautan WhatsApp / kirim hasil diperbarui langsung
      const links = () => {
        const wa = $('#dqWa', m);
        if (wa) wa.href = waHref(shareTextQ(), linkFor({ d: day, n: myName(st), a: st.a, g: st.g }));
        const bk = $('#dqBack', m);
        if (bk && ui.from)
          bk.href = waHref(
            'Hasil Pertanyaan Hari Ini kita sudah keluar 💌',
            linkFor({ d: day, n: ui.from.n, a: ui.from.a, g: ui.from.g, m: myName(st), b: st.a, h: st.g })
          );
      };
      const n = $('#dqName', m);
      if (n)
        n.addEventListener('input', () => {
          st.n = n.value.trim().slice(0, 16);
          saveState(st);
          links();
        });
      // tanpa nama, tautan belum boleh dikirim
      const needName = e => {
        if (myName(st)) return false;
        if (e) e.preventDefault();
        toast('Isi namamu dulu ya, supaya pasanganmu tahu siapa yang menjawab.', { kind: 'err' });
        if (n) n.focus();
        return true;
      };
      ['#dqWa', '#dqBack'].forEach(sel => {
        const a = $(sel, m);
        if (a) a.addEventListener('click', e => needName(e));
      });
      $$('[data-dqa]', m).forEach(b =>
        b.addEventListener('click', () => {
          const i = Number(b.dataset.dqa);
          if (ui.view === 'p2pick') {
            ui.p2.a = i;
            ui.view = 'p2guess';
          } else {
            ui.tmp = null;
            st.a = i;
            ui.view = 'guess';
          }
          SND.play('click');
          UI.refreshModal();
        })
      );
      $$('[data-dqg]', m).forEach(b =>
        b.addEventListener('click', () => {
          const i = Number(b.dataset.dqg);
          if (ui.view === 'p2guess') {
            ui.p2.g = i;
            st.p = { n: ui.p2.n || 'Pasangan', a: ui.p2.a, g: ui.p2.g };
            saveState(st);
            ui.view = 'reveal';
            SND.play('fanfare');
          } else {
            st.g = i;
            if (ui.from) st.p = { n: ui.from.n, a: ui.from.a, g: ui.from.g };
            rewardOnce(st);
            saveState(st);
            ui.view = ui.from ? 'reveal' : 'send';
            SND.play(ui.from ? 'fanfare' : 'stamp');
          }
          UI.refreshModal();
          if (UI.renderHome && !$('#scrHome').hidden) UI.renderHome();
        })
      );
      const sh = $('#dqShare', m);
      if (sh)
        sh.onclick = () => {
          if (!needName()) share(shareTextQ(), linkFor({ d: day, n: myName(st), a: st.a, g: st.g }));
        };
      const hot = $('#dqHot', m);
      if (hot)
        hot.onclick = () => {
          ui.view = 'gate';
          UI.refreshModal();
        };
      const p2 = $('#dqP2', m);
      if (p2) p2.addEventListener('input', () => (ui.p2.n = p2.value.trim().slice(0, 16)));
      const go = $('#dqP2Go', m);
      if (go)
        go.onclick = () => {
          ui.view = 'p2pick';
          UI.refreshModal();
        };
      const sc = $('#dqScore', m);
      if (sc) sc.onclick = () => ui.shareScore && ui.shareScore();
    },
  });
}

export { dailyCard, dailyFromHash, openDaily };
