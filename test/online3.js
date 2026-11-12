// Uji online 3 perangkat (tantangan 3–4 pemain): Peragakan! — penebak yang bukan giliran utama menebak dari HP-nya;
// Aksi Berani — voting penilai lintas HP. Memakai mock LoveBackend yang sama dengan test/online.js. node test/online3.js
import { chromium } from 'playwright';
import { serveDist } from './helpers/serve.js';
import { MOCK } from './helpers/mock-backend.js';
await serveDist(8134);
(async () => {
  const b = await chromium.launch();
  const errs = [],
    results = [];
  const ok = (n, c, d) => results.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
  const ctx = await b.newContext({ locale: 'id-ID', viewport: { width: 900, height: 820 } });
  await ctx.addInitScript(MOCK);
  const mk = async u => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(u + ' ' + e.message));
    p.on('console', m => {
      if (m.type() === 'error' && !/fonts|net::|ERR_/.test(m.text())) errs.push(u + ' ' + m.text());
    });
    await p.goto('http://localhost:8134/?u=' + u);
    await p.waitForSelector('#hOnline');
    return p;
  };
  const host = await mk('u_host'),
    g1 = await mk('u_g1'),
    g2 = await mk('u_g2');
  await host.click('#hOnline');
  await host.waitForSelector('#oCreate');
  await host.fill('#oName', 'Arfi');
  await host.click('#oCreate');
  await host.waitForSelector('#codeBox');
  const code = (await host.textContent('#codeBox')).trim();
  for (const [p, n, av] of [
    [g1, 'Nadia', '🐰'],
    [g2, 'Dimas', '🦊'],
  ]) {
    await p.click('#hOnline');
    await p.waitForSelector('#oJoin');
    await p.fill('#oName', n);
    await p.click('[data-pav="' + av + '"]');
    await p.fill('#oName', n);
    await p.fill('#oCode', code);
    await p.click('#oJoin');
  }
  await host.waitForFunction(() => window.LoveNet.doc.seats.length === 3, null, { timeout: 10000 });
  await host.click('#oStart', { force: true });
  for (const p of [host, g1, g2]) await p.waitForSelector('#board .tile', { timeout: 20000 });
  const inject = async ch =>
    host.evaluate(ch => {
      const N = window.LoveNet,
        E = window.LoveEngine;
      const S = JSON.parse(JSON.stringify(N.doc.state));
      S.queue = [{ type: 'CHALLENGE', p: 0, ch, cat: 'card', source: 'card', redraws: 0 }];
      S.turn.p = 0;
      E.migrate(S);
      S.seq++;
      S.lastEvents = [];
      S.evSeq = S.seq;
      N.doc.state = S;
      N.doc.seq = S.seq;
      window.LoveUI.commit(S);
      N.writeRoom();
    }, ch);
  const settle = p => p.waitForFunction(() => !window.LoveUI.App.animating && !window.LoveUI.App.pending.length, null, { timeout: 15000 });
  const closeDraw = async p => {
    await p.evaluate(() => {
      const g = document.getElementById('drawGo');
      if (g) g.click();
    });
  };
  for (const p of [host, g1, g2]) {
    await p.waitForTimeout(400);
    await closeDraw(p);
  }
  await host.waitForTimeout(3500);
  // --- Peragakan! ---
  await inject('cr');
  await g2.waitForFunction(
    () => {
      const it = window.LoveUI.App.S.queue[0];
      return it && it.type === 'CHALLENGE';
    },
    null,
    { timeout: 8000 }
  );
  const word = await host.evaluate(() => window.LoveUI.App.S.queue[0].pz.word);
  await host.evaluate(() => window.LoveUI.act({ type: 'CH_ANSWER', p: 0 }));
  await g2.waitForFunction(() => window.LoveUI.App.S.queue[0] && window.LoveUI.App.S.queue[0].phase === 'guess', null, { timeout: 8000 });
  const juds = await g2.evaluate(() => window.LoveUI.App.S.queue[0].judges);
  const nonActor = juds[1]; // penebak yang BUKAN giliran utama
  const pg = nonActor === 1 ? g1 : g2;
  await settle(pg);
  await pg.evaluate(() => window.LoveUI.syncModal());
  await pg.waitForTimeout(400);
  const hasInput = await pg.evaluate(() => !!document.querySelector('#modalRoot #chGuess'));
  await pg.fill('#chGuess', word);
  await pg.$eval('#bChSend', b => b.click());
  await host.waitForFunction(() => !window.LoveUI.App.S.queue.length, null, { timeout: 8000 }).catch(() => {});
  const res = await host.evaluate(() => ({
    q: window.LoveUI.App.S.queue.length,
    proof: (window.LoveUI.App.S.proofs.slice(-1)[0] || {}).proof,
  }));
  ok(
    'Peragakan! online: penebak bukan giliran utama bisa menebak dari HP-nya',
    hasInput && res.q === 0 && /menebak "/.test(res.proof || ''),
    'kursi ' + nonActor + ' · ' + res.proof
  );
  // --- Aksi Berani: voting lintas HP ---
  await settle(host);
  await inject('dr3');
  await host.waitForTimeout(600);
  await host.evaluate(() => window.LoveUI.act({ type: 'CH_ANSWER', p: 0 }));
  const vote = async (seat, okv) => {
    const p = seat === 1 ? g1 : g2;
    await p.waitForFunction(s => window.LoveEngine.actor(window.LoveUI.App.S) === s, seat, { timeout: 8000 });
    await settle(p);
    await p.evaluate(() => window.LoveUI.syncModal());
    await p.waitForSelector('#modalRoot #bJudgeOk', { timeout: 8000 });
    await p.$eval(okv ? '#bJudgeOk' : '#bJudgeNo', b => b.click());
  };
  const order = await host.evaluate(() => window.LoveUI.App.S.queue[0].judges);
  await vote(order[0], false);
  await vote(order[1], false);
  await host.waitForFunction(() => !window.LoveUI.App.S.queue.length, null, { timeout: 8000 }).catch(() => {});
  const vproof = await host.evaluate(() => (window.LoveUI.App.S.proofs.slice(-1)[0] || {}).proof || '');
  ok('Aksi Berani online: kedua penilai memilih dari HP masing-masing', /tidak disahkan 0 dari 2 penilai/.test(vproof), vproof);
  console.log(results.join('\n'));
  console.log('ERRORS (' + errs.length + '):', errs.slice(0, 10).join('\n'));
  await b.close();
  process.exit(results.some(r => r.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
