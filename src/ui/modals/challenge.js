/* LOVEOPOLY — dialog permainan › tantangan terbukti, mini-game berwaktu, kamera foto bukti, galeri bukti (dikumpulkan lewat src/ui/modals.js) */
import { App, D, E, SND, ART, TILES, RULES, esc, ic, $$, toast, controls, act, coin, avatarHTML, safeImg } from '../core.js';
import { btn, closeModal, head, on, refreshModal, showModal, whoLine } from './base.js';

// ----- tantangan -----
function humanCount() {
  return App.S.players.filter(p => p.kind === 'human' && !p.bankrupt).length;
}
// Tidak ada tombol "Benar/Selesai" yang dinilai sendiri. auto = mini-game berwaktu (jawaban dinilai engine),
// duel = lawan ikut main, judge = lawan mengesahkan (Aksi Berani & Foto Bukti). Main bersama di satu HP:
// layar "Serahkan ke …" muncul tiap kali giliran beraksi berpindah orang supaya jawaban rahasia aman.
function rewardChips(def, ch, it) {
  // Momen Berdua: hadiah seragam, sama untuk pemilik & satu pasangannya
  if (it && it.source === 'moment') {
    const m = E.momentReward(App.S),
      pair = it.judge >= 0 ? App.S.players[it.judge].name : '',
      who = ch.type === 'charades' && isMulti(it) ? 'penebak yang benar' : pair;
    return (
      '<div class="reward-row"><span class="chip gold">' +
      coin +
      '+' +
      m.gain +
      '</span><span class="chip rose">' +
      ic('heart') +
      'Love +' +
      m.love +
      '</span>' +
      (who ? '<span class="chip mint">' + ic('users') + 'Hadiah sama untuk ' + esc(who) + '</span>' : '') +
      (def.skip && def.skip.love ? '<span class="chip plain">Lewati: Love ' + def.skip.love + '</span>' : '') +
      '</div>'
    );
  }
  const r = def.reward || {},
    s = def.skip || {},
    jr = def.judgeReward;
  const out = [];
  if (r.gain) out.push('<span class="chip gold">' + coin + '+' + r.gain + '</span>');
  if (r.love) out.push('<span class="chip rose">' + ic('heart') + 'Love +' + r.love + '</span>');
  if (ch.type === 'dilemma') out.push('<span class="chip lilac">' + ic('scale') + 'Pilihanmu mengubah strategi</span>');
  if (jr && it && it.judge >= 0)
    out.push(
      '<span class="chip mint">' +
        ic('users') +
        (ch.type === 'bluff'
          ? isMulti(it)
            ? 'Penebak benar: '
            : 'Ketahuan: '
          : ch.type === 'charades' && isMulti(it)
            ? 'Penebak benar: '
            : isMulti(it)
              ? 'Tiap penilai: '
              : 'Penilai juga: ') +
        [jr.gain ? '+' + jr.gain : '', jr.love ? 'Love +' + jr.love : ''].filter(Boolean).join(' ') +
        '</span>'
    );
  if (it && it.isle) out.push('<span class="chip lilac">' + ic('island') + 'Lulus = keluar dari Pulau Rindu</span>');
  if (s.love) out.push('<span class="chip plain">Lewati: Love ' + s.love + '</span>');
  return '<div class="reward-row">' + out.join('') + '</div>';
}
const VERIFY_TXT = {
  auto: 'Dinilai otomatis oleh game',
  duel: 'Lawan ikut main · dinilai game',
  judge: 'Disahkan lawan',
  choice: 'Pilih strategi',
};
// Momen Berdua = kerja sama: yang menilai disebut pasangan, bukan lawan
const MOMENT_VERIFY = { duel: 'Main berdua · dinilai game', judge: 'Disahkan pasangan' };
const nameList = arr => (arr.length <= 1 ? arr[0] || '' : arr.slice(0, -1).join(', ') + ' & ' + arr[arr.length - 1]);
const judgeList = it => (it.judges || []).map(j => App.S.players[j].name);
// all = true: {j} jadi semua lawan yang ikut (penjelasan cara main di 3–4 pemain); teks tantangan tetap memakai penilai utama
const chFill = (txt, it, all) =>
  String(txt || '')
    .replace(
      /\{j\}/g,
      all && (it.judges || []).length > 1 ? nameList(judgeList(it)) : it.judge >= 0 ? App.S.players[it.judge].name : 'lawanmu'
    )
    .replace(/\{n\}/g, App.S.players[it.p].name);
const isMulti = it => (it.judges || []).length > 1;
const multiGuess = it => isMulti(it) && E.CH[it.ch] && E.CH[it.ch].type === 'charades' && it.phase === 'guess';
const chKey = it => it.p + '|' + it.ch + '|' + it.redraws + '|' + App.S.round;
let chSeen = { key: '', who: -1 };
const chClock = {}; // waktu mulai per tantangan+fase (tetap jalan walau dialog digambar ulang)
function clockOf(it, tag, secs) {
  const k = chKey(it) + '|' + tag;
  if (!chClock[k]) chClock[k] = performance.now();
  const ms = performance.now() - chClock[k];
  return {
    ms,
    left: Math.max(0, secs * 1000 - ms),
    reset: () => {
      delete chClock[k];
    },
  };
}
const timerBar = (left, secs) =>
  '<div class="ch-timer' +
  (left < 5000 ? ' hurry' : '') +
  '" role="timer" aria-label="Sisa waktu"><i style="--v:' +
  Math.max(0, (left / (secs * 1000)) * 100).toFixed(1) +
  '%"></i><b>' +
  Math.ceil(left / 1000) +
  '</b></div>';
// kemajuan voting penilai (3–4 pemain): urutan saja, isi suara orang lain dirahasiakan
const voteNote = it =>
  isMulti(it)
    ? '<div class="note gold">' +
      ic('users') +
      '<span>Penilai ' +
      (Object.keys((it.pz && it.pz.votes) || {}).length + 1) +
      ' dari ' +
      it.judges.length +
      '. Pilihanmu rahasia; mayoritas menentukan (seri = sah).</span></div>'
    : '';
