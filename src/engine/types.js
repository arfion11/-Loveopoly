/* LOVEOPOLY — tipe bersama engine (JSDoc). Diperiksa `npm run typecheck`; tidak menghasilkan kode. */

/**
 * State permainan lengkap (bisa di-JSON-kan; disimpan lokal & dikirim host online). Properti lain (log, decks,
 * proofs, news, …) dicakup indeks `[k: string]: any`.
 * @typedef {{
 *   seed: number,
 *   seq: number,
 *   round: number,
 *   turn: { p: number, rolled: boolean, [k: string]: any },
 *   players: Player[],
 *   tiles: Array<{ owner: number, level: number, [k: string]: any }>,
 *   queue: QueueItem[],
 *   settings: Record<string, any>,
 *   over: any,
 *   [k: string]: any
 * }} GameState
 */

/**
 * Pemain. `kind`: 'human' | 'ai'. Properti lain (laps, island, love, cards, stats, …) lewat indeks.
 * @typedef {{
 *   i: number,
 *   name: string,
 *   avatar: string,
 *   color: string,
 *   kind: string,
 *   cash: number,
 *   pos: number,
 *   bankrupt: boolean,
 *   [k: string]: any
 * }} Player
 */

/** @typedef {{ type: string, p?: number, [k: string]: any }} QueueItem */

/**
 * Aksi pemain/AI/host. `type` = nama handler (ROLL, BUY, CH_ANSWER, …), `p` = kursi pelaku.
 * @typedef {{ type: string, p: number, [k: string]: any }} Action
 */

/**
 * Hasil dispatch: ok → state baru + events (untuk animasi UI); gagal → pesan error untuk pemain.
 * @typedef {{ ok: boolean, state?: GameState, events?: any[], error?: string }} DispatchResult
 */

/**
 * @typedef {object} GameSetup
 * @property {Array<{ name: string, avatar?: string, color?: string, kind?: 'human' | 'ai', ai?: string, msg?: string }>} players  2–4 pemain
 * @property {Record<string, any>} [settings]
 * @property {number} [seed]
 * @property {number | 'random'} [first]   giliran pertama (bawaan 0; 'random' = diundi)
 */

export {};
