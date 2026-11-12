/* LOVEOPOLY — dialog permainan › dialog keputusan (beli, bangun, tol, rebut, pajak, kartu, utang) & sinkronisasi dengan state (dikumpulkan lewat src/ui/modals.js) */
import { App, D, E, SND, ART, TILES, GROUPS, RULES, fmt, esc, ic, $$, controls, pname, act, coin, buzz, t as tr, tLog } from '../core.js';
import { UI } from '../ns.js';
import {
  btn,
  cityHero,
  closeModal,
  defaultLevel,
  groupProgress,
  head,
  levelCards,
  on,
  refreshModal,
  showModal,
  sumRow,
  whoLine,
} from './base.js';
import { chKey, dChallenge, multiGuess } from './challenge.js';
import { pTarget, pTour } from './targets.js';

// ---------- keputusan ----------
function openDecision(it, key) {
  const map = {
    BUY: dBuy,
    UPGRADE: dUpgrade,
    RENT: dRent,
    TAKEOVER: dTakeover,
    TAX: dTax,
    CARD: dCard,
    CHALLENGE: dChallenge,
    DEBT: dDebt,
    TARGET: pTarget,
    TOUR: pTour,
  };
  const f = map[it.type];
  if (f) {
    f(key);
    if (App.modal) {
      App.modal.itype = it.type;
      if (it.type === 'CHALLENGE') App.modal.chk = chKey(it);
    }
  }
}

function dBuy(key) {
  let sel = null;
  showModal({
    key,
    decision: true,
    size: 'mid',
    build: () => {
      const S = App.S,
        it = head();
      if (!it || it.type !== 'BUY') return null;
      const p = S.players[it.p],
        t = TILES[it.tile];
      const allowed = E.buyLevels(S, it.p, it.tile);
      const costFn = k => E.buyCost(S, it.p, it.tile, k);
      if (sel == null) sel = defaultLevel(S, it.p, it.tile, allowed, costFn);
      const cost = costFn(sel);
      const can = p.cash >= cost;
      let body = cityHero(S, it.tile) + groupProgress(S, it.p, it.tile);
      if (t.type === 'city') {
        body += '<div class="sec-title">' + esc(tr('Bangun sekaligus')) + '</div>' + levelCards(S, it.p, it.tile, -1, sel, allowed, costFn);
        if (E.capLevel(S, it.p) < 3)
          body += '<div class="note">' + ic('info') + ' ' + esc(tr('Hotel terbuka setelah kamu melewati START sekali.')) + '</div>';
      } else {
        body +=
          '<div class="spot-table">' +
          RULES.spotRent
            .map(
              (r, k) =>
                '<span class="' +
                (k === E.spotsOf(S, it.p).length ? 'cur' : '') +
                '"><b>' +
                esc(tr('{n} wisata', { n: k + 1 })) +
                '</b>' +
                esc(tr('Tol {a}', { a: r })) +
                '</span>'
            )
            .join('') +
          '</div><div class="note">' +
          ic('shield') +
          ' ' +
          esc(tr('Tempat wisata tidak bisa diambil alih lawan.')) +
          '</div>';
      }
      if (p.discount)
        body +=
          '<div class="note good">' +
          ic('ticket') +
          ' ' +
          esc(tr('Voucher diskon {d}% dipakai.', { d: Math.round(p.discount * 100) })) +
          '</div>';
      E.winThreats(S)
        .filter(x => x.tile === it.tile)
        .forEach(x => {
          body +=
            '<div class="note ' +
            (x.p === it.p ? 'good' : 'warn') +
            '">' +
            ic(x.p === it.p ? 'trophy' : 'alert') +
            ' ' +
            esc(
              x.p === it.p
                ? tr('Beli ini dan kamu menang {w}!', { w: UI.winLabel(x) })
                : tr('{n} butuh petak ini untuk {w}. Beli untuk menghalangi!', { n: S.players[x.p].name, w: UI.winLabel(x) })
            ) +
            '</div>';
        });
      body += sumRow(p.cash, cost, can);
      return {
        kicker: ic('flag') + esc(tr('Petak kosong')),
        title: tr('Beli {k}?', { k: { tile: it.tile } }),
        who: whoLine(it.p),
        body,
        foot:
          btn('id="bSkip"', 'ghost', '', 'Lewati') +
          '<span class="grow"></span>' +
          btn('id="bBuy"', 'primary big', 'flag', tr('Beli · {a}', { a: cost }), !can),
      };
    },
    mount: m => {
      const it = head();
      $$('[data-lv]', m).forEach(b =>
        b.addEventListener('click', () => {
          sel = Number(b.dataset.lv);
          SND.play('click');
          refreshModal();
        })
      );
      on(m, '#bBuy', () => {
        if (act({ type: 'BUY', p: it.p, level: sel || 0 })) buzz('buy');
      });
      on(m, '#bSkip', () => act({ type: 'BUY_SKIP', p: it.p }));
    },
  });
}

