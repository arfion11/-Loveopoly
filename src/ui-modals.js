/* LOVEOPOLY 2.0 — dialog keputusan, pilih petak, info petak, aset, menu, pengaturan */
(function (G) {
  'use strict';
  const UI = G.LoveUI;
  const { App, D, E, SND, ART, TILES, GROUPS, RULES, fmt, esc, ic, $, $$, toast, controls, viewer, pname, act, coin, avatarHTML } = UI;

  // ---------- infrastruktur modal ----------
  let escHandler = null;
  function showModal(def) {
    const root = $('#modalRoot');
    UI.cancelAutoEnd();
    if (App.modal && App.modal.cleanup) { try { App.modal.cleanup(); } catch (e) { /* abaikan */ } }
    App.modal = def;
    root.hidden = false;
    paint(def, true);
    if (escHandler) document.removeEventListener('keydown', escHandler);
    escHandler = e => { if (e.key === 'Escape' && App.modal && App.modal.closable !== false) closeModal(); };
    document.addEventListener('keydown', escHandler);
  }
  function paint(def, first) {
    const root = $('#modalRoot');
    const prevBody = root.querySelector('.modal-body');
    const scroll = prevBody ? prevBody.scrollTop : 0;
    const v = def.build();
    if (!v) { closeModal(); return; }
    root.innerHTML = '<div class="scrim"></div><div class="modal ' + (def.size || '') + (v.tone ? ' tone-' + v.tone : '') + '" role="dialog" aria-modal="true" aria-labelledby="mTitle">' +
      (v.hero ? '<div class="modal-hero">' + v.hero + '</div>' : '') +
      '<div class="modal-head"><div class="mh-txt">' + (v.kicker ? '<div class="kicker">' + v.kicker + '</div>' : '') + '<h2 id="mTitle">' + esc(v.title) + '</h2>' + (v.who ? '<div class="who">' + v.who + '</div>' : '') + '</div>' +
      (def.closable !== false ? '<button type="button" class="icon-btn" data-x aria-label="Tutup">' + ic('x') + '</button>' : '') + '</div>' +
      '<div class="modal-body">' + v.body + '</div>' + (v.foot ? '<div class="modal-foot">' + v.foot + '</div>' : '') + '</div>';
    if (!first) root.querySelector('.modal').classList.add('still');
    const body = root.querySelector('.modal-body');
    if (body && !first) body.scrollTop = scroll;
    const x = root.querySelector('[data-x]');
    if (x) x.onclick = () => closeModal();
    const scrim = root.querySelector('.scrim');
    if (scrim && def.closable !== false) scrim.onclick = () => closeModal();
    if (def.mount) def.mount(root.querySelector('.modal'));
    tilt3d(root);
    if (first) {
      const f = root.querySelector('[data-focus]') || root.querySelector('.modal-foot .btn.primary:not(:disabled)') || root.querySelector('.modal-foot .btn:not(:disabled)') || root.querySelector('.modal-head .icon-btn');
      if (f) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }, 40);
    }
  }
  // kartu 3D miring mengikuti pointer (hanya mouse/pena; layar sentuh & gerak dikurangi tetap diam)
  const fineHover = () => { try { return G.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return false; } };
  function tilt3d(root) {
    if (UI.reduceMotion() || !fineHover()) return;
    $$('.tilt3d', root).forEach(el => {
      const max = Number(el.dataset.tilt) || 8;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', (x * 2 * max).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (y * -2 * max).toFixed(2) + 'deg');
        el.classList.add('tilting');
      });
      el.addEventListener('pointerleave', () => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); el.classList.remove('tilting'); });
    });
  }
  function refreshModal() { if (App.modal && App.modal.refreshable !== false) paint(App.modal, false); }
  function closeModal(quiet) {
    const root = $('#modalRoot');
    if (App.modal && App.modal.cleanup) { try { App.modal.cleanup(); } catch (e) { /* abaikan */ } }
    App.modal = null;
    root.hidden = true;
    root.innerHTML = '';
    if (quiet === true) return;
    UI.renderStage();
    UI.scheduleAI();
    UI.scheduleAutoEnd();
  }
  const on = (root, sel, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener('click', fn); };
  const btn = (attrs, cls, icon, label, disabled) => '<button type="button" class="btn ' + (cls || '') + '" ' + attrs + (disabled ? ' disabled' : '') + '>' + (icon ? ic(icon) : '') + '<span>' + esc(label) + '</span></button>';
  const whoLine = (i, extra) => { const p = App.S.players[i]; return avatarHTML(p, 'xs') + '<span>' + esc(p.name) + (extra ? ' · ' + extra : '') + '</span>'; };
  // koin + angka satu unit (tidak menempel, tidak terpisah baris)
  const money = n => '<span class="amt">' + coin + '<b>' + fmt(n) + '</b></span>';
  // ringkasan "Uangmu [koin 2.500] → sisa [koin 2.340]"
  const sumRow = (cash, cost, can) => '<div class="sum-row"><span class="sr-side"><span class="sr-label">Uangmu</span>' + money(cash) + '</span>' +
    '<span class="arrow" aria-hidden="true">→</span>' +
    '<span class="sr-side">' + (can ? '<span class="sr-label sub">sisa</span>' + money(cash - cost) : '<em>kurang ' + fmt(cost - cash) + '</em>') + '</span></div>';
  const head = () => App.S.queue[0];

  // ---------- kepala kartu kota ----------
  function cityHero(S, ti, opts) {
    opts = opts || {};
    const t = TILES[ti], st = S.tiles[ti];
    const g = t.group ? GROUPS[t.group] : null;
    const kind = t.type === 'spot' ? 'Tempat Wisata' : g ? g.name : '';
    const owner = st.owner >= 0 ? S.players[st.owner] : null;
    return '<div class="city-hero" style="--g:' + (g ? g.color : '#B79CFF') + ';--gi:' + (g ? g.ink : '#6B3FC4') + (owner ? ';--oc:' + owner.color : '') + '">' +
      '<span class="ch-art">' + ART.art(t.art) + (st.owner >= 0 && t.type === 'city' && st.level ? '<span class="ch-bld">' + ART.art(['', 'b1', 'b2', 'b3', 'b4'][st.level]) + '</span>' : '') + '</span>' +
      '<span class="ch-txt"><span class="ch-kind">' + esc(kind) + (t.type === 'city' ? ' · ' + E.GROUP_TILES[t.group].length + ' kota' : '') + '</span><b class="ch-name">' + esc(t.name) + '</b>' +
      (t.blurb ? '<span class="ch-blurb">' + esc(t.blurb) + '</span>' : '') +
      (opts.owner !== false && owner ? '<span class="ch-owner">' + avatarHTML(owner, 'xs') + 'Milik ' + esc(owner.name) + (t.type === 'city' ? ' · ' + E.LEVEL_NAME[st.level] : '') + '</span>' : '') +
      '</span></div>';
  }
  // deret petak satu grup / semua wisata: bingkai warna pemilik, label hitungan milik pemain p
  function groupProgress(S, p, ti) {
    const t = TILES[ti];
    const spots = t.type === 'spot';
    const tiles = spots ? E.SPOTS : E.GROUP_TILES[t.group];
    const mine = tiles.filter(x => S.tiles[x].owner === p).length;
    const who = p >= 0 && p !== viewer() ? S.players[p].name + ': ' : '';
    const dots = tiles.map(x => {
      const o = S.tiles[x].owner, op = o >= 0 ? S.players[o] : null;
      return '<span class="pg-dot' + (op ? ' own' : '') + (o === p ? ' mine' : '') + (x === ti && !op ? ' this' : '') + '"' + (op ? ' style="--c:' + op.color + '"' : '') + ' title="' + esc(TILES[x].name + (op ? ' · ' + op.name : '')) + '">' + ART.art(TILES[x].art) + '</span>';
    }).join('');
    const txt = spots ? mine + '/' + tiles.length + ' wisata' + (S.settings.instantWin ? ' · 5 = menang!' : '') : mine + '/' + tiles.length + ' ' + GROUPS[t.group].name + ' · grup penuh = tol ×2';
    return '<div class="progress-row">' + dots + '<span class="pg-txt">' + esc(who + txt) + '</span></div>';
  }
  // tol bila kota ti dimiliki p pada tingkat k
  function tollIf(S, p, ti, k) {
    const t = TILES[ti];
    let r = t.price * RULES.rentMult[k];
    if (E.GROUP_TILES[t.group].every(x => x === ti || S.tiles[x].owner === p)) r *= RULES.groupMult;
    if (S.festival.tile === ti) r *= S.festival.mult;
    r *= 1 + E.tierInfo(S.players[p].love).rentPct / 100;
    return Math.round(r / 5) * 5;
  }
  const LV_ART = ['flag', 'b1', 'b2', 'b3', 'b4'];
  // kartu pilihan tingkat (beli / bangun)
  function levelCards(S, p, ti, from, sel, allowed, costFn) {
    const P = S.players[p];
    const cap = E.capLevel(S, p);
    const maxShow = from === 3 || from === 4 ? 4 : 3;
    let h = '<div class="lv-cards" role="radiogroup" aria-label="Pilih tingkat bangunan">';
    for (let k = 0; k <= maxShow; k++) {
      const done = k <= from;
      const ok = allowed.includes(k);
      const cost = ok ? costFn(k) : 0;
      const afford = ok && cost <= P.cash;
      const locked = !done && !ok;
      let note = '';
      if (done) note = 'Sudah ada';
      else if (locked) note = k === 3 && cap < 3 ? 'Setelah 1 putaran' : k === 4 ? 'Butuh Hotel' : '—';
      else note = fmt(E.levelCost(ti, k) * (1 - (P.discount || 0)));
      const isSel = !done && ok && k <= sel;
      h += '<button type="button" class="lv-card tilt3d' + (done ? ' done' : '') + (isSel ? ' sel' : '') + (locked ? ' locked' : '') + (ok && !afford ? ' poor' : '') + (k === 4 ? ' lm' : '') + '" data-lv="' + k + '" role="radio" aria-checked="' + (k === sel) + '"' + (done || locked || !afford ? ' disabled' : '') + '>' +
        '<span class="lv-art">' + ART.art(LV_ART[k]) + '</span><b>' + E.LEVEL_NAME[k] + '</b><span class="lv-cost">' + (done ? ic('check') : locked ? ic('lock') : coin) + esc(note) + '</span>' +
        '<span class="lv-toll">Tol ' + fmt(tollIf(S, p, ti, k)) + '</span>' + (isSel ? '<span class="lv-check">' + ic('check') + '</span>' : '') + '</button>';
    }
    return h + '</div>';
  }
  function defaultLevel(S, p, ti, allowed, costFn) {
    const P = S.players[p];
    let best = allowed[0];
    allowed.forEach(k => { if (costFn(k) <= Math.max(P.cash - 400, costFn(allowed[0]))) best = k; });
    return best;
  }

  // ---------- keputusan ----------
  function openDecision(it, key) {
    const map = { BUY: dBuy, UPGRADE: dUpgrade, RENT: dRent, TAKEOVER: dTakeover, TAX: dTax, CARD: dCard, CHALLENGE: dChallenge, DEBT: dDebt, TARGET: pTarget, TOUR: pTour };
    const f = map[it.type];
    if (f) { f(key); if (App.modal) App.modal.itype = it.type; }
  }

  function dBuy(key) {
    let sel = null;
    showModal({
      key, decision: true, size: 'mid',
      build: () => {
        const S = App.S, it = head();
        if (!it || it.type !== 'BUY') return null;
        const p = S.players[it.p], t = TILES[it.tile];
        const allowed = E.buyLevels(S, it.p, it.tile);
        const costFn = k => E.buyCost(S, it.p, it.tile, k);
        if (sel == null) sel = defaultLevel(S, it.p, it.tile, allowed, costFn);
        const cost = costFn(sel);
        const can = p.cash >= cost;
        let body = cityHero(S, it.tile) + groupProgress(S, it.p, it.tile);
        if (t.type === 'city') {
          body += '<div class="sec-title">Bangun sekaligus</div>' + levelCards(S, it.p, it.tile, -1, sel, allowed, costFn);
          if (E.capLevel(S, it.p) < 3) body += '<div class="note">' + ic('info') + ' Hotel terbuka setelah kamu melewati START sekali.</div>';
        } else {
          body += '<div class="spot-table">' + RULES.spotRent.map((r, k) => '<span class="' + (k === E.spotsOf(S, it.p).length ? 'cur' : '') + '"><b>' + (k + 1) + ' wisata</b>Tol ' + fmt(r) + '</span>').join('') + '</div><div class="note">' + ic('shield') + ' Tempat wisata tidak bisa diambil alih lawan.</div>';
        }
        if (p.discount) body += '<div class="note good">' + ic('ticket') + ' Voucher diskon ' + Math.round(p.discount * 100) + '% dipakai.</div>';
        E.winThreats(S).filter(x => x.tile === it.tile).forEach(x => { body += '<div class="note ' + (x.p === it.p ? 'good' : 'warn') + '">' + ic(x.p === it.p ? 'trophy' : 'alert') + ' ' + (x.p === it.p ? 'Beli ini dan kamu menang ' + esc(UI.winLabel(x)) + '!' : esc(S.players[x.p].name) + ' butuh petak ini untuk ' + esc(UI.winLabel(x)) + '. Beli untuk menghalangi!') + '</div>'; });
        body += sumRow(p.cash, cost, can);
        return {
          kicker: ic('flag') + 'Petak kosong', title: 'Beli ' + t.name + '?', who: whoLine(it.p),
          body,
          foot: btn('id="bSkip"', 'ghost', '', 'Lewati') + '<span class="grow"></span>' + btn('id="bBuy"', 'primary big', 'flag', 'Beli · ' + fmt(cost), !can)
        };
      },
      mount: m => {
        const it = head();
        $$('[data-lv]', m).forEach(b => b.addEventListener('click', () => { sel = Number(b.dataset.lv); SND.play('click'); refreshModal(); }));
        on(m, '#bBuy', () => act({ type: 'BUY', p: it.p, level: sel || 0 }));
        on(m, '#bSkip', () => act({ type: 'BUY_SKIP', p: it.p }));
      }
    });
  }

  function dUpgrade(key) {
    let sel = null;
    showModal({
      key, decision: true, size: 'mid',
      build: () => {
        const S = App.S, it = head();
        if (!it || it.type !== 'UPGRADE') return null;
        const p = S.players[it.p], t = TILES[it.tile], st = S.tiles[it.tile];
        const allowed = E.upgradeLevels(S, it.p, it.tile);
        const costFn = k => E.upgradeCost(S, it.p, it.tile, k);
        if (sel == null || !allowed.includes(sel)) sel = defaultLevel(S, it.p, it.tile, allowed, costFn);
        const cost = costFn(sel);
        const can = p.cash >= cost;
        const src = { visit: 'Mampir ke kotamu', start: 'Bonus berhenti di START', takeover: 'Kota baru hasil ambil alih' }[it.src] || '';
        let body = cityHero(S, it.tile, { owner: false }) + levelCards(S, it.p, it.tile, st.level, sel, allowed, costFn);
        if (st.level === 3) body += '<div class="note gold">' + ic('crown') + '<span>Landmark: tol tertinggi dan <b>kebal diambil alih</b>.</span></div>';
        else if (E.capLevel(S, it.p) < 3) body += '<div class="note">' + ic('info') + ' Hotel terbuka setelah kamu melewati START sekali.</div>';
        if (p.discount) body += '<div class="note good">' + ic('ticket') + ' Voucher diskon ' + Math.round(p.discount * 100) + '% dipakai.</div>';
        body += sumRow(p.cash, cost, can);
        return {
          kicker: ic('build') + esc(src), title: (st.level === 3 ? 'Bangun Landmark di ' : 'Bangun di ') + t.name + '?', who: whoLine(it.p),
          body,
          foot: btn('id="bSkip"', 'ghost', '', 'Nanti saja') + '<span class="grow"></span>' + btn('id="bUp"', 'primary big', sel === 4 ? 'crown' : 'build', 'Bangun · ' + fmt(cost), !can)
        };
      },
      mount: m => {
        const it = head();
        $$('[data-lv]', m).forEach(b => b.addEventListener('click', () => { sel = Number(b.dataset.lv); SND.play('click'); refreshModal(); }));
        on(m, '#bUp', () => act({ type: 'UPGRADE', p: it.p, level: sel }));
        on(m, '#bSkip', () => act({ type: 'UPGRADE_SKIP', p: it.p }));
      }
    });
  }

  function dRent(key) {
    showModal({
      key, decision: true, size: 'mid',
      build: () => {
        const S = App.S, it = head();
        if (!it || it.type !== 'RENT') return null;
        const p = S.players[it.p], o = S.players[it.to];
        const ri = E.rentInfo(S, it.tile);
        const nAngel = p.cards.filter(c => E.CARD[c].power === 'angel').length;
        const nDisc = p.cards.filter(c => E.CARD[c].power === 'discount').length;
        const can = p.cash >= it.amount;
        let rows = '';
        if (ri) ri.parts.forEach(x => { rows += '<div class="kv"><span>' + esc(x.label) + '</span><b>' + (x.v != null ? fmt(x.v) : x.m ? '×' + x.m : '+' + x.pct + '%') + '</b></div>'; });
        if (it.discountUsed) rows += '<div class="kv good"><span>Kupon Tol 50%</span><b>÷2</b></div>';
        let body = cityHero(S, it.tile) +
          '<div class="toll-big" style="--oc:' + o.color + '"><span>Tol untuk ' + esc(o.name) + '</span><b>' + coin + fmt(it.amount) + '</b></div>' +
          '<div class="kv-list">' + rows + '</div>';
        if (!can) body += '<div class="note warn">' + ic('alert') + ' Uangmu kurang ' + fmt(it.amount - p.cash) + '. Setelah menekan Bayar, kamu bisa menjual kota.</div>';
        if (S.settings.takeover && TILES[it.tile].type === 'city' && S.tiles[it.tile].level < 4) body += '<div class="tiny muted">' + ic('swap') + ' Setelah bayar, kamu boleh mengambil alih kota ini seharga ' + fmt(E.takeoverPrice(S, it.tile)) + '.</div>';
        return {
          tone: 'warn', kicker: ic('coins') + 'Kota lawan', title: 'Bayar Tol', who: whoLine(it.p, 'ke ' + esc(o.name)),
          body,
          foot: (nAngel ? btn('id="bAngel"', 'lilac', 'angel', 'Malaikat (' + nAngel + ')') : '') + (nDisc && !it.discountUsed ? btn('id="bDisc"', 'soft', 'ticket', 'Kupon 50%') : '') +
            '<span class="grow"></span>' + btn('id="bPay"', 'primary big', 'coins', can ? 'Bayar ' + fmt(it.amount) : 'Bayar · jual aset')
        };
      },
      mount: m => {
        const it = head();
        on(m, '#bPay', () => act({ type: 'PAY_RENT', p: it.p }));
        on(m, '#bAngel', () => act({ type: 'USE_ANGEL', p: it.p }));
        on(m, '#bDisc', () => act({ type: 'USE_DISCOUNT', p: it.p }));
      }
    });
  }

  function dTakeover(key) {
    showModal({
      key, decision: true, size: 'mid',
      build: () => {
        const S = App.S, it = head();
        if (!it || it.type !== 'TAKEOVER') return null;
        const p = S.players[it.p], o = S.players[it.owner], t = TILES[it.tile];
        const c = E.canTakeover(S, it.p, it.tile);
        const after = Object.assign({}, S, { tiles: S.tiles.map((x, k) => (k === it.tile ? Object.assign({}, x, { owner: it.p }) : x)) });
        const notes = [];
        const w = E.winCheck(after, it.p);
        if (w && S.settings.instantWin) notes.push('<div class="note good">' + ic('trophy') + ' Ambil alih ini dan kamu langsung menang (' + esc(UI.winLabel(w)) + ')!</div>');
        if (t.type === 'city' && !E.ownsGroup(S, it.p, t.group) && E.ownsGroup(after, it.p, t.group)) notes.push('<div class="note good">' + ic('check') + ' Melengkapi grup ' + esc(GROUPS[t.group].name) + ': tol semua kotanya ×2.</div>');
        if (t.type === 'city' && E.ownsGroup(S, it.owner, t.group)) notes.push('<div class="note">' + ic('swap') + ' Memecah grup penuh milik ' + esc(o.name) + '.</div>');
        E.winThreats(S).filter(x => x.p === it.owner).forEach(x => { if (E.winThreats(after).every(y => !(y.p === x.p && y.tile === x.tile))) notes.push('<div class="note">' + ic('shield') + ' Menghalangi ' + esc(o.name) + ' menuju ' + esc(UI.winLabel(x)) + '.</div>'); });
        return {
          tone: 'take', kicker: ic('swap') + 'Ambil alih', title: 'Rebut ' + t.name + '?', who: whoLine(it.p, 'dari ' + esc(o.name)),
          body: cityHero(S, it.tile) +
            '<div class="kv-list"><div class="kv"><span>Nilai kota (tanah + bangunan)</span><b>' + fmt(E.tileValue(S, it.tile)) + '</b></div><div class="kv"><span>Harga ambil alih (×' + RULES.takeoverMult + ')</span><b>' + fmt(it.price) + '</b></div><div class="kv"><span>Uangmu setelahnya</span><b>' + fmt(p.cash - it.price) + '</b></div></div>' +
            notes.join('') + '<div class="tiny muted">Uangnya dibayar ke ' + esc(o.name) + '. Bangunan ikut pindah, dan kamu bisa langsung membangun lagi.</div>' + (c.ok ? '' : '<div class="note warn">' + esc(c.reason) + '</div>'),
          foot: btn('id="bTkSkip"', 'ghost', '', 'Tidak') + '<span class="grow"></span>' + btn('id="bTkBuy"', 'primary big', 'swap', 'Ambil Alih · ' + fmt(it.price), !c.ok)
        };
      },
      mount: m => { const it = head(); on(m, '#bTkBuy', () => act({ type: 'TAKEOVER_BUY', p: it.p })); on(m, '#bTkSkip', () => act({ type: 'TAKEOVER_SKIP', p: it.p })); }
    });
  }

  function dTax(key) {
    showModal({
      key, decision: true, size: 'mid',
      build: () => {
        const S = App.S, it = head();
        if (!it || it.type !== 'TAX') return null;
        const p = S.players[it.p];
        return {
          kicker: ic('tax') + 'Pajak Rindu', title: 'Bayar Pajak ' + fmt(it.amount), who: whoLine(it.p),
          hero: '<span class="hero-art">' + ART.art('tax') + '</span>',
          body: '<p class="lead">Ongkir kado, pulsa, dan tiket pulang-pergi itu nyata. Pajak = ' + Math.round(RULES.taxRate * 100) + '% dari total asetmu.</p><div class="kv-list"><div class="kv"><span>Total aset</span><b>' + fmt(E.netWorth(S, it.p)) + '</b></div><div class="kv"><span>Pajak</span><b>' + fmt(it.amount) + '</b></div></div>' +
            (p.cash < it.amount ? '<div class="note warn">' + ic('alert') + ' Uangmu kurang. Kamu perlu menjual kota.</div>' : ''),
          foot: '<span class="grow"></span>' + btn('id="bTax"', 'primary big', 'coins', 'Bayar ' + fmt(it.amount))
        };
      },
      mount: m => { const it = head(); on(m, '#bTax', () => act({ type: 'PAY_TAX', p: it.p })); }
    });
  }

  // ilustrasi & warna tiap Kartu Cinta (ikon khusus per kartu, cadangan dari efeknya)
  const CARD_TONE = { 'Kartu Simpan': 'gold', 'Perjalanan': 'sky', 'Masalah LDR': 'lilac', 'Surat Cinta': 'rose', 'Kejutan Manis': 'mint', 'Kartu Aksi': 'violet', 'Tantangan': 'peach' };
  const CARD_ICON = { K16: 'busstop', K17: 'coins', K18: 'headphones', K19: 'gift', K20: 'mic', K21: 'party', K22: 'wifi', K23: 'receipt', K24: 'chat', K25: 'build', K26: 'bowl', K27: 'ring', K28: 'cup', K34: 'ticket',
    K35: 'bolt', K36: 'question', K37: 'sparkle', K38: 'letter', K39: 'target', K40: 'scale', K41: 'dice', K42: 'moon', K43: 'clock', K44: 'wifi', K45: 'ticket', K46: 'umbrella', K47: 'gift' };
  function cardVisual(c) {
    const fx = c.fx || [];
    const has = k => fx.find(e => e[k] != null && e[k] !== false);
    let art = null, icon = CARD_ICON[c.id] || null;
    if (c.power) icon = D.POWER[c.power].icon;
    else if (has('moveTo')) art = TILES[has('moveTo').moveTo].art;
    else if (has('goIsland')) art = 'island';
    else if (has('nearest')) art = 'ferris';
    else if (has('target')) { const k = has('target').target; if (k === 'festival') art = 'festival'; else if (k === 'renov' || k === 'build') art = 'b3'; else icon = k === 'storm' ? 'storm' : 'swap'; }
    if (!art && !icon) icon = 'letter';
    return { tone: CARD_TONE[c.cat] || 'rose', html: art ? ART.art(art) : ic(icon) };
  }
  function dCard(key) {
    showModal({
      key, decision: true, size: 'mid',
      build: () => {
        const it = head();
        if (!it || it.type !== 'CARD') return null;
        const c = E.CARD[it.card];
        const vis = cardVisual(c);
        let extra = '';
        if (c.power) extra = '<div class="note good">' + ic(D.POWER[c.power].icon) + ' Kartu disimpan. ' + esc(D.POWER[c.power].desc) + '</div>';
        if (c.choice) extra = '<div class="choice-list">' + c.choice.map((o, i) => btn('data-ch="' + i + '"', 'choice', 'chevron', o.label)).join('') + '</div>';
        return {
          kicker: ic('letter') + 'Kartu Cinta', title: c.title, who: whoLine(it.p),
          body: '<div class="love-card flip lc-' + vis.tone + '"><div class="lc-inner tilt3d"><div class="lc-front"><span class="lc-cat">' + esc(c.cat) + '</span><span class="lc-med">' + vis.html + '</span><b>' + esc(c.title) + '</b><p>' + esc(c.text) + '</p></div><div class="lc-back" aria-hidden="true">' + ART.art('card') + '</div></div></div>' + extra,
          foot: c.choice ? '' : '<span class="grow"></span>' + btn('id="bCard"', 'primary big', c.power ? 'bolt' : 'check', c.power ? 'Simpan Kartu' : 'Oke!')
        };
      },
      mount: m => {
        const it = head();
        if (!m.classList.contains('still')) UI.flyCard(it.p, m.querySelector('.love-card'));
        on(m, '#bCard', () => act({ type: 'CARD_OK', p: it.p }));
        $$('[data-ch]', m).forEach(b => b.addEventListener('click', () => act({ type: 'CARD_CHOOSE', p: it.p, choice: Number(b.dataset.ch) })));
      }
    });
  }

  // ----- tantangan pasangan -----
  function rewardChips(def, ch) {
    const r = def.reward || {}, s = def.skip || {}, f = def.fail || {};
    const out = [];
    if (r.gain) out.push('<span class="chip gold">' + coin + '+' + r.gain + '</span>');
    if (r.love) out.push('<span class="chip rose">' + ic('heart') + 'Love +' + r.love + '</span>');
    if (ch.type === 'dilemma') out.push('<span class="chip lilac">' + ic('scale') + 'Pilihanmu mengubah strategi</span>');
    if (f.gain || f.love) out.push('<span class="chip plain">Gagal: ' + (f.gain ? '+' + f.gain + ' ' : '') + (f.love ? 'Love +' + f.love : '') + '</span>');
    if (s.love) out.push('<span class="chip plain">Lewati: Love ' + s.love + '</span>');
    return '<div class="reward-row">' + out.join('') + '</div>';
  }
  function humanCount() { return App.S.players.filter(p => p.kind === 'human' && !p.bankrupt).length; }
  function dChallenge(key) {
    const local = { step: 'intro', guessPartner: -1, secret: -1, guess: -1, game: null, text: '' };
    showModal({
      key, decision: true, size: 'mid', blocksAI: false,
      cleanup: () => { if (local.game && local.game.stop) local.game.stop(); },
      build: () => {
        const S = App.S, it = head();
        if (!it || it.type !== 'CHALLENGE') return null;
        const ch = E.CH[it.ch], def = D.CH_TYPES[ch.type];
        const src = it.source === 'island' ? 'Rindu Challenge · selesai = keluar dari Pulau Rindu' : 'Kartu Cinta';
        const redrawLeft = RULES.maxRedraws - it.redraws;
        let body = '<div class="notepaper">' + esc(ch.text) + '</div>' + rewardChips(def, ch);
        let foot = '';
        const drawBtn = btn('id="bRedraw"', 'ghost', 'refresh', 'Ganti (' + redrawLeft + ')', redrawLeft <= 0);
        const skipBtn = btn('id="bSkip"', 'ghost', '', 'Lewati');
        if (ch.type === 'dilemma') {
          body += '<div class="choice-list">' + ch.options.map((o, i) => btn('data-opt="' + i + '"', 'choice', 'chevron', o.label)).join('') + '</div>';
          foot = drawBtn + skipBtn;
        } else if (ch.type === 'message') {
          body += '<div class="field"><label for="chText">Pesanmu (10–280 karakter)</label><textarea class="input" id="chText" maxlength="280" placeholder="Tulis dengan tulus…">' + esc(local.text) + '</textarea><div class="tiny muted" id="chCount">' + local.text.length + '/280</div></div>';
          foot = drawBtn + skipBtn + '<span class="grow"></span>' + btn('id="bDone"', 'primary', 'letter', 'Kirim', local.text.trim().length < 10);
        } else if (ch.type === 'guess') {
          const multi = App.mode === 'local' && humanCount() >= 2;
          if (multi) {
            const others = S.players.filter(p => p.kind === 'human' && !p.bankrupt && p.i !== it.p);
            if (local.guessPartner < 0) local.guessPartner = others[0].i;
            const partner = S.players[local.guessPartner], me = S.players[it.p];
            if (local.step === 'intro') {
              body += '<div class="field"><span class="label">Siapa pasangan yang ditebak?</span><div class="partner-pick">' + others.map(o => '<button type="button" data-gp="' + o.i + '" aria-pressed="' + (o.i === local.guessPartner) + '">' + avatarHTML(o, 'xs') + esc(o.name) + '</button>').join('') + '</div></div><div class="note">' + ic('info') + ' Serahkan layar ke ' + esc(partner.name) + ' untuk memilih jawaban rahasia. ' + esc(me.name) + ' jangan mengintip!</div>';
              foot = drawBtn + skipBtn + '<span class="grow"></span>' + btn('id="bGStart"', 'primary', 'chevron', partner.name + ' siap');
            } else if (local.step === 'secret' || local.step === 'guess') {
              const who = local.step === 'secret' ? partner : me;
              body += '<div class="note ' + (local.step === 'secret' ? 'warn' : 'good') + '">' + ic(local.step === 'secret' ? 'alert' : 'heart') + ' ' + (local.step === 'secret' ? esc(partner.name) + ': pilih jawaban jujurmu. Jawaban disembunyikan.' : esc(me.name) + ': tebak jawaban ' + esc(partner.name) + '.') + '</div>' +
                '<div class="guess-grid">' + ch.options.map((o, i) => btn('data-g="' + i + '"', 'choice', '', o)).join('') + '</div>';
              foot = '<span class="tiny muted">Yang memilih: ' + esc(who.name) + '</span>';
            } else if (local.step === 'reveal') {
              const ok = local.secret === local.guess;
              body += '<div class="note ' + (ok ? 'good' : 'warn') + '">' + ic(ok ? 'check' : 'heart') + ' ' + esc(partner.name) + ' memilih "' + esc(ch.options[local.secret]) + '". ' + esc(me.name) + ' menebak "' + esc(ch.options[local.guess]) + '". ' + (ok ? 'Cocok! Kalian memang sehati.' : 'Belum cocok, tapi sekarang kamu tahu jawabannya.') + '</div>';
              foot = '<span class="grow"></span>' + btn('id="bGEnd"', 'primary', 'check', 'Lanjut');
            }
          } else {
            body += '<div class="note">' + ic('info') + ' Tanyakan ke pasanganmu (lewat chat/telepon), lalu tandai hasilnya dengan jujur.</div><div class="guess-grid">' + ch.options.map(o => '<span class="chip plain">' + esc(o) + '</span>').join('') + '</div>';
            foot = drawBtn + skipBtn + '<span class="grow"></span>' + btn('id="bFail"', 'soft', 'x', 'Salah') + btn('id="bDone"', 'primary', 'check', 'Benar');
          }
        } else if (ch.type === 'minigame') {
          if (local.step === 'intro') {
            body += '<div class="note">' + ic('dice') + ' Mini-game berjalan di layar ini. Hadiah penuh kalau berhasil, hadiah hiburan kalau belum.</div>';
            foot = drawBtn + skipBtn + '<span class="grow"></span>' + btn('id="bPlay"', 'primary', 'play', 'Mulai');
          } else if (local.step === 'play') {
            body += '<div id="mgHost"></div>';
            foot = '<span class="tiny muted">Cepat, cepat!</span>';
          } else {
            body += '<div class="note ' + (local.result ? 'good' : 'warn') + '">' + ic(local.result ? 'trophy' : 'heart') + ' ' + esc(local.resultText) + '</div>';
            foot = '<span class="grow"></span>' + btn('id="bMgEnd"', 'primary', 'check', 'Lanjut');
          }
        } else {
          const judge = def.judge;
          if (judge) body += '<div class="tiny muted">Pasangan yang menilai jawabanmu. Main jujur, ya.</div>';
          foot = drawBtn + skipBtn + '<span class="grow"></span>' + (judge ? btn('id="bFail"', 'soft', 'x', 'Salah') : '') + btn('id="bDone"', 'primary', 'check', judge ? 'Benar' : 'Selesai');
        }
        return { kicker: ic('heart') + esc(src), title: def.label, who: whoLine(it.p), body, foot, hero: '<span class="hero-art">' + G.LoveArt.merpi('is-love') + '</span>' };
      },
      mount: m => {
        const it = head(), p = it.p, ch = E.CH[it.ch];
        const resolve = (result, extra) => act(Object.assign({ type: 'CH_RESOLVE', p, result }, extra || {}));
        on(m, '#bRedraw', () => { local.step = 'intro'; local.text = ''; act({ type: 'CH_REDRAW', p }); });
        on(m, '#bSkip', () => resolve('skip'));
        on(m, '#bFail', () => resolve('fail'));
        $$('[data-opt]', m).forEach(b => b.addEventListener('click', () => resolve('choice', { choice: Number(b.dataset.opt) })));
        const ta = m.querySelector('#chText');
        if (ta) {
          ta.addEventListener('input', () => {
            local.text = ta.value;
            m.querySelector('#chCount').textContent = ta.value.length + '/280';
            const d = m.querySelector('#bDone'); if (d) d.disabled = ta.value.trim().length < 10;
          });
          setTimeout(() => ta.focus(), 60);
        }
        on(m, '#bDone', () => resolve('complete', ch.type === 'message' ? { text: local.text } : {}));
        $$('[data-gp]', m).forEach(b => b.addEventListener('click', () => { local.guessPartner = Number(b.dataset.gp); refreshModal(); }));
        on(m, '#bGStart', () => { local.step = 'secret'; refreshModal(); });
        $$('[data-g]', m).forEach(b => b.addEventListener('click', () => {
          const v = Number(b.dataset.g);
          if (local.step === 'secret') { local.secret = v; local.step = 'guess'; SND.play('click'); }
          else { local.guess = v; local.step = 'reveal'; SND.play(local.secret === v ? 'good' : 'bad'); }
          refreshModal();
        }));
        on(m, '#bGEnd', () => resolve(local.secret === local.guess ? 'complete' : 'fail'));
        on(m, '#bPlay', () => { local.step = 'play'; refreshModal(); });
        on(m, '#bMgEnd', () => resolve(local.result ? 'complete' : 'fail'));
        const host = m.querySelector('#mgHost');
        if (host && local.step === 'play' && !local.game) {
          const done = (ok, text) => { local.game = null; local.result = ok; local.resultText = text; local.step = 'result'; SND.play(ok ? 'good' : 'bad'); refreshModal(); };
          local.game = ch.game === 'heartbeat' ? heartbeatGame(host, ch, done) : matchGame(host, ch, done);
        } else if (host && local.game && local.game.reattach) local.game.reattach(host);
      }
    });
  }
  function matchGame(host, ch, done) {
    const pool = ['kotatua', 'bali', 'paris', 'kyoto', 'santorini', 'hawaii', 'ferris', 'balloon', 'swiss', 'seoul'];
    const pickd = pool.slice().sort(() => Math.random() - 0.5).slice(0, ch.pairs);
    const cards = pickd.concat(pickd).sort(() => Math.random() - 0.5).map((k, i) => ({ k, i, open: false, done: false }));
    let first = null, lock = false, left = ch.seconds * 10, timer = null, matched = 0, el = host;
    const info = () => 'Sisa ' + Math.ceil(left / 10) + ' detik · ' + matched + '/' + ch.pairs + ' pasang';
    // grid dibuat sekali; buka/tutup hanya mengganti kelas supaya kartu berputar 3D (bukan digambar ulang)
    const build = () => {
      el.innerHTML = '<div class="timer-bar" aria-hidden="true"><i style="--v:' + Math.max(0, left / (ch.seconds * 10) * 100) + '%"></i></div><div class="tiny muted mg-info">' + info() + '</div>' +
        '<div class="match-grid">' + cards.map(c => '<button type="button" class="mcard" data-mc="' + c.i + '"><span class="mc-in" aria-hidden="true"><span class="mc-back">' + ic('heart') + '</span><span class="mc-face">' + ART.art(c.k) + '</span></span></button>').join('') + '</div>';
      $$('[data-mc]', el).forEach(b => b.addEventListener('click', () => flip(Number(b.dataset.mc))));
      draw();
    };
    const draw = () => {
      cards.forEach(c => {
        const b = el.querySelector('[data-mc="' + c.i + '"]');
        if (!b) return;
        b.classList.toggle('open', c.open);
        b.classList.toggle('done', c.done);
        b.setAttribute('aria-label', c.open || c.done ? TILES.find(t => t.art === c.k).name : 'Kartu tertutup');
      });
      const t = el.querySelector('.mg-info');
      if (t) t.textContent = info();
    };
    const flip = i => {
      const c = cards[i];
      if (lock || c.open || c.done) return;
      c.open = true; SND.play('click');
      if (!first) { first = c; draw(); return; }
      const a = first; first = null;
      if (a.k === c.k) { a.done = c.done = true; a.open = c.open = false; matched++; SND.play('coin'); draw(); if (matched === ch.pairs) { stop(); done(true, 'Semua kartu cocok dengan sisa ' + Math.ceil(left / 10) + ' detik!'); } return; }
      lock = true; draw();
      setTimeout(() => { a.open = c.open = false; lock = false; draw(); }, 650);
    };
    const stop = () => clearInterval(timer);
    timer = setInterval(() => { left--; if (left <= 0) { stop(); done(false, 'Waktu habis! ' + matched + ' dari ' + ch.pairs + ' pasang cocok.'); return; } const bar = el.querySelector('.timer-bar i'); if (bar) bar.style.setProperty('--v', (left / (ch.seconds * 10) * 100) + '%'); const t = el.querySelector('.mg-info'); if (t && left % 10 === 0) t.textContent = info(); }, 100);
    build();
    return { stop, reattach(h) { el = h; build(); } };
  }
  function heartbeatGame(host, ch, done) {
    let el = host, raf = 0, t0 = performance.now(), taps = [], speed = 1;
    const draw = () => {
      el.innerHTML = '<div class="beat-track"><div class="beat-zone"></div><div class="beat-heart" id="beatHeart">' + ic('heart') + '</div></div>' +
        '<div class="beat-dots">' + Array.from({ length: ch.taps }, (_, i) => '<i class="' + (taps[i] == null ? '' : taps[i] ? 'hit' : 'miss') + '"></i>').join('') + '</div>' +
        '<button type="button" class="btn go block" id="beatTap" data-focus>' + ic('heart') + '<span>Ketuk! (' + taps.length + '/' + ch.taps + ')</span></button><div class="tiny muted">Butuh ' + ch.need + ' ketukan tepat di zona merah muda. Bisa juga tekan spasi.</div>';
      el.querySelector('#beatTap').addEventListener('click', tap);
    };
    const pos = () => { const t = (performance.now() - t0) / 1000 * speed; const ph = t % 2; return ph < 1 ? ph : 2 - ph; };
    const loop = () => { const h = el.querySelector('#beatHeart'); if (h) h.style.left = (pos() * 100) + '%'; raf = requestAnimationFrame(loop); };
    const key = e => { if (e.code === 'Space') { e.preventDefault(); tap(); } };
    function tap() {
      const x = pos();
      const hit = x >= 0.41 && x <= 0.59;
      taps.push(hit); SND.play(hit ? 'heart' : 'error');
      speed += 0.18;
      draw();
      if (taps.length >= ch.taps) {
        stop();
        const hits = taps.filter(Boolean).length;
        done(hits >= ch.need, hits + ' dari ' + ch.taps + ' ketukan tepat. ' + (hits >= ch.need ? 'Detak kalian sinkron!' : 'Hampir sinkron. Coba lagi lain kali.'));
      }
    }
    function stop() { cancelAnimationFrame(raf); document.removeEventListener('keydown', key); }
    document.addEventListener('keydown', key);
    draw(); loop();
    return { stop, reattach(h) { el = h; draw(); } };
  }

  function dDebt(key) {
    let confirmBk = false;
    showModal({
      key, decision: true, size: 'mid',
      build: () => {
        const S = App.S, it = head();
        if (!it || it.type !== 'DEBT') return null;
        const p = S.players[it.p];
        const liq = E.liquidation(S, it.p);
        const enough = liq >= it.amount;
        const can = p.cash >= it.amount;
        const own = E.ownedBy(S, it.p);
        const list = own.length ? '<div class="sell-list">' + own.map(t => {
          const st = S.tiles[t], tl = TILES[t];
          return '<div class="sell-row" style="--g:' + (tl.group ? GROUPS[tl.group].color : '#B79CFF') + '"><span class="sr-art">' + ART.art(tl.art) + '</span><span class="sr-txt"><b>' + esc(tl.name) + '</b><span>' + (tl.type === 'city' ? E.LEVEL_NAME[st.level] : 'Wisata') + ' · nilai ' + fmt(E.tileValue(S, t)) + '</span></span>' + btn('data-sell="' + t + '"', 'soft sm', 'coins', '+' + fmt(E.sellValue(S, t)), can) + '</div>';
        }).join('') + '</div>' : '<div class="empty">' + ic('house') + 'Tidak ada kota yang bisa dijual.</div>';
        return {
          tone: 'warn', kicker: ic('alert') + 'Uang kurang', title: 'Cari Dana ' + fmt(it.amount), who: whoLine(it.p, 'untuk ' + esc(it.reason)),
          body: '<div class="kv-list"><div class="kv"><span>Harus dibayar ke ' + esc(it.to >= 0 ? pname(it.to) : 'Bank') + '</span><b>' + fmt(it.amount) + '</b></div><div class="kv"><span>Uangmu</span><b>' + fmt(p.cash) + '</b></div><div class="kv"><span>Kurang</span><b>' + fmt(Math.max(0, it.amount - p.cash)) + '</b></div></div>' +
            (can ? '<div class="note good">' + ic('check') + ' Uangmu sudah cukup. Tekan Bayar.</div>' : enough ? '<div class="note">' + ic('info') + ' Jual kota ke bank (' + Math.round(RULES.sellRate * 100) + '% nilainya) sampai uangmu cukup.</div>' : '<div class="note warn">' + ic('alert') + ' Semua asetmu tetap tidak cukup. Kamu harus menyatakan bangkrut.</div>') +
            list + (confirmBk ? '<div class="note warn">' + ic('alert') + ' Yakin? Kamu keluar dari permainan.</div>' : ''),
          foot: (!enough ? btn('id="bBk"', 'danger', 'flag', confirmBk ? 'Ya, Bangkrut' : 'Nyatakan Bangkrut') : '') + '<span class="grow"></span>' + btn('id="bPayDebt"', 'primary big', 'check', 'Bayar ' + fmt(it.amount), !can)
        };
      },
      mount: m => {
        const it = head();
        on(m, '#bPayDebt', () => act({ type: 'PAY_DEBT', p: it.p }));
        $$('[data-sell]', m).forEach(b => b.addEventListener('click', () => act({ type: 'SELL', p: it.p, tile: Number(b.dataset.sell) })));
        on(m, '#bBk', () => { if (!confirmBk) { confirmBk = true; refreshModal(); return; } act({ type: 'BANKRUPT', p: it.p }); });
      }
    });
  }

  // ---------- pilih petak (festival, bangun, kartu aksi, World Tour) ----------
  function pTarget(key) {
    const S = App.S, it = head();
    if (!it || it.type !== 'TARGET') return;
    const p = it.p;
    const cand = new Set(E.targetCandidates(S, p, it.kind));
    const theirs = new Set(it.kind === 'swap' ? E.swapTargets(S, p) : []);
    const META = {
      festival: { title: 'Festival Cinta', art: 'festival', ok: 'Adakan Festival', skip: 'Lewati', hint: 'Ketuk kotamu yang menyala. Tolnya jadi ×2 (×3 kalau festival lagi di kota yang sama).' },
      build: { title: 'Bangun dari START', art: 'start', ok: 'Pilih Kota', skip: 'Lewati', hint: 'Ketuk kotamu yang mau dibangun.' },
      renov: { title: 'Renovasi Gratis', art: 'b2', ok: 'Renovasi', skip: 'Lewati', hint: 'Ketuk kotamu: naik 1 tingkat gratis.' },
      storm: { title: 'Badai Rindu', art: 'card', ok: 'Kirim Badai', skip: 'Lewati', hint: 'Ketuk kota lawan yang menyala: bangunannya turun 1 tingkat.' },
      swap: { title: 'Tukar Kota', art: 'card', ok: 'Tukar', skip: 'Lewati', hint: '' }
    }[it.kind];
    const def = {
      key, sel: [], art: META.art, title: META.title, skipLabel: META.skip,
      can: i => it.kind === 'swap' ? (def.sel.length === 0 ? cand.has(i) : (theirs.has(i) || i === def.sel[0])) : cand.has(i),
      tap: i => {
        if (it.kind === 'swap') {
          if (def.sel.length === 0) def.sel = [i];
          else if (i === def.sel[0]) def.sel = [];
          else def.sel = [def.sel[0], i];
        } else def.sel = [i];
      },
      ready: () => it.kind === 'swap' ? def.sel.length === 2 : def.sel.length === 1,
      hint: () => {
        if (it.kind === 'swap') return def.sel.length === 0 ? 'Langkah 1: ketuk kotamu yang mau diberikan.' : def.sel.length === 1 ? 'Langkah 2: ketuk kota lawan yang mau diambil (' + TILES[def.sel[0]].name + ' akan diberikan).' : TILES[def.sel[0]].name + ' ↔ ' + TILES[def.sel[1]].name;
        if (def.sel.length) {
          const t = TILES[def.sel[0]];
          if (it.kind === 'festival') return t.name + ': tol jadi ' + fmt(festPreview(S, def.sel[0])) + '.';
          if (it.kind === 'storm') return t.name + ' milik ' + pname(S.tiles[def.sel[0]].owner) + ' turun jadi ' + E.LEVEL_NAME[S.tiles[def.sel[0]].level - 1] + '.';
          if (it.kind === 'renov') return t.name + ' naik jadi ' + E.LEVEL_NAME[E.upgradeLevels(S, p, def.sel[0])[0]] + '.';
          return t.name + ' dipilih.';
        }
        return META.hint;
      },
      okLabel: () => META.ok,
      confirm: () => act(it.kind === 'swap' ? { type: 'TARGET_PICK', p, tile: def.sel[0], tile2: def.sel[1] } : { type: 'TARGET_PICK', p, tile: def.sel[0] }),
      skip: () => act({ type: 'TARGET_SKIP', p })
    };
    UI.startPick(def);
  }
  function festPreview(S, ti) {
    const mult = S.festival.tile === ti ? Math.min(RULES.festivalMax, S.festival.mult + 1) : 2;
    const r = E.rentInfo(S, ti);
    const base = r ? r.amount / (S.festival.tile === ti ? S.festival.mult : 1) : 0;
    return Math.round(base * mult / 5) * 5;
  }
  function pTour(key) {
    const S = App.S, it = head();
    if (!it || it.type !== 'TOUR') return;
    const p = it.p, P = S.players[p];
    const def = {
      key, sel: [], art: 'plane', title: 'World Tour', skipLabel: 'Lempar dadu biasa',
      can: i => i !== E.TRAVEL && i !== E.ISLAND && P.cash >= RULES.travelFee,
      tap: i => { def.sel = [i]; },
      ready: () => def.sel.length === 1,
      hint: () => {
        if (P.cash < RULES.travelFee) return 'Uangmu kurang untuk tiket ' + RULES.travelFee + '. Lempar dadu biasa.';
        if (!def.sel.length) return 'Ketuk petak tujuan mana pun. Tiket ' + RULES.travelFee + '. Lewat START tetap dapat gaji.';
        const t = TILES[def.sel[0]], st = S.tiles[def.sel[0]];
        let s = 'Terbang ke ' + t.name + '. ';
        if (t.price) s += st.owner < 0 ? 'Bisa dibeli (' + fmt(E.buyCost(S, p, t.i, 0)) + ').' : st.owner === p ? 'Kotamu: bisa dibangun.' : 'Milik ' + pname(st.owner) + ': tol ' + fmt(E.rentFor(S, t.i, p)) + '!';
        else s += t.desc || '';
        return s;
      },
      okLabel: () => def.sel.length ? 'Terbang · ' + RULES.travelFee : 'Pilih tujuan',
      confirm: () => act({ type: 'TOUR_GO', p, tile: def.sel[0] }),
      skip: () => act({ type: 'TOUR_SKIP', p })
    };
    UI.startPick(def);
  }

  // ---------- sinkronisasi keputusan dengan state ----------
  function syncModal(force) {
    const S = App.S;
    if (!S || S.over) return;
    const it = S.queue[0], a = E.actor(S);
    if (it && controls(a)) {
      const key = 'd' + S.seq;
      if (it.type === 'TARGET' || it.type === 'TOUR') {
        if (App.modal && App.modal.decision) closeModal(true);
        if (!force && App.pick && App.pick.key === key) return;
        if (App.tour) return;
        openDecision(it, key);
        return;
      }
      if (!force && App.modal && App.modal.key === key) return;
      if (!force && App.modal && App.modal.decision && App.modal.itype === it.type && it.type === 'DEBT') { App.modal.key = key; refreshModal(); return; }
      openDecision(it, key);
      return;
    }
    if (App.pick) UI.endPick();
    if (App.modal && App.modal.decision) closeModal();
    else if (App.modal) refreshModal();
  }

  // ---------- info petak ----------
  function onTileClick(i) {
    const t = TILES[i];
    showModal({
      key: 'tile' + i, size: 'mid',
      build: () => {
        const S = App.S, st = S.tiles[i], v = viewer();
        const here = S.players.filter(p => p.pos === i && !p.bankrupt);
        let body = '';
        if (t.type === 'city') {
          body += cityHero(S, i);
          const owner = st.owner;
          body += '<div class="ladder">' + [0, 1, 2, 3, 4].map(k => {
            const toll = owner >= 0 ? tollIf(S, owner, i, k) : Math.round(t.price * RULES.rentMult[k] / 5) * 5;
            return '<div class="ld-row' + (owner >= 0 && st.level === k ? ' cur' : '') + (k === 4 ? ' lm' : '') + '"><span class="ld-art">' + ART.art(LV_ART[k]) + '</span><b>' + E.LEVEL_NAME[k] + '</b><span class="ld-cost">' + (k === 0 ? 'Harga ' : '+') + fmt(E.levelCost(i, k)) + '</span><span class="ld-toll">Tol ' + fmt(toll) + '</span></div>';
          }).join('') + '</div>';
          body += '<div class="tiny muted">Grup penuh: tol ×' + RULES.groupMult + '. Festival: ×2/×3. Hotel setelah 1 putaran, Landmark saat mampir ke kota ber-Hotel.</div>';
          if (owner >= 0 && S.settings.takeover) body += st.level === 4 ? '<div class="note gold">' + ic('crown') + ' Landmark: kebal diambil alih.</div>' : '<div class="kv"><span>Harga ambil alih</span><b>' + fmt(E.takeoverPrice(S, i)) + '</b></div>';
          body += groupProgress(S, owner >= 0 ? owner : v, i);
        } else if (t.type === 'spot') {
          body += cityHero(S, i) + '<div class="spot-table">' + RULES.spotRent.map((r, k) => '<span class="' + (st.owner >= 0 && k === E.spotsOf(S, st.owner).length - 1 ? 'cur' : '') + '"><b>' + (k + 1) + ' wisata</b>Tol ' + fmt(r) + '</span>').join('') + '</div>' +
            '<div class="note">' + ic('shield') + ' Wisata tidak bisa diambil alih.' + (S.settings.instantWin ? ' Kuasai kelima wisata untuk menang instan!' : '') + '</div>' + groupProgress(S, st.owner >= 0 ? st.owner : v, i);
        } else {
          body += '<div class="special-hero"><span class="hero-art">' + ART.art(t.art) + '</span><p class="lead">' + esc(t.desc || '') + '</p></div>';
          if (t.type === 'start') body += '<div class="kv"><span>Gaji dasar</span><b>' + RULES.salary + '</b></div><div class="tiny muted">+10 sampai +40 sesuai Love Meter.</div>';
          if (t.type === 'travel') body += '<div class="kv"><span>Tiket terbang</span><b>' + RULES.travelFee + '</b></div>';
          if (t.type === 'island') body += '<div class="kv"><span>Biaya perahu</span><b>' + RULES.islandFee + '</b></div>';
          if (t.type === 'fest' && S.festival.tile >= 0) body += '<div class="note">' + ic('party') + ' Festival sedang di ' + esc(TILES[S.festival.tile].name) + ' (tol ×' + S.festival.mult + ').</div>';
        }
        E.winThreats(S).filter(x => x.tile === i).forEach(x => { body += '<div class="note warn">' + ic('alert') + ' ' + esc(S.players[x.p].name) + ' butuh petak ini untuk ' + esc(UI.winLabel(x)) + '.</div>'; });
        if (here.length) body += '<div class="tiny muted here">Di sini: ' + here.map(p => avatarHTML(p, 'xs') + esc(p.name)).join(' ') + '</div>';
        return { title: t.name, kicker: t.type === 'city' ? ic('house') + 'Kota' : t.type === 'spot' ? ic('ferris') + 'Wisata' : ic('sparkle') + 'Petak spesial', body, foot: '<span class="grow"></span>' + btn('id="tdClose"', 'primary', 'check', 'Tutup') };
      },
      mount: m => { on(m, '#tdClose', () => closeModal()); }
    });
  }

  // ---------- aset pemain ----------
  function openPortfolio(pi) {
    if (pi == null || pi < 0) pi = viewer();
    showModal({
      key: 'pf', size: 'wide', player: pi,
      build: () => {
        const S = App.S, p = S.players[pi];
        const tier = E.tierInfo(p.love);
        const own = E.ownedBy(S, pi);
        const list = own.length ? '<div class="pf-grid">' + own.map(t => {
          const tl = TILES[t], st = S.tiles[t];
          return '<button type="button" class="pf-item" data-tile="' + t + '" style="--g:' + (tl.group ? GROUPS[tl.group].color : '#B79CFF') + ';--oc:' + p.color + '"><span class="pf-art">' + ART.art(tl.art) + (tl.type === 'city' && st.level ? '<span class="pf-bld">' + ART.art(LV_ART[st.level]) + '</span>' : '') + '</span><b>' + esc(tl.name) + '</b><span>' + (tl.type === 'city' ? E.LEVEL_NAME[st.level] : 'Wisata') + (S.festival.tile === t ? ' · ×' + S.festival.mult : '') + '</span><span class="pf-toll">Tol ' + fmt(E.rentInfo(S, t).amount) + '</span></button>';
        }).join('') + '</div>' : '<div class="empty">' + ic('house') + 'Belum punya kota. Mendarat di petak kosong untuk membeli.</div>';
        const held = p.cards.length ? '<div class="held">' + p.cards.map(c => { const k = E.CARD[c].power; return '<div class="held-card">' + ic(D.POWER[k].icon) + '<div><b>' + esc(D.POWER[k].name) + '</b><span>' + esc(D.POWER[k].desc) + '</span></div></div>'; }).join('') + '</div>' : '<div class="tiny muted">Belum ada kartu simpanan. Kartu Malaikat, Kupon, dan Tiket Pulang didapat dari Kartu Cinta.</div>';
        const groups = E.fullGroups(S, pi);
        const ach = '<div class="ach-list">' + D.ACHIEVEMENTS.map(a => '<span class="ach' + (p.achievements.includes(a.id) ? '' : ' locked') + '" title="' + esc(a.text) + '">' + ic(a.icon in G.LoveIcons.paths ? a.icon : 'trophy') + esc(a.name) + '</span>').join('') + '</div>';
        return {
          title: p.name, kicker: ic('briefcase') + 'Aset pemain',
          who: avatarHTML(p, 'xs') + '<span>' + (p.kind === 'ai' ? 'AI ' + p.ai : 'Pemain') + ' · ' + esc(tier.name) + ' (Love ' + p.love + ')</span>',
          body: '<div class="pf-stats"><div><span>Uang</span><b>' + coin + fmt(p.cash) + '</b></div><div><span>Total aset</span><b>' + fmt(E.netWorth(S, pi)) + '</b></div><div><span>Tol diterima</span><b>' + fmt(p.stats.tollIn) + '</b></div><div><span>Grup penuh</span><b>' + groups.length + '</b></div></div>' +
            '<div class="sec-title">Kota & wisata (' + own.length + ')</div>' + list +
            '<div class="sec-title">Kartu simpanan</div>' + held +
            '<div class="sec-title">Achievement</div>' + ach,
          foot: '<span class="grow"></span>' + btn('id="pfClose"', 'primary', 'check', 'Tutup')
        };
      },
      mount: m => {
        on(m, '#pfClose', () => closeModal());
        $$('[data-tile]', m).forEach(b => b.addEventListener('click', () => onTileClick(Number(b.dataset.tile))));
      }
    });
  }

  function openHistory() {
    showModal({
      key: 'hist', size: 'mid',
      build: () => {
        const S = App.S;
        const items = S.log.slice().reverse().map(l => '<li><span class="bub" style="--c:' + (l.p >= 0 && S.players[l.p] ? S.players[l.p].color : 'var(--ink-3)') + '">' + ic(l.icon in G.LoveIcons.paths ? l.icon : 'dot') + '</span><span>' + esc(l.text) + '<small>Ronde ' + l.r + '</small></span></li>').join('');
        return { title: 'Riwayat', kicker: ic('history') + 'Semua kejadian', body: '<ul class="log full">' + items + '</ul>', foot: '<span class="grow"></span>' + btn('id="hClose"', 'primary', 'check', 'Tutup') };
      },
      mount: m => on(m, '#hClose', () => closeModal())
    });
  }

  // ---------- menu permainan ----------
  function onlineControls() {
    const N = App.mode === 'online' ? App.net : null;
    if (!N || !N.doc) return '';
    let h = '<div class="sec-title">Room ' + esc(N.code) + (N.isHost() ? ' · kamu host' : '') + '</div><div class="choice-list">';
    if (N.isHost()) {
      N.doc.seats.forEach((s, i) => {
        if (s.bot || i === App.seat) return;
        const on = N.isOnline(s.uid);
        h += btn('data-afk="' + i + '"', 'choice', 'bot', s.afk ? 'Kembalikan kendali ke ' + s.name : 'Kendalikan ' + s.name + ' dengan AI' + (on === false ? ' (offline)' : ''));
      });
      h += '</div><div class="tiny muted">Pakai saat pasangan terputus lama supaya permainan tetap jalan.</div>';
    } else {
      h += btn('id="mTake"', 'choice', 'globe', 'Jadi host (kalau host offline)') + '</div><div class="tiny muted">Hanya berhasil bila host benar-benar tidak aktif (±45 detik).</div>';
    }
    return h;
  }
  function openMenu() {
    let confirm = '';
    showModal({
      key: 'menu', size: 'mid',
      build: () => {
        const S = App.S, cur = S.turn.p;
        const canEndNow = controls(cur) && !S.queue.length && !S.over;
        return {
          title: 'Menu', kicker: ic('menu') + 'Ronde ' + S.round,
          body: '<div class="menu-grid">' +
            btn('id="mGuide"', 'tile-btn', 'book', 'Buku Panduan') +
            btn('id="mHist"', 'tile-btn', 'history', 'Riwayat') +
            btn('id="mPf"', 'tile-btn', 'briefcase', 'Asetku') +
            btn('id="mSet"', 'tile-btn', 'sliders', 'Pengaturan') +
            btn('id="mPause"', 'tile-btn', S.paused ? 'play' : 'pause', S.paused ? 'Lanjutkan' : 'Jeda') +
            btn('id="mExit"', 'tile-btn', 'exit', 'Keluar') +
            '</div><div class="choice-list">' +
            btn('id="mFinish"', 'choice', 'trophy', confirm === 'finish' ? 'Yakin? Pemenang = aset terbesar sekarang' : 'Akhiri & hitung aset', !canEndNow) +
            btn('id="mResign"', 'choice danger', 'flag', confirm === 'resign' ? 'Yakin menyerah? Kotamu kembali ke bank' : 'Menyerah (' + S.players[cur].name + ')', !canEndNow) +
            '</div>' + (!canEndNow ? '<div class="tiny muted">Akhiri/menyerah hanya di giliran pemain manusia tanpa keputusan tertunda.</div>' : '') + onlineControls(),
          foot: ''
        };
      },
      mount: m => {
        const S = App.S, cur = S.turn.p;
        on(m, '#mGuide', () => { closeModal(); UI.openGuide(); });
        on(m, '#mHist', openHistory);
        on(m, '#mPf', () => openPortfolio(viewer()));
        on(m, '#mSet', openSettings);
        on(m, '#mPause', () => { closeModal(); UI.togglePause(); });
        on(m, '#mFinish', () => { if (confirm !== 'finish') { confirm = 'finish'; refreshModal(); return; } closeModal(); act({ type: 'FINISH_NOW', p: cur }); });
        on(m, '#mResign', () => { if (confirm !== 'resign') { confirm = 'resign'; refreshModal(); return; } closeModal(); act({ type: 'RESIGN', p: cur }); });
        on(m, '#mExit', openExit);
        $$('[data-afk]', m).forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.afk); const seat = App.net.doc.seats[i]; App.net.setAfk(i, !seat.afk); refreshModal(); }));
        on(m, '#mTake', async () => { await App.net.takeOver(); refreshModal(); });
      }
    });
  }
  function openExit() {
    showModal({
      key: 'exit', size: 'mid',
      build: () => ({
        title: 'Keluar ke Menu?', kicker: ic('exit') + 'Keluar',
        body: App.mode === 'online' ? '<div class="note">' + ic('info') + '<span>Kamu bisa kembali kapan saja dengan kode room <b class="mono">' + esc(App.net ? App.net.code : '') + '</b>.</span></div>' : '<div class="note">' + ic('info') + ' Progres tersimpan otomatis di perangkat ini. Lanjutkan dari menu utama kapan saja.</div>',
        foot: btn('id="xNo"', 'ghost', 'back', 'Tetap Main') + '<span class="grow"></span>' + btn('id="xYes"', 'primary', 'exit', 'Keluar')
      }),
      mount: m => { on(m, '#xNo', () => closeModal()); on(m, '#xYes', () => { closeModal(); UI.exitToHome(); }); }
    });
  }
  function seg(id, opts, val) { return '<div class="seg" role="group" id="' + id + '">' + opts.map(([k, l]) => '<button type="button" data-v="' + k + '" aria-pressed="' + (val === k) + '">' + l + '</button>').join('') + '</div>'; }
  function openSettings() {
    showModal({
      key: 'settings', size: 'mid',
      build: () => ({
        title: 'Pengaturan', kicker: ic('sliders') + 'Tersimpan di perangkat ini',
        body: '<div class="opt-list">' +
          '<div class="toggle-row"><div><b>Efek suara</b><div class="tiny muted">Dadu, koin, kartu, dan musik kecil.</div></div><button type="button" class="switch" role="switch" id="sSound" aria-checked="' + App.prefs.sound + '" aria-label="Efek suara"></button></div>' +
          '<div class="toggle-row"><div><b>Papan 3D</b><div class="tiny muted">Papan miring dengan ilustrasi berdiri seperti pop-up. Matikan untuk papan datar.</div></div><button type="button" class="switch" role="switch" id="sView3d" aria-checked="' + (App.prefs.view3d !== false) + '" aria-label="Papan 3D"></button></div>' +
          '<div class="toggle-row"><div><b>Sorot langkah (HP)</b><div class="tiny muted">Saat pion berjalan, papan mendekat mengikuti pion supaya nama & gambar petak besar, lalu kembali menampilkan seluruh papan.</div></div><button type="button" class="switch" role="switch" id="sWalkCam" aria-checked="' + (App.prefs.walkCam !== false) + '" aria-label="Sorot langkah (HP)"></button></div>' +
          '<div class="toggle-row"><div><b>Akhiri giliran otomatis</b><div class="tiny muted">Giliran selesai sendiri ±2 detik setelah semua beres. Sentuh layar untuk menahan.</div></div><button type="button" class="switch" role="switch" id="sAutoEnd" aria-checked="' + (App.prefs.autoEnd !== false) + '" aria-label="Akhiri giliran otomatis"></button></div>' +
          '<div class="opt"><span class="label">Kecepatan animasi</span>' + seg('sSpeed', [['normal', 'Normal'], ['fast', 'Cepat']], App.prefs.speed) + '</div>' +
          '<div class="opt"><span class="label">Kecepatan AI</span>' + seg('sAi', [['slow', 'Santai'], ['normal', 'Normal'], ['fast', 'Cepat']], App.prefs.aiSpeed) + '</div>' +
          '<div class="opt"><span class="label">Tema</span>' + seg('sTheme', [['system', 'Ikuti sistem'], ['light', 'Terang'], ['dark', 'Gelap']], App.prefs.theme) + '</div>' +
          '</div>',
        foot: '<span class="grow"></span>' + btn('id="sDone"', 'primary', 'check', 'Selesai')
      }),
      mount: m => {
        on(m, '#sSound', () => { App.prefs.sound = !App.prefs.sound; SND.setEnabled(App.prefs.sound); UI.savePrefs(); UI.syncSoundBtn && UI.syncSoundBtn(); refreshModal(); });
        on(m, '#sAutoEnd', () => { App.prefs.autoEnd = App.prefs.autoEnd === false; UI.savePrefs(); refreshModal(); });
        on(m, '#sView3d', () => { App.prefs.view3d = App.prefs.view3d === false; UI.savePrefs(); if (App.S) { UI.applyLayout(true); UI.renderTokens && UI.renderTokens(); UI.renderStage && UI.renderStage(); } refreshModal(); });
        on(m, '#sWalkCam', () => { App.prefs.walkCam = App.prefs.walkCam === false; UI.savePrefs(); if (!App.prefs.walkCam && UI.camRelax) UI.camRelax(); refreshModal(); });
        [['#sSpeed', 'speed'], ['#sAi', 'aiSpeed'], ['#sTheme', 'theme']].forEach(([sel, k]) => $$(sel + ' [data-v]', m).forEach(b => b.addEventListener('click', () => { App.prefs[k] = b.dataset.v; UI.savePrefs(); UI.applyTheme(); refreshModal(); })));
        on(m, '#sDone', () => closeModal());
      }
    });
  }

  Object.assign(UI, {
    showModal, refreshModal, closeModal, syncModal, openDecision, openPortfolio, onTileClick, openMenu, openHistory, openSettings, openExit, btn, cityHero
  });
})(typeof window !== 'undefined' ? window : globalThis);
