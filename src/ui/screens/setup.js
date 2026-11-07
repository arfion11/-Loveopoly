/* LOVEOPOLY — layar › setup lokal / lawan AI (dikumpulkan lewat src/ui/screens.js) */
import { D, E, SND, RULES, KEYS, esc, ic, $, $$, store, avatarHTML } from '../core.js';
import { seg, show } from './base.js';
import { passport } from './passport.js';
import { renderHome } from './home.js';
import { enterGame } from './game.js';

// ---------- setup lokal / AI ----------
let setup = null;
function defaultSetup(kind) {
  const base = store.get(KEYS.setup, null);
  const s = {
    kind,
    players:
      kind === 'ai'
        ? [
            { name: 'Kamu', avatar: '🐻', color: D.TOKEN_COLORS[0], kind: 'human', ai: 'normal' },
            { name: D.AI_NAMES[0], avatar: '🐰', color: D.TOKEN_COLORS[1], kind: 'ai', ai: 'normal' },
          ]
        : [
            { name: 'Pemain 1', avatar: '🐻', color: D.TOKEN_COLORS[0], kind: 'human', ai: 'normal' },
            { name: 'Pemain 2', avatar: '🐰', color: D.TOKEN_COLORS[1], kind: 'human', ai: 'normal' },
          ],
    startCash: RULES.startCash,
    roundLimit: 25,
    takeover: true,
    instantWin: true,
    diceControl: true,
  };
  if (base && base.kind === kind && Array.isArray(base.players) && base.players.length >= 2) {
    Object.assign(s, base);
    s.players = s.players.map((p, i) => Object.assign({}, p, { color: D.TOKEN_COLORS.includes(p.color) ? p.color : D.TOKEN_COLORS[i] }));
    if (![2000, 2500, 3000].includes(s.startCash)) s.startCash = RULES.startCash;
    if (![15, 25, 35, 0].includes(s.roundLimit)) s.roundLimit = 25;
  }
  // pemegang Paspor Cinta otomatis jadi Pemain 1 (avatar/warna pemain lain digeser bila bentrok)
  const pp = passport();
  if (pp.name) {
    const p0 = s.players[0];
    Object.assign(p0, { name: pp.name, avatar: pp.avatar, color: pp.color, kind: 'human' });
    s.players.slice(1).forEach((q, k) => {
      if (q.name.trim().toLowerCase() === pp.name.toLowerCase())
        q.name = q.kind === 'ai' ? D.AI_NAMES[k % D.AI_NAMES.length] : 'Pemain ' + (k + 2);
      const usedA = s.players.filter(x => x !== q).map(x => x.avatar),
        usedC = s.players.filter(x => x !== q).map(x => x.color);
      if (usedA.includes(q.avatar)) q.avatar = D.AVATARS.find(a => !usedA.includes(a));
      if (usedC.includes(q.color)) q.color = D.TOKEN_COLORS.find(c => !usedC.includes(c));
    });
  }
  return s;
}
function openSetup(kind) {
  setup = defaultSetup(kind);
  show('scrSetup');
  renderSetup();
}
function setupErrors() {
  const errs = {};
  const names = setup.players.map(p => p.name.trim().toLowerCase());
  setup.players.forEach((p, i) => {
    const n = p.name.trim();
    if (!n) errs['name' + i] = 'Nama wajib diisi.';
    else if (n.length > 16) errs['name' + i] = 'Maksimal 16 karakter.';
    else if (names.indexOf(n.toLowerCase()) !== i) errs['name' + i] = 'Nama sudah dipakai pemain lain.';
  });
  if (!setup.players.some(p => p.kind === 'human')) errs.humans = 'Minimal satu pemain manusia.';
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
        '">Pemain ' +
        (i + 1) +
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
          ? '<button type="button" class="icon-btn" data-rm="' + i + '" aria-label="Hapus pemain ' + (i + 1) + '">' + ic('x') + '</button>'
          : '') +
        '</div>' +
        '<div class="pick-row" aria-label="Avatar">' +
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
    '<span>Kembali</span></button><h2>' +
    (s.kind === 'ai' ? 'Lawan AI' : 'Main Bareng') +
    '</h2></div>' +
    '<div class="setup-grid">' +
    '<div class="panel"><h3>' +
    ic('users') +
    'Pemain <span class="muted">' +
    s.players.length +
    '/4</span></h3><div class="seat-list">' +
    seats +
    '</div>' +
    (errs.humans ? '<div class="err">' + esc(errs.humans) + '</div>' : '') +
    (s.players.length < 4
      ? '<div class="add-row"><button type="button" class="btn soft" id="sAddH">' +
        ic('user') +
        '<span>Tambah pemain</span></button><button type="button" class="btn soft" id="sAddA">' +
        ic('bot') +
        '<span>Tambah AI</span></button></div>'
      : '') +
    '</div>' +
    '<div class="panel"><h3>' +
    ic('sliders') +
    'Aturan</h3><div class="opt-list">' +
    '<div class="opt"><span class="label">Durasi</span>' +
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
    (s.roundLimit ? 'Setelah ' + s.roundLimit + ' ronde, aset terbesar menang.' : 'Main sampai ada yang menang instan atau bangkrut.') +
    '</div></div>' +
    '<div class="opt"><span class="label">Uang awal</span>' +
    seg(
      'cash',
      [
        [2000, '2.000'],
        [2500, '2.500'],
        [3000, '3.000'],
      ],
      s.startCash
    ) +
    '</div>' +
    '<div class="toggle-row"><div><b>Ambil alih kota</b><div class="tiny muted">Setelah bayar tol, rebut kota lawan seharga 2× nilainya. Landmark & wisata kebal.</div></div><button type="button" class="switch" role="switch" id="sTakeover" aria-checked="' +
    s.takeover +
    '" aria-label="Ambil alih kota"></button></div>' +
    '<div class="toggle-row"><div><b>Menang instan</b><div class="tiny muted">Trio Warna, Raja Jalur, atau Kolektor Wisata = langsung menang.</div></div><button type="button" class="switch" role="switch" id="sInstant" aria-checked="' +
    s.instantWin +
    '" aria-label="Menang instan"></button></div>' +
    '<div class="toggle-row"><div><b>Kontrol dadu</b><div class="tiny muted">Bidik hasil kecil, sedang, atau besar sebelum melempar.</div></div><button type="button" class="switch" role="switch" id="sAimCtl" aria-checked="' +
    s.diceControl +
    '" aria-label="Kontrol dadu"></button></div>' +
    (!s.takeover && !s.instantWin && !s.diceControl && s.players.some(p => p.kind === 'ai')
      ? '<div class="note gold">' +
        ic('dice') +
        ' Tanpa ketiga aturan ini permainan lebih banyak ditentukan keberuntungan dadu, jadi level AI hanya sedikit berpengaruh.</div>'
      : '') +
    '</div></div></div>' +
    '<div class="setup-foot sticky-cta"><button type="button" class="btn go" id="sStart"' +
    (Object.keys(errs).length ? ' disabled' : '') +
    '>' +
    ic('heart') +
    '<span>Mulai Main!</span></button></div>' +
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
    show('scrHome');
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
            if (v === 'ai' && /^Pemain \d$/.test(p.name)) p.name = D.AI_NAMES[Number(name.slice(4)) % 4];
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
      name: kind === 'ai' ? D.AI_NAMES[n % 4] : 'Pemain ' + (n + 1),
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
  $('#sStart').onclick = () => {
    if (Object.keys(setupErrors()).length) {
      renderSetup();
      return;
    }
    store.set(KEYS.setup, s);
    const settings = {
      startCash: s.startCash,
      roundLimit: s.roundLimit,
      takeover: s.takeover !== false,
      instantWin: s.instantWin !== false,
      diceControl: s.diceControl !== false,
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
  };
}

export { openSetup };
