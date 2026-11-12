/* LOVEOPOLY — dialog permainan › info petak, aset pemain, riwayat (dikumpulkan lewat src/ui/modals.js) */
import { Icons } from '../../assets/icons.js';
import { App, D, E, ART, TILES, GROUPS, RULES, fmt, esc, ic, $$, viewer, coin, avatarHTML, t as tr, tile, tLog } from '../core.js';

const T = x => esc(tr(x));
import { UI } from '../ns.js';
import { LV_ART, btn, cityHero, closeModal, groupProgress, on, showModal, tollIf } from './base.js';

// ---------- info petak ----------
function onTileClick(i) {
  const t = TILES[i];
  showModal({
    key: 'tile' + i,
    size: 'mid',
    build: () => {
      const S = App.S,
        st = S.tiles[i],
        v = viewer();
      const here = S.players.filter(p => p.pos === i && !p.bankrupt);
      let body = '';
      if (t.type === 'city') {
        body += cityHero(S, i);
        const owner = st.owner;
        body +=
          '<div class="ladder">' +
          [0, 1, 2, 3, 4]
            .map(k => {
              const toll = owner >= 0 ? tollIf(S, owner, i, k) : Math.round((t.price * RULES.rentMult[k]) / 5) * 5;
              return (
                '<div class="ld-row' +
                (owner >= 0 && st.level === k ? ' cur' : '') +
                (k === 4 ? ' lm' : '') +
                '"><span class="ld-art">' +
                ART.art(LV_ART[k]) +
                '</span><b>' +
                T(E.LEVEL_NAME[k]) +
                '</b><span class="ld-cost">' +
                (k === 0 ? T('Harga') + ' ' : '+') +
                fmt(E.levelCost(i, k)) +
                '</span><span class="ld-toll">' +
                esc(tr('Tol {n}', { n: toll })) +
                '</span></div>'
              );
            })
            .join('') +
          '</div>';
        body +=
          '<div class="tiny muted">' +
          esc(
            tr('Grup penuh: tol ×{m}. Festival: ×2/×3. Hotel setelah 1 putaran, Landmark saat mampir ke kota ber-Hotel.', {
              m: RULES.groupMult,
            })
          ) +
          '</div>';
        if (owner >= 0 && S.settings.takeover)
          body +=
            st.level === 4
              ? '<div class="note gold">' + ic('crown') + ' ' + T('Landmark: kebal diambil alih.') + '</div>'
              : '<div class="kv"><span>' + T('Harga ambil alih') + '</span><b>' + fmt(E.takeoverPrice(S, i)) + '</b></div>';
        body += groupProgress(S, owner >= 0 ? owner : v, i);
      } else if (t.type === 'spot') {
        body +=
          cityHero(S, i) +
          '<div class="spot-table">' +
          RULES.spotRent
            .map(
              (r, k) =>
                '<span class="' +
                (st.owner >= 0 && k === E.spotsOf(S, st.owner).length - 1 ? 'cur' : '') +
                '"><b>' +
                esc(tr('{n} wisata', { n: k + 1 })) +
                '</b>' +
                esc(tr('Tol {n}', { n: r })) +
                '</span>'
            )
            .join('') +
          '</div>' +
          '<div class="note">' +
          ic('shield') +
          ' ' +
          T('Wisata tidak bisa diambil alih.') +
          (S.settings.instantWin ? ' ' + T('Kuasai kelima wisata untuk menang instan!') : '') +
          '</div>' +
          groupProgress(S, st.owner >= 0 ? st.owner : v, i);
      } else {
        body +=
          '<div class="special-hero"><span class="hero-art">' + ART.art(t.art) + '</span><p class="lead">' + T(t.desc || '') + '</p></div>';
        if (t.type === 'start')
          body +=
            '<div class="kv"><span>' +
            T('Gaji dasar') +
            '</span><b>' +
            fmt(RULES.salary) +
            '</b></div><div class="tiny muted">' +
            T('+10 sampai +40 sesuai Love Meter.') +
            '</div>';
        if (t.type === 'travel')
          body +=
            '<div class="kv"><span>' +
            T('Tiket terbang') +
            '</span><b>' +
            (E.travelFee(S) ? fmt(E.travelFee(S)) : T('Gratis')) +
            '</b></div>';
        if (t.type === 'island') body += '<div class="kv"><span>' + T('Biaya perahu') + '</span><b>' + fmt(RULES.islandFee) + '</b></div>';
        if (t.type === 'fest' && S.festival.tile >= 0)
          body +=
            '<div class="note">' +
            ic('party') +
            ' ' +
            esc(tr('Festival sedang di {c} (tol ×{m}).', { c: { tile: S.festival.tile }, m: S.festival.mult })) +
            '</div>';
      }
      E.winThreats(S)
        .filter(x => x.tile === i)
        .forEach(x => {
          body +=
            '<div class="note warn">' +
            ic('alert') +
            ' ' +
            esc(tr('{n} butuh petak ini untuk {w}.', { n: S.players[x.p].name, w: UI.winLabel(x) })) +
            '</div>';
        });
      if (here.length)
        body +=
          '<div class="tiny muted here">' + T('Di sini:') + ' ' + here.map(p => avatarHTML(p, 'xs') + esc(p.name)).join(' ') + '</div>';
      return {
        title: tile(i),
        kicker:
          t.type === 'city'
            ? ic('house') + T('Kota§petak')
            : t.type === 'spot'
              ? ic('ferris') + T('Wisata')
              : ic('sparkle') + T('Petak spesial'),
        body,
        foot: '<span class="grow"></span>' + btn('id="tdClose"', 'primary', 'check', 'Tutup'),
      };
    },
    mount: m => {
      on(m, '#tdClose', () => closeModal());
    },
  });
}