function dChallenge(key) {
  const local = {
    answers: [],
    idx: 0,
    text: '',
    lines: ['', '', ''],
    lie: -1,
    pick: -1,
    guess: '',
    reveal: false,
    photo: '',
    tick: null,
    game: null,
    cam: null,
    fb: '',
    guesser: -1,
  };
  const stopTick = () => {
    if (local.tick) {
      clearInterval(local.tick);
      local.tick = null;
    }
  };
  // Dua Fakta Satu Bohong: syarat kirim (sama dengan engine: 3 pernyataan ≥ RULES.bluffMin huruf + 1 ditandai)
  const bluffFilled = () => local.lines.filter(x => x.trim().length >= RULES.bluffMin).length;
  const bluffOk = () => bluffFilled() === 3 && local.lie >= 0;
  // label tombol kirim = langkah yang masih kurang (tombol mati tidak pernah tanpa alasan)
  const bluffLabel = jn =>
    bluffFilled() < 3 ? 'Isi 3 pernyataan (' + bluffFilled() + '/3)' : local.lie < 0 ? 'Ketuk Bohong dulu' : 'Kirim ke ' + jn;
  const bluffChecks = () =>
    [
      { ok: bluffFilled() === 3, label: 'Isi 3 pernyataan (' + bluffFilled() + '/3)' },
      {
        ok: local.lie >= 0,
        label: local.lie >= 0 ? 'Yang bohong: pernyataan ' + (local.lie + 1) : 'Ketuk Bohong di salah satu pernyataan',
      },
    ]
      .map(c => '<li class="' + (c.ok ? 'ok' : '') + '">' + ic(c.ok ? 'check' : 'dot') + esc(c.label) + '</li>')
      .join('');
  showModal({
    key,
    decision: true,
    size: 'mid',
    blocksAI: false,
    closable: false,
    cleanup: () => {
      stopTick();
      if (local.cam) local.cam.stop();
    },
    build: () => {
      const S = App.S,
        it = head();
      if (!it || it.type !== 'CHALLENGE' || !E.CH[it.ch]) return null;
      const ch = E.CH[it.ch],
        def = D.CH_TYPES[ch.type],
        me = S.players[it.who],
        owner = S.players[it.p];
      const J = it.judge >= 0 ? S.players[it.judge] : null;
      const kicker =
        ic(def.icon || 'heart') +
        esc(it.source === 'island' ? 'Rindu Challenge' : it.source === 'moment' ? 'Momen Berdua' : 'Kartu Cinta') +
        ' · ' +
        ((it.source === 'moment' && MOMENT_VERIFY[def.verify]) || VERIFY_TXT[def.verify]);
      const hero = '<span class="hero-art">' + ART.merpi(it.who === it.p ? 'is-wow' : 'is-think') + '</span>';
      const ownerPhase = it.who === it.p;
      // layar serah-HP (main bersama di satu perangkat)
      const k = chKey(it),
        gateId = multiGuess(it) ? 'guess' : it.who;
      if (chSeen.key !== k) chSeen = { key: k, who: gateId };
      if (App.mode !== 'online' && humanCount() >= 2 && chSeen.who !== gateId && multiGuess(it)) {
        local.gate = true;
        return {
          kicker,
          title: 'Waktunya menebak!',
          who: whoLine(it.p, 'memperagakan'),
          hero,
          body:
            '<div class="ch-gate"><p><b>' +
            esc(nameList(judgeList(it))) +
            '</b>: tebak peragaan ' +
            esc(owner.name) +
            '.</p><p class="muted">Siapa cepat dia dapat! Tiap penebak punya ' +
            (it.pz.max || 3) +
            ' kesempatan. Pilih namamu sebelum mengetik tebakan.</p></div>',
          foot: '<span class="grow"></span>' + btn('id="bGate" data-focus', 'primary big', 'check', 'Mulai menebak'),
        };
      }
      if (App.mode !== 'online' && humanCount() >= 2 && chSeen.who !== gateId) {
        local.gate = true;
        return {
          kicker,
          title: 'Serahkan ke ' + me.name,
          who: whoLine(it.who, ownerPhase ? 'giliran menjawab' : 'penilai'),
          hero,
          body:
            '<div class="ch-gate">' +
            avatarHTML(me, 'lg') +
            '<p><b>' +
            esc(me.name) +
            '</b>, sekarang giliranmu' +
            (ownerPhase ? '' : ' menilai tantangan ' + esc(owner.name)) +
            '.</p><p class="muted">' +
            (ch.type === 'secret' || ch.type === 'charades'
              ? 'Yang lain jangan mengintip layar, ya!'
              : 'Pegang perangkatnya, lalu lanjut.') +
            '</p></div>',
          foot: '<span class="grow"></span>' + btn('id="bGate" data-focus', 'primary big', 'check', 'Aku ' + me.name + ', lanjut'),
        };
      }
      local.gate = false;
      const redrawLeft = RULES.maxRedraws - it.redraws;
      const first =
        ownerPhase && (D.AUTO_TYPES.includes(ch.type) ? !local.started : ['intro', 'write', 'act', 'do', 'choose'].includes(it.phase));
      const ownerBtns = ownerPhase
        ? (first ? btn('id="bRedraw"', 'ghost', 'refresh', 'Ganti (' + redrawLeft + ')', redrawLeft <= 0) : '') +
          btn('id="bSkip"', 'ghost', '', 'Lewati')
        : '';
      const task = '<div class="notepaper">' + esc(chFill(ch.text, it)) + '</div>';
      const how =
        '<div class="tiny muted ch-how">' +
        ic('info') +
        ' ' +
        esc(chFill(def.how, it, ch.type !== 'secret')) +
        (isMulti(it) && ch.type !== 'secret'
          ? ' ' +
            (ch.verify === 'judge' || ch.type === 'message' || def.verify === 'judge'
              ? 'Semua lawan menilai bergantian; mayoritas menentukan (seri = sah).'
              : 'Semua lawan ikut menebak.')
          : '') +
        '</div>';
      let body,
        foot,
        title = def.label;
      // --- auto: mini-game berwaktu ---
      if (D.AUTO_TYPES.includes(ch.type)) {
        const z = it.pz;
        if (!local.started) {
          const need =
            ch.type === 'recall'
              ? 'Ulangi ' + z.seq.length + ' gambar persis'
              : 'Butuh ' + z.need + ' dari ' + (z.qs || z.items).length + ' benar';
          body =
            task +
            how +
            '<div class="ch-stats"><span>' +
            ic('clock') +
            z.secs +
            ' detik</span><span>' +
            ic('target') +
            need +
            '</span></div>' +
            rewardChips(def, ch, it);
          foot = ownerBtns + '<span class="grow"></span>' + btn('id="bChGo" data-focus', 'go big', 'play', 'Mulai!');
        } else {
          body = '<div id="chGame" class="ch-game"></div>';
          foot =
            '<span class="tiny muted">' +
            esc(owner.name) +
            ' sedang beraksi…</span><span class="grow"></span>' +
            btn('id="bChGiveUp"', 'ghost', 'x', 'Menyerah');
        }
        // saat bermain, Merpi di kepala dialog disembunyikan supaya soal & tombol lega di HP
        return { kicker, title, who: whoLine(it.p), body, foot, hero: local.started ? '' : hero };
      }
      if (ch.type === 'dilemma') {
        body =
          task +
          rewardChips(def, ch, it) +
          '<div class="choice-list">' +
          ch.options.map((o, i) => btn('data-opt="' + i + '"', 'choice', 'chevron', o.label)).join('') +
          '</div>';
        return { kicker, title, who: whoLine(it.p), body, foot: ownerBtns, hero };
      }
      const jName = J ? J.name : 'lawan';
      if (ch.type === 'secret') {
        const qs = it.pz.qs.map(q => D.HEART_QS[q]);
        if (it.phase === 'intro') {
          body = task + how + rewardChips(def, ch, it);
          foot =
            ownerBtns + '<span class="grow"></span>' + btn('id="bChStep" data-focus', 'primary big', 'chevron', jName + ' menjawab dulu');
        } else {
          const secretPh = it.phase === 'secret';
          title = secretPh ? 'Jawaban rahasia ' + me.name : 'Tebak isi hati ' + jName;
          body =
            '<div class="note ' +
            (secretPh ? 'warn' : 'good') +
            '">' +
            ic(secretPh ? 'lock' : 'heart') +
            ' ' +
            (secretPh
              ? 'Jawab jujur tentang dirimu. ' + esc(owner.name) + ' tidak bisa melihatnya.'
              : 'Tebak jawaban ' + esc(jName) + '. Butuh ' + it.pz.need + ' cocok.') +
            '</div>' +
            qs
              .map(
                (q, qi) =>
                  '<div class="ch-q"><b>' +
                  (qi + 1) +
                  '. ' +
                  esc(chFill(q.q, it)) +
                  '</b><div class="ch-opts">' +
                  q.o
                    .map(
                      (o, oi) =>
                        '<button type="button" class="ch-opt" data-sa="' +
                        qi +
                        ':' +
                        oi +
                        '" aria-pressed="' +
                        (local.answers[qi] === oi) +
                        '">' +
                        esc(o) +
                        '</button>'
                    )
                    .join('') +
                  '</div></div>'
              )
              .join('');
          const all = qs.every((_, qi) => local.answers[qi] >= 0);
          foot =
            (secretPh ? '' : ownerBtns) +
            '<span class="grow"></span>' +
            btn('id="bChSend"', 'primary big', secretPh ? 'lock' : 'heart', secretPh ? 'Kunci jawaban' : 'Tebak!', !all);
        }
        return { kicker, title, who: whoLine(it.who), body, foot, hero };
      }
      if (ch.type === 'bluff') {
        if (it.phase === 'write') {
          body =
            task +
            rewardChips(def, ch, it) +
            '<div class="note">' +
            ic('info') +
            '<span>Tulis 3 hal tentang dirimu, lalu ketuk <b>Bohong</b> di samping yang palsu. ' +
            esc(jName) +
            ' tidak melihat tandanya.</span></div>' +
            [0, 1, 2]
              .map(
                i =>
                  '<div class="bluff-row"><label class="sr-only" for="bl' +
                  i +
                  '">Pernyataan ' +
                  (i + 1) +
                  '</label><input class="input" id="bl' +
                  i +
                  '" maxlength="90" autocomplete="off" enterkeyhint="' +
                  (i < 2 ? 'next' : 'done') +
                  '" placeholder="' +
                  ['mis. Aku pernah ke Bali', 'mis. Aku takut kucing', 'mis. Aku bisa main gitar'][i] +
                  '" value="' +
                  esc(local.lines[i]) +
                  '"><button type="button" class="lie-btn" data-lie="' +
                  i +
                  '" aria-pressed="' +
                  (local.lie === i) +
                  '">' +
                  ic(local.lie === i ? 'check' : 'question') +
                  '<span>Bohong</span></button></div>'
              )
              .join('') +
            '<ul class="ch-checks" id="blChecks">' +
            bluffChecks() +
            '</ul>';
          foot =
            ownerBtns +
            '<span class="grow"></span>' +
            btn('id="bChSend" data-jn="' + esc(jName) + '"', 'primary big', 'chevron', bluffLabel(jName), !bluffOk());
        } else {
          title = 'Mana yang bohong?';
          body =
            (isMulti(it)
              ? '<div class="note gold">' +
                ic('users') +
                '<span>Penebak ' +
                (Object.keys(it.pz.picks || {}).length + 1) +
                ' dari ' +
                it.judges.length +
                '. Tebakanmu rahasia; hanya yang benar dapat hadiah.</span></div>'
              : '') +
            '<div class="note">' +
            ic('question') +
            ' ' +
            esc(owner.name) +
            ' menulis 3 pernyataan. Satu bohong. Tebak yang mana!</div><div class="bluff-pick">' +
            it.pz.lines
              .map(
                (l, i) =>
                  '<button type="button" class="ch-opt big" data-pick="' +
                  i +
                  '" aria-pressed="' +
                  (local.pick === i) +
                  '"><b>#' +
                  (i + 1) +
                  '</b> ' +
                  esc(l) +
                  '</button>'
              )
              .join('') +
            '</div>';
          foot = '<span class="grow"></span>' + btn('id="bChSend"', 'primary big', 'target', 'Ini yang bohong!', local.pick < 0);
        }
        return { kicker, title, who: whoLine(it.who), body, foot, hero };
      }
      if (ch.type === 'charades') {
        const z = it.pz;
        if (it.phase === 'act') {
          body =
            task +
            how +
            rewardChips(def, ch, it) +
            '<button type="button" class="ch-word' +
            (local.reveal ? ' on' : '') +
            '" id="bReveal" aria-pressed="' +
            local.reveal +
            '">' +
            (local.reveal
              ? '<b>' + esc(z.word) + '</b><span class="tiny">Ketuk untuk menyembunyikan</span>'
              : ic('lock') + '<span>Ketuk untuk melihat kata rahasia</span>') +
            '</button>';
          foot = ownerBtns + '<span class="grow"></span>' + btn('id="bChStep"', 'go big', 'play', 'Mulai peragakan!');
        } else {
          const c = clockOf(it, 'cr', z.secs);
          title = 'Tebak peragaan ' + owner.name;
          if (isMulti(it)) {
            const open = E.chActors(S),
              mine = open.filter(j => controls(j));
            if (!mine.includes(local.guesser)) local.guesser = mine.length ? mine[0] : -1;
            const left = j => (z.max || 3) - ((z.triesBy || {})[j] || 0);
            const pickRow =
              mine.length > 1
                ? '<div class="field"><span class="label">Siapa yang menebak?</span><div class="partner-pick">' +
                  mine
                    .map(
                      j =>
                        '<button type="button" data-gsr="' +
                        j +
                        '" aria-pressed="' +
                        (j === local.guesser) +
                        '">' +
                        avatarHTML(S.players[j], 'xs') +
                        esc(S.players[j].name) +
                        ' · ' +
                        left(j) +
                        '</button>'
                    )
                    .join('') +
                  '</div></div>'
                : '';
            body =
              timerBar(c.left, z.secs) +
              '<div class="note">' +
              ic('users') +
              '<span>' +
              esc(owner.name) +
              ' memperagakan tanpa suara. Siapa cepat dia dapat! ' +
              (local.guesser >= 0
                ? esc(S.players[local.guesser].name) + ': ' + left(local.guesser) + ' kesempatan lagi.'
                : 'Kesempatanmu sudah habis, tunggu yang lain.') +
              '</span></div>' +
              (z.guesses.length
                ? '<div class="ch-guesses">' +
                  z.guesses
                    .map(
                      (g, gi) =>
                        '<span class="chip plain">' +
                        ic('x') +
                        (z.gby && S.players[z.gby[gi]] ? esc(S.players[z.gby[gi]].name) + ': ' : '') +
                        esc(g) +
                        '</span>'
                    )
                    .join('') +
                  '</div>'
                : '') +
              pickRow +
              (local.guesser >= 0
                ? '<div class="field"><label for="chGuess">Tebakan ' +
                  esc(S.players[local.guesser].name) +
                  '</label><input class="input" id="chGuess" maxlength="40" autocomplete="off" value="' +
                  esc(local.guess) +
                  '"></div>'
                : '');
            foot =
              local.guesser >= 0
                ? btn('id="bChGiveUp"', 'ghost', 'x', 'Menyerah') +
                  '<span class="grow"></span>' +
                  btn('id="bChSend"', 'primary big', 'target', 'Tebak!', !local.guess.trim())
                : '<span class="tiny muted">Menunggu penebak lain…</span>';
            return { kicker, title, who: whoLine(it.p, 'memperagakan'), body, foot, hero };
          }
          body =
            timerBar(c.left, z.secs) +
            '<div class="note">' +
            ic('users') +
            ' ' +
            esc(owner.name) +
            ' memperagakan tanpa suara. Ketik tebakanmu (' +
            (z.max - z.tries) +
            ' kesempatan lagi).</div>' +
            (z.guesses.length
              ? '<div class="ch-guesses">' +
                z.guesses.map(g => '<span class="chip plain">' + ic('x') + esc(g) + '</span>').join('') +
                '</div>'
              : '') +
            '<div class="field"><label for="chGuess">Tebakan</label><input class="input" id="chGuess" maxlength="40" autocomplete="off" value="' +
            esc(local.guess) +
            '"></div>';
          foot =
            btn('id="bChGiveUp"', 'ghost', 'x', 'Menyerah') +
            '<span class="grow"></span>' +
            btn('id="bChSend"', 'primary big', 'target', 'Tebak!', !local.guess.trim());
        }
        return { kicker, title, who: whoLine(it.who), body, foot, hero };
      }
      if (ch.type === 'message') {
        if (it.phase === 'write') {
          const checks = E.messageChecks(ch.rule || {}, local.text),
            allOk = checks.every(c => c.ok);
          body =
            task +
            rewardChips(def, ch, it) +
            '<div class="field"><label for="chText">Pesanmu (tiap baris = Enter)</label><textarea class="input" id="chText" maxlength="400" rows="5" placeholder="Tulis di sini…">' +
            esc(local.text) +
            '</textarea></div>' +
            '<ul class="ch-checks" id="chChecks">' +
            checks.map(c => '<li class="' + (c.ok ? 'ok' : '') + '">' + ic(c.ok ? 'check' : 'dot') + esc(c.label) + '</li>').join('') +
            '</ul>';
          foot =
            ownerBtns +
            '<span class="grow"></span>' +
            btn('id="bChSend"', 'primary big', 'letter', J ? 'Kirim ke ' + J.name : 'Kirim', !allOk);
        } else {
          title = 'Sahkan surat ' + owner.name + '?';
          body =
            voteNote(it) +
            '<div class="note good">' +
            ic('check') +
            ' Semua syarat sudah lolos cek otomatis.</div><div class="notepaper ch-letter">' +
            esc(it.pz.text).replace(/\n/g, '<br>') +
            '</div><div class="tiny muted">Tantangan: ' +
            esc(chFill(ch.text, it)) +
            '</div>';
          foot =
            btn('id="bJudgeNo"', 'soft', 'x', 'Tidak sah') +
            '<span class="grow"></span>' +
            btn('id="bJudgeOk" data-focus', 'primary big', 'check', 'Sah, manis!');
        }
        return { kicker, title, who: whoLine(it.who), body, foot, hero };
      }
      if (ch.type === 'dare' || ch.type === 'photo') {
        const crit = '<div class="ch-crit">' + ic('check') + '<span><b>Syarat sah:</b> ' + esc(chFill(ch.crit, it)) + '</span></div>';
        if (it.phase === 'do') {
          body = task + crit + how + rewardChips(def, ch, it);
          if (ch.type === 'dare') {
            const secs = it.pz.secs,
              c = local.timing ? clockOf(it, 'dare', secs) : null;
            body += c
              ? timerBar(c.left, secs)
              : '<div class="ch-stats"><span>' +
                ic('clock') +
                secs +
                ' detik</span><span>' +
                ic('users') +
                'Dinilai ' +
                esc(jName) +
                '</span></div>';
            foot =
              ownerBtns +
              '<span class="grow"></span>' +
              (c ? '' : btn('id="bDareTime"', 'soft', 'clock', 'Mulai timer')) +
              btn('id="bChStep"', 'primary', 'check', 'Minta penilaian ' + jName);
          } else {
            body += '<div id="camHost" class="cam-host"></div>';
            foot =
              ownerBtns +
              '<span class="grow"></span>' +
              btn('id="bChSend"', 'primary big', 'polaroid', 'Kirim foto ke ' + jName, !local.photo);
          }
        } else {
          title = 'Sah atau tidak?';
          body =
            voteNote(it) +
            (ch.type === 'photo'
              ? '<figure class="proof-photo"><img src="' +
                safeImg(it.pz.photo) +
                '" alt="Foto bukti dari ' +
                esc(owner.name) +
                '"><figcaption>Foto bukti ' +
                esc(owner.name) +
                '</figcaption></figure>'
              : '') +
            task +
            crit +
            '<div class="tiny muted">' +
            (isMulti(it)
              ? 'Nilai dengan adil. Tiap penilai dapat Love, apa pun hasilnya.'
              : 'Nilai dengan adil. Kalau sah, kamu juga dapat Love.') +
            '</div>';
          foot =
            btn('id="bJudgeNo"', 'soft', 'x', 'Tidak sah') +
            '<span class="grow"></span>' +
            btn('id="bJudgeOk" data-focus', 'primary big', 'check', 'Sah!');
        }
        return { kicker, title, who: whoLine(it.who), body, foot, hero };
      }
      return null;
    },
    mount: m => {
      const it = head();
      if (!it || !E.CH[it.ch]) return;
      const ch = E.CH[it.ch],
        p = multiGuess(it) ? local.guesser : it.who;
      const send = extra => act(Object.assign({ type: 'CH_ANSWER', p }, extra || {}));
      on(m, '#bGate', () => {
        chSeen.who = multiGuess(it) ? 'guess' : it.who;
        refreshModal();
      });
      $$('[data-gsr]', m).forEach(b =>
        b.addEventListener('click', () => {
          local.guesser = Number(b.dataset.gsr);
          SND.play('click');
          refreshModal();
        })
      );
      if (local.gate) return;
      on(m, '#bRedraw', () => {
        local.started = false;
        local.answers = [];
        act({ type: 'CH_REDRAW', p: it.p });
      });
      on(m, '#bSkip', () => act({ type: 'CH_RESOLVE', p: it.p, result: 'skip' }));
      $$('[data-opt]', m).forEach(b =>
        b.addEventListener('click', () => act({ type: 'CH_RESOLVE', p: it.p, result: 'choice', choice: Number(b.dataset.opt) }))
      );
      // auto
      on(m, '#bChGo', () => {
        local.started = true;
        refreshModal();
      });
      const gh = m.querySelector('#chGame');
      if (gh) {
        if (!local.game)
          local.game = autoGame(gh, it, ch, (answers, ms) => {
            local.game = null;
            send({ answers, ms: Math.round(ms) });
          });
        else local.game.reattach(gh);
        on(m, '#bChGiveUp', () => {
          if (local.game) local.game.finish();
        });
        return;
      }
      // duel / judge
      on(m, '#bChStep', () => {
        stopTick();
        send();
      });
      $$('[data-sa]', m).forEach(b =>
        b.addEventListener('click', () => {
          const [q, o] = b.dataset.sa.split(':').map(Number);
          local.answers[q] = o;
          SND.play('click');
          refreshModal();
        })
      );
      $$('[data-lie]', m).forEach(b =>
        b.addEventListener('click', () => {
          local.lie = Number(b.dataset.lie);
          refreshModal();
        })
      );
      $$('[data-pick]', m).forEach(b =>
        b.addEventListener('click', () => {
          local.pick = Number(b.dataset.pick);
          SND.play('click');
          refreshModal();
        })
      );
      [0, 1, 2].forEach(i => {
        const el = m.querySelector('#bl' + i);
        if (!el) return;
        el.addEventListener('input', () => {
          local.lines[i] = el.value;
          const sb = m.querySelector('#bChSend');
          if (sb) {
            sb.disabled = !bluffOk();
            const t = sb.querySelector('span');
            if (t) t.textContent = bluffLabel(sb.dataset.jn || 'lawan');
          }
          const ul = m.querySelector('#blChecks');
          if (ul) ul.innerHTML = bluffChecks();
        });
        // Enter: ke kolom berikutnya; di kolom terakhir kirim bila sudah lengkap
        el.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const nx = m.querySelector('#bl' + (i + 1));
          if (nx) nx.focus();
          else {
            const sb = m.querySelector('#bChSend');
            if (sb && !sb.disabled) sb.click();
            else el.blur();
          }
        });
      });
      on(m, '#bReveal', () => {
        local.reveal = !local.reveal;
        refreshModal();
      });
      const gi = m.querySelector('#chGuess');
      if (gi) {
        gi.addEventListener('input', () => {
          local.guess = gi.value;
          const sb = m.querySelector('#bChSend');
          if (sb) sb.disabled = !gi.value.trim();
        });
        gi.addEventListener('keydown', e => {
          if (e.key === 'Enter' && gi.value.trim()) {
            e.preventDefault();
            m.querySelector('#bChSend').click();
          }
        });
        setTimeout(() => {
          try {
            gi.focus({ preventScroll: true });
          } catch (e) {
            /* abaikan */
          }
        }, 60);
      }
      const ta = m.querySelector('#chText');
      if (ta) {
        ta.addEventListener('input', () => {
          local.text = ta.value;
          const checks = E.messageChecks(ch.rule || {}, ta.value);
          const ul = m.querySelector('#chChecks');
          if (ul)
            ul.innerHTML = checks
              .map(c => '<li class="' + (c.ok ? 'ok' : '') + '">' + ic(c.ok ? 'check' : 'dot') + esc(c.label) + '</li>')
              .join('');
          const sb = m.querySelector('#bChSend');
          if (sb) sb.disabled = !checks.every(c => c.ok);
        });
      }
      on(m, '#bChSend', () => {
        if (ch.type === 'secret') send({ answers: local.answers.slice(0, it.pz.qs.length) });
        else if (ch.type === 'bluff') {
          if (it.phase === 'write') send({ lines: local.lines, lie: local.lie });
          else send({ pick: local.pick });
        } else if (ch.type === 'charades') {
          const g = local.guess;
          local.guess = '';
          send({ guess: g });
        } else if (ch.type === 'message') send({ text: local.text });
        else if (ch.type === 'photo') send({ photo: local.photo });
        local.answers = [];
        local.pick = -1;
      });
      on(m, '#bChGiveUp', () => send({ giveUp: true }));
      on(m, '#bJudgeOk', () => send({ ok: true }));
      on(m, '#bJudgeNo', () => send({ ok: false }));
      on(m, '#bDareTime', () => {
        local.timing = true;
        refreshModal();
      });
      // detik berjalan (Peragakan! & timer aksi): hanya perbarui bar, tidak menggambar ulang dialog
      stopTick();
      const tb = m.querySelector('.ch-timer');
      if (tb && (ch.type === 'charades' || ch.type === 'dare')) {
        const secs = ch.type === 'charades' ? it.pz.secs : it.pz.secs,
          tag = ch.type === 'charades' ? 'cr' : 'dare';
        local.tick = setInterval(() => {
          const c = clockOf(it, tag, secs);
          tb.classList.toggle('hurry', c.left < 5000);
          tb.querySelector('i').style.setProperty('--v', ((c.left / (secs * 1000)) * 100).toFixed(1) + '%');
          tb.querySelector('b').textContent = Math.ceil(c.left / 1000);
          if (c.left <= 0) {
            stopTick();
            SND.play('bad');
            if (ch.type !== 'charades') return;
            if (!multiGuess(it)) send({ giveUp: true });
            else if (controls(E.actor(App.S))) act({ type: 'CH_ANSWER', p: E.actor(App.S), timeout: true });
          }
        }, 200);
      }
      const camHost = m.querySelector('#camHost');
      if (camHost) {
        if (local.cam) local.cam.reattach(camHost);
        else
          local.cam = cameraBox(camHost, url => {
            local.photo = url;
            const sb = m.querySelector('#bChSend');
            if (sb) sb.disabled = !url;
            const sb2 = document.querySelector('#modalRoot #bChSend');
            if (sb2) sb2.disabled = !url;
          });
      }
    },
  });
}

