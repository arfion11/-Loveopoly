/* LOVEOPOLY — engine aturan › pembuatan game (dikumpulkan lewat src/engine/engine.js) */
import { D } from '../data.js';
import { AI_LEVELS, CARDS, PL, RULES, TILES, clampInt, log, rint, shuffle } from './base.js';
import { chDecks } from './challenges.js';

// ---------- pembuatan game ----------
// pesan romantis dari Paspor Cinta pemain: teks satu baris, maks 240 huruf
const cleanMsg = x =>
  String(x == null ? '' : x)
    // eslint-disable-next-line no-control-regex -- sengaja: buang karakter kontrol dari teks pemain
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
function newPlayer(src, i, cash) {
  return {
    i,
    name:
      String(src.name || 'Pemain ' + (i + 1))
        .trim()
        .slice(0, 16) || 'Pemain ' + (i + 1),
    avatar: String(src.avatar || D.AVATARS[i % D.AVATARS.length]).slice(0, 8),
    msg: cleanMsg(src.msg),
    color: /^#[0-9a-fA-F]{6}$/.test(src.color || '') ? src.color : D.TOKEN_COLORS[i % D.TOKEN_COLORS.length],
    kind: src.kind === 'ai' ? 'ai' : 'human',
    ai: AI_LEVELS.includes(src.ai) ? src.ai : 'normal',
    uid: src.uid || null,
    cash,
    pos: 0,
    laps: 0,
    island: false,
    islandTries: 0,
    islandCh: false,
    tour: false,
    skip: 0,
    bankrupt: false,
    love: RULES.loveStart,
    cards: [],
    discount: 0,
    achievements: [],
    stats: {
      tollIn: 0,
      tollOut: 0,
      bought: 0,
      built: 0,
      landmarks: 0,
      takeovers: 0,
      takenFrom: 0,
      festivals: 0,
      travels: 0,
      islands: 0,
      escapes: 0,
      challenges: 0,
      skipped: 0,
      failed: 0,
      letters: 0,
      doubles: 0,
      aimHits: 0,
      debts: 0,
      survived: 0,
      angels: 0,
      earned: 0,
      spent: 0,
      transactions: 0,
      maxNet: cash,
      bankruptRound: 0,
      sold: 0,
      starts: 0,
    },
  };
}

/**
 * Buat game baru yang deterministik dari seed.
 * @param {import('../types.js').GameSetup} setup
 * @returns {import('../types.js').GameState}
 */
function create(setup) {
  if (!setup || !Array.isArray(setup.players) || setup.players.length < 2 || setup.players.length > 4) {
    throw new Error('Butuh 2–4 pemain.');
  }
  const st = setup.settings || {};
  const settings = {
    startCash: clampInt(st.startCash == null ? RULES.startCash : st.startCash, 1000, 6000),
    roundLimit: clampInt(st.roundLimit == null ? 30 : st.roundLimit, 0, 200),
    winMessage: String(st.winMessage || '').slice(0, 240),
    online: !!st.online,
    debug: !!st.debug,
    takeover: st.takeover !== false,
    instantWin: st.instantWin !== false,
    diceControl: st.diceControl !== false,
    news: st.news !== false,
    moment: st.moment !== false,
  };
  const seed = Number(setup.seed) >>> 0 || (Math.random() * 4294967296) >>> 0 || 1;
  const S = {
    v: 2,
    seq: 0,
    rng: seed,
    seed,
    settings,
    players: setup.players.map((p, i) => newPlayer(p, i, settings.startCash)),
    tiles: TILES.map(() => ({ owner: -1, level: 0 })),
    festival: { tile: -1, mult: 1 },
    turn: { p: 0, rolled: false, doubles: 0, canRollAgain: false, dice: [0, 0], rollId: 0 },
    round: 1,
    queue: [],
    decks: { card: [], challenge: {} },
    log: [],
    logN: 0,
    letters: [],
    proofs: [],
    lastEvents: [],
    evSeq: 0,
    over: null,
    paused: false,
  };
  // semua pemain sama persis (modal, posisi START, tanpa bonus). Keadilan lewat undian giliran pertama:
  // setup.first = 'random' (dipakai UI & online) atau indeks pemain; bawaan 0 (deterministik untuk uji)
  const first = setup.first === 'random' ? rint(S, S.players.length) : clampInt(setup.first || 0, 0, S.players.length - 1);
  S.start = first;
  S.turn.p = first;
  S.decks.card = shuffle(
    S,
    CARDS.map(c => c.id)
  );
  chDecks(S);
  log(S, 'Permainan dimulai. Selamat keliling dunia berdua!', 'heart');
  if (setup.first === 'random') log(S, 'Undian giliran: ' + PL(S, first).name + ' jalan duluan!', 'dice', first);
  return S;
}

export { create };