// ---------- aset pemain ----------
function openPortfolio(pi) {
  if (pi == null || pi < 0) pi = viewer();
  showModal({
    key: 'pf',
    size: 'wide',
    player: pi,
    build: () => {
      const S = App.S,
        p = S.players[pi];
      const tier = E.tierInfo(p.love);
      const own = E.ownedBy(S, pi);
      const list = own.length
        ? '<div class="pf-grid">' +
          own
            .map(t => {
              const tl = TILES[t],
                st = S.tiles[t];
              return (
                '<button type="button" class="pf-item" data-tile="' +
                t +
                '" style="--g:' +
                (tl.group ? GROUPS[tl.group].color : '#B79CFF') +
                ';--oc:' +
                p.color +
                '"><span class="pf-art">' +
                ART.art(tl.art) +
                (tl.type === 'city' && st.level ? '<span class="pf-bld">' + ART.art(LV_ART[st.level]) + '</span>' : '') +
                '</span><b>' +
                esc(tile(t)) +
                '</b><span>' +
                T(tl.type === 'city' ? E.LEVEL_NAME[st.level] : 'Wisata') +
                (S.festival.tile === t ? ' · ×' + S.festival.mult : '') +
                '</span><span class="pf-toll">' +
                esc(tr('Tol {n}', { n: E.rentInfo(S, t).amount })) +
                '</span></button>'
              );
            })
            .join('') +
          '</div>'
        : '<div class="empty">' + ic('house') + T('Belum punya kota. Mendarat di petak kosong untuk membeli.') + '</div>';
      const held = p.cards.length
        ? '<div class="held">' +
          p.cards
            .map(c => {
              const k = E.CARD[c].power;
              return (
                '<div class="held-card">' +
                ic(D.POWER[k].icon) +
                '<div><b>' +
                T(D.POWER[k].name) +
                '</b><span>' +
                T(D.POWER[k].desc) +
                '</span></div></div>'
              );
            })
            .join('') +
          '</div>'
        : '<div class="tiny muted">' +
          T('Belum ada kartu simpanan. Kartu Malaikat, Kupon, dan Tiket Pulang didapat dari Kartu Cinta.') +
          '</div>';
      const groups = E.fullGroups(S, pi);
      const ach =
        '<div class="ach-list">' +
        D.ACHIEVEMENTS.map(
          a =>
            '<span class="ach' +
            (p.achievements.includes(a.id) ? '' : ' locked') +
            '" title="' +
            T(a.text) +
            '">' +
            ic(a.icon in Icons.paths ? a.icon : 'trophy') +
            T(a.name) +
            '</span>'
        ).join('') +
        '</div>';
      return {
        title: p.name,
        kicker: ic('briefcase') + T('Aset pemain'),
        who:
          avatarHTML(p, 'xs') +
          '<span>' +
          (p.kind === 'ai' ? 'AI ' + esc(p.ai) : T('Pemain')) +
          ' · ' +
          T(tier.name) +
          ' (Love ' +
          p.love +
          ')</span>',
        body:
          '<div class="pf-stats"><div><span>' +
          T('Uang') +
          '</span><b>' +
          coin +
          fmt(p.cash) +
          '</b></div><div><span>' +
          T('Total aset') +
          '</span><b>' +
          fmt(E.netWorth(S, pi)) +
          '</b></div><div><span>' +
          T('Tol diterima') +
          '</span><b>' +
          fmt(p.stats.tollIn) +
          '</b></div><div><span>' +
          T('Grup penuh') +
          '</span><b>' +
          groups.length +
          '</b></div></div>' +
          '<div class="sec-title">' +
          esc(tr('Kota & wisata ({n})', { n: own.length })) +
          '</div>' +
          list +
          '<div class="sec-title">' +
          T('Kartu simpanan') +
          '</div>' +
          held +
          '<div class="sec-title">' +
          T('Achievement') +
          '</div>' +
          ach,
        foot: '<span class="grow"></span>' + btn('id="pfClose"', 'primary', 'check', 'Tutup'),
      };
    },
    mount: m => {
      on(m, '#pfClose', () => closeModal());
      $$('[data-tile]', m).forEach(b => b.addEventListener('click', () => onTileClick(Number(b.dataset.tile))));
    },
  });
}

function openHistory() {
  showModal({
    key: 'hist',
    size: 'mid',
    build: () => {
      const S = App.S;
      const items = S.log
        .slice()
        .reverse()
        .map(
          l =>
            '<li><span class="bub" style="--c:' +
            (l.p >= 0 && S.players[l.p] ? S.players[l.p].color : 'var(--ink-3)') +
            '">' +
            ic(l.icon in Icons.paths ? l.icon : 'dot') +
            '</span><span>' +
            esc(tLog(l)) +
            '<small>' +
            esc(tr('Ronde {r}', { r: l.r })) +
            '</small></span></li>'
        )
        .join('');
      return {
        title: 'Riwayat',
        kicker: ic('history') + T('Semua kejadian'),
        body: '<ul class="log full">' + items + '</ul>',
        foot: '<span class="grow"></span>' + btn('id="hClose"', 'primary', 'check', 'Tutup'),
      };
    },
    mount: m => on(m, '#hClose', () => closeModal()),
  });
}

export { onTileClick, openHistory, openPortfolio };
