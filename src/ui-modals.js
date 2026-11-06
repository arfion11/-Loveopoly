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
        if (ri) ri.parts.forEach(x => { rows += '<div class="kv"><span>' + esc(x.label) + '</span><b>' + (x.v != null ? fmt(x.v) : x.m ? '×' + String(x.m).replace('.', ',') : '+' + x.pct + '%') + '</b></div>'; });
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

  // ----- tantangan -----
  function humanCount() { return App.S.players.filter(p => p.kind === 'human' && !p.bankrupt).length; }
  // Tidak ada tombol "Benar/Selesai" yang dinilai sendiri. auto = mini-game berwaktu (jawaban dinilai engine),
  // duel = lawan ikut main, judge = lawan mengesahkan (Aksi Berani & Foto Bukti). Main bersama di satu HP:
  // layar "Serahkan ke …" muncul tiap kali giliran beraksi berpindah orang supaya jawaban rahasia aman.
  function rewardChips(def, ch, it) {
    const r = def.reward || {}, s = def.skip || {}, jr = def.judgeReward;
    const out = [];
    if (r.gain) out.push('<span class="chip gold">' + coin + '+' + r.gain + '</span>');
    if (r.love) out.push('<span class="chip rose">' + ic('heart') + 'Love +' + r.love + '</span>');
    if (ch.type === 'dilemma') out.push('<span class="chip lilac">' + ic('scale') + 'Pilihanmu mengubah strategi</span>');
    if (jr && it && it.judge >= 0) out.push('<span class="chip mint">' + ic('users') + (ch.type === 'bluff' ? 'Ketahuan: ' : 'Penilai juga: ') + [jr.gain ? '+' + jr.gain : '', jr.love ? 'Love +' + jr.love : ''].filter(Boolean).join(' ') + '</span>');
    if (it && it.isle) out.push('<span class="chip lilac">' + ic('island') + 'Lulus = keluar dari Pulau Rindu</span>');
    if (s.love) out.push('<span class="chip plain">Lewati: Love ' + s.love + '</span>');
    return '<div class="reward-row">' + out.join('') + '</div>';
  }
  const VERIFY_TXT = { auto: 'Dinilai otomatis oleh game', duel: 'Lawan ikut main · dinilai game', judge: 'Disahkan lawan', choice: 'Pilih strategi' };
  const chFill = (txt, it) => String(txt || '').replace(/\{j\}/g, it.judge >= 0 ? App.S.players[it.judge].name : 'lawanmu').replace(/\{n\}/g, App.S.players[it.p].name);
  const chKey = it => it.p + '|' + it.ch + '|' + it.redraws + '|' + App.S.round;
  let chSeen = { key: '', who: -1 };
  const chClock = {};   // waktu mulai per tantangan+fase (tetap jalan walau dialog digambar ulang)
  function clockOf(it, tag, secs) {
    const k = chKey(it) + '|' + tag;
    if (!chClock[k]) chClock[k] = performance.now();
    const ms = performance.now() - chClock[k];
    return { ms, left: Math.max(0, secs * 1000 - ms), reset: () => { delete chClock[k]; } };
  }
  const timerBar = (left, secs) => '<div class="ch-timer' + (left < 5000 ? ' hurry' : '') + '" role="timer" aria-label="Sisa waktu"><i style="--v:' + Math.max(0, left / (secs * 1000) * 100).toFixed(1) + '%"></i><b>' + Math.ceil(left / 1000) + '</b></div>';
  function dChallenge(key) {
    const local = { answers: [], idx: 0, text: '', lines: ['', '', ''], lie: -1, pick: -1, guess: '', reveal: false, photo: '', tick: null, game: null, cam: null, fb: '' };
    const stopTick = () => { if (local.tick) { clearInterval(local.tick); local.tick = null; } };
    showModal({
      key, decision: true, size: 'mid', blocksAI: false, closable: false,
      cleanup: () => { stopTick(); if (local.cam) local.cam.stop(); },
      build: () => {
        const S = App.S, it = head();
        if (!it || it.type !== 'CHALLENGE' || !E.CH[it.ch]) return null;
        const ch = E.CH[it.ch], def = D.CH_TYPES[ch.type], me = S.players[it.who], owner = S.players[it.p];
        const J = it.judge >= 0 ? S.players[it.judge] : null;
        const kicker = ic(def.icon || 'heart') + esc(it.source === 'island' ? 'Rindu Challenge' : 'Kartu Cinta') + ' · ' + VERIFY_TXT[def.verify];
        const hero = '<span class="hero-art">' + G.LoveArt.merpi(it.who === it.p ? 'is-wow' : 'is-think') + '</span>';
        const ownerPhase = it.who === it.p;
        // layar serah-HP (main bersama di satu perangkat)
        const k = chKey(it);
        if (chSeen.key !== k) chSeen = { key: k, who: it.who };
        if (App.mode !== 'online' && humanCount() >= 2 && chSeen.who !== it.who) {
          local.gate = true;
          return { kicker, title: 'Serahkan ke ' + me.name, who: whoLine(it.who, ownerPhase ? 'giliran menjawab' : 'penilai'), hero,
            body: '<div class="ch-gate">' + avatarHTML(me, 'lg') + '<p><b>' + esc(me.name) + '</b>, sekarang giliranmu' + (ownerPhase ? '' : ' menilai tantangan ' + esc(owner.name)) + '.</p><p class="muted">' + (ch.type === 'secret' || ch.type === 'charades' ? 'Yang lain jangan mengintip layar, ya!' : 'Pegang perangkatnya, lalu lanjut.') + '</p></div>',
            foot: '<span class="grow"></span>' + btn('id="bGate" data-focus', 'primary big', 'check', 'Aku ' + me.name + ', lanjut') };
        }
        local.gate = false;
        const redrawLeft = RULES.maxRedraws - it.redraws;
        const first = ownerPhase && (D.AUTO_TYPES.includes(ch.type) ? !local.started : ['intro', 'write', 'act', 'do', 'choose'].includes(it.phase));
        const ownerBtns = ownerPhase ? (first ? btn('id="bRedraw"', 'ghost', 'refresh', 'Ganti (' + redrawLeft + ')', redrawLeft <= 0) : '') + btn('id="bSkip"', 'ghost', '', 'Lewati') : '';
        const task = '<div class="notepaper">' + esc(chFill(ch.text, it)) + '</div>';
        const how = '<div class="tiny muted ch-how">' + ic('info') + ' ' + esc(chFill(def.how, it)) + '</div>';
        let body = '', foot = '', title = def.label;
        // --- auto: mini-game berwaktu ---
        if (D.AUTO_TYPES.includes(ch.type)) {
          const z = it.pz;
          if (!local.started) {
            const need = ch.type === 'recall' ? 'Ulangi ' + z.seq.length + ' gambar persis' : 'Butuh ' + z.need + ' dari ' + (z.qs || z.items).length + ' benar';
            body = task + how + '<div class="ch-stats"><span>' + ic('clock') + z.secs + ' detik</span><span>' + ic('target') + need + '</span></div>' + rewardChips(def, ch, it);
            foot = ownerBtns + '<span class="grow"></span>' + btn('id="bChGo" data-focus', 'go big', 'play', 'Mulai!');
          } else {
            body = '<div id="chGame" class="ch-game"></div>';
            foot = '<span class="tiny muted">' + esc(owner.name) + ' sedang beraksi…</span><span class="grow"></span>' + btn('id="bChGiveUp"', 'ghost', 'x', 'Menyerah');
          }
          // saat bermain, Merpi di kepala dialog disembunyikan supaya soal & tombol lega di HP
          return { kicker, title, who: whoLine(it.p), body, foot, hero: local.started ? '' : hero };
        }
        if (ch.type === 'dilemma') {
          body = task + rewardChips(def, ch, it) + '<div class="choice-list">' + ch.options.map((o, i) => btn('data-opt="' + i + '"', 'choice', 'chevron', o.label)).join('') + '</div>';
          return { kicker, title, who: whoLine(it.p), body, foot: ownerBtns, hero };
        }
        const jName = J ? J.name : 'lawan';
        if (ch.type === 'secret') {
          const qs = it.pz.qs.map(q => D.HEART_QS[q]);
          if (it.phase === 'intro') {
            body = task + how + rewardChips(def, ch, it);
            foot = ownerBtns + '<span class="grow"></span>' + btn('id="bChStep" data-focus', 'primary big', 'chevron', jName + ' menjawab dulu');
          } else {
            const secretPh = it.phase === 'secret';
            title = secretPh ? 'Jawaban rahasia ' + me.name : 'Tebak isi hati ' + jName;
            body = '<div class="note ' + (secretPh ? 'warn' : 'good') + '">' + ic(secretPh ? 'lock' : 'heart') + ' ' + (secretPh ? 'Jawab jujur tentang dirimu. ' + esc(owner.name) + ' tidak bisa melihatnya.' : 'Tebak jawaban ' + esc(jName) + '. Butuh ' + it.pz.need + ' cocok.') + '</div>' +
              qs.map((q, qi) => '<div class="ch-q"><b>' + (qi + 1) + '. ' + esc(chFill(q.q, it)) + '</b><div class="ch-opts">' + q.o.map((o, oi) => '<button type="button" class="ch-opt" data-sa="' + qi + ':' + oi + '" aria-pressed="' + (local.answers[qi] === oi) + '">' + esc(o) + '</button>').join('') + '</div></div>').join('');
            const all = qs.every((_, qi) => local.answers[qi] >= 0);
            foot = (secretPh ? '' : ownerBtns) + '<span class="grow"></span>' + btn('id="bChSend"', 'primary big', secretPh ? 'lock' : 'heart', secretPh ? 'Kunci jawaban' : 'Tebak!', !all);
          }
          return { kicker, title, who: whoLine(it.who), body, foot, hero };
        }
        if (ch.type === 'bluff') {
          if (it.phase === 'write') {
            body = task + how + rewardChips(def, ch, it) + [0, 1, 2].map(i => '<div class="bluff-row"><label class="sr-only" for="bl' + i + '">Pernyataan ' + (i + 1) + '</label><input class="input" id="bl' + i + '" maxlength="90" placeholder="Pernyataan ' + (i + 1) + '" value="' + esc(local.lines[i]) + '"><button type="button" class="lie-btn" data-lie="' + i + '" aria-pressed="' + (local.lie === i) + '">' + ic('question') + '<span>Bohong</span></button></div>').join('') +
              '<div class="tiny muted">Tandai satu yang bohong. ' + esc(jName) + ' tidak melihat tandanya.</div>';
            const okW = local.lines.every(x => x.trim().length >= 8) && local.lie >= 0;
            foot = ownerBtns + '<span class="grow"></span>' + btn('id="bChSend"', 'primary big', 'chevron', 'Kirim ke ' + jName, !okW);
          } else {
            title = 'Mana yang bohong?';
            body = '<div class="note">' + ic('question') + ' ' + esc(owner.name) + ' menulis 3 pernyataan. Satu bohong. Tebak yang mana!</div><div class="bluff-pick">' + it.pz.lines.map((l, i) => '<button type="button" class="ch-opt big" data-pick="' + i + '" aria-pressed="' + (local.pick === i) + '"><b>#' + (i + 1) + '</b> ' + esc(l) + '</button>').join('') + '</div>';
            foot = '<span class="grow"></span>' + btn('id="bChSend"', 'primary big', 'target', 'Ini yang bohong!', local.pick < 0);
          }
          return { kicker, title, who: whoLine(it.who), body, foot, hero };
        }
        if (ch.type === 'charades') {
          const z = it.pz;
          if (it.phase === 'act') {
            body = task + how + rewardChips(def, ch, it) + '<button type="button" class="ch-word' + (local.reveal ? ' on' : '') + '" id="bReveal" aria-pressed="' + local.reveal + '">' + (local.reveal ? '<b>' + esc(z.word) + '</b><span class="tiny">Ketuk untuk menyembunyikan</span>' : ic('lock') + '<span>Ketuk untuk melihat kata rahasia</span>') + '</button>';
            foot = ownerBtns + '<span class="grow"></span>' + btn('id="bChStep"', 'go big', 'play', 'Mulai peragakan!');
          } else {
            const c = clockOf(it, 'cr', z.secs);
            title = 'Tebak peragaan ' + owner.name;
            body = timerBar(c.left, z.secs) + '<div class="note">' + ic('users') + ' ' + esc(owner.name) + ' memperagakan tanpa suara. Ketik tebakanmu (' + (z.max - z.tries) + ' kesempatan lagi).</div>' +
              (z.guesses.length ? '<div class="ch-guesses">' + z.guesses.map(g => '<span class="chip plain">' + ic('x') + esc(g) + '</span>').join('') + '</div>' : '') +
              '<div class="field"><label for="chGuess">Tebakan</label><input class="input" id="chGuess" maxlength="40" autocomplete="off" value="' + esc(local.guess) + '"></div>';
            foot = btn('id="bChGiveUp"', 'ghost', 'x', 'Menyerah') + '<span class="grow"></span>' + btn('id="bChSend"', 'primary big', 'target', 'Tebak!', !local.guess.trim());
          }
          return { kicker, title, who: whoLine(it.who), body, foot, hero };
        }
        if (ch.type === 'message') {
          if (it.phase === 'write') {
            const checks = E.messageChecks(ch.rule || {}, local.text), allOk = checks.every(c => c.ok);
            body = task + rewardChips(def, ch, it) + '<div class="field"><label for="chText">Pesanmu (tiap baris = Enter)</label><textarea class="input" id="chText" maxlength="400" rows="5" placeholder="Tulis di sini…">' + esc(local.text) + '</textarea></div>' +
              '<ul class="ch-checks" id="chChecks">' + checks.map(c => '<li class="' + (c.ok ? 'ok' : '') + '">' + ic(c.ok ? 'check' : 'dot') + esc(c.label) + '</li>').join('') + '</ul>';
            foot = ownerBtns + '<span class="grow"></span>' + btn('id="bChSend"', 'primary big', 'letter', J ? 'Kirim ke ' + J.name : 'Kirim', !allOk);
          } else {
            title = 'Sahkan surat ' + owner.name + '?';
            body = '<div class="note good">' + ic('check') + ' Semua syarat sudah lolos cek otomatis.</div><div class="notepaper ch-letter">' + esc(it.pz.text).replace(/\n/g, '<br>') + '</div><div class="tiny muted">Tantangan: ' + esc(chFill(ch.text, it)) + '</div>';
            foot = btn('id="bJudgeNo"', 'soft', 'x', 'Tidak sah') + '<span class="grow"></span>' + btn('id="bJudgeOk" data-focus', 'primary big', 'check', 'Sah, manis!');
          }
          return { kicker, title, who: whoLine(it.who), body, foot, hero };
        }
        if (ch.type === 'dare' || ch.type === 'photo') {
          const crit = '<div class="ch-crit">' + ic('check') + '<span><b>Syarat sah:</b> ' + esc(chFill(ch.crit, it)) + '</span></div>';
          if (it.phase === 'do') {
            body = task + crit + how + rewardChips(def, ch, it);
            if (ch.type === 'dare') {
              const secs = it.pz.secs, c = local.timing ? clockOf(it, 'dare', secs) : null;
              body += c ? timerBar(c.left, secs) : '<div class="ch-stats"><span>' + ic('clock') + secs + ' detik</span><span>' + ic('users') + 'Dinilai ' + esc(jName) + '</span></div>';
              foot = ownerBtns + '<span class="grow"></span>' + (c ? '' : btn('id="bDareTime"', 'soft', 'clock', 'Mulai timer')) + btn('id="bChStep"', 'primary', 'check', 'Minta penilaian ' + jName);
            } else {
              body += '<div id="camHost" class="cam-host"></div>';
              foot = ownerBtns + '<span class="grow"></span>' + btn('id="bChSend"', 'primary big', 'polaroid', 'Kirim foto ke ' + jName, !local.photo);
            }
          } else {
            title = 'Sah atau tidak?';
            body = (ch.type === 'photo' ? '<figure class="proof-photo"><img src="' + it.pz.photo + '" alt="Foto bukti dari ' + esc(owner.name) + '"><figcaption>Foto bukti ' + esc(owner.name) + '</figcaption></figure>' : '') + task + crit +
              '<div class="tiny muted">Nilai dengan adil. Kalau sah, kamu juga dapat Love.</div>';
            foot = btn('id="bJudgeNo"', 'soft', 'x', 'Tidak sah') + '<span class="grow"></span>' + btn('id="bJudgeOk" data-focus', 'primary big', 'check', 'Sah!');
          }
          return { kicker, title, who: whoLine(it.who), body, foot, hero };
        }
        return null;
      },
      mount: m => {
        const it = head();
        if (!it || !E.CH[it.ch]) return;
        const ch = E.CH[it.ch], p = it.who;
        const send = extra => act(Object.assign({ type: 'CH_ANSWER', p }, extra || {}));
        on(m, '#bGate', () => { chSeen.who = it.who; refreshModal(); });
        if (local.gate) return;
        on(m, '#bRedraw', () => { local.started = false; local.answers = []; act({ type: 'CH_REDRAW', p: it.p }); });
        on(m, '#bSkip', () => act({ type: 'CH_RESOLVE', p: it.p, result: 'skip' }));
        $$('[data-opt]', m).forEach(b => b.addEventListener('click', () => act({ type: 'CH_RESOLVE', p: it.p, result: 'choice', choice: Number(b.dataset.opt) })));
        // auto
        on(m, '#bChGo', () => { local.started = true; refreshModal(); });
        const gh = m.querySelector('#chGame');
        if (gh) {
          if (!local.game) local.game = autoGame(gh, it, ch, (answers, ms) => { local.game = null; send({ answers, ms: Math.round(ms) }); });
          else local.game.reattach(gh);
          on(m, '#bChGiveUp', () => { if (local.game) local.game.finish(); });
          return;
        }
        // duel / judge
        on(m, '#bChStep', () => { stopTick(); send(); });
        $$('[data-sa]', m).forEach(b => b.addEventListener('click', () => { const [q, o] = b.dataset.sa.split(':').map(Number); local.answers[q] = o; SND.play('click'); refreshModal(); }));
        $$('[data-lie]', m).forEach(b => b.addEventListener('click', () => { local.lie = Number(b.dataset.lie); refreshModal(); }));
        $$('[data-pick]', m).forEach(b => b.addEventListener('click', () => { local.pick = Number(b.dataset.pick); SND.play('click'); refreshModal(); }));
        [0, 1, 2].forEach(i => { const el = m.querySelector('#bl' + i); if (el) el.addEventListener('input', () => { local.lines[i] = el.value; const sb = m.querySelector('#bChSend'); if (sb) sb.disabled = !(local.lines.every(x => x.trim().length >= 8) && local.lie >= 0); }); });
        on(m, '#bReveal', () => { local.reveal = !local.reveal; refreshModal(); });
        const gi = m.querySelector('#chGuess');
        if (gi) {
          gi.addEventListener('input', () => { local.guess = gi.value; const sb = m.querySelector('#bChSend'); if (sb) sb.disabled = !gi.value.trim(); });
          gi.addEventListener('keydown', e => { if (e.key === 'Enter' && gi.value.trim()) { e.preventDefault(); m.querySelector('#bChSend').click(); } });
          setTimeout(() => { try { gi.focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }, 60);
        }
        const ta = m.querySelector('#chText');
        if (ta) {
          ta.addEventListener('input', () => {
            local.text = ta.value;
            const checks = E.messageChecks(ch.rule || {}, ta.value);
            const ul = m.querySelector('#chChecks');
            if (ul) ul.innerHTML = checks.map(c => '<li class="' + (c.ok ? 'ok' : '') + '">' + ic(c.ok ? 'check' : 'dot') + esc(c.label) + '</li>').join('');
            const sb = m.querySelector('#bChSend'); if (sb) sb.disabled = !checks.every(c => c.ok);
          });
        }
        on(m, '#bChSend', () => {
          if (ch.type === 'secret') send({ answers: local.answers.slice(0, it.pz.qs.length) });
          else if (ch.type === 'bluff') { if (it.phase === 'write') send({ lines: local.lines, lie: local.lie }); else send({ pick: local.pick }); }
          else if (ch.type === 'charades') { const g = local.guess; local.guess = ''; send({ guess: g }); }
          else if (ch.type === 'message') send({ text: local.text });
          else if (ch.type === 'photo') send({ photo: local.photo });
          local.answers = []; local.pick = -1;
        });
        on(m, '#bChGiveUp', () => send({ giveUp: true }));
        on(m, '#bJudgeOk', () => send({ ok: true }));
        on(m, '#bJudgeNo', () => send({ ok: false }));
        on(m, '#bDareTime', () => { local.timing = true; refreshModal(); });
        // detik berjalan (Peragakan! & timer aksi): hanya perbarui bar, tidak menggambar ulang dialog
        stopTick();
        const tb = m.querySelector('.ch-timer');
        if (tb && (ch.type === 'charades' || ch.type === 'dare')) {
          const secs = ch.type === 'charades' ? it.pz.secs : it.pz.secs, tag = ch.type === 'charades' ? 'cr' : 'dare';
          local.tick = setInterval(() => {
            const c = clockOf(it, tag, secs);
            tb.classList.toggle('hurry', c.left < 5000);
            tb.querySelector('i').style.setProperty('--v', (c.left / (secs * 1000) * 100).toFixed(1) + '%');
            tb.querySelector('b').textContent = Math.ceil(c.left / 1000);
            if (c.left <= 0) { stopTick(); SND.play('bad'); if (ch.type === 'charades') send({ giveUp: true }); }
          }, 200);
        }
        const camHost = m.querySelector('#camHost');
        if (camHost) {
          if (local.cam) local.cam.reattach(camHost);
          else local.cam = cameraBox(camHost, url => { local.photo = url; const sb = m.querySelector('#bChSend'); if (sb) sb.disabled = !url; const sb2 = document.querySelector('#modalRoot #bChSend'); if (sb2) sb2.disabled = !url; });
        }
      }
    });
  }

  // ----- mini-game berwaktu (auto). Jawaban dikirim ke engine yang menilai; umpan balik instan memakai E.chSolve -----
  function autoGame(host, it, ch, done) {
    const z = it.pz, sol = E.chSolve(it) || [], t0 = performance.now(), secs = z.secs;
    const items = z.qs || z.items || [];
    let el = host, idx = 0, answers = [], streak = 0, tick = 0, over = false, phase = ch.type === 'recall' ? 'show' : 'play', seq = [], showT0 = performance.now();
    const left = () => Math.max(0, secs * 1000 - (performance.now() - t0));
    const finish = () => { if (over) return; over = true; clearInterval(tick); done(ch.type === 'recall' ? seq.slice() : answers.slice(), performance.now() - t0); };
    const feedback = ok => { streak = ok ? streak + 1 : 0; SND.play(ok ? (streak >= 2 ? 'coin' : 'good') : 'bad'); el.classList.remove('hit', 'miss'); void el.offsetWidth; el.classList.add(ok ? 'hit' : 'miss'); };
    const next = v => {
      answers[idx] = v;
      const ok = ch.type === 'price' ? Math.abs(Number(v) - sol[idx]) <= sol[idx] * z.tol : ch.type === 'scramble' ? String(v).toLowerCase().replace(/[^a-z]/g, '') === String(sol[idx]).toLowerCase().replace(/[^a-z]/g, '') : Number(v) === sol[idx];
      feedback(ok);
      idx++;
      if (idx >= items.length) { setTimeout(finish, 280); return; }
      setTimeout(draw, 260);
    };
    const head2 = () => timerBar(left(), secs) + '<div class="ch-prog"><span>' + (ch.type === 'recall' ? (phase === 'show' ? 'Hafalkan!' : 'Ulangi urutannya') : 'Soal ' + Math.min(idx + 1, items.length) + '/' + items.length) + '</span>' + (streak >= 2 ? '<span class="ch-streak">' + ic('bolt') + 'Combo ×' + streak + '</span>' : '') + '</div>';
    function draw() {
      if (over) return;
      let h = head2();
      if (ch.type === 'trivia' || ch.type === 'emoji') {
        const q = items[idx];
        h += (ch.type === 'emoji' ? '<div class="ch-emoji" aria-label="Petunjuk emoji">' + q.e + '</div><div class="ch-qtxt">Tempat mana ini?</div>' : '<div class="ch-qtxt">' + esc(q.t) + '</div>') +
          '<div class="ch-opts grid">' + q.o.map((o, k) => '<button type="button" class="ch-opt big" data-ans="' + k + '">' + esc(o) + '</button>').join('') + '</div>';
      } else if (ch.type === 'price') {
        const t = TILES[items[idx]];
        h += '<div class="ch-city"><span class="cc-art">' + ART.art(t.art) + '</span><b>' + esc(t.name) + '</b></div><form class="ch-in" id="chForm"><label class="sr-only" for="chNum">Harga ' + esc(t.name) + '</label><input class="input num" id="chNum" inputmode="numeric" autocomplete="off" placeholder="Harga beli…"><button class="btn primary" type="submit">' + ic('check') + '<span>Kunci</span></button></form>';
      } else if (ch.type === 'math') {
        h += '<div class="ch-qtxt big">' + esc(items[idx].t) + '</div><form class="ch-in" id="chForm"><label class="sr-only" for="chNum">Jawaban</label><input class="input num" id="chNum" inputmode="numeric" autocomplete="off" placeholder="Jawaban…"><button class="btn primary" type="submit">' + ic('check') + '<span>Kunci</span></button></form>';
      } else if (ch.type === 'scramble') {
        h += '<div class="ch-tiles" aria-label="Huruf acak">' + items[idx].w.split('').map(c => c === ' ' ? '<i class="sp"></i>' : '<span>' + esc(c) + '</span>').join('') + '</div><form class="ch-in" id="chForm"><label class="sr-only" for="chNum">Nama tempat</label><input class="input" id="chNum" autocomplete="off" autocapitalize="words" placeholder="Nama tempat…"><button class="btn primary" type="submit">' + ic('check') + '<span>Kunci</span></button></form>';
      } else if (ch.type === 'recall') {
        if (phase === 'show') h += '<div class="rc-seq show">' + z.seq.map((k, i) => '<span class="rc-cell" style="--i:' + i + '">' + ART.art(k) + '</span>').join('') + '</div>';
        else h += '<div class="rc-seq">' + z.seq.map((_, i) => '<span class="rc-cell slot">' + (seq[i] ? ART.art(seq[i]) : '<i>' + (i + 1) + '</i>') + '</span>').join('') + '</div>' +
          '<div class="rc-pool">' + z.pool.map(k => '<button type="button" class="rc-btn" data-rc="' + k + '" aria-label="' + esc((TILES.find(t => t.art === k) || {}).name || k) + '">' + ART.art(k) + '</button>').join('') + '</div>' +
          '<div class="ch-in">' + btn('id="rcUndo"', 'ghost', 'back', 'Hapus', !seq.length) + '</div>';
      }
      el.innerHTML = h;
      $$('[data-ans]', el).forEach(b => b.addEventListener('click', () => next(Number(b.dataset.ans))));
      const f = el.querySelector('#chForm');
      if (f) {
        const inp = f.querySelector('input');
        f.addEventListener('submit', e => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; next(ch.type === 'scramble' ? v : Number(v.replace(/[^\d-]/g, ''))); });
        setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }, 30);
      }
      $$('[data-rc]', el).forEach(b => b.addEventListener('click', () => {
        if (seq.length >= z.seq.length) return;
        seq.push(b.dataset.rc);
        const ok = seq[seq.length - 1] === z.seq[seq.length - 1];
        SND.play(ok ? 'click' : 'bad');
        if (seq.length >= z.seq.length) { feedback(seq.every((x, i) => x === z.seq[i])); setTimeout(finish, 300); }
        draw();
      }));
      const u = el.querySelector('#rcUndo'); if (u) u.addEventListener('click', () => { seq.pop(); draw(); });
    }
    tick = setInterval(() => {
      if (over) return;
      if (phase === 'show' && performance.now() - showT0 >= z.showMs) { phase = 'play'; draw(); return; }
      const bar = el.querySelector('.ch-timer');
      if (bar) { const l = left(); bar.classList.toggle('hurry', l < 5000); bar.querySelector('i').style.setProperty('--v', (l / (secs * 1000) * 100).toFixed(1) + '%'); bar.querySelector('b').textContent = Math.ceil(l / 1000); }
      if (left() <= 0) { SND.play('bad'); finish(); }
    }, 150);
    draw();
    return { finish, reattach(h) { el = h; draw(); } };
  }

  // ----- kamera foto bukti: pratinjau langsung + hitung mundur 3-2-1, cadangan unggah/ambil foto dari galeri.
  // Foto dikecilkan (≈ 240 px, JPEG) supaya muat di state permainan & room online. -----
  function cameraBox(host, onShot) {
    let el = host, stream = null, url = '', err = '', counting = 0, cdT = 0;
    const shrink = src => new Promise(res => {
      const draw = (w, q) => {
        const c = document.createElement('canvas'), r = src.videoWidth ? src.videoHeight / src.videoWidth : src.height / src.width;
        c.width = w; c.height = Math.round(w * r);
        const g = c.getContext('2d');
        if (src.videoWidth) { g.translate(w, 0); g.scale(-1, 1); }
        g.drawImage(src, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', q);
      };
      let w = 260, q = 0.62, out = draw(w, q);
      while (out.length > 20000 && w > 140) { w -= 30; q = Math.max(0.4, q - 0.05); out = draw(w, q); }
      res(out.length <= 21500 ? out : '');
    });
    const stop = () => { clearInterval(cdT); if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };
    async function open() {
      err = '';
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
      } catch (e) { err = 'Kamera tidak bisa dibuka. Pakai tombol unggah foto di bawah.'; }
      draw();
    }
    function draw() {
      const live = !!stream && !url;
      el.innerHTML = '<div class="cam-frame' + (url ? ' shot' : '') + '">' +
        (url ? '<img src="' + url + '" alt="Foto bukti">' : live ? '<video id="camVid" playsinline muted autoplay></video>' : '<div class="cam-empty">' + ic('polaroid') + '<span>' + esc(err || 'Buka kamera untuk foto bukti') + '</span></div>') +
        (counting ? '<b class="cam-cd" aria-live="assertive">' + counting + '</b>' : '') + '</div>' +
        '<div class="cam-bar">' + (url ? btn('id="camRetake"', 'soft', 'refresh', 'Foto ulang') : live ? btn('id="camSnap" data-focus', 'go', 'polaroid', counting ? 'Siap…' : 'Cekrek (3 dtk)', !!counting) : btn('id="camOpen"', 'primary', 'polaroid', 'Buka kamera')) +
        '<label class="btn ghost cam-file">' + ic('plus') + '<span>Unggah foto</span><input type="file" accept="image/*" capture="user" id="camFile" class="sr-only"></label></div>';
      const v = el.querySelector('#camVid'); if (v && stream) { v.srcObject = stream; v.play().catch(() => {}); }
      const o = el.querySelector('#camOpen'); if (o) o.addEventListener('click', open);
      const r = el.querySelector('#camRetake'); if (r) r.addEventListener('click', () => { url = ''; onShot(''); if (!stream) open(); else draw(); });
      const sn = el.querySelector('#camSnap');
      if (sn) sn.addEventListener('click', () => {
        counting = 3; SND.play('click'); draw();
        cdT = setInterval(async () => {
          counting--;
          if (counting > 0) { SND.play('click'); draw(); return; }
          clearInterval(cdT);
          const vid = el.querySelector('#camVid');
          SND.play('stamp');
          url = vid ? await shrink(vid) : '';
          if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
          onShot(url); draw();
        }, 800);
      });
      const f = el.querySelector('#camFile');
      if (f) f.addEventListener('change', () => {
        const file = f.files && f.files[0]; if (!file) return;
        const img = new Image();
        img.onload = async () => { url = await shrink(img); URL.revokeObjectURL(img.src); if (!url) err = 'Foto terlalu besar, coba lagi.'; stop(); onShot(url); draw(); };
        img.src = URL.createObjectURL(file);
      });
    }
    draw();
    return { stop, reattach(h) { el = h; draw(); } };
  }

  // galeri foto bukti (dibuka dari polaroid di papan & layar akhir)
  function openProofs() {
    showModal({
      key: 'proofs', size: 'mid',
      build: () => {
        const S = App.S, ph = (S && S.photos) || [], pr = (S && S.proofs) || [];
        const photos = ph.length ? '<div class="proof-grid">' + ph.slice().reverse().map(x => '<figure class="proof-photo' + (x.ok ? '' : ' no') + '"><img src="' + x.img + '" alt="Foto bukti ' + esc(S.players[x.p].name) + '"><figcaption><span class="pc-who"><b>' + esc(S.players[x.p].name) + '</b> · ronde ' + x.r + '</span><span class="' + (x.ok ? 'ok' : 'bad') + '">' + ic(x.ok ? 'check' : 'x') + (x.ok ? 'Disahkan' : 'Ditolak') + (x.judge >= 0 ? ' ' + esc(S.players[x.judge].name) : '') + '</span><small>' + esc(x.text) + '</small></figcaption></figure>').join('') + '</div>' : '<div class="empty">' + ic('polaroid') + 'Belum ada foto bukti. Kartu Foto Bukti membuka kamera.</div>';
        const list = pr.length ? '<ul class="proof-list">' + pr.slice().reverse().slice(0, 12).map(x => '<li class="' + (x.ok ? 'ok' : 'bad') + '">' + ic(x.ok ? 'check' : 'x') + '<span><b>' + esc(S.players[x.p].name) + '</b> · ' + esc(x.label) + '<small>' + esc(x.proof) + '</small></span></li>').join('') + '</ul>' : '';
        return { kicker: ic('polaroid') + 'Bukti tantangan', title: 'Galeri Bukti', body: photos + (list ? '<h3 class="mini-h">Riwayat tantangan</h3>' + list : ''), foot: '<span class="grow"></span>' + btn('id="bPfClose" data-focus', 'primary', 'check', 'Tutup') };
      },
      mount: m => on(m, '#bPfClose', () => closeModal())
    });
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
      can: i => i !== E.TRAVEL && i !== E.ISLAND && P.cash >= E.travelFee(App.S),
      tap: i => { def.sel = [i]; },
      ready: () => def.sel.length === 1,
      hint: () => {
        if (P.cash < E.travelFee(App.S)) return 'Uangmu kurang untuk tiket ' + E.travelFee(App.S) + '. Lempar dadu biasa.';
        if (!def.sel.length) return 'Ketuk petak tujuan mana pun. ' + (E.travelFee(App.S) ? 'Tiket ' + E.travelFee(App.S) : 'Tiket gratis (Promo Maskapai)') + '. Lewat START tetap dapat gaji.';
        const t = TILES[def.sel[0]], st = S.tiles[def.sel[0]];
        let s = 'Terbang ke ' + t.name + '. ';
        if (t.price) s += st.owner < 0 ? 'Bisa dibeli (' + fmt(E.buyCost(S, p, t.i, 0)) + ').' : st.owner === p ? 'Kotamu: bisa dibangun.' : 'Milik ' + pname(st.owner) + ': tol ' + fmt(E.rentFor(S, t.i, p)) + '!';
        else s += t.desc || '';
        return s;
      },
      okLabel: () => def.sel.length ? 'Terbang · ' + (E.travelFee(App.S) || 'gratis') : 'Pilih tujuan',
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
          if (t.type === 'travel') body += '<div class="kv"><span>Tiket terbang</span><b>' + (E.travelFee(S) || 'Gratis') + '</b></div>';
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
    showModal, refreshModal, closeModal, syncModal, openDecision, openPortfolio, onTileClick, openMenu, openHistory, openSettings, openExit, btn, cityHero, openProofs
  });
})(typeof window !== 'undefined' ? window : globalThis);