function dUpgrade(key) {
  let sel = null;
  showModal({
    key,
    decision: true,
    size: 'mid',
    build: () => {
      const S = App.S,
        it = head();
      if (!it || it.type !== 'UPGRADE') return null;
      const p = S.players[it.p],
        st = S.tiles[it.tile];
      const allowed = E.upgradeLevels(S, it.p, it.tile);
      const costFn = k => E.upgradeCost(S, it.p, it.tile, k);
      if (sel == null || !allowed.includes(sel)) sel = defaultLevel(S, it.p, it.tile, allowed, costFn);
      const cost = costFn(sel);
      const can = p.cash >= cost;
      const src = { visit: 'Mampir ke kotamu', start: 'Bonus berhenti di START', takeover: 'Kota baru hasil ambil alih' }[it.src] || '';
      let body = cityHero(S, it.tile, { owner: false }) + levelCards(S, it.p, it.tile, st.level, sel, allowed, costFn);
      if (st.level === 3)
        body +=
          '<div class="note gold">' +
          ic('crown') +
          '<span>' +
          tr('Landmark: tol tertinggi dan {b}.', { b: '<b>' + esc(tr('kebal diambil alih')) + '</b>' }) +
          '</span></div>';
      else if (E.capLevel(S, it.p) < 3)
        body += '<div class="note">' + ic('info') + ' ' + esc(tr('Hotel terbuka setelah kamu melewati START sekali.')) + '</div>';
      if (p.discount)
        body +=
          '<div class="note good">' +
          ic('ticket') +
          ' ' +
          esc(tr('Voucher diskon {d}% dipakai.', { d: Math.round(p.discount * 100) })) +
          '</div>';
      body += sumRow(p.cash, cost, can);
      return {
        kicker: ic('build') + esc(tr(src)),
        title: tr(st.level === 3 ? 'Bangun Landmark di {k}?' : 'Bangun di {k}?', { k: { tile: it.tile } }),
        who: whoLine(it.p),
        body,
        foot:
          btn('id="bSkip"', 'ghost', '', 'Nanti saja') +
          '<span class="grow"></span>' +
          btn('id="bUp"', 'primary big', sel === 4 ? 'crown' : 'build', tr('Bangun · {a}', { a: cost }), !can),
      };
    },
    mount: m => {
      const it = head();
      $$('[data-lv]', m).forEach(b =>
        b.addEventListener('click', () => {
          sel = Number(b.dataset.lv);
          SND.play('click');
          refreshModal();
        })
      );
      on(m, '#bUp', () => act({ type: 'UPGRADE', p: it.p, level: sel }));
      on(m, '#bSkip', () => act({ type: 'UPGRADE_SKIP', p: it.p }));
    },
  });
}

