/* LOVEOPOLY — layar › setup lokal / lawan AI (dikumpulkan lewat src/ui/screens.js) */
import { D, E, SND, RULES, KEYS, fmt, esc, ic, $, $$, store, avatarHTML, t } from '../core.js';
import { seg, show } from './base.js';
import { passport } from './passport.js';
import { renderHome } from './home.js';
import { enterGame } from './game.js';

// ---------- setup lokal / AI ----------
let setup = null;
// nama bawaan "Pemain n" (bahasa aktif); nama bawaan dikenali di kedua bahasa (setelan lama bisa berbahasa lain)
const playerN = n => t('Pemain {n}', { n });
const isDefaultName = nm => /^(Pemain|Player) \d$/.test(nm);
// baris sakelar aturan: judul + keterangan; nama aksesibel = judul yang terlihat
const toggle = (id, title, note, on) =>
  '<div class="toggle-row"><div><b>' +
  esc(t(title)) +
  '</b><div class="tiny muted">' +
  esc(note) +
  '</div></div><button type="button" class="switch" role="switch" id="' +
  id +
  '" aria-checked="' +
  !!on +
  '" aria-label="' +
  esc(t(title)) +
  '"></button></div>';
function defaultSetup(kind) {
  const base = store.get(KEYS.setup, null);
  const s = {
    kind,
    players:
      kind === 'ai'
        ? [
            { name: t('Kamu§nama'), avatar: '🐻', color: D.TOKEN_COLORS[0], kind: 'human', ai: 'normal' },
            { name: t(D.AI_NAMES[0]), avatar: '🐰', color: D.TOKEN_COLORS[1], kind: 'ai', ai: 'normal' },
          ]
        : [
            { name: playerN(1), avatar: '🐻', color: D.TOKEN_COLORS[0], kind: 'human', ai: 'normal' },
            { name: playerN(2), avatar: '🐰', color: D.TOKEN_COLORS[1], kind: 'human', ai: 'normal' },
          ],
    startCash: RULES.startCash,
    roundLimit: 25,
    takeover: true,
    instantWin: true,
    diceControl: true,
    moment: true,
  };
  if (base && base.kind === kind && Array.isArray(base.players) && base.players.length >= 2) {
    Object.assign(s, base);
    s.players = s.players.map((p, i) => Object.assign({}, p, { color: D.TOKEN_COLORS.includes(p.color) ? p.color : D.TOKEN_COLORS[i] }));
    if (![2000, 2500, 3000].includes(s.startCash)) s.startCash = RULES.startCash;
    if (![15, 25, 35, 0].includes(s.roundLimit)) s.roundLimit = 25;
  }
  return applyPassport(s);
}
// pemegang Paspor Cinta otomatis jadi Pemain 1 (avatar/warna pemain lain digeser bila bentrok)
function applyPassport(s) {
  const pp = passport();
  if (pp.name) {
    const p0 = s.players[0];
    Object.assign(p0, { name: pp.name, avatar: pp.avatar, color: pp.color, kind: 'human' });
    s.players.slice(1).forEach((q, k) => {
      if (q.name.trim().toLowerCase() === pp.name.toLowerCase())
        q.name = q.kind === 'ai' ? t(D.AI_NAMES[k % D.AI_NAMES.length]) : playerN(k + 2);
      const usedA = s.players.filter(x => x !== q).map(x => x.avatar),
        usedC = s.players.filter(x => x !== q).map(x => x.color);
      if (usedA.includes(q.avatar)) q.avatar = D.AVATARS.find(a => !usedA.includes(a));
      if (usedC.includes(q.color)) q.color = D.TOKEN_COLORS.find(c => !usedC.includes(c));
    });
  }
  return s;
}
// ---------- Main lagi cepat (beranda): setelan game lokal terakhir, dicatat enterGame di KEYS.last ----------
const SET_OPTS = { startCash: [2000, 2500, 3000], roundLimit: [15, 25, 35, 0] };
function lastSetup() {
  const o = store.get(KEYS.last, null);
  if (!o || typeof o !== 'object' || !Array.isArray(o.players) || o.players.length < 2 || o.players.length > 4) return null;
  const st = o.settings && typeof o.settings === 'object' ? o.settings : {};
  const players = o.players.map(p => ({
    name: p && typeof p.name === 'string' ? p.name.trim().slice(0, 16) : '',
    avatar: p && D.AVATARS.includes(p.avatar) ? p.avatar : null,
    color: p && D.TOKEN_COLORS.includes(p.color) ? p.color : null,
    kind: p && p.kind === 'ai' ? 'ai' : 'human',
    ai: p && ['easy', 'normal', 'hard'].includes(p.ai) ? p.ai : 'normal',
  }));
  if (players.some(p => !p.name || !p.avatar || !p.color)) return null;
  if (new Set(players.map(p => p.avatar)).size < players.length || new Set(players.map(p => p.color)).size < players.length) return null;
  const humans = players.filter(p => p.kind === 'human').length;
  const s = {
    kind: humans === 1 && humans < players.length ? 'ai' : 'local',
    players,
    startCash: SET_OPTS.startCash.includes(st.startCash) ? st.startCash : RULES.startCash,
    roundLimit: SET_OPTS.roundLimit.includes(st.roundLimit) ? st.roundLimit : 25,
    takeover: st.takeover !== false,
    instantWin: st.instantWin !== false,
    diceControl: st.diceControl !== false,
    moment: st.moment !== false,
  };
  applyPassport(s);
  return Object.keys(setupErrors(s)).length ? null : s;
}
// ringkasan untuk kartu beranda: "🐻 Arfi vs 🐰 Nadia · 25 ronde"
function lastSetupText(s) {
  const who = p => p.avatar + ' ' + p.name + (p.kind === 'ai' ? ' (' + { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[p.ai] + ')' : '');
  const ps = s.players.map(who);
  return (ps.length === 2 ? ps.join(' vs ') : ps.join(', ')) + ' · ' + (s.roundLimit ? t('{n} ronde', { n: s.roundLimit }) : t('Bebas'));
}
function quickReplay() {
  const s = lastSetup();
  if (s) startSetup(s);
  else openSetup('local');
}
function openSetup(kind, preset) {
  setup = preset || defaultSetup(kind);
  show('scrSetup', preset ? null : kind === 'ai' ? 'ai' : 'local');
  renderSetup();
}
function setupErrors(s0) {
  const errs = {};
  const s = s0 || setup;
  const names = s.players.map(p => p.name.trim().toLowerCase());
  s.players.forEach((p, i) => {
    const n = p.name.trim();
    if (!n) errs['name' + i] = t('Nama wajib diisi.');
    else if (n.length > 16) errs['name' + i] = t('Maksimal 16 karakter.');
    else if (names.indexOf(n.toLowerCase()) !== i) errs['name' + i] = t('Nama sudah dipakai pemain lain.');
  });
  if (!s.players.some(p => p.kind === 'human')) errs.humans = t('Minimal satu pemain manusia.');
  return errs;
}
function renderSetup() {
  const errs = setupErrors();
  const s = setup;
  const used = (k, i) => s.players.filter((_, j) => j !== i).map(p => p[k]);
  const seats = s.players
    .map(
      (p, i) =>
        '<div class="seat-card" style="--c:' +
        p.color +
        '">' +
        '<div class="sc-head">' +
        avatarHTML(p, 'lg') +
        '<div class="field grow"><label for="pn' +
        i +
        '">' +
        esc(playerN(i + 1)) +
        '</label><input class="input' +
        (errs['name' + i] ? ' invalid' : '') +
        '" id="pn' +
        i +
        '" data-i="' +
        i +
        '" maxlength="16" value="' +
        esc(p.name) +
        '" autocomplete="off">' +
        (errs['name' + i] ? '<div class="err">' + esc(errs['name' + i]) + '</div>' : '') +
        '</div>' +
        (s.players.length > 2
          ? '<button type="button" class="icon-btn" data-rm="' +
            i +
            '" aria-label="' +
            esc(t('Hapus pemain {n}', { n: i + 1 })) +
            '">' +
            ic('x') +
            '</button>'
          : '') +
        '</div>' +
        '<div class="pick-row" aria-label="' +
        esc(t('Avatar')) +
        '">' +
        D.AVATARS.map(
          a =>
            '<button type="button" class="avbtn" data-av="' +
            i +
            '" data-v="' +
            a +
            '" aria-pressed="' +
            (p.avatar === a) +
            '"' +
            (used('avatar', i).includes(a) ? ' disabled' : '') +
            ' aria-label="Avatar ' +
            a +
            '">' +
            a +
            '</button>'
        ).join('') +
        '</div>' +
        '<div class="pick-row swatches" aria-label="Warna pion">' +
        D.TOKEN_COLORS.map(
          c =>
            '<button type="button" class="swatch" style="--sw:' +
            c +
            '" data-col="' +
            i +
            '" data-v="' +
            c +
            '" aria-pressed="' +
            (p.color === c) +
            '"' +
            (used('color', i).includes(c) ? ' disabled' : '') +
            ' aria-label="Warna ' +
            c +
            '"></button>'
        ).join('') +
        '</div>' +
        '<div class="pick-row">' +
        seg(
          'kind' + i,
          [
            ['human', 'Manusia'],
            ['ai', 'AI'],
          ],
          p.kind
        ) +
        (p.kind === 'ai'
          ? seg(
              'ai' + i,
              [
                ['easy', 'Easy'],
                ['normal', 'Normal'],
                ['hard', 'Hard'],
              ],
              p.ai
            )
          : '') +
        '</div>' +
        '</div>'
    )
    .join('');
  $('#scrSetup').innerHTML =
    '<div class="setup">' +
    '<div class="setup-head"><button type="button" class="btn ghost" id="sBack">' +
    ic('back') +
    '<span>' +
    esc(t('Kembali')) +
    '</span></button><h2>' +
    esc(t(s.kind === 'ai' ? 'Lawan AI' : 'Main Bareng')) +
    '</h2></div>' +
    '<div class="setup-grid">' +
    '<div class="panel"><h3>' +
    ic('users') +
    esc(t('Pemain')) +
    ' <span class="muted">' +
    s.players.length +
    '/4</span></h3><div class="seat-list">' +
    seats +
    '</div>' +
    (errs.humans ? '<div class="err">' + esc(errs.humans) + '</div>' : '') +
    (s.players.length < 4
      ? '<div class="add-row"><button type="button" class="btn soft" id="sAddH">' +
        ic('user') +
        '<span>' +
        esc(t('Tambah pemain')) +
        '</span></button><button type="button" class="btn soft" id="sAddA">' +
        ic('bot') +
        '<span>' +
        esc(t('Tambah AI')) +
        '</span></button></div>'
      : '') +
    '</div>' +
    '<div class="panel"><h3>' +
    ic('sliders') +
    esc(t('Aturan')) +
    '</h3><div class="opt-list">' +
    '<div class="opt"><span class="label">' +
    esc(t('Durasi')) +
    '</span>' +
    seg(
      'rounds',
      [
        [15, 'Singkat · 15'],
        [25, 'Normal · 25'],
        [35, 'Panjang · 35'],
        [0, 'Bebas'],
      ],
      s.roundLimit
    ) +
    '<div class="tiny muted">' +
    esc(
      s.roundLimit
        ? t('Setelah {n} ronde, aset terbesar menang.', { n: s.roundLimit })
        : t('Main sampai ada yang menang instan atau bangkrut.')
    ) +
    '</div></div>' +
    '<div class="opt"><span class="label">' +
    esc(t('Uang awal')) +
    '</span>' +
    seg(
      'cash',
      [
        [2000, fmt(2000)],
        [2500, fmt(2500)],
        [3000, fmt(3000)],
      ],
      s.startCash
    ) +
    '</div>' +
    toggle(
      'sTakeover',
      'Ambil alih kota',
      t('Setelah bayar tol, rebut kota lawan seharga 2× nilainya. Landmark & wisata kebal.'),
      s.takeover
    ) +
    toggle('sInstant', 'Menang instan', t('Trio Warna, Raja Jalur, atau Kolektor Wisata = langsung menang.'), s.instantWin) +
    toggle('sAimCtl', 'Kontrol dadu', t('Bidik hasil kecil, sedang, atau besar sebelum melempar.'), s.diceControl) +
    toggle(
      'sMoment',
      'Momen Berdua',
      s.players.filter(p => p.kind === 'human').length >= 2
        ? t('Tiap {a}–{b} ronde, tiap pemain dapat satu tantangan kerja sama. Berhasil = hadiah untuk berdua.', {
            a: RULES.momentGap.short,
            b: RULES.momentGap.long,
          })
        : t('Tantangan kerja sama tiap beberapa ronde. Butuh minimal 2 pemain manusia.'),
      s.moment !== false
    ) +
    (!s.takeover && !s.instantWin && !s.diceControl && s.players.some(p => p.kind === 'ai')
      ? '<div class="note gold">' +
        ic('dice') +
        ' ' +
        esc(t('Tanpa ketiga aturan ini permainan lebih banyak ditentukan keberuntungan dadu, jadi level AI hanya sedikit berpengaruh.')) +
        '</div>'
      : '') +
    '</div></div></div>' +
    '<div class="setup-foot sticky-cta"><button type="button" class="btn go" id="sStart"' +
    (Object.keys(errs).length ? ' disabled' : '') +
    '>' +
    ic('heart') +
    '<span>' +
    esc(t('Mulai Main!')) +
    '</span></button></div>' +
    '</div>';
  bindSetup();
}
function bindSetup() {
  const root = $('#scrSetup');
  const s = setup;
  const re = () => {
    store.set(KEYS.setup, s);
    renderSetup();
  };
  $('#sBack').onclick = () => {
    show('scrHome', s.kind === 'ai' ? 'ai' : 'local');
    renderHome();
  };
  $$('input[id^="pn"]', root).forEach(inp => {
    inp.addEventListener('input', () => {
      s.players[Number(inp.dataset.i)].name = inp.value;
      const errs = setupErrors();
      $('#sStart').disabled = Object.keys(errs).length > 0;
      inp.classList.toggle('invalid', !!errs['name' + inp.dataset.i]);
    });
    inp.addEventListener('change', re);
  });
  $$('[data-av]', root).forEach(
    b =>
      (b.onclick = () => {
        s.players[Number(b.dataset.av)].avatar = b.dataset.v;
        SND.play('click');
        re();
      })
  );
  $$('[data-col]', root).forEach(
    b =>
      (b.onclick = () => {
        s.players[Number(b.dataset.col)].color = b.dataset.v;
        SND.play('click');
        re();
      })
  );
  $$('[data-rm]', root).forEach(
    b =>
      (b.onclick = () => {
        s.players.splice(Number(b.dataset.rm), 1);
        re();
      })
  );
  $$('[data-seg]', root).forEach(g =>
    $$('[data-v]', g).forEach(
      b =>
        (b.onclick = () => {
          const name = g.dataset.seg,
            v = b.dataset.v;
          if (name.startsWith('kind')) {
            const p = s.players[Number(name.slice(4))];
            p.kind = v;
            if (v === 'ai' && isDefaultName(p.name)) p.name = t(D.AI_NAMES[Number(name.slice(4)) % 4]);
          } else if (name.startsWith('ai')) s.players[Number(name.slice(2))].ai = v;
          else if (name === 'cash') s.startCash = Number(v);
          else if (name === 'rounds') s.roundLimit = Number(v);
          SND.play('click');
          re();
        })
    )
  );
  const add = kind => {
    const usedC = s.players.map(p => p.color),
      usedA = s.players.map(p => p.avatar);
    const n = s.players.length;
    s.players.push({
      name: kind === 'ai' ? t(D.AI_NAMES[n % 4]) : playerN(n + 1),
      avatar: D.AVATARS.find(a => !usedA.includes(a)),
      color: D.TOKEN_COLORS.find(c => !usedC.includes(c)),
      kind,
      ai: 'normal',
    });
    re();
  };
  const ah = $('#sAddH');
  if (ah) ah.onclick = () => add('human');
  const aa = $('#sAddA');
  if (aa) aa.onclick = () => add('ai');
  $('#sTakeover').onclick = () => {
    s.takeover = !s.takeover;
    re();
  };
  $('#sInstant').onclick = () => {
    s.instantWin = !s.instantWin;
    re();
  };
  $('#sAimCtl').onclick = () => {
    s.diceControl = !s.diceControl;
    re();
  };
  $('#sMoment').onclick = () => {
    s.moment = s.moment === false;
    re();
  };
  $('#sStart').onclick = () => {
    if (Object.keys(setupErrors()).length) {
      renderSetup();
      return;
    }
    startSetup(s);
  };
}
// mulai game lokal dari setelan (tombol Mulai Main! & Main lagi cepat di beranda)
function startSetup(s) {
  store.set(KEYS.setup, s);
  const settings = {
    startCash: s.startCash,
    roundLimit: s.roundLimit,
    takeover: s.takeover !== false,
    instantWin: s.instantWin !== false,
    diceControl: s.diceControl !== false,
    moment: s.moment !== false,
  };
  const pp = passport();
  const S = E.create({
    players: s.players.map(p => ({
      name: p.name.trim(),
      avatar: p.avatar,
      color: p.color,
      kind: p.kind,
      ai: p.ai,
      msg: p.kind === 'human' && pp.name && p.name.trim().toLowerCase() === pp.name.trim().toLowerCase() ? pp.msg : '',
    })),
    settings,
    first: 'random',
  });
  SND.unlock();
  SND.play('fanfare');
  enterGame('local', -1, S);
}

export { lastSetup, lastSetupText, openSetup, quickReplay, renderSetup };
