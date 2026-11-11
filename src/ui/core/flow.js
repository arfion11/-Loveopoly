/* LOVEOPOLY — UI inti › alur commit & animasi, kartu terbang, akhiri giliran otomatis, AI (diekspor ulang lewat src/ui/core.js) */
import { ART } from '../../assets/art.js';
import { SND } from '../../assets/audio.js';
import { AI } from '../../engine/ai.js';
import { D } from '../../engine/data.js';
import { E } from '../../engine/engine.js';
import { UI } from '../ns.js';
import {
  $,
  AISPD,
  App,
  KEYS,
  SPD,
  TILES,
  controls,
  esc,
  fmt,
  hotseat,
  ic,
  pname,
  pulse,
  reduceMotion,
  restart,
  runsAI,
  safeImg,
  sleep,
  store,
} from './base.js';
import { achievementFx, banner, toast } from './notify.js';
import { camCinema, camHold, camSettle } from './camera.js';
import { flashTile, renderBoard, renderTile, tileEl } from './board.js';
import { moveToken, rollDice, setDieFace } from './pieces.js';
import { bfloat, burst, fireworks, flagDrop, moneyFx, stampDrop, stormFx, tweenCash } from './effects.js';
import { mascotAct, mascotEmote, mascotLook, merpiSay, pick } from './mascot.js';
import { renderAll, renderStage, showPhotoPop } from './hud.js';
import { endPick } from './pick.js';