function dRent(key) {
  showModal({
    key,
    decision: true,
    size: 'mid',
    build: () => {
      const S = App.S,
        it = head();
      if (!it || it.type !== 'RENT') return null;
      const p = S.players[it.p],
        o = S.players[it.to];
      const ri = E.rentInfo(S, it.tile);
      const nAngel = p.cards.filter(c => E.CARD[c].power === 'angel').length;
      const nDisc = p.cards.filter(c => E.CARD[c].power === 'discount').length;
      const can = p.cash >= it.amount;
      let rows = '';
      if (ri)
        ri.parts.forEach(x => {
          rows +=
            '<div class="kv"><span>' +
            esc(tLog(x.label)) +
            '</span><b>' +
            (x.v != null ? fmt(x.v) : x.m ? '×' + esc(tr('{m}', { m: x.m })) : '+' + x.pct + '%') +
            '</b></div>';
        });
      if (it.discountUsed) rows += '<div class="kv good"><span>' + esc(tr('Kupon Tol 50%')) + '</span><b>÷2</b></div>';
      let body =
        cityHero(S, it.tile) +
        '<div class="toll-big" style="--oc:' +
        o.color +
        '"><span>' +
        esc(tr('Tol untuk {n}', { n: o.name })) +
        '</span><b>' +
        coin +
        fmt(it.amount) +
        '</b></div>' +
        '<div class="kv-list">' +
        rows +
        '</div>';
      if (!can)
        body +=
          '<div class="note warn">' +
          ic('alert') +
          ' ' +
          esc(tr('Uangmu kurang {a}. Setelah menekan Bayar, kamu bisa menjual kota.', { a: it.amount - p.cash })) +
          '</div>';
      if (S.settings.takeover && TILES[it.tile].type === 'city' && S.tiles[it.tile].level < 4)
        body +=
          '<div class="tiny muted">' +
          ic('swap') +
          ' ' +
          esc(tr('Setelah bayar, kamu boleh mengambil alih kota ini seharga {a}.', { a: E.takeoverPrice(S, it.tile) })) +
          '</div>';
      return {
        tone: 'warn',
        kicker: ic('coins') + esc(tr('Kota lawan')),
        title: 'Bayar Tol',
        who: whoLine(it.p, esc(tr('ke {n}', { n: o.name }))),
        body,
        foot:
          (nAngel ? btn('id="bAngel"', 'lilac', 'angel', tr('Malaikat ({n})', { n: nAngel })) : '') +
          (nDisc && !it.discountUsed ? btn('id="bDisc"', 'soft', 'ticket', 'Kupon 50%') : '') +
          '<span class="grow"></span>' +
          btn('id="bPay"', 'primary big', 'coins', can ? tr('Bayar {a}', { a: it.amount }) : 'Bayar · jual aset'),
      };
    },
    mount: m => {
      const it = head();
      on(m, '#bPay', () => act({ type: 'PAY_RENT', p: it.p }));
      on(m, '#bAngel', () => act({ type: 'USE_ANGEL', p: it.p }));
      on(m, '#bDisc', () => act({ type: 'USE_DISCOUNT', p: it.p }));
    },
  });
}

function dTakeover(key) {
  showModal({
    key,
    decision: true,
    size: 'mid',
    build: () => {
      const S = App.S,
        it = head();
      if (!it || it.type !== 'TAKEOVER') return null;
      const p = S.players[it.p],
        o = S.players[it.owner],
        t = TILES[it.tile];
      const c = E.canTakeover(S, it.p, it.tile);
      const after = Object.assign({}, S, { tiles: S.tiles.map((x, k) => (k === it.tile ? Object.assign({}, x, { owner: it.p }) : x)) });
      const notes = [];
      const w = E.winCheck(after, it.p);
      if (w && S.settings.instantWin)
        notes.push(
          '<div class="note good">' +
            ic('trophy') +
            ' ' +
            esc(tr('Ambil alih ini dan kamu langsung menang ({w})!', { w: UI.winLabel(w) })) +
            '</div>'
        );
      if (t.type === 'city' && !E.ownsGroup(S, it.p, t.group) && E.ownsGroup(after, it.p, t.group))
        notes.push(
          '<div class="note good">' +
            ic('check') +
            ' ' +
            esc(tr('Melengkapi grup {g}: tol semua kotanya ×2.', { g: { t: GROUPS[t.group].name } })) +
            '</div>'
        );
      if (t.type === 'city' && E.ownsGroup(S, it.owner, t.group))
        notes.push('<div class="note">' + ic('swap') + ' ' + esc(tr('Memecah grup penuh milik {n}.', { n: o.name })) + '</div>');
      E.winThreats(S)
        .filter(x => x.p === it.owner)
        .forEach(x => {
          if (E.winThreats(after).every(y => !(y.p === x.p && y.tile === x.tile)))
            notes.push(
              '<div class="note">' +
                ic('shield') +
                ' ' +
                esc(tr('Menghalangi {n} menuju {w}.', { n: o.name, w: UI.winLabel(x) })) +
                '</div>'
            );
        });
      return {
        tone: 'take',
        kicker: ic('swap') + esc(tr('Ambil alih')),
        title: tr('Rebut {k}?', { k: { tile: it.tile } }),
        who: whoLine(it.p, esc(tr('dari {n}', { n: o.name }))),
        body:
          cityHero(S, it.tile) +
          '<div class="kv-list"><div class="kv"><span>' +
          esc(tr('Nilai kota (tanah + bangunan)')) +
          '</span><b>' +
          fmt(E.tileValue(S, it.tile)) +
          '</b></div><div class="kv"><span>' +
          esc(tr('Harga ambil alih (×{m})', { m: RULES.takeoverMult })) +
          '</span><b>' +
          fmt(it.price) +
          '</b></div><div class="kv"><span>' +
          esc(tr('Uangmu setelahnya')) +
          '</span><b>' +
          fmt(p.cash - it.price) +
          '</b></div></div>' +
          notes.join('') +
          '<div class="tiny muted">' +
          esc(tr('Uangnya dibayar ke {n}. Bangunan ikut pindah, dan kamu bisa langsung membangun lagi.', { n: o.name })) +
          '</div>' +
          (c.ok ? '' : '<div class="note warn">' + esc(tLog(c.reason)) + '</div>'),
        foot:
          btn('id="bTkSkip"', 'ghost', '', 'Tidak') +
          '<span class="grow"></span>' +
          btn('id="bTkBuy"', 'primary big', 'swap', tr('Ambil Alih · {a}', { a: it.price }), !c.ok),
      };
    },
    mount: m => {
      const it = head();
      on(m, '#bTkBuy', () => act({ type: 'TAKEOVER_BUY', p: it.p }));
      on(m, '#bTkSkip', () => act({ type: 'TAKEOVER_SKIP', p: it.p }));
    },
  });
}