// ----- mini-game berwaktu (auto). Jawaban dikirim ke engine yang menilai; umpan balik instan memakai E.chSolve -----
function autoGame(host, it, ch, done) {
  const z = it.pz,
    sol = E.chSolve(it) || [],
    t0 = performance.now(),
    secs = z.secs;
  const items = z.qs || z.items || [];
  let el = host,
    idx = 0,
    streak = 0,
    tick = 0,
    over = false,
    phase = ch.type === 'recall' ? 'show' : 'play';
  const answers = [],
    seq = [],
    showT0 = performance.now();
  const left = () => Math.max(0, secs * 1000 - (performance.now() - t0));
  const finish = () => {
    if (over) return;
    over = true;
    clearInterval(tick);
    done(ch.type === 'recall' ? seq.slice() : answers.slice(), performance.now() - t0);
  };
  const feedback = ok => {
    streak = ok ? streak + 1 : 0;
    SND.play(ok ? (streak >= 2 ? 'coin' : 'good') : 'bad');
    el.classList.remove('hit', 'miss');
    void el.offsetWidth;
    el.classList.add(ok ? 'hit' : 'miss');
  };
  const next = v => {
    answers[idx] = v;
    const ok =
      ch.type === 'price'
        ? Math.abs(Number(v) - sol[idx]) <= sol[idx] * z.tol
        : ch.type === 'scramble'
          ? String(v)
              .toLowerCase()
              .replace(/[^a-z]/g, '') ===
            String(sol[idx])
              .toLowerCase()
              .replace(/[^a-z]/g, '')
          : Number(v) === sol[idx];
    feedback(ok);
    idx++;
    if (idx >= items.length) {
      setTimeout(finish, 280);
      return;
    }
    setTimeout(draw, 260);
  };
  const head2 = () =>
    timerBar(left(), secs) +
    '<div class="ch-prog"><span>' +
    (ch.type === 'recall'
      ? phase === 'show'
        ? 'Hafalkan!'
        : 'Ulangi urutannya'
      : 'Soal ' + Math.min(idx + 1, items.length) + '/' + items.length) +
    '</span>' +
    (streak >= 2 ? '<span class="ch-streak">' + ic('bolt') + 'Combo ×' + streak + '</span>' : '') +
    '</div>';
  function draw() {
    if (over) return;
    let h = head2();
    if (ch.type === 'trivia' || ch.type === 'emoji') {
      const q = items[idx];
      h +=
        (ch.type === 'emoji'
          ? '<div class="ch-emoji" aria-label="Petunjuk emoji">' + q.e + '</div><div class="ch-qtxt">Tempat mana ini?</div>'
          : '<div class="ch-qtxt">' + esc(q.t) + '</div>') +
        '<div class="ch-opts grid">' +
        q.o.map((o, k) => '<button type="button" class="ch-opt big" data-ans="' + k + '">' + esc(o) + '</button>').join('') +
        '</div>';
    } else if (ch.type === 'price') {
      const t = TILES[items[idx]];
      h +=
        '<div class="ch-city"><span class="cc-art">' +
        ART.art(t.art) +
        '</span><b>' +
        esc(t.name) +
        '</b></div><form class="ch-in" id="chForm"><label class="sr-only" for="chNum">Harga ' +
        esc(t.name) +
        '</label><input class="input num" id="chNum" inputmode="numeric" autocomplete="off" placeholder="Harga beli…"><button class="btn primary" type="submit">' +
        ic('check') +
        '<span>Kunci</span></button></form>';
    } else if (ch.type === 'math') {
      h +=
        '<div class="ch-qtxt big">' +
        esc(items[idx].t) +
        '</div><form class="ch-in" id="chForm"><label class="sr-only" for="chNum">Jawaban</label><input class="input num" id="chNum" inputmode="numeric" autocomplete="off" placeholder="Jawaban…"><button class="btn primary" type="submit">' +
        ic('check') +
        '<span>Kunci</span></button></form>';
    } else if (ch.type === 'scramble') {
      h +=
        '<div class="ch-tiles" aria-label="Huruf acak">' +
        items[idx].w
          .split('')
          .map(c => (c === ' ' ? '<i class="sp"></i>' : '<span>' + esc(c) + '</span>'))
          .join('') +
        '</div><form class="ch-in" id="chForm"><label class="sr-only" for="chNum">Nama tempat</label><input class="input" id="chNum" autocomplete="off" autocapitalize="words" placeholder="Nama tempat…"><button class="btn primary" type="submit">' +
        ic('check') +
        '<span>Kunci</span></button></form>';
    } else if (ch.type === 'recall') {
      if (phase === 'show')
        h +=
          '<div class="rc-seq show">' +
          z.seq.map((k, i) => '<span class="rc-cell" style="--i:' + i + '">' + ART.art(k) + '</span>').join('') +
          '</div>';
      else
        h +=
          '<div class="rc-seq">' +
          z.seq.map((_, i) => '<span class="rc-cell slot">' + (seq[i] ? ART.art(seq[i]) : '<i>' + (i + 1) + '</i>') + '</span>').join('') +
          '</div>' +
          '<div class="rc-pool">' +
          z.pool
            .map(
              k =>
                '<button type="button" class="rc-btn" data-rc="' +
                k +
                '" aria-label="' +
                esc((TILES.find(t => t.art === k) || {}).name || k) +
                '">' +
                ART.art(k) +
                '</button>'
            )
            .join('') +
          '</div>' +
          '<div class="ch-in">' +
          btn('id="rcUndo"', 'ghost', 'back', 'Hapus', !seq.length) +
          '</div>';
    }
    el.innerHTML = h;
    $$('[data-ans]', el).forEach(b => b.addEventListener('click', () => next(Number(b.dataset.ans))));
    const f = el.querySelector('#chForm');
    if (f) {
      const inp = f.querySelector('input');
      f.addEventListener('submit', e => {
        e.preventDefault();
        const v = inp.value.trim();
        if (!v) return;
        next(ch.type === 'scramble' ? v : Number(v.replace(/[^\d-]/g, '')));
      });
      setTimeout(() => {
        try {
          inp.focus({ preventScroll: true });
        } catch (e) {
          /* abaikan */
        }
      }, 30);
    }
    $$('[data-rc]', el).forEach(b =>
      b.addEventListener('click', () => {
        if (seq.length >= z.seq.length) return;
        seq.push(b.dataset.rc);
        const ok = seq[seq.length - 1] === z.seq[seq.length - 1];
        SND.play(ok ? 'click' : 'bad');
        if (seq.length >= z.seq.length) {
          feedback(seq.every((x, i) => x === z.seq[i]));
          setTimeout(finish, 300);
        }
        draw();
      })
    );
    const u = el.querySelector('#rcUndo');
    if (u)
      u.addEventListener('click', () => {
        seq.pop();
        draw();
      });
  }
  tick = setInterval(() => {
    if (over) return;
    if (phase === 'show' && performance.now() - showT0 >= z.showMs) {
      phase = 'play';
      draw();
      return;
    }
    const bar = el.querySelector('.ch-timer');
    if (bar) {
      const l = left();
      bar.classList.toggle('hurry', l < 5000);
      bar.querySelector('i').style.setProperty('--v', ((l / (secs * 1000)) * 100).toFixed(1) + '%');
      bar.querySelector('b').textContent = Math.ceil(l / 1000);
    }
    if (left() <= 0) {
      SND.play('bad');
      finish();
    }
  }, 150);
  draw();
  return {
    finish,
    reattach(h) {
      el = h;
      draw();
    },
  };
}