// ---------- alur commit & animasi ----------
// durasi kamera sinematik ikut kecepatan animasi (Cepat = lebih singkat)
const cine = (k, turn, hold) => ({ k, turn, hold: hold * SPD(), inMs: 760 * SPD(), outMs: 950 * SPD() });
async function animateEvents(prev, ns) {
  const evs = ns.lastEvents || [];
  if (!prev || ns.evSeq !== ns.seq || prev.seq >= ns.seq) return;
  const fresh = ns.seq === prev.seq + 1;
  let coinBurst = 0;
  const used = new Set();
  const mine = i => controls(i) && !hotseat();
  for (let idx = 0; idx < evs.length; idx++) {
    const e = evs[idx];
    switch (e.t) {
      case 'dice':
        if (fresh) {
          mascotLook(ns.players[e.p].pos);
          mascotEmote(ic('dice'), 1100);
          mascotAct('peek', 700);
          await rollDice(e.d, e.dbl, e.aim, e.hit);
          if (e.dbl && !ns.players[e.p].island) {
            merpiSay(pick(D.MERPI.doubles), 'wow', 1600);
            mascotAct('spin', 900);
            mascotEmote(ic('sparkle'), 1400);
          }
        } else {
          setDieFace($('#die1'), e.d[0], false);
          setDieFace($('#die2'), e.d[1], false);
        }
        break;
      case 'move':
        if (fresh) await moveToken(e);
        break;
      case 'money':
        if (fresh) {
          tweenCash(e.p, e.d);
          moneyFx(evs, idx, used);
        }
        if (coinBurst++ < 2) SND.play(e.d > 0 ? 'coin' : 'pay');
        break;
      case 'salary':
        if (fresh) {
          merpiSay(pick(D.MERPI.salary), 'happy', 1500);
          mascotEmote(ic('coins'), 1400);
          pulse($('#tok-' + e.p), 'cheer', 800);
        }
        break;
      case 'love':
        if (fresh && Math.abs(e.d) >= 3) bfloat(e.p, (e.d > 0 ? '+' : '−') + Math.abs(e.d) + ic('heart'), 'love');
        break;
      case 'buy': {
        SND.play('buy');
        if (fresh) {
          flagDrop(e.tile, ns.players[e.p].color);
          merpiSay(pick(D.MERPI.buy), 'happy', 1800);
          mascotEmote(ic('flag'), 1500);
          await sleep(420 * SPD());
        }
        const el = tileEl(e.tile);
        if (el) renderTile(el, ns, true);
        flashTile(e.tile);
        if (fresh && e.level > 0) await sleep(380 * SPD());
        break;
      }
      case 'build': {
        SND.play(e.level === 4 ? 'fanfare' : 'build');
        const el = tileEl(e.tile);
        if (el) renderTile(el, ns, true);
        flashTile(e.tile);
        if (e.level === 4) {
          if (fresh) {
            burst(e.tile, ['#FFD93D', '#FFF3B0', '#FFFFFF'], 16);
            camCinema(e.tile, cine(0.42, 5, 1200));
          }
          banner('LANDMARK!', pname(e.p) + ' membangun landmark di ' + TILES[e.tile].name + '. Kebal diambil alih!', 'gold', 2400, 'b4');
          merpiSay(pick(D.MERPI.landmark), 'wow', 2200);
          mascotAct('spin', 900);
          mascotEmote(ic('crown'), 2000);
        } else if (fresh) {
          merpiSay(pick(D.MERPI.build), 'happy', 1600);
          mascotEmote(ic('build'), 1400);
        }
        if (fresh) await sleep((e.level === 4 ? 900 : 520) * SPD());
        break;
      }
      case 'takeover': {
        SND.play('stamp');
        const taker = ns.players[e.p],
          from = ns.players[e.from];
        if (fresh) {
          stampDrop(e.tile, taker.color, 'DIAMBIL ALIH');
          camCinema(e.tile, cine(0.34, 4, 1000));
        }
        banner(
          'AMBIL ALIH!',
          taker.name + ' merebut ' + TILES[e.tile].name + ' dari ' + from.name + ' (' + fmt(e.price) + ').',
          'take',
          2400
        );
        merpiSay(pick(D.MERPI.takeover), 'wow', 2000);
        if (fresh) {
          mascotAct('shake', 700);
          mascotEmote(ic('alert'), 1600);
        }
        const el = tileEl(e.tile);
        if (el) renderTile(el, ns, true);
        flashTile(e.tile);
        if (fresh) await sleep(620 * SPD());
        break;
      }
      case 'rent':
        if (fresh) {
          if (mine(e.p)) merpiSay(pick(D.MERPI.rent), 'sad', 1800);
          else if (mine(e.to)) merpiSay('Cuan! Tol masuk ' + fmt(e.amount) + '.', 'love', 1800);
          mascotEmote(ic('coins'), 1400);
        }
        break;
      case 'festival': {
        SND.play('fanfare');
        const el = tileEl(e.tile);
        renderBoard(ns);
        if (fresh) {
          camHold(true, e.tile);
          fireworks(e.tile);
        }
        if (el) flashTile(e.tile);
        banner('FESTIVAL CINTA!', TILES[e.tile].name + ' jadi tuan rumah. Tol ×' + e.mult + '!', 'party', 2400, 'festival');
        merpiSay(pick(D.MERPI.festival), 'love', 2000);
        if (fresh) {
          mascotAct('spin', 900);
          mascotEmote(ic('party'), 2000);
        }
        if (fresh) await sleep(700 * SPD());
        break;
      }
      case 'storm': {
        SND.play('thunder');
        if (fresh) {
          camHold(true, e.tile);
          stormFx(e.tile);
          await sleep(500 * SPD());
        }
        const el = tileEl(e.tile);
        if (el) renderTile(el, ns, true);
        flashTile(e.tile);
        toast(TILES[e.tile].name + ' turun jadi ' + E.LEVEL_NAME[e.level] + '.', { title: 'Badai Rindu', icon: 'storm' });
        if (fresh) await sleep(400 * SPD());
        break;
      }
      case 'swap': {
        SND.play('whoosh');
        [e.a, e.b].forEach(t => {
          const el = tileEl(t);
          if (el) renderTile(el, ns, true);
          flashTile(t);
          if (fresh) burst(t, [ns.players[e.p].color, '#FFFFFF'], 8);
        });
        banner('TUKAR KOTA!', pname(e.p) + ' menukar ' + TILES[e.a].name + ' dengan ' + TILES[e.b].name + '.', 'take', 2200);
        if (fresh) await sleep(500 * SPD());
        break;
      }
      case 'sell': {
        const el = tileEl(e.tile);
        if (el) renderTile(el, ns, true);
        flashTile(e.tile);
        SND.play('pay');
        break;
      }
      case 'island':
        SND.play('splash');
        if (fresh) {
          pulse($('#tok-' + e.p), 'shake', 600);
          merpiSay(pick(D.MERPI.island), 'sad', 2000);
          mascotEmote(ic('island'), 1800);
        }
        break;
      case 'free':
        SND.play('good');
        if (fresh) pulse($('#tok-' + e.p), 'cheer', 800);
        break;
      case 'tour':
        SND.play('plane');
        if (fresh) {
          merpiSay(pick(D.MERPI.travel), 'happy', 1800);
          mascotAct('fly', 1500);
          mascotEmote(ic('plane'), 1500);
          pulse($('#tok-' + e.p), 'cheer', 800);
        }
        break;
      case 'tax':
        SND.play('pay');
        break;
      case 'card': {
        SND.play('card');
        // kartu sendiri: dialog Kartu Cinta yang menerbangkan kartu dari tumpukan; lawan: kotak intip
        if (!fresh) pulse($('#deck'), 'pull', 800);
        if (fresh && !controls(e.p)) peekCard(e);
        else if (fresh) merpiSay(pick(D.MERPI.card), 'think', 1200);
        if (fresh) mascotEmote(ic('letter'), 1500);
        break;
      }
      case 'gameover': {
        const o = ns.over;
        if (o && (o.reason === 'triple' || o.reason === 'line' || o.reason === 'spots')) {
          SND.play('win');
          // kamera menyorot jalur yang dikuasai (Raja Jalur) atau pion sang juara
          if (fresh) {
            const sd = o.reason === 'line' && o.detail && D.SIDES.find(x => x.id === o.detail.side);
            camCinema(sd ? Math.round((sd.from + sd.to) / 2) : ns.players[o.winner].pos, cine(0.5, 6, 1500));
          }
          banner(
            { triple: 'TRIO WARNA!', line: 'RAJA JALUR!', spots: 'KOLEKTOR WISATA!' }[o.reason],
            pname(o.winner) + ' menang instan!',
            'gold',
            2600,
            'b4'
          );
          merpiSay(pick(D.MERPI.win), 'love', 2600);
          mascotAct('spin', 900);
          mascotEmote(ic('trophy'), 2600);
          if (fresh) await sleep(1700 * SPD());
        }
        break;
      }
      case 'achievement':
        achievementFx(e, ns, fresh);
        break;
      case 'bankrupt':
        SND.play('bad');
        toast(pname(e.p) + ' bangkrut.', { icon: 'alert', kind: 'err' });
        banner('BANGKRUT!', pname(e.p) + ' keluar dari permainan.', 'warn', 2000);
        break;
      case 'skip':
        toast(pname(e.p) + ' kehilangan giliran.', { icon: 'pause' });
        break;
      case 'meet': {
        if (!fresh) break;
        SND.play('heart');
        [e.p].concat(e.with).forEach(q => {
          pulse($('#tok-' + q), 'cheer', 800);
          bfloat(q, '+' + fmt(e.cash) + ' ' + ic('heart') + '+' + e.love, 'love');
        });
        burst(e.tile, ['#FF4F8B', '#FF9EC4', '#FFFFFF'], 14);
        merpiSay(
          pick(['Ketemuan! Kangen terobati~', 'Akhirnya ketemu juga!', 'Peluk dulu dong!', 'Momen langka, abadikan!']),
          'love',
          2000
        );
        mascotEmote(ic('heart'), 1600);
        mascotAct('hop', 700);
        await sleep(600 * SPD());
        break;
      }
      case 'news': {
        SND.play('fanfare');
        banner('KABAR MERPI', e.label + ': ' + e.text + ' (' + e.rounds + ' ronde)', 'party', 3000, 'card');
        if (fresh) {
          merpiSay(
            pick(['Ada kabar baru dari seluruh dunia!', 'Surat kilat! Baca dulu, ya~', 'Kabar hangat, strategi berubah!']),
            'wow',
            2400
          );
          mascotAct('fly', 1500);
          mascotEmote(ic('letter'), 2000);
          await sleep(900 * SPD());
        }
        break;
      }
      case 'moment': {
        SND.play('fanfare');
        banner(
          'MOMEN BERDUA',
          'Ronde ini tiap pemain dapat satu tantangan kerja sama. Berhasil = hadiah untuk berdua!',
          'party',
          3200,
          'card'
        );
        if (fresh) {
          camCinema(null, cine(0.3, 6, 1300));
          merpiSay(pick(['Momen berdua! Kompakan, ya~', 'Waktunya kerja sama!', 'Bukan lawan dulu, sekarang tim!']), 'love', 2400);
          mascotAct('hop', 700);
          mascotEmote(ic('heart'), 2000);
          await sleep(900 * SPD());
        }
        break;
      }
      case 'peak': {
        SND.play('fanfare');
        banner(
          'MUSIM PUNCAK!',
          e.rounds + ' ronde terakhir: semua tol ×' + String(e.mult).replace('.', ',') + '. Saatnya menyalip!',
          'gold',
          3000,
          'festival'
        );
        if (fresh) {
          merpiSay('Musim puncak! Siapa yang menyalip di akhir?', 'wow', 2400);
          mascotAct('spin', 900);
          mascotEmote(ic('bolt'), 2000);
          await sleep(900 * SPD());
        }
        break;
      }
      case 'challenge': {
        if (e.dilemma) {
          SND.play('good');
          break;
        }
        SND.play(e.ok ? 'fanfare' : 'bad');
        if (fresh) {
          const ph = ns.photos && ns.photos[ns.photos.length - 1];
          const isPhoto = ph && D.CH_TYPES.photo.label === e.label;
          if (isPhoto) showPhotoPop(ph, ns);
          else banner(e.ok ? 'LULUS!' : 'BELUM LULUS', pname(e.p) + ' · ' + e.label + ': ' + e.proof, e.ok ? 'gold' : 'warn', 2600);
          merpiSay(
            e.ok
              ? pick(['Terbukti! Keren banget!', 'Sah! Hadiah cair~', 'Bukti lengkap, mantap!'])
              : pick(['Hampir! Coba lagi lain kali.', 'Belum terbukti, hehe.', 'Ups, bukti kurang kuat!']),
            e.ok ? 'love' : 'sad',
            2000
          );
          mascotEmote(ic(e.ok ? 'trophy' : 'x'), 1600);
          if (e.ok) mascotAct('spin', 900);
          await sleep(500 * SPD());
        }
        break;
      }
      case 'power':
        SND.play('card');
        if (fresh) bfloat(e.p, ic(D.POWER[e.power].icon), 'love');
        break;
      case 'letter':
        UI.onLetter && UI.onLetter(e.p);
        break;
      default:
        break;
    }
  }
}
let peekTimer = null;
// ---------- kartu terbang: dari tumpukan di tengah papan (atau petak tempat pion mendarat bila tumpukan
// tidak terlihat) ke kartu di dialog / kotak intip. target disembunyikan (kelas await) selama terbang ----------
const shown = el => {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return (
    r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
  );
};
function flyFrom(p) {
  const dk = $('#deck .dk1');
  if (shown(dk)) return dk;
  const pl = App.S && App.S.players[p];
  const t = pl ? tileEl(pl.pos) : null;
  if (!t) return null;
  const c = t.querySelector('.tp-card');
  return shown(c) ? c : shown(t) ? t : null;
}
// posisi akhir elemen setelah animasi masuk induknya (dialog/kotak intip) selesai
function finalRect(el) {
  const anims = [];
  for (let n = el; n && n !== document.body; n = n.parentElement)
    n.getAnimations().forEach(a => {
      const end = a.effect && a.effect.getComputedTiming().endTime;
      if (isFinite(end)) anims.push([a, a.currentTime, a.playState, end]);
    });
  anims.forEach(([a, , , end]) => {
    a.currentTime = end;
  });
  const r = el.getBoundingClientRect();
  anims.forEach(([a, t, st]) => {
    a.currentTime = t;
    if (st === 'running') a.play();
  });
  return r;
}
function flyCard(p, target, done) {
  const fin = flew => {
    if (target) {
      if (flew) target.classList.add('flown');
      target.classList.remove('await');
    }
    if (done) done();
  };
  const from = !reduceMotion() && target ? flyFrom(p) : null;
  if (!from) {
    fin();
    return;
  }
  target.classList.add('await');
  const a = from.getBoundingClientRect(),
    b = finalRect(target);
  const deck = $('#deck');
  if (deck && deck.contains(from)) {
    deck.classList.remove('lift');
    void deck.offsetWidth;
    deck.classList.add('lift');
    setTimeout(() => deck.classList.remove('lift'), 1300);
  }
  const fly = document.createElement('div');
  fly.className = 'fly-card';
  fly.setAttribute('aria-hidden', 'true');
  fly.innerHTML = '<span>' + ART.art('card') + '</span>';
  document.body.appendChild(fly);
  const box = (r, extra) =>
    Object.assign({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }, extra);
  const mid = {
    left: (a.left + b.left) / 2,
    top: Math.min(a.top, b.top) - Math.min(90, innerHeight * 0.12),
    width: (a.width + b.width) / 2,
    height: (a.height + b.height) / 2,
  };
  const anim = fly.animate(
    [
      box(a, { transform: 'perspective(800px) rotateX(35deg) rotate(-8deg)', opacity: 0.4 }),
      box(a, { transform: 'perspective(800px) translateY(-30%) rotate(-4deg) scale(1.12)', opacity: 1, offset: 0.22 }),
      box(mid, { transform: 'perspective(800px) rotateY(-24deg) rotate(6deg)', opacity: 1, offset: 0.6 }),
      box(b, { transform: 'perspective(800px) none', opacity: 1 }),
    ],
    { duration: Math.round(900 * Math.max(0.7, SPD())), easing: 'cubic-bezier(.45, .05, .3, 1)', fill: 'forwards' }
  );
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    fly.remove();
    fin(true);
  };
  anim.onfinish = end;
  anim.oncancel = end;
  setTimeout(end, 2500);
}
function peekCard(e) {
  const host = $('#boardVP');
  const c = E.CARD[e.card];
  if (!host || !c) return;
  const old = host.querySelector('.peek');
  if (old) old.remove();
  clearTimeout(peekTimer);
  const el = document.createElement('div');
  el.className = 'peek';
  el.innerHTML =
    '<span class="pk-art">' +
    ART.art('card') +
    '</span><div><small>' +
    esc(pname(e.p)) +
    ' · Kartu Cinta</small><b>' +
    esc(c.title) +
    '</b><span>' +
    esc(c.text) +
    '</span></div>';
  host.appendChild(el);
  flyCard(e.p, el.querySelector('.pk-art'));
  peekTimer = setTimeout(
    () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 380);
    },
    Math.round(3400 * Math.max(0.65, AISPD()))
  );
}
// state dari luar (simpanan lokal, dokumen room online) dibersihkan sebelum dirender:
// warna dipakai di atribut style, nama/avatar dibatasi — pertahanan berlapis terhadap data yang diubah orang
const HEX = /^#[0-9a-fA-F]{6}$/;
function cleanState(S) {
  if (!S || !Array.isArray(S.players)) return S;
  if (Array.isArray(S.photos)) S.photos = S.photos.filter(x => x && safeImg(x.img) && S.players[x.p]);
  (S.queue || []).forEach(it => {
    if (it && it.type === 'CHALLENGE' && it.pz && it.pz.photo != null && !safeImg(it.pz.photo)) it.pz.photo = '';
  });
  S.players.forEach((p, k) => {
    p.name = String(p.name == null ? 'Pemain' : p.name).slice(0, 16);
    if (!HEX.test(p.color || '')) p.color = D.TOKEN_COLORS[k % D.TOKEN_COLORS.length];
    if (typeof p.avatar !== 'string' || !p.avatar || p.avatar.length > 8) p.avatar = D.AVATARS[k % D.AVATARS.length];
    p.msg = typeof p.msg === 'string' ? p.msg.slice(0, 240) : '';
  });
  return S;
}
function commit(ns) {
  cleanState(ns);
  App.pending.push(ns);
  if (!App.animating) drain();
}
async function drain() {
  App.animating = true;
  clearTimeout(App.aiTimer);
  cancelAutoEnd();
  renderStage(App.S);
  try {
    while (App.pending.length) {
      const ns = App.pending.shift();
      const prev = App.shown;
      App.S = ns;
      dropStaleDecision(ns);
      try {
        await animateEvents(prev, ns);
      } catch (e) {
        console.error(e);
      }
      App.shown = ns;
      renderAll();
    }
  } finally {
    App.animating = false;
  }
  renderStage(App.S);
  persist();
  UI.afterSettle();
  camSettle();
}
function dropStaleDecision(ns) {
  const m = App.modal;
  if (App.pick) endPick(true);
  if (!m || !m.decision || ns.over || !UI.closeModal) return;
  const it = ns.queue[0];
  if (it && controls(E.actor(ns)) && m.itype === it.type && it.type === 'DEBT') return;
  UI.closeModal(true);
}
function persist() {
  if (App.mode !== 'local' || !App.S) return;
  if (App.S.over) {
    store.del(KEYS.save);
    return;
  }
  store.set(KEYS.save, { S: App.S, savedAt: Date.now() });
}