function dTax(key) {
  showModal({
    key,
    decision: true,
    size: 'mid',
    build: () => {
      const S = App.S,
        it = head();
      if (!it || it.type !== 'TAX') return null;
      const p = S.players[it.p];
      return {
        kicker: ic('tax') + esc(tr('Pajak Rindu')),
        title: tr('Bayar Pajak {a}', { a: it.amount }),
        who: whoLine(it.p),
        hero: '<span class="hero-art">' + ART.art('tax') + '</span>',
        body:
          '<p class="lead">' +
          esc(
            tr('Ongkir kado, pulsa, dan tiket pulang-pergi itu nyata. Pajak = {p}% dari total asetmu.', {
              p: Math.round(RULES.taxRate * 100),
            })
          ) +
          '</p><div class="kv-list"><div class="kv"><span>' +
          esc(tr('Total aset')) +
          '</span><b>' +
          fmt(E.netWorth(S, it.p)) +
          '</b></div><div class="kv"><span>' +
          esc(tr('Pajak')) +
          '</span><b>' +
          fmt(it.amount) +
          '</b></div></div>' +
          (p.cash < it.amount
            ? '<div class="note warn">' + ic('alert') + ' ' + esc(tr('Uangmu kurang. Kamu perlu menjual kota.')) + '</div>'
            : ''),
        foot: '<span class="grow"></span>' + btn('id="bTax"', 'primary big', 'coins', tr('Bayar {a}', { a: it.amount })),
      };
    },
    mount: m => {
      const it = head();
      on(m, '#bTax', () => act({ type: 'PAY_TAX', p: it.p }));
    },
  });
}

