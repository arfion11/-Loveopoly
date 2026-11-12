/* LOVEOPOLY — layar › tur singkat game pertama (dikumpulkan lewat src/ui/screens.js) */
import { App, SND, ART, KEYS, $, store, t } from '../core.js';
import { UI } from '../ns.js';

// ---------- tur singkat di game pertama ----------
function tourSteps(S) {
  const st = S.settings,
    steps = [];
  const mine = UI.controls(S.turn.p);
  // kalimat utuh per kasus (bukan potongan) supaya terjemahannya wajar
  const n = S.players[S.turn.p].name;
  steps.push({
    sel: '#stage',
    title: 'Mulai dari sini',
    text: mine
      ? st.diceControl
        ? t('Pilih bidikan dadu (opsional), lalu tekan Lempar. Dadu kembar = lempar lagi!')
        : t('Tekan Lempar untuk berjalan. Dadu kembar = lempar lagi!')
      : st.diceControl
        ? t(
            'Undian giliran: {n} jalan duluan. Saat giliranmu, pilih bidikan dadu (opsional), lalu tekan Lempar. Dadu kembar = lempar lagi!',
            { n }
          )
        : t('Undian giliran: {n} jalan duluan. Saat giliranmu, tekan Lempar untuk berjalan. Dadu kembar = lempar lagi!', { n }),
  });
  steps.push({
    sel: '#boardVP',
    title: 'Beli kota, bangun, tarik tol',
    text: 'Mendarat di kota kosong: beli tanah + villa/gedung/hotel sekaligus. Ketuk petak mana pun untuk melihat detailnya.',
  });
  if (st.instantWin)
    steps.push({
      sel: '#game .pcard',
      title: 'Menang lebih cepat',
      text: 'Kuasai 3 grup warna, satu jalur penuh, atau 5 tempat wisata. Petak berdenyut = ada yang hampir menang!',
    });
  steps.push({
    sel: '#hMenu',
    title: 'Semua ada di Menu',
    text: 'Buku Panduan, suara, pengaturan, riwayat, jeda, dan keluar ada di tombol ini.',
  });
  return steps;
}
let tourPlace = null;
function endTour(done) {
  UI.leave($('#tourOv'));
  if (tourPlace) {
    removeEventListener('resize', tourPlace);
    tourPlace = null;
  }
  if (done) store.set(KEYS.tour, 'done');
  if (!App.tour) return;
  App.tour = false;
  if (App.S) {
    UI.syncModal();
    UI.renderStage();
    UI.scheduleAI();
    UI.scheduleAutoEnd();
  }
}
function startTour() {
  const S = App.S;
  if (!S || S.over || $('#scrGame').hidden || store.get(KEYS.tour, null) === 'done' || $('#tourOv') || $('#winOv') || $('#guideOv')) {
    if (App.tourPending) {
      App.tourPending = false;
      UI.scheduleAI();
    }
    return;
  }
  const visible = sel => {
    const el = $(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  };
  const steps = tourSteps(S).filter(s => visible(s.sel));
  App.tourPending = false;
  if (!steps.length) {
    UI.scheduleAI();
    return;
  }
  let k = 0;
  App.tour = true;
  clearTimeout(App.aiTimer);
  UI.cancelAutoEnd();
  const ov = document.createElement('div');
  ov.className = 'tour';
  ov.id = 'tourOv';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'tourT');
  ov.innerHTML =
    '<div class="tour-ring"></div><div class="tour-card"><span class="tour-merpi">' +
    ART.merpi('is-happy') +
    '</span><div class="tour-step"></div><b id="tourT"></b><p id="tourP"></p><div class="tour-foot"><button type="button" class="btn ghost sm" id="tSkip"><span>' +
    t('Lewati') +
    '</span></button><span class="grow"></span><button type="button" class="btn primary sm" id="tNext"></button></div></div>';
  document.body.appendChild(ov);
  const ring = $('.tour-ring', ov),
    card = $('.tour-card', ov);
  tourPlace = () => {
    const el = $(steps[k].sel);
    let r = el ? el.getBoundingClientRect() : null;
    if (!r || r.width < 4 || r.height < 4)
      r = { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0, right: innerWidth / 2, bottom: innerHeight / 2 };
    const pad = 8,
      top = Math.max(4, r.top - pad),
      left = Math.max(4, r.left - pad);
    const h = Math.min(innerHeight - 8, r.bottom + pad) - top,
      w = Math.min(innerWidth - 8, r.right + pad) - left;
    Object.assign(ring.style, { top: top + 'px', left: left + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
    const cw = Math.min(340, innerWidth - 32);
    card.style.width = cw + 'px';
    const ch = card.offsetHeight;
    let ct = top + h + 14;
    if (ct + ch > innerHeight - 12) ct = top - ch - 14;
    if (ct < 12) ct = Math.max(12, Math.min(innerHeight - ch - 12, top + h / 2 - ch / 2));
    const cl = Math.max(16, Math.min(innerWidth - cw - 16, left + w / 2 - cw / 2));
    card.style.top = ct + 'px';
    card.style.left = cl + 'px';
  };
  const showStep = () => {
    const st = steps[k];
    $('.tour-step', ov).textContent = t('Tur singkat · {a}/{b}', { a: k + 1, b: steps.length });
    $('#tourT', ov).textContent = t(st.title);
    $('#tourP', ov).textContent = t(st.text);
    $('#tNext', ov).innerHTML = '<span>' + t(k === steps.length - 1 ? 'Mulai main!' : 'Lanjut') + '</span>';
    card.classList.remove('in');
    void card.offsetWidth;
    card.classList.add('in');
    requestAnimationFrame(tourPlace);
  };
  $('#tNext', ov).onclick = () => {
    SND.play('click');
    if (++k >= steps.length) endTour(true);
    else showStep();
  };
  $('#tSkip', ov).onclick = () => endTour(true);
  addEventListener('resize', tourPlace);
  showStep();
  setTimeout(() => {
    const b = $('#tNext', ov);
    if (b) b.focus({ preventScroll: true });
  }, 80);
}

export { endTour, startTour };
