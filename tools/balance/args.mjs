// Argumen sederhana untuk alat simulasi: --kunci nilai atau --kunci=nilai (nilai bawaan dari `defaults`).
export function args(defaults) {
  const out = Object.assign({}, defaults);
  const a = process.argv.slice(2);
  for (let k = 0; k < a.length; k++) {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(a[k]);
    if (!m) continue;
    const v = m[2] != null ? m[2] : a[k + 1] != null && !a[k + 1].startsWith('--') ? a[++k] : 'true';
    out[m[1]] = typeof defaults[m[1]] === 'number' ? Number(v) : v;
  }
  return out;
}
export const pct = (a, n) => Math.round((100 * a) / Math.max(1, n)) + '%';
export const quant = (arr, q) => {
  const s = arr.slice().sort((x, y) => x - y);
  return s.length ? s[Math.floor((s.length - 1) * q)] : null;
};
// PRNG deterministik (mulberry32) supaya hasil simulasi bisa diulang
export function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
