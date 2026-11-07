/* LOVEOPOLY — dialog permainan › pilih petak (festival, bangun, kartu aksi, World Tour) (dikumpulkan lewat src/ui/modals.js) */
import { App, E, TILES, RULES, fmt, pname, act } from '../core.js';
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
    title: META.title,
    skipLabel: META.skip,
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
          ? 'Langkah 1: ketuk kotamu yang mau diberikan.'
          : def.sel.length === 1
            ? 'Langkah 2: ketuk kota lawan yang mau diambil (' + TILES[def.sel[0]].name + ' akan diberikan).'
            : TILES[def.sel[0]].name + ' ↔ ' + TILES[def.sel[1]].name;
      if (def.sel.length) {
        const t = TILES[def.sel[0]];
        if (it.kind === 'festival') return t.name + ': tol jadi ' + fmt(festPreview(S, def.sel[0])) + '.';
        if (it.kind === 'storm')
          return t.name + ' milik ' + pname(S.tiles[def.sel[0]].owner) + ' turun jadi ' + E.LEVEL_NAME[S.tiles[def.sel[0]].level - 1] + '.';
        if (it.kind === 'renov') return t.name + ' naik jadi ' + E.LEVEL_NAME[E.upgradeLevels(S, p, def.sel[0])[0]] + '.';
        return t.name + ' dipilih.';
      }
      return META.hint;
    },
    okLabel: () => META.ok,
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
    title: 'World Tour',
    skipLabel: 'Lempar dadu biasa',
    can: i => i !== E.TRAVEL && i !== E.ISLAND && P.cash >= E.travelFee(App.S),
    tap: i => {
      def.sel = [i];
    },
    ready: () => def.sel.length === 1,
    hint: () => {
      if (P.cash < E.travelFee(App.S)) return 'Uangmu kurang untuk tiket ' + E.travelFee(App.S) + '. Lempar dadu biasa.';
      if (!def.sel.length)
        return (
          'Ketuk petak tujuan mana pun. ' +
          (E.travelFee(App.S) ? 'Tiket ' + E.travelFee(App.S) : 'Tiket gratis (Promo Maskapai)') +
          '. Lewat START tetap dapat gaji.'
        );
      const t = TILES[def.sel[0]],
        st = S.tiles[def.sel[0]];
      let s = 'Terbang ke ' + t.name + '. ';
      if (t.price)
        s +=
          st.owner < 0
            ? 'Bisa dibeli (' + fmt(E.buyCost(S, p, t.i, 0)) + ').'
            : st.owner === p
              ? 'Kotamu: bisa dibangun.'
              : 'Milik ' + pname(st.owner) + ': tol ' + fmt(E.rentFor(S, t.i, p)) + '!';
      else s += t.desc || '';
      return s;
    },
    okLabel: () => (def.sel.length ? 'Terbang · ' + (E.travelFee(App.S) || 'gratis') : 'Pilih tujuan'),
    confirm: () => act({ type: 'TOUR_GO', p, tile: def.sel[0] }),
    skip: () => act({ type: 'TOUR_SKIP', p }),
  };
  UI.startPick(def);
}

export { pTarget, pTour };