function lockModal() {
  const m = document.querySelector('#modalRoot:not([hidden]) .modal');
  if (m)
    m.querySelectorAll('.modal-body button, .modal-foot button, .modal-body input, .modal-body textarea').forEach(b => {
      b.disabled = true;
    });
  const bar = $('#pickbar');
  if (bar && !bar.hidden)
    bar.querySelectorAll('button').forEach(b => {
      b.disabled = true;
    });
}
function act(action) {
  if (!App.S) return false;
  SND.unlock();
  if (action.type !== 'PAUSE' && (App.animating || App.pending.length)) return false;
  let ok;
  if (App.mode === 'online' && App.net) ok = App.net.send(action);
  else {
    const r = E.dispatch(App.S, action);
    if (!r.ok) {
      toast(r.error, { kind: 'err' });
      SND.play('error');
      return false;
    }
    commit(r.state);
    ok = true;
  }
  if (ok) lockModal();
  return ok;
}

// ---------- akhiri giliran otomatis ----------
let autoTimer = null;
function onUserAct(e) {
  if (e && e.target && e.target.closest && e.target.closest('#cEnd')) return;
  cancelAutoEnd();
}
function cancelAutoEnd() {
  clearTimeout(autoTimer);
  autoTimer = null;
  const b = document.getElementById('cEnd');
  if (b) b.classList.remove('auto');
  document.removeEventListener('pointerdown', onUserAct, true);
  document.removeEventListener('keydown', onUserAct, true);
}
function scheduleAutoEnd() {
  cancelAutoEnd();
  const S = App.S;
  if (
    !S ||
    S.over ||
    S.paused ||
    App.prefs.autoEnd === false ||
    App.animating ||
    App.pending.length ||
    App.modal ||
    App.tour ||
    App.pick ||
    document.getElementById('guideOv')
  )
    return;
  const a = E.actor(S);
  if (!controls(a) || !E.canEnd(S, a)) return;
  const b = $('#cEnd');
  if (!b) return;
  const ms = Math.round(2400 * (App.prefs.speed === 'fast' ? 0.8 : 1));
  b.style.setProperty('--auto', ms + 'ms');
  restart(b, 'auto');
  document.addEventListener('pointerdown', onUserAct, true);
  document.addEventListener('keydown', onUserAct, true);
  autoTimer = setTimeout(() => {
    autoTimer = null;
    cancelAutoEnd();
    if (App.S === S && !App.modal && !App.tour && !App.pick && !document.getElementById('guideOv')) act({ type: 'END_TURN', p: a });
  }, ms);
}

