/* LOVEOPOLY — UI inti › header, kartu pemain, panggung, log (diekspor ulang lewat src/ui/core.js) */
import { SND } from '../../assets/audio.js';
import { Icons } from '../../assets/icons.js';
import { D } from '../../engine/data.js';
import { E } from '../../engine/engine.js';
import { UI } from '../ns.js';
import { wakeCalm } from './power.js';
import {
  $,
  $$,
  App,
  RULES,
  TILES,
  avatarHTML,
  coin,
  controls,
  esc,
  fmt,
  ic,
  pulse,
  reduceMotion,
  restart,
  runsAI,
  safeImg,
  setHTML,
} from './base.js';
import { toast } from './notify.js';
import { miniStrip } from './layout.js';
import { auto3d, camAuto, camFocus, camHold, is3d, renderCamCtl } from './camera.js';
import { renderBoard } from './board.js';
import { renderTokens } from './pieces.js';
import { tweens } from './effects.js';
import { fill, mascotLook, mascotWake, merpiMood, merpiSay, pick, renderAmbience } from './mascot.js';
import { act } from './flow.js';

// ---------- header, pemain, panggung ----------
function renderHeader(S) {
  S = S || App.S;
  const mid = $('#hdrMid');
  if (!mid) return;
  let net = $('#hdrNet');
  if (!net) {
    net = document.createElement('span');
    net.id = 'hdrNet';
    net.className = 'hdr-net';
    mid.insertBefore(net, mid.firstChild);
  }
  const on = !!(S && App.mode === 'online' && App.net);
  setHTML(net, on ? App.net.chipHTML() : '');
  mid.classList.toggle('net-on', on);
}
function playerCardHTML(S, p, compact) {
  const tier = E.tierInfo(p.love);
  const cities = E.citiesOf(S, p.i).length,
    spots = E.spotsOf(S, p.i).length;
  const nw = E.netWorth(S, p.i);
  // selama papan muncul & undian giliran (App.revealing), siapa yang jalan duluan dirahasiakan
  const active = p.i === S.turn.p && !S.over && !App.revealing;
  const tags = [];
  if (p.bankrupt) tags.push('<span class="tag warn">' + ic('alert') + 'Bangkrut</span>');
  if (p.island) tags.push('<span class="tag sea">' + ic('island') + 'Pulau Rindu</span>');
  if (p.tour) tags.push('<span class="tag sky">' + ic('plane') + 'World Tour</span>');
  if (p.skip) tags.push('<span class="tag warn">' + ic('pause') + 'Lewat giliran</span>');
  if (p.discount) tags.push('<span class="tag good">' + ic('ticket') + 'Diskon ' + Math.round(p.discount * 100) + '%</span>');
  const held = {};
  p.cards.forEach(c => {
    const k = E.CARD[c].power;
    held[k] = (held[k] || 0) + 1;
  });
  Object.keys(held).forEach(k =>
    tags.push('<span class="tag lilac" title="' + esc(D.POWER[k].name) + '">' + ic(D.POWER[k].icon) + '×' + held[k] + '</span>')
  );
  if (!tweens[p.i]) App.cashShown[p.i] = p.cash;
  const kind =
    p.kind === 'ai'
      ? 'AI ' + { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[p.ai]
      : App.mode === 'online'
        ? p.i === App.seat
          ? 'Kamu'
          : 'Online'
        : 'Pemain';
  const presence = App.mode === 'online' && App.net ? App.net.presenceDot(p.i) : '';
  if (compact) {
    return (
      '<button type="button" class="pcard mini' +
      (active ? ' active' : '') +
      (p.bankrupt ? ' bankrupt' : '') +
      '" data-p="' +
      p.i +
      '" style="--c:' +
      p.color +
      '">' +
      avatarHTML(p, 'sm') +
      '<span class="pc-txt"><span class="pc-name">' +
      esc(p.name) +
      presence +
      '</span><span class="pc-cash">' +
      coin +
      '<b class="num" data-cash="' +
      p.i +
      '">' +
      fmt(App.cashShown[p.i]) +
      '</b></span></span>' +
      (p.island ? '<span class="pc-flag">' + ic('island') + '</span>' : p.tour ? '<span class="pc-flag">' + ic('plane') + '</span>' : '') +
      '</button>'
    );
  }
  return (
    '<button type="button" class="pcard' +
    (active ? ' active' : '') +
    (p.bankrupt ? ' bankrupt' : '') +
    '" data-p="' +
    p.i +
    '" style="--c:' +
    p.color +
    '"><span class="sr-only">Lihat aset: </span>' +
    (active ? '<span class="turn-pill">Giliran</span>' : '') +
    '<span class="pc-top">' +
    avatarHTML(p) +
    '<span class="pc-id"><span class="pc-name">' +
    esc(p.name) +
    presence +
    '</span><span class="pc-kind">' +
    esc(kind) +
    '</span></span></span>' +
    '<span class="pc-cash">' +
    coin +
    '<b class="num" data-cash="' +
    p.i +
    '">' +
    fmt(App.cashShown[p.i]) +
    '</b></span>' +
    '<span class="pc-meta"><span title="Total aset">' +
    ic('briefcase') +
    fmt(nw) +
    '</span><span title="Kota">' +
    ic('house') +
    cities +
    '</span><span title="Wisata">' +
    ic('ferris') +
    spots +
    '</span></span>' +
    '<span class="pc-love" title="Love Meter ' +
    p.love +
    '/100 · ' +
    esc(tier.name) +
    '">' +
    ic('heart') +
    '<span class="meter"><i style="--v:' +
    p.love +
    '%"></i></span><b>' +
    esc(tier.name) +
    '</b></span>' +
    (tags.length ? '<span class="pc-tags">' + tags.join('') + '</span>' : '') +
    '</button>'
  );
}
function slotOrder(n) {
  if (n === 2) return ['slotBL', 'slotTR'];
  if (n === 3) return ['slotBL', 'slotTL', 'slotTR'];
  return ['slotBL', 'slotTL', 'slotTR', 'slotBR'];
}
function placePlayers() {
  if (App.S) renderPlayers(App.S, true);
}
function renderPlayers(S, force) {
  S = S || App.S;
  if (!S) return;
  const compact = App.layout !== 'wide';
  const mini = miniStrip();
  const order = slotOrder(S.players.length);
  ['slotTL', 'slotBL', 'slotTR', 'slotBR'].forEach(id => {
    const el = $('#' + id);
    if (el && !order.includes(id) && el.innerHTML) {
      el.innerHTML = '';
      el._h = '';
    }
  });
  const strip = $('#strip');
  if (compact) {
    if (force)
      order.forEach(id => {
        const el = $('#' + id);
        if (el) {
          el.innerHTML = '';
          el._h = '';
        }
      });
    if (strip) {
      strip.dataset.n = S.players.length;
      setHTML(strip, S.players.map(p => playerCardHTML(S, p, mini)).join(''));
    }
  } else {
    if (strip && (force || strip.innerHTML)) {
      strip.innerHTML = '';
      strip._h = '';
    }
    S.players.forEach((p, k) => setHTML($('#' + order[k]), playerCardHTML(S, p, false)));
    const freeL = $('#slotTL'),
      freeR = $('#slotBR');
    if (S.players.length === 2 && freeL) setHTML(freeL, infoCardHTML(S));
    if (S.players.length <= 3 && freeR) setHTML(freeR, logCardHTML(S));
  }
  $$('.pcard').forEach(el => {
    el.onclick = () => UI.openPortfolio(Number(el.dataset.p));
  });
  const lb = $('#logMore');
  if (lb) lb.onclick = () => UI.openHistory();
  Object.keys(tweens).forEach(k => {
    if (S.players[k]) tweens[k].to = S.players[k].cash;
  });
}
function infoCardHTML(S) {
  const lim = S.settings.roundLimit;
  const pct = lim ? Math.min(100, Math.round((S.round / lim) * 100)) : 0;
  let h =
    '<div class="info-card"><div class="ic-row"><span class="ic-title">' +
    ic('calendar') +
    'Ronde ' +
    S.round +
    (lim ? ' dari ' + lim : '') +
    '</span></div>' +
    (lim ? '<span class="meter gold"><i style="--v:' + pct + '%"></i></span>' : '') +
    newsCardHTML(S) +
    '<div class="ic-wins"><b>Cara menang cepat</b>';
  if (S.settings.instantWin)
    h +=
      '<span>' +
      ic('trophy') +
      'Trio Warna: 3 grup penuh (1 grup 3 kota)</span><span>' +
      ic('map') +
      'Raja Jalur: 1 jalur penuh</span><span>' +
      ic('ferris') +
      'Kolektor Wisata: 5 wisata</span>';
  h += '<span>' + ic('alert') + 'Buat lawan bangkrut</span></div></div>';
  return h;
}
// Kabar Merpi & Musim Puncak: pil kecil di samping chip ronde (ketuk = detail) dan blok di kartu info desktop
function newsBits(S) {
  const n = S && !S.over ? E.newsInfo(S) : null,
    peak = S && E.peakOn(S);
  return { n, peak };
}
function newsPillHTML(S) {
  const { n, peak } = newsBits(S);
  if (!n && !peak) return '';
  return (
    '<button type="button" class="news-pill' +
    (peak ? ' peak' : '') +
    '" data-news><span class="sr-only">Kabar Merpi: </span>' +
    (n ? ic(NEWS_ICON[n.id] || 'sparkle') + '<span class="np-t">' + esc(n.label) + '</span>' : '') +
    (peak ? '<span class="sr-only">' + (n ? ', ' : '') + 'Musim </span>' + ic('bolt') + '<span class="np-t">Puncak</span>' : '') +
    '</button>'
  );
}
const NEWS_ICON = { rain: 'umbrella', holiday: 'sun', sale: 'ticket', promo: 'plane', bonus: 'coins', love: 'heart' };
function newsCardHTML(S) {
  const { n, peak } = newsBits(S);
  if (!n && !peak) return '';
  return (
    '<div class="news-card">' +
    (n
      ? '<div class="nc-row">' +
        ic(NEWS_ICON[n.id] || 'sparkle') +
        '<span><b>Kabar Merpi: ' +
        esc(n.label) +
        '</b><small>' +
        esc(n.text.charAt(0).toUpperCase() + n.text.slice(1)) +
        ' · sisa ' +
        n.left +
        ' ronde</small></span></div>'
      : '') +
    (peak
      ? '<div class="nc-row peak">' +
        ic('bolt') +
        '<span><b>Musim Puncak</b><small>Semua tol ×' +
        String(RULES.peakMult).replace('.', ',') +
        ' sampai akhir</small></span></div>'
      : '') +
    '</div>'
  );
}
function showNewsToast() {
  const { n, peak } = newsBits(App.S);
  if (!n && !peak) return;
  toast(
    [
      n ? n.label + ': ' + n.text + ' (sisa ' + n.left + ' ronde).' : '',
      peak ? 'Musim Puncak: semua tol ×' + String(RULES.peakMult).replace('.', ',') + ' sampai akhir permainan.' : '',
    ]
      .filter(Boolean)
      .join(' '),
    { title: 'Kabar Merpi', icon: 'sparkle', kind: 'lilac' }
  );
}
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('[data-news]')) showNewsToast();
});
function logCardHTML(S) {
  const items = visibleLog(S)
    .slice(-6)
    .reverse()
    .map(
      l =>
        '<li class="' +
        (l.n > App.lastLogN ? 'new' : '') +
        '"><span class="bub" style="--c:' +
        (l.p >= 0 && S.players[l.p] ? S.players[l.p].color : 'var(--ink-3)') +
        '">' +
        ic(l.icon in Icons.paths ? l.icon : 'dot') +
        '</span><span>' +
        esc(l.text) +
        '</span></li>'
    )
    .join('');
  App.lastLogN = S.logN;
  return (
    '<div class="log-card"><div class="ic-row"><span class="ic-title">' +
    ic('history') +
    'Kabar terbaru</span><button type="button" class="link-btn" id="logMore">Semua</button></div><ul class="log">' +
    items +
    '</ul></div>'
  );
}

