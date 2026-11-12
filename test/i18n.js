// Uji bahasa (English): kamus lengkap & konsisten, lalu jalan-jalan di aplikasi dengan bahasa perangkat English
// (beranda, menu, pengaturan, panduan, Pertanyaan Hari Ini, setup, permainan melawan AI sampai layar menang,
// Kartu Kenangan, ganti bahasa di Pengaturan) sambil mencari teks Indonesia yang tersisa di layar.
// npm run test:i18n (butuh build: npm run build)
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { collectKeys, holes } from '../tools/i18n/keys.mjs';
import { shadowCalls } from '../tools/i18n/shadow.mjs';
import { EN } from '../src/i18n/en.js';
import { fill, setLang, t, useDict } from '../src/i18n/i18n.js';

const results = [];
const ok = (n, c, d) => results.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));

// ---------- 1. kamus (tanpa browser) ----------
{
  const { all } = await collectKeys();
  const missingKeys = [...all].filter(k => !Object.prototype.hasOwnProperty.call(EN, k));
  ok('kamus English memuat semua teks UI, engine & data', missingKeys.length === 0, missingKeys.slice(0, 8).join(' | '));
  const badHoles = Object.entries(EN).filter(([k, v]) => {
    const hk = new Set(holes(k)),
      hv = new Set(holes(v));
    return [...hk].some(h => !hv.has(h));
  });
  ok(
    'placeholder {…} di tiap kunci ada di terjemahannya',
    badHoles.length === 0,
    badHoles
      .slice(0, 6)
      .map(([k, v]) => k + ' → ' + v)
      .join(' | ')
  );
  const sh = shadowCalls();
  ok('panggilan t()/T() tidak tertutup variabel lokal bernama sama', sh.length === 0, sh.slice(0, 5).join(' | '));
  const empty = Object.entries(EN).filter(([, v]) => typeof v !== 'string' || !v.trim());
  ok(
    'tidak ada terjemahan kosong',
    empty.length === 0,
    empty
      .slice(0, 5)
      .map(([k]) => k)
      .join(' | ')
  );
  // bentuk jamak & angka
  useDict('en', EN);
  setLang('en');
  const one = t('{n} ronde', { n: 1 }),
    many = t('{n} ronde', { n: 3 }),
    money = t('Uang awal {c}', { c: 2500 });
  ok(
    'jamak English & format angka en-US',
    one === '1 round' && many === '3 rounds' && money === 'Starting cash 2,500',
    [one, many, money].join(' / ')
  );
  ok('konteks § tidak tampil & memilih terjemahan', t('Kota§petak') === 'City' && t('Kota') === 'Cities');
  setLang('id');
  ok(
    'Bahasa Indonesia: kunci tampil apa adanya, konteks § dibuang',
    t('Kota§petak') === 'Kota' && fill('{n} {n|ronde|ronde}', { n: 2 }) === '2 ronde'
  );
}

// ---------- 2. aplikasi dalam English ----------
const { serveDist } = await import('./helpers/serve.js');
const URL = (await serveDist()).url + '/';
const OUT = path.join(import.meta.dirname, 'out', 'i18n');
fs.mkdirSync(OUT, { recursive: true });

// kata Indonesia yang hampir tidak mungkin muncul di teks English (nama tempat & nama pemain tidak termasuk)
const ID_WORDS =
  'dan yang kamu untuk dengan tidak belum sudah bisa kota pemain giliran ronde lempar beli bayar kembali simpan lewati tantangan pasangan lawan menang uang dari akan atau lagi saja semua juga kalau saat masih baru tanpa bila tiap hari minggu nama pesan kartu petak papan bangun gaji hadiah selesai tunggu sedang dulu nanti sekarang punya lihat ketuk tekan jawab tebak kirim bagikan salin perangkat layar pengaturan beranda permainan kenangan cinta rindu jalan berdua bareng teman lencana tol aset jadi ini itu ada ke di mulai pilih buka tutup ambil alih lulus gagal'.split(
    ' '
  );
const ID_RE = new RegExp('\\b(' + ID_WORDS.join('|') + ')\\b', 'i');
// teks yang memang boleh dalam Bahasa Indonesia di mode English
const ALLOW = [
  /Bahasa · Language/,
  /^Indonesia$/,
  /Halaman pemilik|Pemilik/,
  /Nama \/ Name|Name \/ Nama/,
  /Berlaku|Valid \/ Berlaku/,
  /#pulihkan=/,
  /CINTA = love/,
];

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('i18n-init')) return;
  sessionStorage.setItem('i18n-init', '1');
  localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast', autoEnd: true }));
  localStorage.setItem('loveopoly.v1.profile', JSON.stringify({ skipped: true }));
});
const p = await ctx.newPage();
p.on('pageerror', e => errors.push('pageerror: ' + e.message));
p.on('console', m => {
  if (m.type() === 'error' && !/fonts|ERR_/.test(m.text())) errors.push('console: ' + m.text());
});

