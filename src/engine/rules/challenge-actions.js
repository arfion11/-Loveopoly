/* LOVEOPOLY — engine aturan › handler aksi tantangan (dikumpulkan lewat src/engine/engine.js) */
import {
  AUTO_TYPES,
  CH,
  CH_TYPES,
  CHARADES,
  CHARADES_EN,
  H,
  HEART_QS,
  PL,
  RULES,
  clampInt,
  ev,
  fail,
  log,
  loveAdd,
  sub,
  tx,
} from './base.js';
import { applyFx } from './move.js';
import {
  PHOTO_KEEP,
  PHOTO_MAX,
  PHOTO_RE,
  assignJudges,
  chActors,
  chFinish,
  charadesOpen,
  cleanText,
  drawChallenge,
  gradeAuto,
  messageChecks,
  multiJudge,
  normWord,
  setupCh,
} from './challenges.js';
import { head } from './turns.js';

// --- tantangan ---
// CH_REDRAW / CH_RESOLVE(skip|choice) oleh pemilik; CH_ANSWER oleh yang sedang beraksi (pemilik atau penilai)
const chHead = (S, p) => {
  const it = S.queue[0];
  if (!it || it.type !== 'CHALLENGE') fail('Tidak ada tantangan yang menunggu.');
  if (it.p !== p) fail('Ini bukan tantanganmu.');
  return it;
};
const FIRST_PHASE = { secret: 'intro', bluff: 'write', charades: 'act', message: 'write', dare: 'do', photo: 'do', dilemma: 'choose' };
H.CH_REDRAW = (S, a) => {
  const it = chHead(S, a.p),
    ch = CH[it.ch];
  if (it.who !== it.p || it.phase !== (FIRST_PHASE[ch.type] || 'play')) fail('Tantangan sudah berjalan, tidak bisa diganti.');
  if (it.redraws >= RULES.maxRedraws) fail('Batas ganti tantangan sudah habis.');
  it.ch = drawChallenge(S, a.p, it.cat);
  assignJudges(S, it, it.rot == null);
  it.redraws++;
  setupCh(S, it);
};
// voting penilai (3–4 pemain): bergiliran, rahasia satu sama lain; mayoritas menentukan, seri = sah
function judgeVote(S, it, okVote, p) {
  it.pz.votes = it.pz.votes || {};
  it.pz.votes[p] = !!okVote;
  const next = it.judges.find(j => !(j in it.pz.votes) && !PL(S, j).bankrupt);
  if (next != null) {
    it.who = next;
    return null;
  }
  const vs = it.judges.filter(j => j in it.pz.votes);
  const yes = vs.filter(j => it.pz.votes[j]).length;
  const ok = yes >= vs.length - yes;
  return {
    ok,
    vs,
    txt: tx(ok ? 'disahkan {y} dari {c} penilai ({l})' : 'tidak disahkan {y} dari {c} penilai ({l})', {
      y: yes,
      c: vs.length,
      l: vs.map(j => PL(S, j).name + (it.pz.votes[j] ? ' ✓' : ' ✗')).join(', '),
    }),
  };
}
// kata Peragakan! cocok? (bahasa Indonesia atau padanan English di CHARADES_EN)
const wordHit = (g, word) => {
  const k = CHARADES.indexOf(word),
    alt = k >= 0 ? CHARADES_EN[k] : '';
  return normWord(g) === normWord(word) || (!!alt && normWord(g) === normWord(alt));
};
H.CH_ANSWER = (S, a) => {
  const it0 = S.queue[0];
  const it = charadesOpen(S, it0) && chActors(S).includes(a.p) ? it0 : head(S, 'CHALLENGE', a.p);
  const ch = CH[it.ch],
    J = it.judge >= 0 ? PL(S, it.judge).name : '';
  const multi = multiJudge(it);
  if (AUTO_TYPES.includes(ch.type)) {
    const ms = clampInt(a.ms, 0, 3600000),
      z = it.pz;
    const late = ms > z.secs * 1000 + 2000;
    const got = late ? 0 : gradeAuto(it, a.answers);
    const total = ch.type === 'recall' ? z.seq.length : (z.qs || z.items).length;
    const shown =
      ch.type === 'recall'
        ? got
          ? tx('urutan {n} gambar tepat', { n: total })
          : tx('urutan keliru')
        : tx('{g}/{n} benar', { g: got, n: total });
    chFinish(
      S,
      it,
      !late && got >= z.need,
      late ? tx('waktu habis') : tx('{x} dalam {s} dtk', { x: sub(shown), s: Math.round(ms / 100) / 10 })
    );
    return;
  }
  if (ch.type === 'secret') {
    const n = it.pz.qs.length,
      A = Array.isArray(a.answers) ? a.answers.map(Number) : [];
    if (it.phase === 'intro') {
      it.phase = 'secret';
      it.who = it.judge;
      return;
    }
    if (A.length !== n || A.some((v, k) => !(v >= 0 && v < HEART_QS[it.pz.qs[k]].o.length))) fail('Jawab semua pertanyaan.');
    if (it.phase === 'secret') {
      it.pz.secret = A;
      it.phase = 'guess';
      it.who = it.p;
      return;
    }
    const hit = A.reduce((c, v, k) => c + (v === it.pz.secret[k] ? 1 : 0), 0);
    it.pz.guess = A;
    const ok = hit >= it.pz.need;
    chFinish(S, it, ok, tx('{h}/{n} cocok dengan jawaban rahasia {j}', { h: hit, n, j: J }), ok);
    return;
  }
  if (ch.type === 'bluff') {
    if (it.phase === 'write') {
      const L = (Array.isArray(a.lines) ? a.lines : []).map(x => cleanText(x, 90));
      if (L.length !== 3 || L.some(x => x.length < RULES.bluffMin))
        fail(tx('Tulis 3 pernyataan, masing-masing minimal {n} huruf.', { n: RULES.bluffMin }));
      const lie = Number(a.lie);
      if (!(lie >= 0 && lie < 3)) fail('Tandai pernyataan yang bohong.');
      it.pz = { lines: L, lie };
      it.phase = 'guess';
      it.who = it.judge;
      return;
    }
    const pick = Number(a.pick);
    if (!(pick >= 0 && pick < 3)) fail('Pilih pernyataan yang menurutmu bohong.');
    if (multi) {
      it.pz.picks = it.pz.picks || {};
      it.pz.picks[a.p] = pick;
      const next = it.judges.find(j => !(j in it.pz.picks) && !PL(S, j).bankrupt);
      if (next != null) {
        it.who = next;
        return;
      }
      const gs = it.judges.filter(j => j in it.pz.picks),
        caught = gs.filter(j => it.pz.picks[j] === it.pz.lie),
        fooled = gs.length - caught.length;
      const okB = fooled >= caught.length;
      chFinish(
        S,
        it,
        okB,
        tx('{f} dari {g} tertipu, yang bohong #{l}{c}', {
          f: fooled,
          g: gs.length,
          l: it.pz.lie + 1,
          c: caught.length ? { t: ' · ketahuan {x}', p: { x: caught.map(j => PL(S, j).name).join(' & ') } } : '',
        }),
        caught
      );
      return;
    }
    it.pz.pick = pick;
    const fooled = pick !== it.pz.lie;
    chFinish(
      S,
      it,
      fooled,
      tx('{j} menebak #{a}, yang bohong #{b}{x}', {
        j: J,
        a: pick + 1,
        b: it.pz.lie + 1,
        x: { t: fooled ? ' (berhasil mengecoh)' : ' (ketahuan)' },
      }),
      !fooled
    );
    return;
  }
  if (ch.type === 'charades') {
    const z = it.pz;
    if (it.phase === 'act') {
      it.phase = 'guess';
      it.who = it.judge;
      return;
    }
    if (multi) {
      z.triesBy = z.triesBy || {};
      z.gby = z.gby || [];
      const nm = PL(S, a.p).name;
      if (a.timeout) {
        chFinish(
          S,
          it,
          false,
          tx('waktu habis, tidak ada yang menebak "{w}"{g}', {
            w: { t: z.word },
            g: z.guesses.length ? { t: ' ({n} tebakan)', p: { n: z.guesses.length } } : '',
          }),
          false
        );
        return;
      }
      if (a.giveUp) z.triesBy[a.p] = z.max;
      else {
        const g = cleanText(a.guess, 40);
        if (!normWord(g)) fail('Ketik tebakanmu.');
        z.guesses.push(g);
        z.gby.push(a.p);
        z.tries++;
        z.triesBy[a.p] = (z.triesBy[a.p] || 0) + 1;
        if (wordHit(g, z.word)) {
          chFinish(S, it, true, tx('{n} menebak "{w}" di tebakan ke-{k}', { n: nm, w: { t: z.word }, k: z.triesBy[a.p] }), [a.p]);
          return;
        }
      }
      const left = chActors(S);
      if (!left.length) {
        chFinish(S, it, false, tx('semua penebak kehabisan kesempatan, jawabannya "{w}"', { w: { t: z.word } }), false);
        return;
      }
      if (!left.includes(it.who)) it.who = left[0];
      return;
    }
    if (a.giveUp) {
      chFinish(
        S,
        it,
        false,
        tx('{j} tidak berhasil menebak "{w}"{g}', {
          j: J,
          w: { t: z.word },
          g: z.guesses.length ? { t: ' ({n} tebakan)', p: { n: z.guesses.length } } : '',
        }),
        false
      );
      return;
    }
    const g = cleanText(a.guess, 40);
    if (!normWord(g)) fail('Ketik tebakanmu.');
    z.guesses.push(g);
    z.tries++;
    if (wordHit(g, z.word)) {
      chFinish(S, it, true, tx('{j} menebak "{w}" di tebakan ke-{k}', { j: J, w: { t: z.word }, k: z.tries }), true);
      return;
    }
    if (z.tries >= z.max) chFinish(S, it, false, tx('{j} salah {k} kali, jawabannya "{w}"', { j: J, k: z.tries, w: { t: z.word } }), false);
    return;
  }
  if (ch.type === 'message') {
    if (it.phase === 'write') {
      const text = cleanText(a.text, 400);
      const bad = messageChecks(ch.rule || {}, text).filter(c => !c.ok);
      if (bad.length) fail(tx('Belum lolos syarat: {x}.', { x: bad.map(c => c.label.text).join(', ') }));
      it.pz = { text };
      if (it.judge >= 0) {
        it.phase = 'judge';
        it.who = it.judge;
        return;
      }
    } else if (multi) {
      const v = judgeVote(S, it, a.ok, a.p);
      if (!v) return;
      if (!v.ok) {
        chFinish(S, it, false, tx('lolos syarat, tapi {x}', { x: sub(v.txt) }), v.vs);
        return;
      }
      it.pz.voteTxt = v.txt;
      it.pz.voters = v.vs;
    } else if (!a.ok) {
      chFinish(S, it, false, tx('lolos syarat, tapi tidak disahkan {j}', { j: J }), false);
      return;
    }
    const text = it.pz.text,
      p = PL(S, it.p);
    S.letters.push({ p: it.p, text, r: S.round });
    if (S.letters.length > 40) S.letters.shift();
    p.stats.letters++;
    ev(S, { t: 'letter', p: it.p });
    chFinish(
      S,
      it,
      true,
      tx('lolos semua syarat{x}', {
        x: it.pz.voteTxt
          ? { t: ' · {v}', p: { v: sub(it.pz.voteTxt) } }
          : it.judge >= 0
            ? { t: ' · disahkan {j}', p: { j: J } }
            : { t: ' (dicek otomatis)' },
      }),
      it.pz.voters || it.judge >= 0
    );
    return;
  }
  if (ch.type === 'dare') {
    if (it.phase === 'do') {
      it.phase = 'judge';
      it.who = it.judge;
      it.pz.votes = {};
      return;
    }
    if (multi) {
      const v = judgeVote(S, it, a.ok, a.p);
      if (v) chFinish(S, it, v.ok, v.txt, v.vs);
      return;
    }
    chFinish(S, it, !!a.ok, tx(a.ok ? 'disahkan oleh {j}' : 'tidak disahkan oleh {j}', { j: J }), !!a.ok);
    return;
  }
  if (ch.type === 'photo') {
    if (it.phase === 'do') {
      const ph = String(a.photo || '');
      if (!ph || ph.length > PHOTO_MAX || !PHOTO_RE.test(ph)) fail('Ambil foto bukti dulu.');
      it.pz = { photo: ph, votes: {} };
      it.phase = 'judge';
      it.who = it.judge;
      return;
    }
    // foto disimpan (maksimal 4 terakhir) dan dipajang di papan; yang ditolak tetap tersimpan sebagai bukti
    let okP = !!a.ok,
      txtP = tx(a.ok ? 'foto disahkan oleh {j}' : 'foto tidak disahkan oleh {j}', { j: J }),
      shareP = okP;
    if (multi) {
      const v = judgeVote(S, it, a.ok, a.p);
      if (!v) return;
      okP = v.ok;
      txtP = tx('foto {x}', { x: sub(v.txt) });
      shareP = v.vs;
    }
    S.photos = S.photos || [];
    // ch = id tantangan: UI menampilkan teks tantangan dalam bahasa perangkat (text = Indonesia, untuk save lama)
    S.photos.push({ p: it.p, img: it.pz.photo, text: ch.text.replace(/\{j\}/g, J), ch: it.ch, ok: okP, judge: it.judge, r: S.round });
    while (S.photos.length > PHOTO_KEEP) S.photos.shift();
    chFinish(S, it, okP, txtP, shareP);
    return;
  }
  fail('Tantangan ini tidak memakai jawaban.');
};
H.CH_RESOLVE = (S, a) => {
  const it = chHead(S, a.p);
  const ch = CH[it.ch],
    def = CH_TYPES[ch.type];
  const p = PL(S, a.p);
  const res = a.result;
  if (res === 'choice') {
    if (ch.type !== 'dilemma' || it.who !== a.p) fail('Pilihan hanya untuk dilema.');
    const opt = ch.options[a.choice];
    if (!opt) fail('Pilih salah satu opsi.');
    S.queue.shift();
    log(S, tx('{n} memilih: {o}.', { n: p.name, o: { t: opt.label } }), 'scale', a.p);
    p.stats.challenges++;
    applyFx(S, a.p, opt.fx);
    ev(S, { t: 'challenge', p: a.p, ok: true, dilemma: true });
    return;
  }
  if (res === 'skip') {
    S.queue.shift();
    const sk = def.skip || {};
    if (sk.love) loveAdd(S, a.p, sk.love);
    p.stats.skipped++;
    log(
      S,
      tx('{n} melewati {c}{l}.', { n: p.name, c: { t: def.label }, l: sk.love ? { t: ' (Love {v})', p: { v: sk.love } } : '' }),
      'dot',
      a.p
    );
    return;
  }
  // "complete"/"fail" dari pemain sendiri tidak diterima lagi: hasil harus dibuktikan lewat CH_ANSWER
  fail('Hasil tantangan harus dibuktikan lewat jawaban atau penilaian lawan.');
};
