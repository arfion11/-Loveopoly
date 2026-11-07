/* LOVEOPOLY — engine aturan › dispatch & API publik engine (dikumpulkan lewat src/engine/engine.js) */
// mendaftarkan handler ke registri H (efek samping impor; urutan: aksi permainan lalu tantangan)
import './actions.js';
import './challenge-actions.js';
import {
  ACH,
  AIM_LABEL,
  CARD,
  CH,
  CITIES,
  FEST,
  GROUP_IDS,
  GROUP_TILES,
  H,
  ISLAND,
  LEVEL_NAME,
  N,
  OWNABLE,
  PL,
  POWER,
  RULES,
  RuleError,
  SIDE_TILES,
  SPOTS,
  TRAVEL,
  buildingLevels,
  buyCost,
  buyLevels,
  capLevel,
  citiesOf,
  costRange,
  countGroup,
  fail,
  fmt,
  fullGroups,
  levelCost,
  liquidation,
  netWorth,
  newsGap,
  newsOn,
  ownedBy,
  ownsGroup,
  peakOn,
  sellValue,
  spotsOf,
  tierInfo,
  tierOf,
  tileValue,
  upgradeCost,
  upgradeLevels,
} from './base.js';
import { canTakeover, rentFor, rentInfo, takeoverPrice, tripleOk, winCheck, winThreats } from './tolls.js';
import { create } from './create.js';
import { nearestTile, swapTargets, targetCandidates } from './move.js';
import { chActors, chSolve, charadesOpen, judgeFor, judgesFor, messageChecks, migrate } from './challenges.js';
import { actor, canEnd, canRoll, checkAchievements, finish, islandPre, newsInfo, nextTurn, sideName, winReason } from './turns.js';

// ---------- dispatch ----------
function clone(o) {
  return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o));
}
function postProcess(S) {
  if (S.over) return;
  if (PL(S, S.turn.p).bankrupt && !S.queue.length && !S._new.length) nextTurn(S);
  checkAchievements(S);
  S.players.forEach(p => {
    if (!p.bankrupt) p.stats.maxNet = Math.max(p.stats.maxNet, netWorth(S, p.i));
  });
  if (S.settings.instantWin && !S.over) {
    const n = S.players.length;
    for (let k = 0; k < n; k++) {
      const i = (S.turn.p + k) % n;
      const w = winCheck(S, i);
      if (w) {
        finish(S, w.kind, i, w);
        return;
      }
    }
  }
}
/**
 * Terapkan satu aksi ke state (murni: state masukan tidak diubah).
 * @param {import('../types.js').GameState} S0
 * @param {import('../types.js').Action} action
 * @returns {import('../types.js').DispatchResult}
 */
function dispatch(S0, action) {
  if (!action || typeof action.type !== 'string' || !Object.prototype.hasOwnProperty.call(H, action.type))
    return { ok: false, error: 'Aksi tidak dikenal.' };
  const S = clone(S0);
  migrate(S);
  S._ev = [];
  S._new = [];
  try {
    if (S.over) fail('Permainan sudah selesai.');
    const p = action.p;
    if (!Number.isInteger(p) || !S.players[p]) fail('Pemain tidak dikenal.');
    if (S.players[p].bankrupt) fail('Pemain ini sudah bangkrut.');
    if (S.paused && action.type !== 'PAUSE') fail('Permainan sedang dijeda.');
    // pemilik tantangan boleh membatalkan (skip) walau sedang menunggu penilai, supaya tidak macet bila penilai pergi
    const chCancel =
      action.type === 'CH_RESOLVE' && action.result === 'skip' && S.queue[0] && S.queue[0].type === 'CHALLENGE' && S.queue[0].p === p;
    const chGuess = action.type === 'CH_ANSWER' && charadesOpen(S, S.queue[0]) && chActors(S).includes(p);
    if (action.type !== 'PAUSE' && !chCancel && !chGuess && actor(S) !== p) fail('Bukan giliranmu.');
    H[action.type](S, action);
    S.queue = S._new.concat(S.queue);
    S._new = [];
    postProcess(S);
    S.queue = S._new.concat(S.queue);
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    throw e;
  }
  const events = S._ev;
  delete S._ev;
  delete S._new;
  S.seq++;
  S.lastEvents = events;
  S.evSeq = S.seq;
  return { ok: true, state: S, events };
}
function check(S, action) {
  const r = dispatch(S, action);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export const E = {
  create,
  dispatch,
  check,
  actor,
  canRoll,
  canEnd,
  islandPre,
  chSolve,
  messageChecks,
  judgeFor,
  judgesFor,
  chActors,
  migrate,
  newsInfo,
  peakOn,
  newsGap,
  tripleOk,
  travelFee: S => (newsOn(S, 'promo') ? 0 : RULES.travelFee),
  rentFor,
  rentInfo,
  netWorth,
  liquidation,
  tileValue,
  sellValue,
  levelCost,
  costRange,
  buyCost,
  upgradeCost,
  buyLevels,
  upgradeLevels,
  capLevel,
  targetCandidates,
  swapTargets,
  ownsGroup,
  countGroup,
  fullGroups,
  ownedBy,
  citiesOf,
  spotsOf,
  buildingLevels,
  tierOf,
  tierInfo,
  winCheck,
  winThreats,
  canTakeover,
  takeoverPrice,
  winReason,
  sideName,
  nearestTile,
  GROUP_TILES,
  GROUP_IDS,
  OWNABLE,
  CITIES,
  SPOTS,
  SIDE_TILES,
  ISLAND,
  FEST,
  TRAVEL,
  N,
  AIM_LABEL,
  LEVEL_NAME,
  CARD,
  CH,
  ACH,
  POWER,
  fmt,
};