const leftovers = new Map();
async function scan(where) {
  const texts = await p.evaluate(() => {
    const out = [];
    const walk = el => {
      if (el.nodeType === 3) {
        const v = el.textContent.trim();
        if (v) out.push(v);
        return;
      }
      if (el.nodeType !== 1) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"]:not(.modal-root)') === el) return;
      ['aria-label', 'title', 'placeholder', 'alt'].forEach(a => el.getAttribute(a) && out.push(el.getAttribute(a)));
      el.childNodes.forEach(walk);
    };
    walk(document.body);
    return out;
  });
  for (const tx of texts) {
    if (ALLOW.some(r => r.test(tx))) continue;
    const m = ID_RE.exec(tx);
    if (m && !leftovers.has(tx)) leftovers.set(tx, where + ' (' + m[1] + ')');
  }
}

await p.goto(URL);
await p.waitForSelector('#hOnline');
ok(
  'bahasa perangkat English → html lang=en & beranda English',
  (await p.evaluate(() => document.documentElement.lang)) === 'en' && /Play Online/.test(await p.textContent('#scrHome'))
);
ok('judul halaman ikut English', /couples & friends/.test(await p.title()), await p.title());
await scan('beranda');

// menu, pengaturan, privasi
await p.click('#hMenu');
await p.waitForSelector('#mSet');
await scan('menu beranda');
await p.click('#mSet');
await p.waitForSelector('#sLang');
await scan('pengaturan');
await p.screenshot({ path: OUT + '/settings.png' });
await p.evaluate(() => window.LoveUI.closeModal(true));
await p.evaluate(() => window.LoveUI.openPrivacy && window.LoveUI.openPrivacy());
await p.waitForTimeout(150);
await scan('privasi');
await p.evaluate(() => window.LoveUI.closeModal(true));

// Buku Panduan: semua halaman
await p.evaluate(() => window.LoveUI.openGuide(0));
await p.waitForSelector('#guideOv');
const pages = await p.evaluate(() => window.LoveUI.GUIDE_PAGES.length);
for (let k = 0; k < pages; k++) {
  await scan('panduan ' + (k + 1));
  if (k < pages - 1) await p.click('#gNext');
}
await p.click('#gClose');

// Pertanyaan Hari Ini
await p.click('#hDaily');
await p.waitForSelector('[data-dqa]');
await scan('harian: pilih');
await p.click('[data-dqa="0"]');
await scan('harian: tebak');
await p.click('[data-dqg="1"]');
await p.waitForSelector('#dqShare');
await scan('harian: kirim');
await p.evaluate(() => window.LoveUI.closeModal(true));

// Paspor (terbitkan) → kartu beranda
await p.evaluate(() => window.LoveUI.openPassport({ first: false }));
await p.waitForSelector('#ppName');
await p.waitForTimeout(500);
await scan('paspor');
await p.keyboard.press('Escape');
await p.waitForSelector('#passOv', { state: 'detached' });

// setup lawan AI → permainan
await p.evaluate(() => window.LoveUI.renderHome());
await p.click('#hAI');
await p.waitForSelector('#sStart');
await scan('setup');
ok('setup: uang awal format en-US', /2,500/.test(await p.textContent('#scrSetup')));
await p.click('#sStart');
await p.waitForSelector('#board .tile');
await p.waitForTimeout(400);
// lewati undian & tur
for (let k = 0; k < 6; k++) {
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
}
await scan('papan');

