/* LOVEOPOLY — layar › Paspor Cinta (dikumpulkan lewat src/ui/screens.js) */
import { App, D, E, SND, ART, TILES, esc, ic, $, $$, store, toast } from '../core.js';
import { UI } from '../ns.js';
import { renderHome } from './home.js';

// ---------- Paspor Cinta (profil di perangkat: nama, avatar, warna + statistik & cap kota) ----------
// Disimpan di loveopoly.v1.profile (sama dengan profil online). Tidak ada kata sandi: login online tetap anonim.
const PKEY = 'loveopoly.v1.profile';
const CITY_TILES = TILES.filter(t => t.type === 'city');
function passport() {
  const p = store.get(PKEY, null) || {};
  return {
    name: typeof p.name === 'string' ? p.name.slice(0, 16) : '',
    avatar: D.AVATARS.includes(p.avatar) ? p.avatar : D.AVATARS[0],
    color: D.TOKEN_COLORS.includes(p.color) ? p.color : D.TOKEN_COLORS[0],
    since: p.since || 0,
    games: p.games | 0,
    wins: p.wins | 0,
    stamps: Array.isArray(p.stamps) ? p.stamps.filter(i => TILES[i] && TILES[i].type === 'city') : [],
    skipped: !!p.skipped,
    last: p.last || '',
    msg: typeof p.msg === 'string' ? p.msg.slice(0, 240) : '',
  };
}
const savePassport = p => store.set(PKEY, p);
const passNo = p =>
  'LV-' +
  String((p.since || 1) % 1e8)
    .padStart(8, '0')
    .replace(/(\d{4})(\d{4})/, '$1 $2');
