/* LOVEOPOLY 2.0 — efek suara sintetis (WebAudio), tanpa file eksternal */
let ctx = null,
  master = null,
  enabled = true;
const last = {};
function ensure() {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch (e) {
    return null;
  }
}
function tone(freq, dur, opt) {
  const c = ensure();
  if (!c) return;
  opt = opt || {};
  const t0 = c.currentTime + (opt.delay || 0);
  const o = c.createOscillator(),
    g = c.createGain();
  o.type = opt.type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opt.vol || 0.5, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
function noise(dur, opt) {
  const c = ensure();
  if (!c) return;
  opt = opt || {};
  const t0 = c.currentTime + (opt.delay || 0);
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = opt.freq || 1800;
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = opt.vol || 0.35;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
}
const SFX = {
  click: () => tone(660, 0.06, { type: 'triangle', vol: 0.25 }),
  dice: () => {
    for (let i = 0; i < 6; i++) noise(0.05, { delay: i * 0.07, freq: 1400 + Math.random() * 1600, vol: 0.4 });
    tone(220, 0.08, { type: 'square', vol: 0.08, delay: 0.42 });
  },
  step: () => tone(880 + Math.random() * 120, 0.05, { type: 'triangle', vol: 0.12 }),
  coin: () => {
    tone(988, 0.08, { type: 'square', vol: 0.12 });
    tone(1319, 0.16, { type: 'square', vol: 0.12, delay: 0.07 });
  },
  pay: () => {
    tone(523, 0.1, { type: 'triangle', vol: 0.2 });
    tone(392, 0.16, { type: 'triangle', vol: 0.2, delay: 0.08 });
  },
  buy: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.22, delay: i * 0.07 }));
  },
  build: () => {
    noise(0.06, { freq: 600, vol: 0.4 });
    tone(392, 0.12, { type: 'square', vol: 0.12, delay: 0.05 });
    tone(587, 0.18, { type: 'triangle', vol: 0.18, delay: 0.12 });
  },
  card: () => {
    noise(0.18, { freq: 3200, vol: 0.18 });
    tone(740, 0.22, { type: 'sine', vol: 0.18, delay: 0.1, to: 1100 });
  },
  jail: () => {
    tone(330, 0.2, { type: 'sawtooth', vol: 0.12 });
    tone(247, 0.35, { type: 'sawtooth', vol: 0.12, delay: 0.16 });
  },
  event: () => {
    [659, 880, 784].forEach((f, i) => tone(f, 0.22, { type: 'sine', vol: 0.2, delay: i * 0.11 }));
  },
  good: () => {
    [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.2, delay: i * 0.08 }));
  },
  bad: () => {
    tone(300, 0.25, { type: 'triangle', vol: 0.22, to: 180 });
  },
  error: () => {
    tone(200, 0.12, { type: 'square', vol: 0.1 });
  },
  win: () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.26, { type: 'triangle', vol: 0.24, delay: i * 0.12 }));
  },
  heart: () => {
    tone(110, 0.12, { type: 'sine', vol: 0.5 });
    tone(110, 0.12, { type: 'sine', vol: 0.4, delay: 0.16 });
  },
  plane: () => {
    tone(220, 0.9, { type: 'sawtooth', vol: 0.05, to: 440 });
    noise(0.8, { freq: 900, vol: 0.12 });
  },
  whoosh: () => {
    noise(0.32, { freq: 2400, vol: 0.2 });
    tone(500, 0.25, { type: 'sine', vol: 0.08, to: 900 });
  },
  chirp: () => {
    tone(1500, 0.07, { type: 'sine', vol: 0.18, to: 2100 });
    tone(1700, 0.09, { type: 'sine', vol: 0.16, delay: 0.1, to: 2400 });
  },
  fanfare: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.2, delay: i * 0.09 }));
    tone(1047, 0.5, { type: 'square', vol: 0.06, delay: 0.45 });
  },
  stamp: () => {
    noise(0.12, { freq: 300, vol: 0.6 });
    tone(140, 0.18, { type: 'square', vol: 0.12, delay: 0.02 });
  },
  thunder: () => {
    noise(0.9, { freq: 220, vol: 0.55 });
    tone(80, 0.6, { type: 'sawtooth', vol: 0.08 });
  },
  splash: () => {
    noise(0.4, { freq: 1200, vol: 0.3 });
    tone(600, 0.2, { type: 'sine', vol: 0.08, delay: 0.05, to: 200 });
  },
  page: () => {
    noise(0.12, { freq: 4200, vol: 0.12 });
  },
  // achievement: arpeggio naik + kilau lonceng
  achieve: () => {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.17, { type: 'triangle', vol: 0.2, delay: i * 0.075 }));
    tone(1568, 0.7, { type: 'square', vol: 0.035, delay: 0.3 });
    [2093, 2637, 3136].forEach((f, i) => tone(f, 0.55, { type: 'sine', vol: 0.07, delay: 0.32 + i * 0.06 }));
    noise(0.35, { freq: 7000, vol: 0.05, delay: 0.3 });
  },
  ding: () => {
    tone(1568, 0.22, { type: 'sine', vol: 0.16 });
    tone(2349, 0.3, { type: 'sine', vol: 0.08, delay: 0.05 });
  },
};
export const SND = {
  play(name) {
    if (!enabled || !SFX[name]) return;
    const now = Date.now();
    if (last[name] && now - last[name] < 45) return;
    last[name] = now;
    try {
      SFX[name]();
    } catch (e) {
      /* audio opsional */
    }
  },
  setEnabled(v) {
    enabled = !!v;
    if (enabled) ensure();
  },
  isEnabled() {
    return enabled;
  },
  unlock() {
    ensure();
  },
};