// ilustrasi & warna tiap Kartu Cinta (ikon khusus per kartu, cadangan dari efeknya)
const CARD_TONE = {
  'Kartu Simpan': 'gold',
  Perjalanan: 'sky',
  'Masalah LDR': 'lilac',
  'Surat Cinta': 'rose',
  'Kejutan Manis': 'mint',
  'Kartu Aksi': 'violet',
  Tantangan: 'peach',
};
const CARD_ICON = {
  K16: 'busstop',
  K17: 'coins',
  K18: 'headphones',
  K19: 'gift',
  K20: 'mic',
  K21: 'party',
  K22: 'wifi',
  K23: 'receipt',
  K24: 'chat',
  K25: 'build',
  K26: 'bowl',
  K27: 'ring',
  K28: 'cup',
  K34: 'ticket',
  K35: 'bolt',
  K36: 'question',
  K37: 'sparkle',
  K38: 'letter',
  K39: 'target',
  K40: 'scale',
  K41: 'dice',
  K42: 'moon',
  K43: 'clock',
  K44: 'wifi',
  K45: 'ticket',
  K46: 'umbrella',
  K47: 'gift',
};
function cardVisual(c) {
  const fx = c.fx || [];
  const has = k => fx.find(e => e[k] != null && e[k] !== false);
  let art = null,
    icon = CARD_ICON[c.id] || null;
  if (c.power) icon = D.POWER[c.power].icon;
  else if (has('moveTo')) art = TILES[has('moveTo').moveTo].art;
  else if (has('goIsland')) art = 'island';
  else if (has('nearest')) art = 'ferris';
  else if (has('target')) {
    const k = has('target').target;
    if (k === 'festival') art = 'festival';
    else if (k === 'renov' || k === 'build') art = 'b3';
    else icon = k === 'storm' ? 'storm' : 'swap';
  }
  if (!art && !icon) icon = 'letter';
  return { tone: CARD_TONE[c.cat] || 'rose', html: art ? ART.art(art) : ic(icon) };
}
function dCard(key) {
  showModal({
    key,
    decision: true,
    size: 'mid',
    build: () => {
      const it = head();
      if (!it || it.type !== 'CARD') return null;
      const c = E.CARD[it.card];
      const vis = cardVisual(c);
      let extra = '';
      if (c.power)
        extra =
          '<div class="note good">' +
          ic(D.POWER[c.power].icon) +
          ' ' +
          esc(tr('Kartu disimpan.')) +
          ' ' +
          esc(tr(D.POWER[c.power].desc)) +
          '</div>';
      if (c.choice)
        extra =
          '<div class="choice-list">' +
          c.choice.map((o, i) => btn('data-ch="' + i + '"', 'choice', 'chevron', o.label)).join('') +
          '</div>';
      return {
        kicker: ic('letter') + esc(tr('Kartu Cinta')),
        title: c.title,
        who: whoLine(it.p),
        body:
          '<div class="love-card flip lc-' +
          vis.tone +
          '"><div class="lc-inner tilt3d"><div class="lc-front"><span class="lc-cat">' +
          esc(tr(c.cat)) +
          '</span><span class="lc-med">' +
          vis.html +
          '</span><b>' +
          esc(tr(c.title)) +
          '</b><p>' +
          esc(tr(c.text)) +
          '</p></div><div class="lc-back" aria-hidden="true">' +
          ART.art('card') +
          '</div></div></div>' +
          extra,
        foot: c.choice
          ? ''
          : '<span class="grow"></span>' + btn('id="bCard"', 'primary big', c.power ? 'bolt' : 'check', c.power ? 'Simpan Kartu' : 'Oke!'),
      };
    },
    mount: m => {
      const it = head();
      if (!m.classList.contains('still')) UI.flyCard(it.p, m.querySelector('.love-card'));
      on(m, '#bCard', () => act({ type: 'CARD_OK', p: it.p }));
      $$('[data-ch]', m).forEach(b =>
        b.addEventListener('click', () => act({ type: 'CARD_CHOOSE', p: it.p, choice: Number(b.dataset.ch) }))
      );
    },
  });
}

