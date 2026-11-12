// Monkey test UI LOVEOPOLY 2.0: main lewat klik di beberapa ukuran layar, tangkap error & layar macet.
// node test/ui.js   (ITER=jumlah aksi desktop, default 400)
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { serveDist } from './helpers/serve.js';
const OUT = process.env.OUT || path.join(import.meta.dirname, 'out', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const URL = (await serveDist()).url + '/';
const ITER = Number(process.env.ITER || 400);

// satu aksi "pemain manusia": pilih tombol yang masuk akal di layar saat ini
const MONKEY = () => {
  const q = s => document.querySelector(s);
  const vis = el => el && !el.disabled && el.offsetParent !== null;
  if (q('#guideOv')) {
    q('#gClose').click();
    return 'guide-close';
  }
  if (q('#tourOv')) {
    const b = q('#tourOv .btn.ghost') || q('#tourOv button');
    if (b) {
      b.click();
      return 'tour-skip';
    }
  }
  if (q('#winOv')) return 'win';
  if (q('#pauseOv')) {
    q('#pResume').click();
    return 'resume';
  }
  const modal = q('#modalRoot:not([hidden]) .modal');
  if (modal) {
    const ta = modal.querySelector('#chText');
    if (ta && ta.value.length < 10) {
      ta.value = 'Aku sayang kamu, semangat terus ya!';
      ta.dispatchEvent(new Event('input'));
    }
    // utang: jual dulu kalau belum bisa bayar
    const pd = modal.querySelector('#bPayDebt');
    if (pd && pd.disabled) {
      const s = modal.querySelector('[data-sell]:not(:disabled)');
      if (s) {
        s.click();
        return 'sell';
      }
    }
    const prefs = [
      '#bTkBuy',
      '#bTkSkip',
      '#bBuy',
      '#bUp',
      '#bCard',
      '[data-ch="0"]',
      '#bPay',
      '#bTax',
      '#bDone',
      '[data-opt="0"]',
      '#bGStart',
      '[data-gp]',
      '#bGEnd',
      '#bGate',
      '#bJudgeOk',
      '#bPayDebt',
      '#bBk',
      '#bSkip',
    ];
    for (const s of prefs) {
      const el = modal.querySelector(s);
      if (vis(el)) {
        el.click();
        return s;
      }
    }
    const mc = Array.from(modal.querySelectorAll('.mcard:not(.done):not(.open)'));
    if (mc.length) {
      mc[Math.floor(Math.random() * mc.length)].click();
      return 'mcard';
    }
    const beat = modal.querySelector('#beatTap');
    if (vis(beat)) {
      beat.click();
      return 'beat';
    }
    const x = modal.querySelector('[data-x]');
    if (x) {
      x.click();
      return 'close';
    }
    return 'modal-stuck';
  }
  // mode pilih petak di papan
  const bar = q('#pickbar');
  if (bar && !bar.hidden) {
    const ok = q('#pbOk');
    if (vis(ok) && Math.random() < 0.7) {
      ok.click();
      return 'pick-ok';
    }
    const tiles = Array.from(document.querySelectorAll('#board .tile.pickable'));
    if (tiles.length && Math.random() < 0.85) {
      tiles[Math.floor(Math.random() * tiles.length)].click();
      return 'pick-tile';
    }
    const sk = q('#pbSkip');
    if (vis(sk)) {
      sk.click();
      return 'pick-skip';
    }
    if (vis(ok)) {
      ok.click();
      return 'pick-ok';
    }
    return 'pick-stuck';
  }
  const aims = Array.from(document.querySelectorAll('[data-aim]'));
  if (aims.length && Math.random() < 0.4 && !aims.some(b => b.getAttribute('aria-pressed') === 'true')) {
    aims[Math.floor(Math.random() * aims.length)].click();
    return 'aim';
  }
  const isle = ['#cIslePay', '#cIsleCh', '#cIsleCard'].map(s => q(s)).filter(vis);
  if (isle.length && Math.random() < 0.4) {
    isle[Math.floor(Math.random() * isle.length)].click();
    return 'island-opt';
  }
  for (const s of ['#cRoll', '#cEnd', '#cOpen', '#cResume', '#cShowWin']) {
    const el = q(s);
    if (vis(el)) {
      el.click();
      return s;
    }
  }
  return null;
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function newPage(viewport, scheme, label, extra) {
    const ctx = await browser.newContext(Object.assign({ locale: 'id-ID', viewport, colorScheme: scheme || 'light' }, extra || {}));
    const page = await ctx.newPage();
    page.on('console', m => {
      if (m.type() === 'error') errors.push(label + ' console: ' + m.text());
    });
    page.on('pageerror', e => errors.push(label + ' pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
    await page.addInitScript(() => {
      try {
        if (!localStorage.getItem('loveopoly.v1.profile')) localStorage.setItem('loveopoly.v1.profile', JSON.stringify({ skipped: true }));
        localStorage.setItem('loveopoly.v2.tour', '"done"');
        if (!localStorage.getItem('loveopoly.v1.prefs'))
          localStorage.setItem('loveopoly.v1.prefs', JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast', theme: 'system' }));
      } catch (e) {}
    });
    await page.goto(URL);
    return page;
  }
  async function play(page, label, iters) {
    const seen = {};
    let stuck = 0,
      idle = 0;
    for (let k = 0; k < iters; k++) {
      const r = await page.evaluate(MONKEY);
      if (r) seen[r] = (seen[r] || 0) + 1;
      if (r === 'win') break;
      if (r && /stuck/.test(r)) {
        stuck++;
        if (stuck > 6) {
          await page.screenshot({ path: OUT + '/err-' + label + '-stuck.png' });
          errors.push(label + ': UI macet (' + r + ')');
          break;
        }
      } else stuck = 0;
      // tanpa aksi lama = mungkin menunggu AI; kalau terlalu lama dianggap macet
      if (!r) {
        idle++;
        if (idle > 160) {
          await page.screenshot({ path: OUT + '/err-' + label + '-idle.png' });
          errors.push(label + ': tidak ada aksi tersedia terlalu lama');
          break;
        }
      } else idle = 0;
      await page.waitForTimeout(r ? 90 : 200);
    }
    return seen;
  }
  const t0 = Date.now();

  // ---- desktop vs AI (aturan lengkap) ----
  const page = await newPage({ width: 1440, height: 900 }, 'light', 'desk');
  await page.waitForSelector('#hAI');
  await page.click('#hAI');
  await page.waitForSelector('#sStart');
  await page.click('#sStart', { force: true });
  await page.waitForSelector('#board .tile');
  await page.waitForTimeout(600);
  const seen = await play(page, 'desk', ITER);
  await page.screenshot({ path: OUT + '/04-game-mid.png' });
  const info = await page.evaluate(() => {
    const S = window.LoveUI.App.S;
    return S
      ? {
          round: S.round,
          seq: S.seq,
          over: S.over && S.over.reason,
          cash: S.players.map(p => p.cash),
          owned: S.tiles.filter(t => t.owner >= 0).length,
          queue: S.queue.map(x => x.type),
        }
      : null;
  });
  console.log('desk state:', JSON.stringify(info));

  // ---- permainan singkat sampai layar menang ----
  await page.evaluate(() => {
    const E = window.LoveEngine,
      UI = window.LoveUI;
    const S = E.create({
      players: [
        { name: 'Arfi', avatar: '🐻', color: '#FF4F8B' },
        { name: 'Nadia', avatar: '🐰', color: '#7B61FF', kind: 'ai', ai: 'hard' },
      ],
      settings: { roundLimit: 1 },
      seed: 77,
    });
    UI.enterGame('local', -1, S);
  });
  await play(page, 'win', 120);
  await page.waitForTimeout(900);
  const winShown = await page.evaluate(() => !!document.querySelector('#winOv'));
  if (!winShown) errors.push('win: layar menang tidak muncul setelah 1 ronde');
  await page.screenshot({ path: OUT + '/07-win.png' });

  // ---- ponsel potret, 4 pemain lokal ----
  const mob = await newPage({ width: 390, height: 844 }, 'light', 'mob', { deviceScaleFactor: 2, hasTouch: true });
  await mob.waitForSelector('#hLocal');
  await mob.evaluate(() => {
    const E = window.LoveEngine,
      UI = window.LoveUI;
    const S = E.create({
      players: [
        { name: 'Arfi', avatar: '🐻', color: '#FF4F8B' },
        { name: 'Nadia', avatar: '🐰', color: '#7B61FF' },
        { name: 'Bima', avatar: '🦊', color: '#12B5A6', kind: 'ai', ai: 'normal' },
        { name: 'Citra', avatar: '🐱', color: '#FF8A3D', kind: 'ai', ai: 'easy' },
      ],
      settings: { roundLimit: 0 },
      seed: 9,
    });
    UI.enterGame('local', -1, S);
  });
  await mob.waitForSelector('#board .tile');
  const seenMob = await play(mob, 'mob', 220);
  await mob.screenshot({ path: OUT + '/14-mob-game-later.png' });
  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) errors.push('mob: horizontal overflow ' + overflow + 'px');

  // ---- ponsel mendatar ----
  const land = await newPage({ width: 844, height: 390 }, 'light', 'land', { deviceScaleFactor: 2, hasTouch: true });
  await land.waitForSelector('#hAI');
  await land.click('#hAI');
  await land.waitForSelector('#sStart');
  await land.click('#sStart', { force: true });
  await land.waitForSelector('#board .tile');
  const seenLand = await play(land, 'land', 120);
  await land.screenshot({ path: OUT + '/15-land.png' });

  // ---- tablet + gelap ----
  const dark = await newPage({ width: 1024, height: 768 }, 'dark', 'tab-dark');
  await dark.waitForSelector('#hAI');
  await dark.click('#hAI');
  await dark.click('#sStart', { force: true });
  await dark.waitForSelector('#board .tile');
  await play(dark, 'tab-dark', 120);
  await dark.screenshot({ path: OUT + '/21-dark-tab.png' });

  console.log('desk actions:', JSON.stringify(seen));
  console.log('mob actions:', JSON.stringify(seenMob));
  console.log('land actions:', JSON.stringify(seenLand));
  console.log('ERRORS (' + errors.length + '):\n' + errors.slice(0, 20).join('\n---\n'));
  console.log('time', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => {
  console.error('TEST CRASH', e);
  process.exit(1);
});
