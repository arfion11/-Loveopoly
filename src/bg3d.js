/* LOVEOPOLY 2.0 — dunia 3D di latar.
   - Langit: hati 3D, awan low-poly, balon udara, pesawat kertas berjejak hati (semua layar).
   - Globe mini di tengah papan saat main di ponsel (tengah papan kosong karena panel ada di bawah).
   Three.js r128 dimuat malas dari CDN. Tanpa WebGL / CDN gagal / dimatikan di Pengaturan -> latar CSS biasa.
   Hemat: 30 fps, berhenti saat tab tersembunyi, saat dialog terbuka, dan menurunkan kualitas bila perangkat lambat. */
(function (G) {
  'use strict';
  const SRC = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'];
  let T = null, loading = null, sky = null, globe = null, poll = 0, started = false, broken = false;
  const ST = { enabled: true };
  const mq = q => { try { return G.matchMedia(q); } catch (e) { return null; } };
  const mqDark = mq('(prefers-color-scheme: dark)'), mqReduce = mq('(prefers-reduced-motion: reduce)');
  const isDark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : !!(mqDark && mqDark.matches); };
  const isReduce = () => !!(mqReduce && mqReduce.matches);
  const rnd = (a, b) => a + Math.random() * (b - a);

  function loadThree() {
    if (G.THREE && G.THREE.REVISION) return Promise.resolve(G.THREE);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      let k = 0;
      const next = () => {
        if (k >= SRC.length) { rej(new Error('three.js tidak termuat')); return; }
        const s = document.createElement('script');
        s.src = SRC[k++];
        s.async = true;
        s.onload = () => (G.THREE && G.THREE.REVISION ? res(G.THREE) : next());
        s.onerror = () => { s.remove(); next(); };
        document.head.appendChild(s);
      };
      next();
    });
    return loading;
  }

  // ---------- bentuk bersama ----------
  let GEO = null;
  function geos() {
    if (GEO) return GEO;
    const pts = [];
    for (let i = 0; i < 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      pts.push(new T.Vector2(16 * Math.pow(Math.sin(t), 3) / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17));
    }
    const heart = new T.ExtrudeGeometry(new T.Shape(pts), { depth: 0.32, bevelEnabled: true, bevelThickness: 0.17, bevelSize: 0.15, bevelSegments: 4, curveSegments: 6 });
    heart.center();
    // pesawat kertas: dua sayap sedikit naik (dihedral) + lunas; hidung ke +z
    const plane = new T.BufferGeometry();
    plane.setAttribute('position', new T.Float32BufferAttribute([
      0, 0, 1, -0.78, 0.1, -0.6, 0, 0.02, -0.42,
      0, 0, 1, 0, 0.02, -0.42, 0.78, 0.1, -0.6,
      0, 0, 1, 0, -0.26, -0.5, 0, 0.02, -0.42
    ], 3));
    plane.computeVertexNormals();
    GEO = { heart, puff: new T.IcosahedronGeometry(1, 1), plane, neck: new T.CylinderGeometry(0.38, 0.16, 0.42, 12, 1, true), basket: new T.BoxGeometry(0.34, 0.26, 0.34) };
    return GEO;
  }
  // balon berlajur: warna per sisi supaya garisnya tegas (gaya low-poly)
  function balloonGeo(a, b) {
    const g = new T.SphereGeometry(1, 16, 12).toNonIndexed();
    const p = g.attributes.position, col = new Float32Array(p.count * 3), A = new T.Color(a), B = new T.Color(b);
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const c = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12) % 2 ? B : A;
      for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    return g;
  }
  function spriteTex(kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    if (kind === 'heart') {
      x.fillStyle = '#fff';
      x.beginPath();
      x.moveTo(32, 56);
      x.bezierCurveTo(4, 36, 6, 10, 22, 10);
      x.bezierCurveTo(28, 10, 31, 14, 32, 18);
      x.bezierCurveTo(33, 14, 36, 10, 42, 10);
      x.bezierCurveTo(58, 10, 60, 36, 32, 56);
      x.fill();
    } else if (kind === 'spark') {
      x.translate(32, 32);
      x.fillStyle = '#fff';
      x.beginPath();
      for (let k = 0; k < 8; k++) { const r = k % 2 ? 7 : 30, a = (k / 8) * Math.PI * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      x.fill();
    } else {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(kind === 'halo' ? 0.25 : 0.35, kind === 'halo' ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
    }
    return new T.CanvasTexture(c);
  }
  function cloud(mat, n, spread) {
    const g = new T.Group();
    for (let k = 0; k < n; k++) {
      const off = k - (n - 1) / 2, s = 1 - (Math.abs(off) / n) * 0.95;
      const m = new T.Mesh(GEO.puff, mat);
      m.position.set(off * spread * rnd(0.85, 1.05), (1 - s) * -0.45 + rnd(-0.06, 0.06), rnd(-0.25, 0.25));
      m.scale.set(s * 1.12, s, s);
      g.add(m);
    }
    return g;
  }
  function trail(color, n) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new T.PointsMaterial({ size: 0.26, map: spriteTex('heart'), vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.05 });
    const pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    return { pts, n, buf: [], col: new T.Color(color), acc: 0 };
  }
  function pushTrail(tr, v, fade, dt, every) {
    tr.acc += dt;
    if (tr.acc >= every) { tr.acc = 0; tr.buf.unshift(v.clone()); if (tr.buf.length > tr.n) tr.buf.pop(); }
    const p = tr.pts.geometry.attributes.position, c = tr.pts.geometry.attributes.color, tmp = new T.Color();
    for (let i = 0; i < tr.n; i++) {
      const q = tr.buf[i] || tr.buf[tr.buf.length - 1] || v;
      p.setXYZ(i, q.x, q.y - i * 0.004, q.z);
      tmp.copy(tr.col).lerp(fade, Math.min(1, i / tr.n * 1.15));
      c.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    p.needsUpdate = true;
    c.needsUpdate = true;
  }

  // ---------- kerangka renderer: 30 fps, jeda, kualitas adaptif ----------
  function makeView(canvas, opts) {
    const r = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
    r.setClearColor(0x000000, 0);
    const v = { r, canvas, fps: soft(r) && !G.LOVE_BG_FORCE_ANIM ? 0 : 30, prCap: opts.prCap || 1.5, raf: 0, last: 0, t: 0, frames: 0, slow: 0, n: 0, gaps: 0, gapN: 0, running: false, dead: false, w: 0, h: 0, pr: 1 };
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); v.dead = true; stopView(v); canvas.classList.remove('on'); }, false);
    return v;
  }
  // GPU perangkat lunak membuat seluruh halaman tersendat: cukup gambar diam
  let softGL = null;
  function soft(r) {
    if (softGL !== null) return softGL;
    try {
      const gl = r.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      softGL = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
    } catch (e) { softGL = false; }
    return softGL;
  }
  function degrade(v) {
    if (v.prCap > 1) { v.prCap = 1; v.w = 0; v.resize(); }
    else if (v.fps > 20) v.fps = 20;
    else { v.fps = 0; stopView(v); }
  }
  function sizeView(v, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    let pr = Math.min(G.devicePixelRatio || 1, v.prCap);
    if (w * h * pr * pr > 2.2e6) pr = Math.max(0.75, Math.sqrt(2.2e6 / (w * h)));
    if (w === v.w && h === v.h && Math.abs(pr - v.pr) < 0.01) return false;
    v.w = w; v.h = h; v.pr = pr;
    v.r.setPixelRatio(pr);
    v.r.setSize(w, h, false);
    return true;
  }
  function drawView(v, dt) {
    if (v.dead) return;
    const t0 = performance.now();
    v.update(dt, v.t);
    v.r.render(v.scene, v.cam);
    v.frames++;
    // kualitas adaptif: perangkat lambat -> resolusi turun, lalu fps turun, lalu berhenti bergerak
    const ms = performance.now() - t0;
    v.n++;
    if (ms > 14) v.slow++;
    if (v.n >= 40) {
      if (v.slow > 24) degrade(v);
      v.n = 0; v.slow = 0;
    }
  }
  function loopView(v) {
    const step = now => {
      if (!v.running) return;
      v.raf = requestAnimationFrame(step);
      if (!v.last) { v.last = now; v.prevRaf = now; return; }
      const gap = now - v.prevRaf;
      v.prevRaf = now;
      if (gap < 1000) { v.gaps += gap; v.gapN++; }
      if (v.gapN >= 90) { if (v.gaps / v.gapN > 45) degrade(v); v.gaps = 0; v.gapN = 0; if (!v.running) return; }
      if (now - v.last < 1000 / v.fps - 3) return;
      const dt = Math.min(0.08, (now - v.last) / 1000);
      v.last = now;
      v.t += dt;
      drawView(v, dt);
    };
    v.raf = requestAnimationFrame(step);
  }
  function runView(v, on) {
    if (!v || v.dead) return;
    on = on && v.fps > 0;
    if (on === v.running) return;
    if (on) { v.running = true; v.last = 0; loopView(v); }
    else stopView(v);
  }
  function stopView(v) { v.running = false; cancelAnimationFrame(v.raf); v.raf = 0; }
  function stillFrame(v) { if (v && !v.dead && !v.running) drawView(v, 0); }

  // ---------- langit ----------
  function buildSky() {
    const host = document.querySelector('.page-sky');
    if (!host) return null;
    const canvas = document.createElement('canvas');
    canvas.className = 'sky3d';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    let v;
    try { v = makeView(canvas, { prCap: 1.5 }); } catch (e) { canvas.remove(); return null; }
    geos();
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(42, 1, 0.1, 80);
    cam.position.set(0, 0, 16);
    const hemi = new T.HemisphereLight(0xFFF5FA, 0xD9C9FF, 0.95), sun = new T.DirectionalLight(0xFFFFFF, 0.7);
    sun.position.set(5, 8, 9);
    scene.add(hemi, sun);
    scene.fog = new T.Fog(0xFCE6F0, 13, 31);
    v.scene = scene; v.cam = cam;
    v.resize = () => {
      if (!sizeView(v, G.innerWidth, G.innerHeight)) return false;
      cam.aspect = v.w / v.h;
      cam.updateProjectionMatrix();
      return true;
    };
    v.resize();
    const tan = Math.tan(T.MathUtils.degToRad(cam.fov / 2));
    const halfH = z => (cam.position.z - z) * tan, halfW = z => halfH(z) * cam.aspect;
    const side = () => (Math.random() < 0.5 ? -1 : 1);
    const objs = [];
    // hati 3D mengapung naik
    const HC = [0xFF4F8B, 0xFF7EAC, 0xFF9EC4, 0xFFC93C, 0xB79CFF, 0xFF6F9F];
    const hMats = HC.map(c => new T.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.05, emissive: c, emissiveIntensity: 0.12 }));
    const heartX = z => side() * (z > -3 ? rnd(0.86, 1.04) : rnd(0.2, 0.98)) * halfW(z);
    for (let i = 0; i < 12; i++) {
      const m = new T.Mesh(GEO.heart, hMats[i % hMats.length]);
      const z = i < 4 ? rnd(-2, 2.5) : rnd(-12, -3);
      m.scale.setScalar(rnd(0.32, 0.58) + (z + 12) * 0.014);
      m.userData = { k: 'heart', z, spin: rnd(0.25, 0.7) * side(), rise: rnd(0.16, 0.36), amp: rnd(0.2, 0.5), sw: rnd(0.25, 0.55), ph: rnd(0, 6.3), x0: heartX(z) };
      m.position.set(m.userData.x0, rnd(-1, 1) * halfH(z), z);
      m.rotation.y = rnd(0, 6.3);
      objs.push(m);
      scene.add(m);
    }
    // awan low-poly berarak
    const cMat = new T.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.9, flatShading: true, emissive: 0xFFE6F0, emissiveIntensity: 0.38, transparent: true, opacity: 0.96 });
    for (let i = 0; i < 7; i++) {
      const g = cloud(cMat, 4 + (i % 3), 0.95);
      const z = rnd(-14, -3);
      g.scale.setScalar(rnd(0.7, 1.25));
      g.userData = { k: 'cloud', z, vx: rnd(0.12, 0.32) * (i % 2 ? 1 : -1), ph: rnd(0, 6.3) };
      g.position.set(rnd(-1, 1) * halfW(z), rnd(-0.85, 0.85) * halfH(z), z);
      objs.push(g);
      scene.add(g);
    }
    // balon udara
    const BAL = [[0xFF4F8B, 0xFFFFFF], [0x9C88FF, 0xFFD96B], [0xFFC93C, 0xFF7EAC]];
    const ropeMat = new T.LineBasicMaterial({ color: 0x9A7A5A }), bMat = new T.MeshStandardMaterial({ color: 0xC98B4E, roughness: 0.9 });
    BAL.forEach(([a, b], i) => {
      const g = new T.Group();
      const env = new T.Mesh(balloonGeo(a, b), new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, emissive: a, emissiveIntensity: 0.06 }));
      env.scale.set(1, 1.12, 1);
      const neck = new T.Mesh(GEO.neck, new T.MeshStandardMaterial({ color: a, roughness: 0.6, side: T.DoubleSide }));
      neck.position.y = -1.2;
      const basket = new T.Mesh(GEO.basket, bMat);
      basket.position.y = -1.86;
      const rp = [];
      [[0.28, 0.28], [-0.28, 0.28], [0.28, -0.28], [-0.28, -0.28]].forEach(([x, z]) => rp.push(x * 0.5, -1.4, z * 0.5, x * 0.56, -1.74, z * 0.56));
      const rg = new T.BufferGeometry();
      rg.setAttribute('position', new T.Float32BufferAttribute(rp, 3));
      g.add(env, neck, basket, new T.LineSegments(rg, ropeMat));
      const z = rnd(-9, -2) - i;
      g.scale.setScalar(rnd(0.5, 0.75));
      g.userData = { k: 'balloon', z, rise: rnd(0.1, 0.18), ph: rnd(0, 6.3), env, base: a };
      g.position.set(side() * rnd(0.45, 0.95) * halfW(z), rnd(-1, 1) * halfH(z), z);
      objs.push(g);
      scene.add(g);
    });
    // pesawat kertas berjejak hati
    const pMat = new T.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.7, flatShading: true, side: T.DoubleSide, emissive: 0xFFF0F6, emissiveIntensity: 0.3 });
    const fadeCol = new T.Color(0xFCE6F0);
    for (let i = 0; i < 2; i++) {
      const m = new T.Mesh(GEO.plane, pMat);
      const z = i ? -6 : -1.5;
      m.scale.setScalar(i ? 0.55 : 0.42);
      const tr = trail(i ? 0xB79CFF : 0xFF7EAC, 22);
      scene.add(m, tr.pts);
      m.userData = { k: 'plane', z, dir: i ? -1 : 1, sp: i ? 1.2 : 1.6, y0: 0, ph: rnd(0, 6.3), wait: i * 6 + rnd(1, 4), tr, prev: new T.Vector3() };
      objs.push(m);
    }
    // kilau (terang) & bintang (gelap)
    const sparkGeo = new T.BufferGeometry(), sp = [];
    for (let i = 0; i < 46; i++) sp.push(rnd(-26, 26), rnd(-15, 15), rnd(-18, -6));
    sparkGeo.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    const sparkA = new T.Points(sparkGeo, new T.PointsMaterial({ size: 0.34, map: spriteTex('spark'), color: 0xFFD45E, transparent: true, depthWrite: false, opacity: 0.75 }));
    const starGeo = new T.BufferGeometry(), sg = [];
    for (let i = 0; i < 180; i++) sg.push(rnd(-34, 34), rnd(-20, 20), rnd(-24, -10));
    starGeo.setAttribute('position', new T.Float32BufferAttribute(sg, 3));
    const stars = new T.Points(starGeo, new T.PointsMaterial({ size: 0.22, map: spriteTex('dot'), color: 0xFFF2F8, transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
    scene.add(sparkA, stars);

    let px = 0, py = 0;
    G.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { px = e.clientX / G.innerWidth * 2 - 1; py = e.clientY / G.innerHeight * 2 - 1; } }, { passive: true });
    const tmpV = new T.Vector3();
    v.update = (dt, t) => {
      cam.position.x += (px * 0.9 - cam.position.x) * Math.min(1, dt * 2);
      cam.position.y += (-py * 0.55 - cam.position.y) * Math.min(1, dt * 2);
      cam.lookAt(0, 0, -6);
      objs.forEach(o => {
        const u = o.userData;
        if (u.k === 'heart') {
          o.rotation.y += u.spin * dt;
          o.rotation.z = Math.sin(t * 0.7 + u.ph) * 0.16;
          o.position.y += u.rise * dt;
          o.position.x = u.x0 + Math.sin(t * u.sw + u.ph) * u.amp;
          if (o.position.y > halfH(u.z) + 1.4) { u.x0 = heartX(u.z); o.position.y = -halfH(u.z) - 1.2; }
        } else if (u.k === 'cloud') {
          o.position.x += u.vx * dt;
          o.position.y += Math.sin(t * 0.3 + u.ph) * 0.02 * dt;
          const w = halfW(u.z) + 3.5;
          if (o.position.x > w) o.position.x = -w;
          if (o.position.x < -w) o.position.x = w;
        } else if (u.k === 'balloon') {
          o.position.y += u.rise * dt;
          o.rotation.z = Math.sin(t * 0.6 + u.ph) * 0.06;
          u.env.rotation.y += 0.12 * dt;
          if (o.position.y > halfH(u.z) + 2.4) { o.position.y = -halfH(u.z) - 2.4; o.position.x = side() * rnd(0.45, 0.95) * halfW(u.z); }
        } else if (u.k === 'plane') {
          if (u.wait > 0) { u.wait -= dt; o.visible = false; u.tr.pts.visible = false; if (u.wait <= 0) { o.position.set(-u.dir * (halfW(u.z) + 2), rnd(-0.5, 0.6) * halfH(u.z), u.z); u.y0 = o.position.y; u.tr.buf.length = 0; } return; }
          o.visible = true; u.tr.pts.visible = true;
          u.prev.copy(o.position);
          o.position.x += u.dir * u.sp * dt;
          o.position.y = u.y0 + Math.sin(o.position.x * 0.45 + u.ph) * 0.9;
          tmpV.copy(o.position).multiplyScalar(2).sub(u.prev);
          o.lookAt(tmpV);
          o.rotateZ(-u.dir * (o.position.y - u.prev.y) / Math.max(0.001, dt) * 0.25);
          pushTrail(u.tr, o.position, fadeCol, dt, 0.09);
          if (Math.abs(o.position.x) > halfW(u.z) + 3) u.wait = rnd(5, 10);
        }
      });
      sparkA.material.opacity = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.4));
      stars.material.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.9));
    };
    v.theme = dark => {
      hemi.color.setHex(dark ? 0x9A86E8 : 0xFFF5FA);
      hemi.groundColor.setHex(dark ? 0x22163A : 0xD9C9FF);
      hemi.intensity = dark ? 0.75 : 0.95;
      sun.color.setHex(dark ? 0xFFD6E8 : 0xFFFFFF);
      sun.intensity = dark ? 0.5 : 0.7;
      scene.fog.color.setHex(dark ? 0x1C1230 : 0xFCE6F0);
      fadeCol.setHex(dark ? 0x1C1230 : 0xFCE6F0);
      hMats.forEach(m => { m.emissiveIntensity = dark ? 0.42 : 0.12; });
      cMat.color.setHex(dark ? 0x6E5A9E : 0xFFFFFF);
      cMat.emissive.setHex(dark ? 0x2A1E44 : 0xFFE6F0);
      cMat.opacity = dark ? 0.55 : 0.96;
      pMat.emissiveIntensity = dark ? 0.5 : 0.3;
      sparkA.visible = !dark;
      stars.visible = dark;
    };
    v.theme(isDark());
    return v;
  }

  // ---------- globe mini (tengah papan, ponsel) ----------
  const CONT = [[18, 15, 0.62], [-12, 25, 0.42], [45, 95, 0.55], [30, 130, 0.34], [-25, 135, 0.36], [12, -75, 0.4], [48, -105, 0.5], [-22, -60, 0.38]].map(([la, lo, r]) => {
    const a = la * Math.PI / 180, b = lo * Math.PI / 180;
    return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b), r];
  });
  function globeGeo() {
    const g = new T.IcosahedronGeometry(1, 3);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), v = new T.Vector3(), c = new T.Color();
    const OCEAN = [0x52B6F2, 0x66C3F7, 0x5ABCF4], LAND = [0x6FD18D, 0x5DC57F, 0x7ED996], SAND = 0xFFD98C, SNOW = 0xFFFFFF;
    for (let i = 0; i < p.count; i += 3) {
      v.set((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3).normalize();
      let land = -9;
      CONT.forEach(([x, y, z, r]) => { land = Math.max(land, r - Math.acos(Math.max(-1, Math.min(1, v.x * x + v.y * y + v.z * z)))); });
      land += 0.07 * Math.sin(9 * v.x + 3) * Math.cos(7 * v.z - 1);
      const k = (i / 3) % 3;
      c.setHex(Math.abs(v.y) > 0.9 ? SNOW : land > 0.04 ? LAND[k] : land > -0.02 ? SAND : OCEAN[k]);
      for (let q = 0; q < 3; q++) { col[(i + q) * 3] = c.r; col[(i + q) * 3 + 1] = c.g; col[(i + q) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    return g;
  }
  function buildGlobe() {
    const wrap = document.createElement('div');
    wrap.className = 'globe-3d';
    wrap.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    let v;
    try { v = makeView(canvas, { prCap: 2 }); } catch (e) { return null; }
    geos();
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(34, 1, 0.1, 50);
    cam.position.set(0, 0.6, 6.1);
    cam.lookAt(0, 0, 0);
    const hemi = new T.HemisphereLight(0xFFFFFF, 0xB9A6F5, 0.8), sun = new T.DirectionalLight(0xFFFFFF, 0.9);
    sun.position.set(-3, 4, 5);
    scene.add(hemi, sun);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: spriteTex('halo'), color: 0xFFB3CF, transparent: true, depthWrite: false, opacity: 0.85 }));
    halo.scale.setScalar(3.3);
    halo.renderOrder = -1;
    scene.add(halo);
    const gMat = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, emissive: 0x000000 });
    const earth = new T.Mesh(globeGeo(), gMat);
    earth.rotation.z = 0.32;
    scene.add(earth);
    // awan mini mengitari
    const cMat = new T.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.9, flatShading: true, emissive: 0xFFEFF5, emissiveIntensity: 0.35 });
    const ringC = new T.Group();
    ringC.rotation.set(-0.2, 0, 0.15);
    for (let k = 0; k < 3; k++) {
      const c = cloud(cMat, 3, 0.9);
      c.scale.setScalar(0.13);
      const a = (k / 3) * Math.PI * 2;
      c.position.set(Math.cos(a) * 1.13, rnd(-0.25, 0.25), Math.sin(a) * 1.13);
      c.lookAt(0, c.position.y, 0);
      ringC.add(c);
    }
    scene.add(ringC);
    // pesawat kertas mengelilingi bumi + jejak hati
    const orbit = new T.Group();
    orbit.rotation.set(0.42, 0, -0.28);
    const pivot = new T.Group();
    orbit.add(pivot);
    const plane = new T.Mesh(GEO.plane, new T.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6, flatShading: true, side: T.DoubleSide, emissive: 0xFFF0F6, emissiveIntensity: 0.25 }));
    plane.scale.setScalar(0.24);
    plane.position.set(1.36, 0, 0);
    plane.rotation.set(0, Math.PI, 0.4);
    pivot.add(plane);
    scene.add(orbit);
    const tr = trail(0xFF4F8B, 18);
    tr.pts.material.size = 0.3;
    scene.add(tr.pts);
    // hati kecil di orbit lain
    const hearts = [];
    [[1.52, 0.0, -0.5, 0.4, 0xFF4F8B], [1.52, Math.PI, -0.5, 0.4, 0xB79CFF], [1.66, 1.4, 0.25, 0.62, 0xFFC93C]].forEach(([r, a0, tx, tz, c]) => {
      const o = new T.Group();
      o.rotation.set(tx, 0, tz);
      const h = new T.Mesh(GEO.heart, new T.MeshStandardMaterial({ color: c, roughness: 0.3, emissive: c, emissiveIntensity: 0.15 }));
      h.scale.setScalar(0.15);
      h.position.set(Math.cos(a0) * r, 0, Math.sin(a0) * r);
      o.add(h);
      scene.add(o);
      hearts.push({ o, h, sp: rnd(0.25, 0.4) });
    });
    const fade = new T.Color(0xFFE9F2), wp = new T.Vector3();
    v.scene = scene; v.cam = cam; v.wrap = wrap;
    // papan 3D: wadah lebih tinggi dari lebarnya (lihat CSS) -> gambar sengaja memanjang, kamera tetap rasio 1
    v.resize = () => { const w = wrap.clientWidth || 1, h = wrap.clientHeight || w; v.prCap = Math.max(0.5, Math.min(2, 512 / Math.max(w, h))); return sizeView(v, w, h); };
    v.update = (dt, t) => {
      earth.rotation.y += 0.22 * dt;
      ringC.rotation.y += 0.09 * dt;
      pivot.rotation.y += 0.55 * dt;
      hearts.forEach(x => { x.o.rotation.y += x.sp * dt; x.h.rotation.y += 1.2 * dt; });
      halo.material.opacity = 0.75 + 0.12 * Math.sin(t * 1.1);
      plane.getWorldPosition(wp);
      pushTrail(tr, wp, fade, dt, 0.07);
    };
    v.theme = dark => {
      hemi.intensity = dark ? 0.72 : 0.8;
      hemi.groundColor.setHex(dark ? 0x3A2C5C : 0xB9A6F5);
      sun.intensity = dark ? 0.75 : 0.9;
      halo.material.color.setHex(dark ? 0x8C75FF : 0xFFB3CF);
      gMat.emissive.setHex(dark ? 0x1A1033 : 0x000000);
      fade.setHex(dark ? 0x2B1E47 : 0xFFE9F2);
    };
    v.theme(isDark());
    // tetap jalan beberapa langkah supaya jejak terisi sebelum frame diam pertama
    for (let k = 0; k < 24; k++) v.update(0.07, k * 0.07);
    return v;
  }

  // ---------- pengendali ----------
  function centerDeco() {
    if (!document.body.classList.contains('in-game')) return null;
    const g = document.getElementById('game');
    // tengah papan kosong saat panel aksi ada di HUD: ponsel, atau semua tata letak saat kamera 3D
    if (!g || !(g.classList.contains('v3d') || g.classList.contains('layout-compact') || g.classList.contains('layout-land'))) return null;
    return document.querySelector('#board .center .center-deco');
  }
  function tick() {
    if (!ST.enabled || broken || !T) return;
    const covered = !!document.querySelector('#modalRoot:not([hidden]), #winOv, #guideOv, #pauseOv, #tourOv');
    const deco = centerDeco();
    const motion = !document.hidden && !isReduce() && !covered;
    if (sky && !sky.dead) {
      const resized = sky.resize();
      // di ponsel (papan datar) latar luar nyaris tertutup papan: cukup gambar diam;
      // kamera 3D memperlihatkan langit di balik papan yang miring -> tetap bergerak
      const g = document.getElementById('game'), v3 = !!(g && g.classList.contains('v3d'));
      runView(sky, motion && (!deco || v3));
      if (!sky.running && (resized || !sky.frames)) stillFrame(sky);
    }
    if (deco) {
      if (!globe) globe = buildGlobe();
      if (globe && !globe.dead) {
        let fresh = false;
        if (globe.wrap.parentNode !== deco) { deco.appendChild(globe.wrap); globe.w = 0; fresh = true; }
        const c = deco.parentNode;
        if (c && !c.classList.contains('globe-on')) c.classList.add('globe-on');
        if (globe.resize()) fresh = true;
        runView(globe, motion);
        if (!globe.running && (fresh || !globe.frames)) stillFrame(globe);
        globe.wrap.classList.add('on');
      }
    } else if (globe) {
      runView(globe, false);
      const c = globe.wrap.parentNode && globe.wrap.parentNode.parentNode;
      if (c && c.classList) c.classList.remove('globe-on');
      if (globe.wrap.parentNode) globe.wrap.parentNode.removeChild(globe.wrap);
      globe.wrap.classList.remove('on');
    }
  }
  function applyTheme() {
    const d = isDark();
    [sky, globe].forEach(v => { if (v && !v.dead) { v.theme(d); if (!v.running) stillFrame(v); } });
  }
  let wired = false;
  function ensureSky() {
    if (sky || broken || !T || !ST.enabled) return;
    try { sky = buildSky(); } catch (e) { sky = null; }
    if (!sky) { broken = true; return; }
    stillFrame(sky);
    requestAnimationFrame(() => sky.canvas.classList.add('on'));
    if (wired) return;
    wired = true;
    poll = setInterval(tick, 450);
    document.addEventListener('visibilitychange', tick);
    G.addEventListener('resize', () => { if (sky && sky.resize() && !sky.running) stillFrame(sky); tick(); });
    try { new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* opsional */ }
    if (mqDark && mqDark.addEventListener) mqDark.addEventListener('change', applyTheme);
    if (mqReduce && mqReduce.addEventListener) mqReduce.addEventListener('change', tick);
  }
  function start() {
    if (started || broken || !ST.enabled) return;
    started = true;
    loadThree().then(three => { T = three; ensureSky(); tick(); }).catch(() => { broken = true; });
  }
  // dimuat saat peramban senggang supaya tidak mengganggu tampilan pertama
  const whenIdle = f => (G.requestIdleCallback ? G.requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 300));
  function setEnabled(on) {
    ST.enabled = !!on;
    document.documentElement.classList.toggle('no-bg3d', !ST.enabled);
    if (!ST.enabled) {
      [sky, globe].forEach(v => { if (v) runView(v, false); });
      if (globe && globe.wrap.parentNode) { const c = globe.wrap.parentNode.parentNode; if (c && c.classList) c.classList.remove('globe-on'); globe.wrap.parentNode.removeChild(globe.wrap); globe.wrap.classList.remove('on'); }
      return;
    }
    if (!started) setTimeout(() => whenIdle(start), 600);
    else { ensureSky(); tick(); }
  }
  function status() {
    return { loaded: !!T, broken, enabled: ST.enabled, soft: !!softGL, sky: sky ? { running: sky.running, frames: sky.frames, fps: sky.fps, pr: sky.pr, dead: sky.dead } : null, globe: globe ? { running: globe.running, frames: globe.frames, fps: globe.fps, mounted: !!globe.wrap.parentNode, dead: globe.dead } : null };
  }
  G.LoveBG = { setEnabled, status, refresh: tick };
})(typeof window !== 'undefined' ? window : globalThis);