// ---------- AI ----------
function fallbackAction(S, p) {
  const it = S.queue[0];
  if (it) {
    const m = {
      BUY: 'BUY_SKIP',
      UPGRADE: 'UPGRADE_SKIP',
      RENT: 'PAY_RENT',
      TAX: 'PAY_TAX',
      TAKEOVER: 'TAKEOVER_SKIP',
      TARGET: 'TARGET_SKIP',
      TOUR: 'TOUR_SKIP',
    };
    if (it.type === 'CARD') return E.CARD[it.card].choice ? { type: 'CARD_CHOOSE', p, choice: 0 } : { type: 'CARD_OK', p };
    if (it.type === 'CHALLENGE') return { type: 'CH_RESOLVE', p, result: 'skip' };
    if (it.type === 'DEBT') {
      if (S.players[p].cash >= it.amount) return { type: 'PAY_DEBT', p };
      const own = E.ownedBy(S, p);
      return own.length && E.liquidation(S, p) >= it.amount ? { type: 'SELL', p, tile: own[0] } : { type: 'BANKRUPT', p };
    }
    return { type: m[it.type], p };
  }
  return E.canRoll(S, p) ? { type: 'ROLL', p } : { type: 'END_TURN', p };
}
function aiDelay(S) {
  const it = S.queue[0];
  let ms = 650;
  if (!it) ms = S.turn.rolled ? 700 : 950;
  else if (it.type === 'CARD') ms = 1500;
  else if (it.type === 'CHALLENGE') ms = 1400;
  else if (it.type === 'BUY' || it.type === 'UPGRADE') ms = 900;
  else if (it.type === 'TAKEOVER' || it.type === 'TARGET' || it.type === 'TOUR') ms = 1100;
  return Math.round(ms * AISPD());
}
function scheduleAI() {
  clearTimeout(App.aiTimer);
  const S = App.S;
  if (!S || S.over || S.paused || App.animating) return;
  const a = E.actor(S);
  if (!runsAI(a)) return;
  if (App.modal && App.modal.blocksAI) return;
  if (App.tour || App.tourPending || App.revealing || document.getElementById('guideOv')) return;
  App.aiTimer = setTimeout(() => {
    if (App.animating || App.S !== S || App.tour || App.tourPending || App.revealing) return;
    let action;
    try {
      action = AI.decide(S, a);
    } catch (e) {
      console.error(e);
      action = fallbackAction(S, a);
    }
    let ok;
    if (App.mode === 'online') ok = App.net.applyHost(action, true);
    else {
      const r = E.dispatch(S, action);
      if (!r.ok) {
        console.warn('AI action ditolak:', action, r.error);
        const r2 = E.dispatch(S, fallbackAction(S, a));
        if (r2.ok) commit(r2.state);
        else console.error('AI macet', r2.error);
        return;
      }
      commit(r.state);
      ok = true;
    }
    if (!ok) {
      const fb = fallbackAction(S, a);
      if (App.mode === 'online') App.net.applyHost(fb, true);
    }
  }, aiDelay(S));
}

export { act, cancelAutoEnd, cleanState, commit, fallbackAction, flyCard, persist, scheduleAI, scheduleAutoEnd };
