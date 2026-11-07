/* LOVEOPOLY — engine aturan › tantangan terbukti: soal, penilaian, penilai (dikumpulkan lewat src/engine/engine.js) */
import {
  AUTO_TYPES,
  CH,
  CHALLENGES,
  CHARADES,
  CH_TYPES,
  EMOJI_CLUES,
  GROUPS,
  HEART_QS,
  ISLAND,
  N,
  PL,
  SIDES,
  TILES,
  cashAdd,
  ev,
  fmt,
  log,
  loveAdd,
  rint,
  shuffle,
} from './base.js';
import { release } from './move.js';
import { actor } from './turns.js';

// ---------- tantangan ----------
// Tidak ada "klik Selesai" tanpa bukti: auto = soal dari seed dinilai engine; duel = jawaban lawan dibandingkan
// engine; judge = lawan manusia mengesahkan aksi nyata. Item: { type: 'CHALLENGE', p (pemilik), who (yang
// sedang beraksi), judge (lawan penilai / -1), phase, pz (soal), isle (Rindu Challenge: syarat lebih ringan) }.
const NEEDS_JUDGE = ['secret', 'bluff', 'charades', 'dare', 'photo'];
const PHOTO_MAX = 22000,
  PHOTO_KEEP = 4;
const PHOTO_RE = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const PRICED = TILES.filter(t => t.price).map(t => t.i);
const RECALL_POOL = [
  'kotatua',
  'bali',
  'paris',
  'kyoto',
  'santorini',
  'hawaii',
  'ferris',
  'balloon',
  'swiss',
  'seoul',
  'maldives',
  'aurora',
];
function chDecks(S) {
  S.decks.challenge = S.decks.challenge || {};
  Object.keys(CH_TYPES).forEach(type => {
    const ids = CHALLENGES.filter(c => c.type === type).map(c => c.id);
    const cur = S.decks.challenge[type];
    if (!Array.isArray(cur) || !cur.length || cur.some(id => !CH[id])) S.decks.challenge[type] = shuffle(S, ids);
  });
}
// lawan manusia aktif berikutnya dalam urutan giliran (bot tidak pernah menjadi penilai)
function judgeFor(S, i) {
  const n = S.players.length;
  for (let k = 1; k < n; k++) {
    const q = S.players[(i + k) % n];
    if (q.kind === 'human' && !q.bankrupt) return q.i;
  }
  return -1;
}
function chType(S, i, cat) {
  const human = PL(S, i).kind === 'human',
    j = human ? judgeFor(S, i) : -1;
  const pickOf = arr => arr[rint(S, arr.length)];
  const auto = () => pickOf(AUTO_TYPES);
  if (cat === 'skill') return auto();
  if (cat === 'any') return pickOf(AUTO_TYPES.concat(['dilemma'], human ? ['message'] : [], j >= 0 ? NEEDS_JUDGE : []));
  if (cat === 'rindu') return pickOf(AUTO_TYPES.concat(j >= 0 ? NEEDS_JUDGE : []));
  if (!CH_TYPES[cat]) return auto();
  if (NEEDS_JUDGE.includes(cat) && j < 0) return auto();
  if (cat === 'message' && !human) return auto();
  return cat;
}
function pickN(S, arr, n) {
  return shuffle(S, arr.slice()).slice(0, n);
}
const normWord = x =>
  String(x == null ? '' : x)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