function renderStage(S) {
  S = S || App.S;
  if (!S || !$('#turnLine')) return;
  wakeCalm(); // ada perubahan di permainan: hiasan jalan lagi (lihat power.js)
  const cur = S.players[S.turn.p];
  const lim = S.settings.roundLimit;
  setHTML($('#roundChip'), ic('calendar') + '<span>Ronde <b>' + S.round + '</b>' + (lim ? '/' + lim : '') + '</span>');
  setHTML($('#newsSlot'), newsPillHTML(S));
  renderAmbience(S);
  const tl = $('#turnLine');
  setHTML(
    tl,
    S.over
      ? '<span class="tl-txt">' + ic('trophy') + ' Permainan selesai</span>'
      : App.revealing
        ? '<span class="tl-txt">' + ic('dice') + ' Mengundi giliran…</span>'
        : avatarHTML(cur, 'xs') +
          '<span class="tl-txt"><span class="tl-w">Giliran </span><b>' +
          esc(cur.name) +
          '</b></span>' +
          '<span class="tl-round">' +
          ic('calendar') +
          'R' +
          S.round +
          (lim ? '/' + lim : '') +
          '</span>' +
          (cur.island
            ? '<span class="tag sea">' +
              ic('island') +
              '<span class="tl-w">Pulau Rindu </span>' +
              cur.islandTries +
              '/' +
              RULES.islandTurns +
              '</span>'
            : '')
  );
  tl.classList.toggle('has-tag', !S.over && !App.revealing && !!cur.island);
  const tkey = S.over ? 'over' : S.turn.p + ':' + S.round;
  if (App.turnKey !== tkey && !App.revealing) {
    const fresh = !!App.turnKey;
    App.turnKey = tkey;
    App.aim = null;
    if (fresh && !S.over) {
      pulse(tl, 'pop', 900);
      mascotLook(cur.pos);
      mascotWake();
      if (controls(S.turn.p)) merpiSay(fill(pick(D.MERPI.turn), S), '', 2400);
      if (is3d()) {
        if (auto3d()) camHold(false);
        else if (App.cam.zoomed && Date.now() >= App.cam.manualUntil) camFocus(cur.pos, true, 500, true);
      } else if (camAuto()) camHold(false);
      else camFocus(cur.pos, true, 500, true);
    }
  }
  const note = $('#statusNote'),
    acts = $('#centerActions');
  let nh = '',
    ah = '';
  const binds = [];
  const btn = (id, cls, icon, label, title) =>
    '<button type="button" class="btn ' +
    cls +
    '" id="' +
    id +
    '"' +
    (title ? ' title="' + esc(title) + '"' : '') +
    '>' +
    (icon ? ic(icon) : '') +
    '<span>' +
    esc(label) +
    '</span></button>';
  let aiming = false,
    mode = '';
  const dots = '<span class="dots"><i></i><i></i><i></i></span>';
  if (S.over) {
    ah = btn('cShowWin', 'primary big', 'trophy', 'Lihat Hasil');
    binds.push(['cShowWin', () => UI.showWin()]);
  } else if (S.paused) {
    nh = 'Permainan dijeda.';
    ah = btn('cResume', 'primary big', 'play', 'Lanjutkan');
    binds.push(['cResume', () => UI.togglePause()]);
  } else if (App.revealing) {
    nh = 'Papan disiapkan, sebentar lagi undian siapa yang jalan duluan…';
  } else if (App.animating) {
    nh = dots;
  } else {
    const a = E.actor(S);
    const it = S.queue[0];
    if (it) {
      const who = S.players[a];
      if (controls(a)) {
        nh = esc(describeItem(S, it, true));
        if (it.type === 'TARGET' || it.type === 'TOUR') {
          mode = 'pick';
          ah = '';
        } else {
          ah = btn('cOpen', 'primary big attn', 'chevron', 'Buka Keputusan');
          binds.push(['cOpen', () => UI.syncModal(true)]);
        }
      } else {
        nh =
          '<span class="wait">' +
          (runsAI(a) ? ic('bot') : ic('clock')) +
          esc(who.name) +
          ' ' +
          esc(describeItem(S, it, false)) +
          ' ' +
          dots +
          '</span>';
        // online: pemilik tantangan yang menunggu penilai boleh membatalkan (penilai pergi / tidak merespons)
        if (it.type === 'CHALLENGE' && it.who !== it.p && controls(it.p)) {
          ah = btn('cChCancel', 'ghost', 'x', 'Batalkan tantangan', 'Lewati bila ' + who.name + ' tidak merespons');
          binds.push(['cChCancel', () => act({ type: 'CH_RESOLVE', p: it.p, result: 'skip' })]);
        }
      }
    } else if (!controls(a)) {
      nh =
        '<span class="wait">' +
        (runsAI(a) ? ic('bot') + esc(cur.name) + ' sedang berpikir' : ic('clock') + 'Menunggu ' + esc(cur.name)) +
        ' ' +
        dots +
        '</span>';
      if (runsAI(a) && !merpiMood && Math.random() < 0.25) merpiSay(pick(D.MERPI.think), 'think', 1400);
    } else {
      const p = cur;
      if (E.islandPre(S, a)) {
        mode = 'island';
        ah += btn('cRoll', 'go', 'dice', 'Cari Kembar', 'Lempar: dadu kembar = keluar dan jalan');
        ah +=
          '<div class="isle-opts">' +
          btn('cIslePay', 'soft', 'boat', 'Bayar ' + RULES.islandFee, 'Bayar perahu dan lempar dadu biasa') +
          (p.cards.some(c => E.CARD[c].power === 'escape') ? btn('cIsleCard', 'soft lilac', 'key', 'Tiket Pulang') : '') +
          (!p.islandCh
            ? btn('cIsleCh', 'soft rose', 'heart', 'Rindu Challenge', 'Lulus tantangan = keluar gratis. Gagal = tetap di pulau.')
            : '') +
          '</div>';
        nh = 'Terdampar! Percobaan ' + (p.islandTries + 1) + '/' + RULES.islandTurns + '. Kembar = keluar, atau pilih cara lain.';
      } else if (E.canRoll(S, a)) {
        if (S.settings.diceControl) {
          aiming = true;
          ah =
            '<div class="aim" role="group" aria-label="Bidik hasil dadu">' +
            [
              ['low', 'Kecil', '2–5'],
              ['mid', 'Sedang', '6–8'],
              ['high', 'Besar', '9–12'],
            ]
              .map(
                ([k, l, r]) =>
                  '<button type="button" data-aim="' +
                  k +
                  '" aria-pressed="' +
                  (App.aim === k) +
                  '" title="Bidik total ' +
                  r +
                  ' (berhasil ' +
                  Math.round(RULES.aimChance * 100) +
                  '%)"><b>' +
                  l +
                  '</b><small>' +
                  r +
                  '</small></button>'
              )
              .join('') +
            '</div>';
        }
        ah += btn('cRoll', 'go', 'dice', S.turn.canRollAgain ? 'Lempar Lagi!' : 'Lempar', App.aim ? 'Bidik ' + E.AIM_LABEL[App.aim] : '');
        nh = S.turn.canRollAgain
          ? 'Dadu kembar! Kamu dapat lemparan bonus.'
          : S.settings.diceControl
            ? 'Pilih bidikan (opsional), lalu tekan Lempar.'
            : 'Tekan Lempar untuk berjalan.';
      } else if (E.canEnd(S, a)) {
        ah = btn('cEnd', 'primary big', 'check', 'Akhiri Giliran');
        nh = App.prefs.autoEnd !== false ? 'Giliran berakhir otomatis. Sentuh layar untuk menahan.' : 'Tekan Akhiri Giliran untuk lanjut.';
      }
      const roll = () => {
        const aim = App.aim;
        if (act(aim ? { type: 'ROLL', p: a, aim } : { type: 'ROLL', p: a })) App.aim = null;
      };
      binds.push(
        ['cRoll', roll],
        ['cEnd', () => act({ type: 'END_TURN', p: a })],
        ['cIslePay', () => act({ type: 'ISLAND_PAY', p: a })],
        ['cIsleCard', () => act({ type: 'ISLAND_CARD', p: a })],
        ['cIsleCh', () => act({ type: 'ISLAND_CH', p: a })]
      );
    }
  }
  setHTML(note, nh);
  setHTML(acts, ah);
  binds.forEach(([id, f]) => {
    const el = $('#' + id);
    if (el) el.onclick = f;
  });
  $$('[data-aim]', acts).forEach(b => {
    b.onclick = () => {
      App.aim = App.aim === b.dataset.aim ? null : b.dataset.aim;
      SND.play('click');
      renderStage();
    };
  });
  const st = $('#stage');
  if (st) {
    st.classList.toggle('aiming', aiming);
    st.dataset.mode = mode;
  }
  renderTicker(S);
}
// selama undian giliran belum terungkap (App.revealing), entri "Undian giliran: … jalan duluan" disembunyikan
function visibleLog(S) {
  return App.revealing ? S.log.filter(l => !/^Undian giliran:/.test(l.text)) : S.log;
}
function renderTicker(S) {
  const el = $('#ticker');
  if (!el || !S) return;
  const log = visibleLog(S);
  const l = log[log.length - 1];
  if (!l) {
    setHTML(el, '');
    return;
  }
  if (setHTML(el, ic(l.icon in Icons.paths ? l.icon : 'dot') + '<span>' + esc(l.text) + '</span>')) restart(el, 'new');
}
function describeItem(S, it, mine) {
  const t = it.tile != null ? TILES[it.tile] : null;
  switch (it.type) {
    case 'BUY':
      return mine ? 'Beli ' + t.name + '?' : 'memutuskan membeli ' + t.name;
    case 'UPGRADE':
      return mine ? 'Bangun di ' + t.name + '?' : 'membangun di ' + t.name;
    case 'RENT':
      return mine ? 'Bayar tol ' + fmt(it.amount) + '.' : 'membayar tol ' + fmt(it.amount);
    case 'TAKEOVER':
      return mine ? 'Ambil alih ' + t.name + '?' : 'mempertimbangkan ambil alih ' + t.name;
    case 'TAX':
      return mine ? 'Bayar Pajak Rindu.' : 'membayar Pajak Rindu';
    case 'CARD':
      return mine ? 'Buka Kartu Cinta.' : 'membuka Kartu Cinta';
    case 'CHALLENGE': {
      const ch = E.CH[it.ch],
        lb = ch ? D.CH_TYPES[ch.type].label : 'tantangan';
      if (it.who != null && it.who !== it.p)
        return mine ? 'Giliranmu menilai ' + lb + '.' : S.players[it.who].name + ' sedang menilai ' + lb;
      return mine ? lb + ' menunggu.' : 'mengerjakan ' + lb;
    }
    case 'DEBT':
      return mine ? 'Uangmu kurang ' + fmt(it.amount - S.players[it.p].cash) + '.' : 'sedang mencari dana';
    case 'TARGET':
      return mine
        ? {
            festival: 'Pilih kota tuan rumah Festival Cinta di papan.',
            build: 'Pilih kotamu untuk dibangun di papan.',
            renov: 'Pilih kota untuk renovasi gratis.',
            storm: 'Pilih kota lawan untuk Badai Rindu.',
            swap: 'Pilih kota yang mau ditukar.',
          }[it.kind]
        : {
            festival: 'memilih kota festival',
            build: 'memilih kota untuk dibangun',
            renov: 'memilih kota renovasi',
            storm: 'memilih sasaran badai',
            swap: 'memilih kota untuk ditukar',
          }[it.kind];
    case 'TOUR':
      return mine ? 'World Tour: pilih tujuan di papan.' : 'memilih tujuan World Tour';
    default:
      return '';
  }
}