// ----- kamera foto bukti: pratinjau langsung + hitung mundur 3-2-1, cadangan unggah/ambil foto dari galeri.
// Foto dikecilkan (≈ 240 px, JPEG) supaya muat di state permainan & room online. -----
function cameraBox(host, onShot) {
  let el = host,
    stream = null,
    url = '',
    err = '',
    counting = 0,
    cdT = 0;
  const shrink = src =>
    new Promise(res => {
      const draw = (w, q) => {
        const c = document.createElement('canvas'),
          r = src.videoWidth ? src.videoHeight / src.videoWidth : src.height / src.width;
        c.width = w;
        c.height = Math.round(w * r);
        const g = c.getContext('2d');
        if (src.videoWidth) {
          g.translate(w, 0);
          g.scale(-1, 1);
        }
        g.drawImage(src, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', q);
      };
      let w = 260,
        q = 0.62,
        out = draw(w, q);
      while (out.length > 20000 && w > 140) {
        w -= 30;
        q = Math.max(0.4, q - 0.05);
        out = draw(w, q);
      }
      res(out.length <= 21500 ? out : '');
    });
  const stop = () => {
    clearInterval(cdT);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  };
  async function open() {
    err = '';
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
    } catch (e) {
      err = 'Kamera tidak bisa dibuka. Pakai tombol unggah foto di bawah.';
    }
    draw();
  }
  function draw() {
    const live = !!stream && !url;
    el.innerHTML =
      '<div class="cam-frame' +
      (url ? ' shot' : '') +
      '">' +
      (url
        ? '<img src="' + safeImg(url) + '" alt="Foto bukti">'
        : live
          ? '<video id="camVid" playsinline muted autoplay></video>'
          : '<div class="cam-empty">' + ic('polaroid') + '<span>' + esc(err || 'Buka kamera untuk foto bukti') + '</span></div>') +
      (counting ? '<b class="cam-cd" aria-live="assertive">' + counting + '</b>' : '') +
      '</div>' +
      '<div class="cam-bar">' +
      (url
        ? btn('id="camRetake"', 'soft', 'refresh', 'Foto ulang')
        : live
          ? btn('id="camSnap" data-focus', 'go', 'polaroid', counting ? 'Siap…' : 'Cekrek (3 dtk)', !!counting)
          : btn('id="camOpen"', 'primary', 'polaroid', 'Buka kamera')) +
      '<label class="btn ghost cam-file">' +
      ic('plus') +
      '<span>Unggah foto</span><input type="file" accept="image/*" capture="user" id="camFile" class="sr-only"></label></div>' +
      '<p class="cam-note">' +
      ic('shield') +
      '<span>Foto dikecilkan dan hanya dilihat pemain di permainan ini. Online: foto tersimpan di room bersama permainan. <button type="button" class="link-btn" id="camPriv">Privasi</button></span></p>';
    const v = el.querySelector('#camVid');
    if (v && stream) {
      v.srcObject = stream;
      v.play().catch(() => {});
    }
    const o = el.querySelector('#camOpen');
    if (o) o.addEventListener('click', open);
    const r = el.querySelector('#camRetake');
    if (r)
      r.addEventListener('click', () => {
        url = '';
        onShot('');
        if (!stream) open();
        else draw();
      });
    const sn = el.querySelector('#camSnap');
    if (sn)
      sn.addEventListener('click', () => {
        counting = 3;
        SND.play('click');
        draw();
        cdT = setInterval(async () => {
          counting--;
          if (counting > 0) {
            SND.play('click');
            draw();
            return;
          }
          clearInterval(cdT);
          const vid = el.querySelector('#camVid');
          SND.play('stamp');
          url = vid ? await shrink(vid) : '';
          if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
          }
          onShot(url);
          draw();
        }, 800);
      });
    const pv = el.querySelector('#camPriv');
    if (pv)
      pv.addEventListener('click', () =>
        toast(
          'Foto Bukti dikecilkan (±20 KB) dan hanya dilihat pemain di permainan yang sama. Saat main online, foto tersimpan di room bersama permainan. Detail: Pengaturan → Privasi & data.',
          { title: 'Privasi foto', icon: 'shield', ms: 7000 }
        )
      );
    const f = el.querySelector('#camFile');
    if (f)
      f.addEventListener('change', () => {
        const file = f.files && f.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = async () => {
          url = await shrink(img);
          URL.revokeObjectURL(img.src);
          if (!url) err = 'Foto terlalu besar, coba lagi.';
          stop();
          onShot(url);
          draw();
        };
        img.src = URL.createObjectURL(file);
      });
  }
  draw();
  return {
    stop,
    reattach(h) {
      el = h;
      draw();
    },
  };
}

