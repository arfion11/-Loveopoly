/* LOVEOPOLY — dialog permainan › pilih petak (festival, bangun, kartu aksi, World Tour) (dikumpulkan lewat src/ui/modals.js) */
import { App, E, TILES, RULES, pname, act, t as tr, tile } from '../core.js';
import { UI } from '../ns.js';
import { head } from './base.js';

// ---------- pilih petak (festival, bangun, kartu aksi, World Tour) ----------
function pTarget(key) {
  const S = App.S,
    it = head();
  if (!it || it.type !== 'TARGET') return;
  const p = it.p;
  const cand = new Set(E.targetCandidates(S, p, it.kind));
  const theirs = new Set(it.kind === 'swap' ? E.swapTargets(S, p) : []);
  const META = {
    festival: {
      title: 'Festival Cinta',
      art: 'festival',
      ok: 'Adakan Festival',
      skip: 'Lewati',
      hint: 'Ketuk kotamu yang menyala. Tolnya jadi ×2 (×3 kalau festival lagi di kota yang sama).',
    },
    build: { title: 'Bangun dari START', art: 'start', ok: 'Pilih Kota', skip: 'Lewati', hint: 'Ketuk kotamu yang mau dibangun.' },
    renov: { title: 'Renovasi Gratis', art: 'b2', ok: 'Renovasi', skip: 'Lewati', hint: 'Ketuk kotamu: naik 1 tingkat gratis.' },
    storm: {
      title: 'Badai Rindu',
      art: 'card',
      ok: 'Kirim Badai',
      skip: 'Lewati',
      hint: 'Ketuk kota lawan yang menyala: bangunannya turun 1 tingkat.',
    },
    swap: { title: 'Tukar Kota', art: 'card', ok: 'Tukar', skip: 'Lewati', hint: '' },
  }[it.kind];
  const def = {
    key,
    sel: [],
    art: META.art,
    title: tr(META.title),
    skipLabel: tr(META.skip),
    can: i => (it.kind === 'swap' ? (def.sel.length === 0 ? cand.has(i) : theirs.has(i) || i === def.sel[0]) : cand.has(i)),
    tap: i => {
      if (it.kind === 'swap') {
        if (def.sel.length === 0) def.sel = [i];
        else if (i === def.sel[0]) def.sel = [];
        else def.sel = [def.sel[0], i];
      } else def.sel = [i];
    },
    ready: () => (it.kind === 'swap' ? def.sel.length === 2 : def.sel.length === 1),
    hint: () => {
      if (it.kind === 'swap')
        return def.sel.length === 0
          ? tr('Langkah 1: ketuk kotamu yang mau diberikan.')
          : def.sel.length === 1
            ? tr('Langkah 2: ketuk kota lawan yang mau diambil ({c} akan diberikan).', { c: tile(def.sel[0]) })
            : tile(def.sel[0]) + ' ↔ ' + tile(def.sel[1]);
      if (def.sel.length) {
        const c = { tile: def.sel[0] };
        if (it.kind === 'festival') return tr('{c}: tol jadi {n}.', { c, n: festPreview(S, def.sel[0]) });
        if (it.kind === 'storm')
          return tr('{c} milik {o} turun jadi {l}.', {
            c,
            o: pname(S.tiles[def.sel[0]].owner),
            l: { t: E.LEVEL_NAME[S.tiles[def.sel[0]].level - 1] },
          });
        if (it.kind === 'renov') return tr('{c} naik jadi {l}.', { c, l: { t: E.LEVEL_NAME[E.upgradeLevels(S, p, def.sel[0])[0]] } });
        return tr('{c} dipilih.', { c });
      }
      return tr(META.hint);
    },
    okLabel: () => tr(META.ok),
    confirm: () =>
      act(
        it.kind === 'swap' ? { type: 'TARGET_PICK', p, tile: def.sel[0], tile2: def.sel[1] } : { type: 'TARGET_PICK', p, tile: def.sel[0] }
      ),
    skip: () => act({ type: 'TARGET_SKIP', p }),
  };
  UI.startPick(def);
}
function festPreview(S, ti) {
  const mult = S.festival.tile === ti ? Math.min(RULES.festivalMax, S.festival.mult + 1) : 2;
  const r = E.rentInfo(S, ti);
  const base = r ? r.amount / (S.festival.tile === ti ? S.festival.mult : 1) : 0;
  return Math.round((base * mult) / 5) * 5;
}
function pTour(key) {
  const S = App.S,
    it = head();
  if (!it || it.type !== 'TOUR') return;
  const p = it.p,
    P = S.players[p];
  const def = {
    key,
    sel: [],
    art: 'plane',
    title: tr('World Tour'),
    skipLabel: tr('Lempar dadu biasa'),
    can: i => i !== E.TRAVEL && i !== E.ISLAND && P.cash >= E.travelFee(App.S),
    tap: i => {
      def.sel = [i];
    },
    ready: () => def.sel.length === 1,
    hint: () => {
      if (P.cash < E.travelFee(App.S)) return tr('Uangmu kurang untuk tiket {f}. Lempar dadu biasa.', { f: E.travelFee(App.S) });
      if (!def.sel.length)
        return (
          tr('Ketuk petak tujuan mana pun.') +
          ' ' +
          (E.travelFee(App.S) ? tr('Tiket {f}', { f: E.travelFee(App.S) }) : tr('Tiket gratis (Promo Maskapai)')) +
          '. ' +
          tr('Lewat START tetap dapat gaji.')
        );
      const t = TILES[def.sel[0]],
        st = S.tiles[def.sel[0]];
      let s = tr('Terbang ke {c}.', { c: tile(t.i) }) + ' ';
      if (t.price)
        s +=
          st.owner < 0
            ? tr('Bisa dibeli ({n}).', { n: E.buyCost(S, p, t.i, 0) })
            : st.owner === p
              ? tr('Kotamu: bisa dibangun.')
              : tr('Milik {o}: tol {n}!', { o: pname(st.owner), n: E.rentFor(S, t.i, p) });
      else s += tr(t.desc || '');
      return s;
    },
    okLabel: () => (def.sel.length ? tr('Terbang · {f}', { f: E.travelFee(App.S) || { t: 'gratis' } }) : tr('Pilih tujuan')),
    confirm: () => act({ type: 'TOUR_GO', p, tile: def.sel[0] }),
    skip: () => act({ type: 'TOUR_SKIP', p }),
  };
  UI.startPick(def);
}

export { pTarget, pTour };