// polaroid foto bukti terakhir: rebah di bidang papan (seperti foto di meja); ketuk = galeri bukti
function renderProofPin(S) {
  const c = $('#board .center');
  if (!c) return;
  const ph = S && S.photos && S.photos[S.photos.length - 1];
  let pin = $('#proofPin', c);
  if (!ph) {
    if (pin) pin.remove();
    return;
  }
  if (!pin) {
    pin = document.createElement('button');
    pin.type = 'button';
    pin.id = 'proofPin';
    pin.className = 'proof-pin';
    pin.addEventListener('click', () => UI.openProofs && UI.openProofs());
    c.appendChild(pin);
  }
  const k = S.photos.length + ':' + ph.r + ':' + ph.p;
  if (pin.dataset.k === k) return;
  pin.dataset.k = k;
  pin.setAttribute('aria-label', 'Galeri foto bukti (' + S.photos.length + ')');
  pin.innerHTML =
    '<img src="' +
    safeImg(ph.img) +
    '" alt=""><span class="pp-cap">' +
    esc(S.players[ph.p].name) +
    ' ' +
    (ph.ok ? '✓' : '✗') +
    '</span>' +
    (S.photos.length > 1 ? '<b class="pp-n">' + S.photos.length + '</b>' : '');
}
// foto bukti baru muncul besar di atas papan sebentar, lalu "jatuh" ke polaroid di papan
function showPhotoPop(ph, S) {
  const vp = $('#boardVP');
  if (!vp) return;
  const old = $('.photo-pop', vp);
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'photo-pop' + (ph.ok ? '' : ' no');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<figure><img src="' +
    safeImg(ph.img) +
    '" alt=""><figcaption><b>' +
    esc(S.players[ph.p].name) +
    '</b><span>' +
    (ph.ok ? 'Disahkan' : 'Ditolak') +
    (ph.judge >= 0 ? ' ' + esc(S.players[ph.judge].name) : '') +
    '</span></figcaption></figure>';
  vp.appendChild(el);
  setTimeout(() => el.classList.add('out'), reduceMotion() ? 2400 : 2600);
  setTimeout(() => el.remove(), 3200);
}
function renderAll() {
  const S = App.S;
  if (!S) return;
  renderProofPin(S);
  renderHeader(S);
  renderBoard(S);
  renderTokens(S);
  renderPlayers(S);
  renderStage(S);
  renderCamCtl();
}

export { describeItem, newsPillHTML, placePlayers, renderAll, renderHeader, renderPlayers, renderStage, renderTicker, showPhotoPop };