// galeri foto bukti (dibuka dari polaroid di papan & layar akhir)
function openProofs() {
  showModal({
    key: 'proofs',
    size: 'mid',
    build: () => {
      const S = App.S,
        ph = (S && S.photos) || [],
        pr = (S && S.proofs) || [];
      const photos = ph.length
        ? '<div class="proof-grid">' +
          ph
            .slice()
            .reverse()
            .map(
              x =>
                '<figure class="proof-photo' +
                (x.ok ? '' : ' no') +
                '"><img src="' +
                safeImg(x.img) +
                '" alt="Foto bukti ' +
                esc(S.players[x.p].name) +
                '"><figcaption><span class="pc-who"><b>' +
                esc(S.players[x.p].name) +
                '</b> · ronde ' +
                x.r +
                '</span><span class="' +
                (x.ok ? 'ok' : 'bad') +
                '">' +
                ic(x.ok ? 'check' : 'x') +
                (x.ok ? 'Disahkan' : 'Ditolak') +
                (x.judge >= 0 ? ' ' + esc(S.players[x.judge].name) : '') +
                '</span><small>' +
                esc(x.text) +
                '</small></figcaption></figure>'
            )
            .join('') +
          '</div>'
        : '<div class="empty">' + ic('polaroid') + 'Belum ada foto bukti. Kartu Foto Bukti membuka kamera.</div>';
      const list = pr.length
        ? '<ul class="proof-list">' +
          pr
            .slice()
            .reverse()
            .slice(0, 12)
            .map(
              x =>
                '<li class="' +
                (x.ok ? 'ok' : 'bad') +
                '">' +
                ic(x.ok ? 'check' : 'x') +
                '<span><b>' +
                esc(S.players[x.p].name) +
                '</b> · ' +
                esc(x.label) +
                '<small>' +
                esc(x.proof) +
                '</small></span></li>'
            )
            .join('') +
          '</ul>'
        : '';
      return {
        kicker: ic('polaroid') + 'Bukti tantangan',
        title: 'Galeri Bukti',
        body: photos + (list ? '<h3 class="mini-h">Riwayat tantangan</h3>' + list : ''),
        foot: '<span class="grow"></span>' + btn('id="bPfClose" data-focus', 'primary', 'check', 'Tutup'),
      };
    },
    mount: m => on(m, '#bPfClose', () => closeModal()),
  });
}

export { chKey, dChallenge, multiGuess, openProofs };