function sideOf(t) {
  const sd = SIDES.find(d => t >= d.from && t <= d.to);
  return sd ? sd.name : '';
}
// jawaban benar sebuah soal trivia (dihitung dari data papan, tidak disimpan di state)
function triviaAnswer(q) {
  if (q.k === 'max') {
    let best = -1,
      bi = 0;
    q.o.forEach((nm, k) => {
      const t = TILES.find(x => x.name === nm);
      if (t && t.price > best) {
        best = t.price;
        bi = k;
      }
    });
    return bi;
  }
  if (q.k === 'group') return q.o.indexOf(GROUPS[TILES[q.s].group].name);
  if (q.k === 'next') return q.o.indexOf(TILES[(q.s + 1) % N].name);
  if (q.k === 'side') return q.o.indexOf(sideOf(q.s));
  if (q.k === 'price') return q.o.indexOf(fmt(TILES[q.s].price));
  if (q.k === 'odd')
    return q.o.findIndex(nm => {
      const t = TILES.find(x => x.name === nm);
      return !t || sideOf(t.i) !== q.side;
    });
  return -1;
}
function genTrivia(S, n) {
  const kinds = shuffle(S, ['max', 'group', 'next', 'side', 'price', 'odd', 'next']).slice(0, n);
  const used = new Set();
  const subj = pool => {
    const c = pool.filter(t => !used.has(t));
    const t = c[rint(S, c.length)];
    used.add(t);
    return t;
  };
  const cities = TILES.filter(t => t.type === 'city').map(t => t.i),
    sideT = TILES.filter(t => t.price && sideOf(t.i)).map(t => t.i);
  const withAns = (ans, others) =>
    shuffle(
      S,
      [ans].concat(
        pickN(
          S,
          others.filter(x => x !== ans),
          3
        )
      )
    );
  return kinds.map(k => {
    if (k === 'max') {
      const prices = new Set(),
        opts = [];
      shuffle(S, PRICED.slice()).forEach(t => {
        if (opts.length < 4 && !prices.has(TILES[t].price)) {
          prices.add(TILES[t].price);
          opts.push(TILES[t].name);
        }
      });
      return { k, s: -1, t: 'Mana yang harga belinya paling mahal?', o: opts };
    }
    if (k === 'group') {
      const t = subj(cities);
      return {
        k,
        s: t,
        t: TILES[t].name + ' termasuk grup warna apa?',
        o: withAns(
          GROUPS[TILES[t].group].name,
          Object.values(GROUPS).map(g => g.name)
        ),
      };
    }
    if (k === 'next') {
      const t = subj(TILES.map(x => x.i).filter(i => TILES[i].type !== 'card' && TILES[(i + 1) % N].type !== 'card'));
      const names = [...new Set(TILES.map(x => x.name))];
      return {
        k,
        s: t,
        t: 'Petak apa yang tepat sesudah ' + TILES[t].name + ' (searah langkah pion)?',
        o: withAns(TILES[(t + 1) % N].name, names),
      };
    }
    if (k === 'odd') {
      const sd = SIDES[rint(S, SIDES.length)],
        inS = sideT.filter(t => sideOf(t) === sd.name),
        out = sideT.filter(t => sideOf(t) !== sd.name);
      const o = shuffle(
        S,
        pickN(S, inS, 3)
          .concat([out[rint(S, out.length)]])
          .map(t => TILES[t].name)
      );
      return { k, s: -1, side: sd.name, t: 'Mana yang BUKAN bagian dari ' + sd.name + '?', o };
    }
    if (k === 'side') {
      const t = subj(sideT);
      return {
        k,
        s: t,
        t: TILES[t].name + ' ada di jalur mana?',
        o: withAns(
          sideOf(t),
          SIDES.map(d => d.name)
        ),
      };
    }
    const t = subj(PRICED);
    const near = [...new Set(PRICED.map(i => TILES[i].price))]
      .filter(v => v !== TILES[t].price)
      .sort((a, b) => Math.abs(a - TILES[t].price) - Math.abs(b - TILES[t].price))
      .slice(0, 5);
    return { k: 'price', s: t, t: 'Berapa harga beli ' + TILES[t].name + '?', o: withAns(fmt(TILES[t].price), near.map(fmt)) };
  });
}
function genMath(S, n) {
  const P = () => TILES[PRICED[rint(S, PRICED.length)]].price;
  const kinds = shuffle(S, ['fest', 'trip', 'tax', 'change', 'fest', 'trip']).slice(0, n);
  return kinds.map(k => {
    if (k === 'fest') {
      const a = P(),
        m = 2 + rint(S, 2),
        b = P();
      return { k, n: [a, m, b], t: 'Tol ' + fmt(a) + ' × ' + m + ' (festival) + tol ' + fmt(b) + ' = ?' };
    }
    if (k === 'trip') {
      const a = P(),
        b = P(),
        c = P();
      return { k, n: [a, b, c], t: 'Beli ' + fmt(a) + ' + ' + fmt(b) + ' − jual ' + fmt(c) + ' = ?' };
    }
    if (k === 'tax') {
      const a = (120 + rint(S, 380)) * 10;
      return { k, n: [a], t: 'Pajak Rindu 10% dari aset ' + fmt(a) + ' = ?' };
    }
    const a = 1000 + rint(S, 20) * 50,
      b = P(),
      c = P();
    return { k: 'change', n: [a, b, c], t: 'Uang ' + fmt(a) + ', bayar tol ' + fmt(b) + ' dan ' + fmt(c) + '. Sisa = ?' };
  });
}
function mathAnswer(q) {
  const [a, b, c] = q.n;
  if (q.k === 'fest') return a * b + c;
  if (q.k === 'trip') return a + b - c;
  if (q.k === 'tax') return Math.round(a / 10);
  return a - b - c;
}
function scrambleWord(S, w) {
  const word = x => {
    if (x.length < 3) return x;
    let y = x;
    for (let k = 0; k < 8 && y.toLowerCase() === x.toLowerCase(); k++) y = shuffle(S, x.split('')).join('');
    return y;
  };
  return w.split(' ').map(word).join(' ').toUpperCase();
}
function setupCh(S, it) {
  const ch = CH[it.ch],
    def = CH_TYPES[ch.type],
    I = it.isle;
  const of = (I && def.ofIsle) || def.of,
    need = (I && def.needIsle) || def.need,
    secs = (I && def.secsIsle) || def.secs;
  it.phase = 'play';
  it.who = it.p;
  it.pz = null;
  if (ch.type === 'trivia') it.pz = { qs: genTrivia(S, of), need, secs };
  else if (ch.type === 'price') it.pz = { items: pickN(S, PRICED, of), need, secs, tol: (I && def.tolIsle) || def.tol };
  else if (ch.type === 'recall') {
    const pool = pickN(S, RECALL_POOL, 6),
      seq = [];
    while (seq.length < of) {
      const x = pool[rint(S, pool.length)];
      if (x !== seq[seq.length - 1]) seq.push(x);
    }
    it.pz = { pool, seq, need: of, secs, showMs: 900 + of * 550 };
  } else if (ch.type === 'math') it.pz = { qs: genMath(S, of), need, secs };
  else if (ch.type === 'emoji') {
    const keys = Object.keys(EMOJI_CLUES).map(Number),
      names = [...new Set(keys.map(t => TILES[t].name))];
    it.pz = {
      qs: pickN(S, keys, of).map(t => ({
        s: t,
        e: EMOJI_CLUES[t],
        o: shuffle(
          S,
          [TILES[t].name].concat(
            pickN(
              S,
              names.filter(x => x !== TILES[t].name),
              3
            )
          )
        ),
      })),
      need,
      secs,
    };
  } else if (ch.type === 'scramble')
    it.pz = { items: pickN(S, PRICED.concat([ISLAND]), of).map(t => ({ s: t, w: scrambleWord(S, TILES[t].name) })), need, secs };
  else if (ch.type === 'secret') {
    it.phase = 'intro';
    it.pz = {
      qs: pickN(
        S,
        HEART_QS.map((_, k) => k),
        def.of
      ),
      need: def.need,
    };
  } else if (ch.type === 'bluff') it.phase = 'write';
  else if (ch.type === 'charades') {
    it.phase = 'act';
    it.pz = { word: CHARADES[rint(S, CHARADES.length)], secs: def.secs, tries: 0, max: def.tries, guesses: [] };
  } else if (ch.type === 'message') it.phase = 'write';
  else if (ch.type === 'dare') {
    it.phase = 'do';
    it.pz = { secs: ch.secs || 30 };
  } else if (ch.type === 'photo') {
    it.phase = 'do';
    it.pz = {};
  } else if (ch.type === 'dilemma') it.phase = 'choose';
}
function drawChallenge(S, i, cat) {
  chDecks(S);
  const type = chType(S, i, cat);
  const deck = S.decks.challenge[type];
  const id = deck.shift();
  deck.push(id);
  return id;
}
// Penilai = semua lawan manusia aktif (it.judges). Penilai utama (it.judge, dipakai {j} di teks tantangan & Tebak Isi
// Hati) bergiliran per pemilik lewat S.chRot supaya tidak selalu orang yang sama. 2 pemain: daftarnya 1 orang = aturan lama.
function judgesFor(S, i, rot) {
  const n = S.players.length,
    list = [];
  for (let k = 1; k < n; k++) {
    const q = S.players[(i + k) % n];
    if (q.kind === 'human' && !q.bankrupt) list.push(q.i);
  }
  if (!list.length) return list;
  const s = (((rot || 0) % list.length) + list.length) % list.length;
  return list.slice(s).concat(list.slice(0, s));
}
function assignJudges(S, it, fresh) {
  const t = CH[it.ch].type;
  if (!(NEEDS_JUDGE.includes(t) || t === 'message')) {
    it.judge = -1;
    it.judges = [];
    return;
  }
  if (fresh || it.rot == null) {
    S.chRot = S.chRot || {};
    it.rot = S.chRot[it.p] || 0;
    S.chRot[it.p] = it.rot + 1;
  }
  it.judges = judgesFor(S, it.p, it.rot);
  it.judge = it.judges.length ? it.judges[0] : -1;
}
const multiJudge = it => Array.isArray(it.judges) && it.judges.length > 1;
// Peragakan! dengan banyak penebak: siapa yang masih boleh menebak (sisa kesempatan)
const charadesOpen = (S, it) =>
  it && it.type === 'CHALLENGE' && CH[it.ch] && CH[it.ch].type === 'charades' && it.phase === 'guess' && multiJudge(it);