// catat hasil permainan sekali per game untuk pemegang paspor (online: kursi sendiri; lokal: nama sama / satu-satunya manusia)
function recordPassport(S) {
  const p = passport();
  if (!p.name || !S || !S.over) return;
  const key = S.seed + ':' + S.over.round + ':' + S.players.length;
  if (p.last === key) return;
  let me;
  if (App.mode === 'online') me = App.seat;
  else {
    const humans = S.players.filter(q => q.kind === 'human');
    const byName = S.players.find(q => q.kind === 'human' && q.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    me = byName ? byName.i : humans.length === 1 ? humans[0].i : -1;
  }
  if (me < 0 || !S.players[me]) return;
  p.last = key;
  p.games++;
  if (S.over.winner === me) p.wins++;
  E.citiesOf(S, me).forEach(t => {
    if (!p.stamps.includes(t)) p.stamps.push(t);
  });
  savePassport(p);
}
function stampGrid(p, cls) {
  return (
    '<div class="pp-stamps ' +
    (cls || '') +
    '" aria-label="Cap kota: ' +
    p.stamps.length +
    ' dari ' +
    CITY_TILES.length +
    '">' +
    CITY_TILES.map((t, k) => {
      const got = p.stamps.includes(t.i);
      return (
        '<span class="pp-st' +
        (got ? ' got' : '') +
        '" style="--k:' +
        k +
        ';--g:' +
        D.GROUPS[t.group].color +
        '" title="' +
        esc(t.name) +
        (got ? '' : ' (belum)') +
        '">' +
        ART.art(t.art) +
        '</span>'
      );
    }).join('') +
    '</div>'
  );
}
// bagian dalam sampul (terlihat setelah paspor terbuka): halaman pemilik + cap kota + segel, dekoratif
function coverInside(p) {
  const since = p.since ? new Date(p.since).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const got = p.stamps
    .slice(-6)
    .reverse()
    .map(i => TILES[i])
    .filter(Boolean);
  const stamps = got.length
    ? got
        .map(
          (t, k) =>
            '<span class="pp-cb-st" style="--k:' +
            k +
            ';--g:' +
            D.GROUPS[t.group].color +
            '"><span class="cbs-art">' +
            ART.art(t.art) +
            '</span><b>' +
            esc(t.short || t.name) +
            '</b></span>'
        )
        .join('')
    : [0, 1, 2]
        .map(
          k => '<span class="pp-cb-st empty" style="--k:' + k + '"><span class="cbs-art">' + ic('plane') + '</span><b>Cap kota</b></span>'
        )
        .join('');
  return (
    '<div class="pp-cv-back" aria-hidden="true"><div class="pp-cb-in">' +
    '<span class="pp-cb-k">Halaman pemilik · Holder</span>' +
    '<span class="pp-cb-merpi">' +
    ART.merpi(p.name ? 'is-love' : 'is-happy') +
    '</span>' +
    '<b class="pp-cb-name">' +
    esc(p.name || 'Calon pelancong cinta') +
    '</b>' +
    '<span class="pp-cb-sub">' +
    (since ? 'Pelancong cinta sejak ' + esc(since) : 'Selamat datang di Republik Rindu') +
    '</span>' +
    '<div class="pp-cb-stamps">' +
    stamps +
    '</div>' +
    '<span class="pp-cb-note">' +
    (got.length
      ? p.stamps.length + ' cap kota terkumpul · ' + p.games + ' main · ' + p.wins + ' menang'
      : 'Main dan kuasai kota untuk mengumpulkan cap di sini') +
    '</span>' +
    '<span class="pp-cb-seal"><svg viewBox="0 0 100 100"><defs><path id="ppSealArc" d="M50 50 m-36 0 a36 36 0 1 1 72 0 a36 36 0 1 1 -72 0"/></defs><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 3"/><text font-size="10.5" font-weight="700" letter-spacing="2" fill="currentColor"><textPath href="#ppSealArc">REPUBLIK RINDU ✦ LOVEOPOLY ✦</textPath></text><path d="M50 62c-9-7-15-12-15-18a7.5 7.5 0 0 1 15-3 7.5 7.5 0 0 1 15 3c0 6-6 11-15 18z" fill="currentColor"/></svg></span>' +
    '</div></div>'
  );
}
function openPassport(opts) {
  opts = opts || {};
  if ($('#passOv')) return;
  const p = passport();
  const edit = !!p.name;
  const st = { name: p.name, avatar: p.avatar, color: p.color, msg: p.msg, open: UI.reduceMotion(), done: false };
  const ov = document.createElement('div');
  ov.className = 'pass-ov';
  ov.id = 'passOv';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'ppTitle');
  document.body.appendChild(ov);
  const close = () => {
    ov.classList.add('out');
    setTimeout(
      () => {
        ov.remove();
        renderHome();
      },
      UI.reduceMotion() ? 0 : 420
    );
    document.removeEventListener('keydown', key);
  };
  const key = e => {
    if (e.key === 'Escape' && (edit || st.open)) {
      if (!edit) {
        const q = passport();
        q.skipped = true;
        savePassport(q);
      }
      close();
    }
  };
  document.addEventListener('keydown', key);
  const sparks = Array.from(
    { length: 16 },
    (_, k) => '<i style="--k:' + k + ';--x:' + (((k * 61 + 7) % 96) + 2) + '%;--y:' + (((k * 37 + 11) % 90) + 4) + '%"></i>'
  ).join('');
  const paint = () => {
    const valid = st.name.trim().length >= 1 && st.name.trim().length <= 16;
    ov.innerHTML =
      '<div class="pp-sky" aria-hidden="true">' +
      sparks +
      '</div>' +
      '<div class="pp-wrap">' +
      '<div class="pp-book' +
      (st.open ? ' open' : '') +
      (st.done ? ' done' : '') +
      '">' +
      // halaman dalam (formulir)
      '<form class="pp-page" id="ppForm" novalidate>' +
      '<div class="pp-page-top"><span class="pp-k">Republik Rindu · Loveopoly</span><span class="pp-no">' +
      esc(passNo(Object.assign({}, p, { since: p.since || Date.now() }))) +
      '</span></div>' +
      '<h2 id="ppTitle" class="pp-h">' +
      (edit ? 'Paspor Cintamu' : 'Terbitkan Paspor Cinta') +
      '</h2>' +
      '<div class="pp-id">' +
      '<div class="pp-photo" style="--c:' +
      st.color +
      '"><span>' +
      esc(st.avatar) +
      '</span><i class="pp-holo" aria-hidden="true"></i></div>' +
      '<div class="pp-fields"><label class="pp-lbl" for="ppName">Nama / Name</label><input class="pp-in" id="ppName" maxlength="16" autocomplete="nickname" placeholder="Nama panggilanmu" value="' +
      esc(st.name) +
      '">' +
      '<span class="pp-lbl">Berlaku / Valid</span><b class="pp-val">Selamanya ❤</b></div></div>' +
      '<div class="pp-lbl">Pilih wajah pionmu</div><div class="pp-avs" role="group" aria-label="Avatar">' +
      D.AVATARS.map(
        a =>
          '<button type="button" data-ppav="' +
          a +
          '" aria-pressed="' +
          (st.avatar === a) +
          '" aria-label="Avatar ' +
          a +
          '">' +
          a +
          '</button>'
      ).join('') +
      '</div>' +
      '<div class="pp-lbl">Warna pion</div><div class="pp-cols" role="group" aria-label="Warna pion">' +
      D.TOKEN_COLORS.map(
        c =>
          '<button type="button" data-ppcol="' +
          c +
          '" style="--sw:' +
          c +
          '" aria-pressed="' +
          (st.color === c) +
          '" aria-label="Warna ' +
          c +
          '"></button>'
      ).join('') +
      '</div>' +
      '<label class="pp-lbl" for="ppMsg">Pesan romantis di layar kemenangan</label>' +
      '<textarea class="pp-msg" id="ppMsg" maxlength="240" rows="2" placeholder="' +
      esc(D.WIN_MESSAGES[0]) +
      '">' +
      esc(st.msg) +
      '</textarea>' +
      '<p class="pp-msg-note">Opsional. Muncul di layar kemenangan setiap game. Saat main online, pesan ini juga terlihat oleh pemain lain di room.</p>' +
      (edit
        ? '<div class="pp-lbl">Cap kota · ' +
          p.stamps.length +
          '/' +
          CITY_TILES.length +
          ' · ' +
          p.games +
          ' main · ' +
          p.wins +
          ' menang</div>' +
          stampGrid(p, 'sm')
        : '') +
      '<div class="pp-foot">' +
      (edit
        ? '<button type="button" class="pp-ghost" id="ppCancel">Tutup</button>'
        : '<button type="button" class="pp-ghost" id="ppSkip">Nanti saja</button>') +
      '<button type="submit" class="pp-gold" id="ppGo"' +
      (valid ? '' : ' disabled') +
      '>' +
      ic('check') +
      '<span>' +
      (edit ? 'Simpan Paspor' : 'Terbitkan Paspor') +
      '</span></button></div>' +
      '<p class="pp-priv">' +
      ic('shield') +
      '<span>Paspor hanya tersimpan di perangkat ini. Tanpa email, tanpa kata sandi.</span></p>' +
      '<div class="pp-mrz" aria-hidden="true">P&lt;LOV' +
      esc(
        (st.name || 'TAMU')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 12)
      ) +
      '&lt;&lt;RINDU&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>' +
      '<div class="pp-stamp" aria-hidden="true"><b>DISETUJUI</b><span>' +
      ic('heart') +
      ' Loveopoly</span></div>' +
      '</form>' +
      // sampul kulit dengan foil emas
      '<div class="pp-cover" aria-hidden="' +
      st.open +
      '"><div class="pp-cv-in">' +
      '<span class="pp-foil pp-cv-top">Republik Rindu</span>' +
      '<span class="pp-emblem">' +
      ART.merpi('is-happy') +
      '</span>' +
      '<span class="pp-foil pp-cv-title">PASPOR<br>CINTA</span>' +
      '<span class="pp-foil pp-cv-sub">LOVEOPOLY · PASSPORT OF LOVE</span>' +
      (edit
        ? '<span class="pp-foil pp-cv-name">' + esc(p.name.toUpperCase()) + '</span>'
        : '<span class="pp-chip" aria-hidden="true"></span>') +
      '<button type="button" class="pp-gold pp-open" id="ppOpen"' +
      (st.open ? ' tabindex="-1"' : '') +
      '>' +
      ic('book') +
      '<span>Buka Paspor</span></button>' +
      '<button type="button" class="pp-ghost pp-skip-c" id="ppSkip2"' +
      (st.open ? ' tabindex="-1"' : '') +
      '>' +
      (edit ? 'Tutup' : 'Nanti saja') +
      '</button>' +
      '</div>' +
      coverInside(p) +
      '</div>' +
      '</div></div>';
    bind();
  };
  const syncBtn = () => {
    const b = $('#ppGo', ov);
    if (b) b.disabled = !(st.name.trim().length >= 1 && st.name.trim().length <= 16);
    const m = $('.pp-mrz', ov);
    if (m)
      m.innerHTML =
        'P&lt;LOV' +
        esc(
          (st.name || 'TAMU')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 12)
        ) +
        '&lt;&lt;RINDU&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;';
  };
  const skip = () => {
    const q = passport();
    q.skipped = true;
    savePassport(q);
    close();
  };
  function bind() {
    const o = $('#ppOpen', ov);
    if (o)
      o.onclick = () => {
        st.open = true;
        SND.play('page');
        $('.pp-book', ov).classList.add('open');
        $('.pp-cover', ov).setAttribute('aria-hidden', 'true');
        setTimeout(
          () => {
            const n = $('#ppName', ov);
            if (n) n.focus({ preventScroll: true });
          },
          UI.reduceMotion() ? 0 : 750
        );
      };
    const sk = $('#ppSkip', ov);
    if (sk) sk.onclick = skip;
    const sk2 = $('#ppSkip2', ov);
    if (sk2) sk2.onclick = edit ? close : skip;
    const c = $('#ppCancel', ov);
    if (c) c.onclick = close;
    const n = $('#ppName', ov);
    if (n)
      n.addEventListener('input', () => {
        st.name = n.value;
        syncBtn();
      });
    const mi = $('#ppMsg', ov);
    if (mi)
      mi.addEventListener('input', () => {
        st.msg = mi.value;
      });
    $$('[data-ppav]', ov).forEach(
      b =>
        (b.onclick = () => {
          st.avatar = b.dataset.ppav;
          SND.play('click');
          $$('[data-ppav]', ov).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          $('.pp-photo span', ov).textContent = st.avatar;
        })
    );
    $$('[data-ppcol]', ov).forEach(
      b =>
        (b.onclick = () => {
          st.color = b.dataset.ppcol;
          SND.play('click');
          $$('[data-ppcol]', ov).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          $('.pp-photo', ov).style.setProperty('--c', st.color);
        })
    );
    const f = $('#ppForm', ov);
    if (f)
      f.onsubmit = e => {
        e.preventDefault();
        const nm = st.name.trim();
        if (!nm || nm.length > 16) return;
        const q = passport();
        Object.assign(q, {
          name: nm,
          avatar: st.avatar,
          color: st.color,
          msg: String(st.msg || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 240),
          skipped: false,
          since: q.since || Date.now(),
        });
        savePassport(q);
        SND.play('stamp');
        $('.pp-book', ov).classList.add('done');
        setTimeout(
          () => {
            close();
            toast(edit ? 'Paspor diperbarui.' : 'Paspor terbit! Selamat datang, ' + nm + '.', {
              kind: 'good',
              icon: 'heart',
              title: edit ? '' : 'Selamat datang',
            });
          },
          UI.reduceMotion() ? 300 : 1250
        );
      };
    const first = st.open ? $('#ppName', ov) : $('#ppOpen', ov);
    if (first && !opts.noFocus)
      setTimeout(() => {
        try {
          first.focus({ preventScroll: true });
        } catch (e) {
          /* abaikan */
        }
      }, 60);
  }
  paint();
  if (edit && !st.open)
    setTimeout(() => {
      const o = $('#ppOpen', ov);
      if (o && !st.open && ov.isConnected) o.click();
    }, 650);
}
function passportCard() {
  const p = passport();
  if (!p.name)
    return (
      '<button type="button" class="pass-card empty" id="hPass"><span class="pc-book" aria-hidden="true">' +
      ic('book') +
      '</span><span class="grow"><b>Buat Paspor Cinta</b><span>Simpan nama & pionmu, kumpulkan cap kota tiap kali main.</span></span>' +
      ic('chevron') +
      '</button>'
    );
  const rate = p.games ? Math.round((p.wins / p.games) * 100) : 0;
  return (
    '<button type="button" class="pass-card" id="hPass"><span class="pc-photo" style="--c:' +
    p.color +
    '" aria-hidden="true">' +
    esc(p.avatar) +
    '</span>' +
    '<span class="grow"><span class="pc-k">Paspor Cinta · ' +
    esc(passNo(p)) +
    '</span><b>Halo, ' +
    esc(p.name) +
    '!</b>' +
    '<span class="pc-stats"><span><b>' +
    p.games +
    '</b> main</span><span><b>' +
    p.wins +
    '</b> menang' +
    (p.games ? ' (' + rate + '%)' : '') +
    '</span><span><b>' +
    p.stamps.length +
    '</b>/' +
    CITY_TILES.length +
    ' cap kota</span></span></span>' +
    '<span class="pc-foil" aria-hidden="true">' +
    ic('heart') +
    '</span></button>'
  );
}

export { openPassport, passport, passportCard, recordPassport };