function dDebt(key) {
  let confirmBk = false;
  showModal({
    key,
    decision: true,
    size: 'mid',
    build: () => {
      const S = App.S,
        it = head();
      if (!it || it.type !== 'DEBT') return null;
      const p = S.players[it.p];
      const liq = E.liquidation(S, it.p);
      const enough = liq >= it.amount;
      const can = p.cash >= it.amount;
      const own = E.ownedBy(S, it.p);
      const list = own.length
        ? '<div class="sell-list">' +
          own
            .map(t => {
              const st = S.tiles[t],
                tl = TILES[t];
              return (
                '<div class="sell-row" style="--g:' +
                (tl.group ? GROUPS[tl.group].color : '#B79CFF') +
                '"><span class="sr-art">' +
                ART.art(tl.art) +
                '</span><span class="sr-txt"><b>' +
                esc(tr(tl.name)) +
                '</b><span>' +
                esc(tr(tl.type === 'city' ? E.LEVEL_NAME[st.level] : 'Wisata')) +
                ' · ' +
                esc(tr('nilai {a}', { a: E.tileValue(S, t) })) +
                '</span></span>' +
                btn('data-sell="' + t + '"', 'soft sm', 'coins', '+' + fmt(E.sellValue(S, t)), can) +
                '</div>'
              );
            })
            .join('') +
          '</div>'
        : '<div class="empty">' + ic('house') + esc(tr('Tidak ada kota yang bisa dijual.')) + '</div>';
      return {
        tone: 'warn',
        kicker: ic('alert') + esc(tr('Uang kurang')),
        title: tr('Cari Dana {a}', { a: it.amount }),
        who: whoLine(it.p, esc(tr('untuk {r}', { r: tLog(it.reason) }))),
        body:
          '<div class="kv-list"><div class="kv"><span>' +
          esc(tr('Harus dibayar ke {n}', { n: it.to >= 0 ? pname(it.to) : tr('Bank') })) +
          '</span><b>' +
          fmt(it.amount) +
          '</b></div><div class="kv"><span>' +
          esc(tr('Uangmu')) +
          '</span><b>' +
          fmt(p.cash) +
          '</b></div><div class="kv"><span>' +
          esc(tr('Kurang')) +
          '</span><b>' +
          fmt(Math.max(0, it.amount - p.cash)) +
          '</b></div></div>' +
          (can
            ? '<div class="note good">' + ic('check') + ' ' + esc(tr('Uangmu sudah cukup. Tekan Bayar.')) + '</div>'
            : enough
              ? '<div class="note">' +
                ic('info') +
                ' ' +
                esc(tr('Jual kota ke bank ({p}% nilainya) sampai uangmu cukup.', { p: Math.round(RULES.sellRate * 100) })) +
                '</div>'
              : '<div class="note warn">' +
                ic('alert') +
                ' ' +
                esc(tr('Semua asetmu tetap tidak cukup. Kamu harus menyatakan bangkrut.')) +
                '</div>') +
          list +
          (confirmBk ? '<div class="note warn">' + ic('alert') + ' ' + esc(tr('Yakin? Kamu keluar dari permainan.')) + '</div>' : ''),
        foot:
          (!enough ? btn('id="bBk"', 'danger', 'flag', confirmBk ? 'Ya, Bangkrut' : 'Nyatakan Bangkrut') : '') +
          '<span class="grow"></span>' +
          btn('id="bPayDebt"', 'primary big', 'check', tr('Bayar {a}', { a: it.amount }), !can),
      };
    },
    mount: m => {
      const it = head();
      on(m, '#bPayDebt', () => act({ type: 'PAY_DEBT', p: it.p }));
      $$('[data-sell]', m).forEach(b => b.addEventListener('click', () => act({ type: 'SELL', p: it.p, tile: Number(b.dataset.sell) })));
      on(m, '#bBk', () => {
        if (!confirmBk) {
          confirmBk = true;
          refreshModal();
          return;
        }
        act({ type: 'BANKRUPT', p: it.p });
      });
    },
  });
}

// ---------- sinkronisasi keputusan dengan state ----------
function syncModal(force) {
  const S = App.S;
  if (!S || S.over) return;
  const it = S.queue[0];
  let a = E.actor(S);
  if (it && it.type === 'CHALLENGE' && !controls(a)) {
    const alt = E.chActors(S).find(j => controls(j));
    if (alt != null) a = alt;
  }
  if (it && controls(a)) {
    const key = 'd' + S.seq;
    if (
      !force &&
      it.type === 'CHALLENGE' &&
      multiGuess(it) &&
      App.modal &&
      App.modal.decision &&
      App.modal.itype === 'CHALLENGE' &&
      App.modal.chk === chKey(it)
    ) {
      App.modal.key = key;
      refreshModal();
      return;
    }
    if (it.type === 'TARGET' || it.type === 'TOUR') {
      if (App.modal && App.modal.decision) closeModal(true);
      if (!force && App.pick && App.pick.key === key) return;
      if (App.tour) return;
      openDecision(it, key);
      return;
    }
    if (!force && App.modal && App.modal.key === key) return;
    if (!force && App.modal && App.modal.decision && App.modal.itype === it.type && it.type === 'DEBT') {
      App.modal.key = key;
      refreshModal();
      return;
    }
    openDecision(it, key);
    return;
  }
  if (App.pick) UI.endPick();
  if (App.modal && App.modal.decision) closeModal();
  else if (App.modal) refreshModal();
}

export { openDecision, syncModal };