const MON = () => {
  const vis = el => el && !el.disabled && el.offsetParent !== null;
  const q = s => document.querySelector(s);
  const g = q('#drawGo') || q('#tNext') || q('#bGate');
  if (vis(g)) {
    g.click();
    return 'gate';
  }
  const m = q('#modalRoot:not([hidden]) .modal');
  if (m) {
    const ta = m.querySelector('#chText');
    if (ta && ta.value.length < 10) {
      ta.value = 'Missing you from afar!';
      ta.dispatchEvent(new Event('input'));
    }
    // tantangan: lewati saja (teksnya diperiksa di bagian tantangan di bawah)
    for (const s of [
      '#bSkip',
      '#bTkSkip',
      '#bBuy',
      '#bUp',
      '#bCard',
      '#bPay',
      '#bTax',
      '#bDone',
      '[data-opt="0"]',
      '#bPayDebt',
      '#bBk',
      '#tdClose',
    ]) {
      const el = m.querySelector(s);
      if (vis(el)) {
        el.click();
        return s;
      }
    }
    const any = m.querySelector('.modal-foot .btn.primary:not(:disabled)');
    if (vis(any)) {
      any.click();
      return 'primary';
    }
    return 'modal';
  }
  const bar = q('#pickbar');
  if (bar && !bar.hidden) {
    const okb = q('#pbOk');
    if (vis(okb)) {
      okb.click();
      return 'pick-ok';
    }
    const tl = q('#board .tile.pickable');
    if (tl) {
      tl.click();
      return 'pick-tile';
    }
    const sk = q('#pbSkip');
    if (vis(sk)) {
      sk.click();
      return 'pick-skip';
    }
  }
  for (const s of ['#cRoll', '#cEnd', '#cOpen']) {
    const el = q(s);
    if (vis(el)) {
      el.click();
      return s;
    }
  }
  return null;
};
let acts = 0;
for (let k = 0; k < 260 && acts < 120; k++) {
  const r = await p.evaluate(MON);
  if (r) acts++;
  if (k % 20 === 0) await scan('permainan');
  if (await p.evaluate(() => !!(window.LoveUI && document.querySelector('#modalRoot .modal')))) await scan('dialog permainan');
  await p.waitForTimeout(160);
}
ok('permainan English berjalan (aksi pemain)', acts > 20, acts + ' aksi');
// tunggu giliran pemain manusia yang bersih (tanpa animasi & keputusan): riwayat, menu, lalu akhiri permainan
const humanIdle = () =>
  p.evaluate(() => {
    const UI = window.LoveUI,
      A = UI.App,
      S = A.S;
    if (!S || S.over) return 'over';
    const h = S.players.findIndex(x => x.kind === 'human');
    return !A.animating && !A.pending.length && !S.queue.length && window.LoveEngine.actor(S) === h && window.LoveEngine.canRoll(S, h)
      ? 'idle'
      : '';
  });
let st = '';
for (let k = 0; k < 400 && !st; k++) {
  st = await humanIdle();
  if (!st) {
    await p.evaluate(MON);
    await p.waitForTimeout(220);
  }
}
const diag = st
  ? ''
  : await p.evaluate(() => {
      const A = window.LoveUI.App,
        S = A.S;
      const m = document.querySelector('#modalRoot .modal');
      return JSON.stringify({
        q: S.queue.map(x => x.type + ':' + (x.kind || x.ch || '')),
        actor: window.LoveEngine.actor(S),
        turn: S.turn.p,
        anim: A.animating,
        pend: A.pending.length,
        modal: m ? m.textContent.slice(0, 80) : '',
        btns: [...document.querySelectorAll('button')]
          .filter(b => b.offsetParent && !b.disabled)
          .map(b => b.id)
          .filter(Boolean)
          .slice(0, 12),
      });
    });