const guessLeft = (it, j) => (it.pz.max || 3) - ((it.pz.triesBy || {})[j] || 0);
function chActors(S) {
  const it = S.queue[0];
  if (charadesOpen(S, it)) return it.judges.filter(j => !PL(S, j).bankrupt && guessLeft(it, j) > 0);
  const a = actor(S);
  return a >= 0 ? [a] : [];
}
function chItem(S, i, cat, source) {
  const it = {
    type: 'CHALLENGE',
    p: i,
    ch: drawChallenge(S, i, cat),
    cat,
    source,
    redraws: 0,
    isle: source === 'island',
    judge: -1,
    judges: [],
  };
  assignJudges(S, it, true);
  setupCh(S, it);
  return it;
}
// migrasi save lama / item buatan tangan: tantangan tanpa fase atau dengan id yang sudah dihapus disiapkan ulang
function migrate(S) {
  if (!S || !Array.isArray(S.queue)) return S;
  if (!S.proofs) S.proofs = [];
  S.queue.forEach(it => {
    if (it.type === 'CHALLENGE' && !Array.isArray(it.judges)) it.judges = it.judge >= 0 ? [it.judge] : [];
    if (it.type !== 'CHALLENGE' || (CH[it.ch] && it.phase && it.who != null)) return;
    if (!S.decks) S.decks = { card: [], challenge: {} };
    if (!CH[it.ch]) it.ch = drawChallenge(S, it.p, it.cat || 'any');
    if (it.redraws == null) it.redraws = 0;
    it.isle = it.source === 'island';
    assignJudges(S, it, false);
    if (NEEDS_JUDGE.includes(CH[it.ch].type) && it.judge < 0) {
      it.ch = drawChallenge(S, it.p, 'skill');
      it.judge = -1;
      it.judges = [];
    }
    setupCh(S, it);
  });
  return S;
}
// jawaban benar untuk tantangan auto (dipakai AI & umpan balik UI; penilaian tetap di engine)
function chSolve(it) {
  const ch = CH[it.ch],
    z = it.pz;
  if (!z) return null;
  if (ch.type === 'trivia') return z.qs.map(triviaAnswer);
  if (ch.type === 'price') return z.items.map(t => TILES[t].price);
  if (ch.type === 'recall') return z.seq.slice();
  if (ch.type === 'math') return z.qs.map(mathAnswer);
  if (ch.type === 'scramble') return z.items.map(x => TILES[x.s].name);
  if (ch.type === 'emoji') return z.qs.map(q => q.o.indexOf(TILES[q.s].name));
  return null;
}
function gradeAuto(it, ans) {
  const ch = CH[it.ch],
    z = it.pz,
    A = Array.isArray(ans) ? ans : [];
  if (ch.type === 'trivia') return z.qs.reduce((n, q, k) => n + (Number(A[k]) === triviaAnswer(q) ? 1 : 0), 0);
  if (ch.type === 'price')
    return z.items.reduce((n, t, k) => {
      const v = Number(String(A[k] == null ? '' : A[k]).replace(/\D/g, ''));
      const pr = TILES[t].price;
      return n + (v > 0 && Math.abs(v - pr) <= pr * z.tol ? 1 : 0);
    }, 0);
  if (ch.type === 'recall') return z.seq.every((x, k) => A[k] === x) && A.length === z.seq.length ? z.seq.length : 0;
  if (ch.type === 'math')
    return z.qs.reduce(
      (n, q, k) => n + (A[k] !== '' && A[k] != null && Number(String(A[k]).replace(/[^\d-]/g, '')) === mathAnswer(q) ? 1 : 0),
      0
    );
  if (ch.type === 'scramble') return z.items.reduce((n, x, k) => n + (normWord(A[k]) === normWord(TILES[x.s].name) ? 1 : 0), 0);
  if (ch.type === 'emoji') return z.qs.reduce((n, q, k) => n + (Number(A[k]) === q.o.indexOf(TILES[q.s].name) ? 1 : 0), 0);
  return 0;
}
const secsTxt = ms => (Math.round(ms / 100) / 10).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' dtk';
// cek syarat Surat Bersyarat; kembalikan daftar { ok, label }
function messageChecks(rule, text) {
  const t = String(text || ''),
    lines = t
      .split(/\n+/)
      .map(x => x.trim())
      .filter(Boolean),
    words = t.split(/\s+/).filter(w => /[a-z0-9]/i.test(w));
  const out = [];
  if (rule.acrostic)
    out.push({
      ok:
        lines.length === rule.acrostic.length &&
        rule.acrostic.split('').every((c, k) => lines[k] && normWord(lines[k])[0] === c.toLowerCase()),
      label: rule.acrostic.length + ' baris diawali ' + rule.acrostic.split('').join('-'),
    });
  if (rule.cities) {
    const found = new Set(
      TILES.filter(x => x.type === 'city' || x.type === 'spot')
        .filter(x => normWord(t).includes(normWord(x.name)))
        .map(x => x.name)
    );
    out.push({ ok: found.size >= rule.cities, label: 'Memuat ' + rule.cities + ' nama kota di papan (' + found.size + ')' });
  }
  if (rule.noLetter)
    out.push({ ok: t.length > 0 && !t.toLowerCase().includes(rule.noLetter), label: 'Tanpa huruf "' + rule.noLetter + '"' });
  if (rule.minWords) out.push({ ok: words.length >= rule.minWords, label: 'Minimal ' + rule.minWords + ' kata (' + words.length + ')' });
  if (rule.lines) out.push({ ok: lines.length === rule.lines, label: 'Tepat ' + rule.lines + ' baris (' + lines.length + ')' });
  if (rule.wordsPerLine)
    out.push({
      ok: lines.length > 0 && lines.every(l => l.split(/\s+/).filter(Boolean).length >= rule.wordsPerLine),
      label: 'Tiap baris minimal ' + rule.wordsPerLine + ' kata',
    });
  if (rule.rhyme === 'abab') {
    const end = k => {
      const w = normWord((lines[k] || '').split(/\s+/).pop());
      return w.slice(-2);
    };
    out.push({ ok: lines.length === 4 && end(0) && end(0) === end(2) && end(1) === end(3), label: 'Rima a-b-a-b' });
  }
  out.push({ ok: t.trim().length <= 400, label: 'Maksimal 400 karakter' });
  return out;
}
const cleanText = (x, max) =>
  String(x || '')
    // eslint-disable-next-line no-control-regex -- sengaja: buang karakter kontrol dari teks pemain
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, max);
function chProof(S, it, ok, proof) {
  const ch = CH[it.ch];
  S.proofs = S.proofs || [];
  S.proofs.push({ p: it.p, type: ch.type, label: CH_TYPES[ch.type].label, ok, proof, judge: it.judge, r: S.round });
  if (S.proofs.length > 40) S.proofs.shift();
}
function rewardTo(S, i, rw) {
  if (!rw) return '';
  if (rw.gain) cashAdd(S, i, rw.gain);
  if (rw.love) loveAdd(S, i, rw.love);
  return [rw.gain ? '+' + fmt(rw.gain) : '', rw.love ? 'Love +' + rw.love : ''].filter(Boolean).join(', ');
}
// akhir tantangan: ok = pemilik lulus. judgeWin = penilai yang dapat hadiah (Dua Fakta Satu Bohong)
function chFinish(S, it, ok, proof, judgeShare) {
  const ch = CH[it.ch],
    def = CH_TYPES[ch.type],
    p = PL(S, it.p);
  S.queue.shift();
  chProof(S, it, ok, proof);
  if (ok) {
    const got = rewardTo(S, it.p, def.reward);
    p.stats.challenges++;
    log(S, p.name + ' lulus ' + def.label + ' (' + got + '). Bukti: ' + proof + '.', 'heart', it.p);
    if (it.source === 'island' && p.island) {
      release(S, it.p, 'lewat Rindu Challenge');
      p.stats.escapes++;
    }
  } else {
    p.stats.failed++;
    log(
      S,
      p.name + ' gagal ' + def.label + '. Bukti: ' + proof + '.' + (it.source === 'island' && p.island ? ' Tetap di Pulau Rindu.' : ''),
      'dot',
      it.p
    );
  }
  const sharers = judgeShare === true ? [it.judge] : Array.isArray(judgeShare) ? judgeShare : [];
  sharers.forEach(j => {
    if (j < 0 || !PL(S, j) || PL(S, j).bankrupt) return;
    const g = rewardTo(S, j, def.judgeReward);
    if (g) log(S, PL(S, j).name + ' ikut dapat hadiah (' + g + ').', 'heart', j);
  });
  ev(S, { t: 'challenge', p: it.p, ok, proof, label: def.label, judge: it.judge });
}

export {
  PHOTO_KEEP,
  PHOTO_MAX,
  PHOTO_RE,
  assignJudges,
  chActors,
  chDecks,
  chFinish,
  chItem,
  chSolve,
  charadesOpen,
  cleanText,
  drawChallenge,
  gradeAuto,
  judgeFor,
  judgesFor,
  messageChecks,
  migrate,
  multiJudge,
  normWord,
  secsTxt,
  setupCh,
};
