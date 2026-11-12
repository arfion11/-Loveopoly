// Uji asap di URL hosting sungguhan: dua browser terpisah (uid anonim berbeda) membuat & bergabung room,
// main beberapa ronde, lalu tamu menutup tab → host melihat Offline. Room uji dihapus di akhir.
// node test/smoke.js [URL]   (bawaan https://loveopoly.web.app)
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const URL = process.argv[2] || 'https://loveopoly.web.app';
const OUT = path.join(import.meta.dirname, 'out', 'smoke');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const errors = [],
    results = [];
  const ok = (n, c, d) => results.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
  const mk = async (label, viewport) => {
    const ctx = await browser.newContext({ locale: 'id-ID', viewport });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem(
          'loveopoly.v1.prefs',
          JSON.stringify({ sound: false, speed: 'fast', aiSpeed: 'fast', theme: 'system', autoEnd: false })
        );
        if (!localStorage.getItem('loveopoly.v1.profile')) localStorage.setItem('loveopoly.v1.profile', JSON.stringify({ skipped: true }));
        localStorage.setItem('loveopoly.v2.tour', '"done"');
      } catch (e) {}
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(label + ' pageerror: ' + e.message));
    p.on('console', m => {
      if (m.type() === 'error' && !/fonts|ERR_/.test(m.text())) errors.push(label + ' console: ' + m.text());
    });
    await p.goto(URL);
    await p.waitForSelector('#hOnline', { timeout: 30000 });
    return { ctx, p };
  };
  const H = await mk('host', { width: 1280, height: 820 }),
    host = H.p;
  const G = await mk('tamu', { width: 390, height: 844 }),
    guest = G.p;

  await host.click('#hOnline');
  await host.waitForSelector('#oCreate', { timeout: 30000 });
  await host.fill('#oName', 'Uji Host');
  await host.click('#oCreate');
  await host.waitForSelector('#codeBox', { timeout: 30000 });
  const code = (await host.textContent('#codeBox')).trim();
  ok('host membuat room', /^[A-Z0-9]{6}$/.test(code), code);

  await guest.click('#hOnline');
  await guest.waitForSelector('#oJoin', { timeout: 30000 });
  await guest.fill('#oName', 'Uji Tamu');
  await guest.click('[data-pav="🐰"]');
  await guest.fill('#oName', 'Uji Tamu');
  await guest.fill('#oCode', code);
  await guest.click('#oJoin');
  await host.waitForFunction(() => window.LoveNet.doc && window.LoveNet.doc.seats.length === 2, null, { timeout: 30000 }).catch(() => {});
  await guest.waitForFunction(() => window.LoveNet.doc && window.LoveNet.mySeat() === 1, null, { timeout: 30000 }).catch(() => {});
  ok('tamu bergabung', await guest.evaluate(() => window.LoveNet.mySeat() === 1));
  await host.screenshot({ path: OUT + '/01-lobby.png' });

  await host.click('#oStart', { force: true });
  await host.waitForSelector('#board .tile', { timeout: 30000 });
  await guest.waitForSelector('#board .tile', { timeout: 30000 });
  ok('keduanya masuk papan', true);

  const MON = () => {
    const vis = el => el && !el.disabled && el.offsetParent !== null;
    const q = s => document.querySelector(s);
    const m = q('#modalRoot:not([hidden]) .modal');
    if (m) {
      const ta = m.querySelector('#chText');
      if (ta && ta.value.length < 10) {
        ta.value = 'Rindu kamu dari jauh!';
        ta.dispatchEvent(new Event('input'));
      }
      const pd = m.querySelector('#bPayDebt');
      if (pd && pd.disabled) {
        const s = m.querySelector('[data-sell]:not(:disabled)');
        if (s) {
          s.click();
          return 'sell';
        }
      }
      for (const s of [
        '#bTkSkip',
        '#bBuy',
        '#bUp',
        '#bCard',
        '[data-ch="0"]',
        '#bPay',
        '#bTax',
        '#bDone',
        '[data-opt="0"]',
        '#bFail',
        '#bPayDebt',
        '#bBk',
        '#bSkip',
      ]) {
        const el = m.querySelector(s);
        if (vis(el)) {
          el.click();
          return s;
        }
      }
      return 'modal';
    }
    const bar = q('#pickbar');
    if (bar && !bar.hidden) {
      const ok = q('#pbOk');
      if (vis(ok)) {
        ok.click();
        return 'pick-ok';
      }
      const t = q('#board .tile.pickable');
      if (t) {
        t.click();
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
  let hostActs = 0,
    guestActs = 0;
  for (let k = 0; k < 160; k++) {
    if (await host.evaluate(MON)) hostActs++;
    await host.waitForTimeout(250);
    if (await guest.evaluate(MON)) guestActs++;
    await guest.waitForTimeout(400);
    if ((await host.evaluate(() => window.LoveUI.App.S.round)) >= 3) break;
  }
  await guest
    .waitForFunction(
      () => window.LoveNet.doc && window.LoveNet.doc.state && window.LoveUI.App.S.seq === window.LoveNet.doc.state.seq,
      null,
      { timeout: 20000 }
    )
    .catch(() => {});
  const hs = await host.evaluate(() => window.LoveUI.App.S.seq),
    gs = await guest.evaluate(() => window.LoveUI.App.S.seq);
  ok(
    'main 2 ronde & state sinkron',
    hs === gs && hs > 5,
    'seq host=' + hs + ' tamu=' + gs + ' aksi host=' + hostActs + ' tamu=' + guestActs
  );
  ok('aksi tamu diproses host', await host.evaluate(() => window.LoveUI.App.S.log.some(l => l.p === 1 && /melempar/.test(l.text))));
  const pres = await host.evaluate(() => [...window.LoveNet.onlineUids].length);
  ok('presence: dua pemain online', pres === 2, 'online=' + pres);
  await host.screenshot({ path: OUT + '/02-host.png' });
  await guest.screenshot({ path: OUT + '/03-tamu.png' });

  await G.ctx.close();
  await host.waitForFunction(() => window.LoveNet.onlineUids.size === 1, null, { timeout: 30000 }).catch(() => {});
  ok(
    'tamu menutup tab → host melihat Offline',
    await host.evaluate(() => window.LoveNet.onlineUids.size === 1 && window.LoveNet.isOnline(window.LoveNet.doc.seats[1].uid) === false)
  );

  await host.evaluate(() => window.LoveNet.deleteRoom()).catch(() => {});
  await browser.close();
  results.forEach(r => console.log(r));
  console.log('ERRORS (' + errors.length + '):', errors.slice(0, 10).join('\n'));
  process.exit(results.some(r => r.startsWith('FAIL')) || errors.length ? 1 : 0);
})().catch(e => {
  console.error('SMOKE CRASH', e);
  process.exit(1);
});