ok('giliran pemain manusia tercapai (atau permainan sudah selesai)', !!st, st || diag);
// riwayat (log engine diterjemahkan dari k/a)
await p.evaluate(() => {
  window.LoveUI.closeModal(true);
  window.LoveUI.openHistory();
});
await p.waitForSelector('.log.full');
await scan('riwayat');
const hist = await p.textContent('.log.full');
ok(
  'riwayat engine tampil English',
  /rolled|passed START|bought|paid/.test(hist) && !/melempar|membeli|membayar/.test(hist),
  hist.slice(0, 160)
);
// menu permainan → Akhiri & hitung aset (konfirmasi dua kali); permainan bisa sudah selesai sendiri (bangkrut / menang instan)
if (st === 'idle') {
  await p.evaluate(() => {
    window.LoveUI.closeModal(true);
    window.LoveUI.openMenu();
  });
  await p.waitForSelector('#mFinish:not(:disabled)');
  await scan('menu permainan');
  await p.click('#mFinish');
  await p.waitForTimeout(150);
  await scan('menu permainan: konfirmasi');
  await p.click('#mFinish');
} else {
  await p.evaluate(() => window.LoveUI.closeModal(true));
  await p.evaluate(() => window.LoveUI.showWin && window.LoveUI.showWin());
}
await p.waitForSelector('#wShare', { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(600);
await p.keyboard.press('Escape');
await scan('layar menang');
await p.screenshot({ path: OUT + '/win.png' });
ok('layar menang tercapai', !!(await p.$('#wShare')));
if (await p.$('#wShare')) {
  await p.click('#wShare');
  await p.waitForSelector('.mem-prev img', { timeout: 15000 }).catch(() => {});
  await scan('Kartu Kenangan');
  await p.keyboard.press('Escape');
}

// tiap jenis tantangan (2 & 3 pemain manusia), info petak, aset pemain, galeri bukti
const HUM = [
  { name: 'Sam', avatar: '🐻', color: '#FF4F8B', kind: 'human' },
  { name: 'Alex', avatar: '🐰', color: '#7B61FF', kind: 'human' },
  { name: 'Kim', avatar: '🦊', color: '#12B5A6', kind: 'human' },
];
const chGame = (id, n) =>
  p.evaluate(
    ([id, players]) => {
      const E = window.LoveEngine,
        UI = window.LoveUI;
      const S = E.create({ players, settings: { debug: true, roundLimit: 0 }, seed: 777 });
      S.queue.push({ type: 'CHALLENGE', p: 0, ch: id, cat: 'card', source: 'card', redraws: 0 });
      E.migrate(S);
      UI.enterGame('local', -1, S);
      UI.syncModal(true);
    },
    [id, HUM.slice(0, n)]
  );
const clickIf = async sel => {
  const el = await p.$(sel);
  if (el && (await el.isVisible())) {
    await p.$eval(sel, e => e.click());
    await p.waitForTimeout(250);
    return true;
  }
  return false;
};
for (const [id, n] of [
  ['tv', 2],
  ['pr', 2],
  ['rc', 2],
  ['mt', 2],
  ['sc', 2],
  ['em', 2],
  ['hs', 2],
  ['bl', 2],
  ['cr', 2],
  ['ms1', 2],
  ['ms5', 2],
  ['dr1', 2],
  ['ph1', 2],
  ['dl1', 2],
  ['dr2', 3],
  ['bl', 3],
  ['cr', 3],
]) {
  await chGame(id, n);
  await p.waitForTimeout(500);
  await scan('tantangan ' + id + ' (' + n + ')');
  for (const sel of ['#bGate', '#bChGo', '#bChStep', '#bGate']) {
    if (await clickIf(sel)) await scan('tantangan ' + id + ' ' + sel);
  }
}
await p.evaluate(() => {
  window.LoveUI.closeModal(true);
  window.LoveUI.onTileClick(9);
});
await p.waitForTimeout(250);
await scan('info petak kota');
await p.evaluate(() => {
  window.LoveUI.closeModal(true);
  window.LoveUI.onTileClick(8);
});
await p.waitForTimeout(250);
await scan('info petak pulau');
await p.evaluate(() => {
  window.LoveUI.closeModal(true);
  window.LoveUI.openPortfolio(0);
});
await p.waitForTimeout(250);
await scan('aset pemain');
await p.evaluate(() => window.LoveUI.closeModal(true));
await p.evaluate(() => window.LoveUI.exitToHome && window.LoveUI.exitToHome(true));

// ganti bahasa di Pengaturan: Indonesia → English (Otomatis)
await p.waitForSelector('#hOnline');
await p.click('#hMenu');
await p.click('#mSet');
await p.click('#sLang [data-v="id"]');
await p.waitForTimeout(300);
const idHome = await p.textContent('#scrHome');
const idLang = await p.evaluate(() => document.documentElement.lang);
await p.click('#sLang [data-v="auto"]');
await p.waitForTimeout(300);
const enHome = await p.textContent('#scrHome');
ok(
  'Pengaturan → Bahasa: Indonesia lalu kembali Otomatis (English)',
  idLang === 'id' && /Main Online/.test(idHome) && /Play Online/.test(enHome)
);
await p.evaluate(() => window.LoveUI.closeModal(true));

// HP: beranda & dialog di layar kecil
await p.setViewportSize({ width: 390, height: 844 });
await p.evaluate(() => window.LoveUI.renderHome());
await scan('beranda HP');
await p.screenshot({ path: OUT + '/home-phone.png' });

const miss = await p.evaluate(() => window.LoveI18n.missing());
const missID = miss.filter(s => ID_RE.test(s) && !ALLOW.some(r => r.test(s)));
ok('tidak ada kunci kamus yang hilang saat dipakai', missID.length === 0, missID.slice(0, 10).join(' | '));
ok(
  'tidak ada teks Indonesia tersisa di layar English',
  leftovers.size === 0,
  [...leftovers]
    .slice(0, 12)
    .map(([k, v]) => v + ': ' + k.slice(0, 80))
    .join(' || ')
);
ok('tanpa error konsol', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL')).length;
console.log(fails ? fails + ' gagal' : 'semua lulus');
process.exit(fails ? 1 : 0);
