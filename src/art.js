/* LOVEOPOLY 2.0 — ilustrasi orisinal (SVG): destinasi, wisata, petak spesial, bangunan, dan maskot Merpi */
(function (G) {
  'use strict';
  const K = '#3A2B4A';
  const S = ' stroke="' + K + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
  const S1 = ' stroke="' + K + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
  const P = (d, f, x) => '<path d="' + d + '" fill="' + (f || 'none') + '"' + S + (x || '') + '/>';
  const p1 = (d, f, x) => '<path d="' + d + '" fill="' + (f || 'none') + '"' + S1 + (x || '') + '/>';
  const pn = (d, f, x) => '<path d="' + d + '" fill="' + f + '"' + (x || '') + '/>';
  const C = (cx, cy, r, f, x) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + f + '"' + S + (x || '') + '/>';
  const c1 = (cx, cy, r, f, x) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + f + '"' + S1 + (x || '') + '/>';
  const cn = (cx, cy, r, f, x) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + f + '"' + (x || '') + '/>';
  const R = (x, y, w, h, rx, f, xx) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) + '" fill="' + f + '"' + S + (xx || '') + '/>';
  const r1 = (x, y, w, h, rx, f, xx) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) + '" fill="' + f + '"' + S1 + (xx || '') + '/>';
  const rn = (x, y, w, h, rx, f, xx) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) + '" fill="' + f + '"' + (xx || '') + '/>';
  const El = (cx, cy, rx, ry, f, x) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + f + '"' + S + (x || '') + '/>';
  const en = (cx, cy, rx, ry, f, x) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + f + '"' + (x || '') + '/>';
  const shadow = (cx, cy, rx) => en(cx, cy, rx, 2.6, K, ' opacity=".14"');
  const f2 = n => Math.round(n * 100) / 100;
  // hati dengan pusat (cx, cy) dan lebar w
  function heartD(cx, cy, w) {
    const X = u => f2(cx + (u - 0.5) * w), Y = v => f2(cy + (v - 0.55) * w), r = f2(0.25 * w);
    return 'M' + X(0.5) + ' ' + Y(0.95) + 'C' + X(0.15) + ' ' + Y(0.7) + ' ' + X(0) + ' ' + Y(0.48) + ' ' + X(0) + ' ' + Y(0.3) +
      'A' + r + ' ' + r + ' 0 0 1 ' + X(0.5) + ' ' + Y(0.18) + 'A' + r + ' ' + r + ' 0 0 1 ' + X(1) + ' ' + Y(0.3) +
      'C' + X(1) + ' ' + Y(0.48) + ' ' + X(0.85) + ' ' + Y(0.7) + ' ' + X(0.5) + ' ' + Y(0.95) + 'Z';
  }
  const heart = (x, y, s, f) => P(heartD(x, y - 0.1 * s, 2.8 * s), f);
  const heartN = (x, y, s, f, xx) => pn(heartD(x, y - 0.1 * s, 2.8 * s), f, xx);
  const sparkle = (x, y, s, f) => {
    const q = 0.26 * s;
    const pts = [[x, y - s], [x + q, y - q], [x + s, y], [x + q, y + q], [x, y + s], [x - q, y + q], [x - s, y], [x - q, y - q]];
    return pn('M' + pts.map(pt => f2(pt[0]) + ' ' + f2(pt[1])).join('L') + 'Z', f || '#FFD93D');
  };
  const wave = (y, f, f2) => P('M2 ' + y + 'q5-4 10 0t10 0 10 0 10 0 10 0 10 0 10 0V62H2z', f) + (f2 ? p1('M8 ' + (y + 7) + 'q3-2.4 6 0M30 ' + (y + 9) + 'q3-2.4 6 0M48 ' + (y + 6) + 'q3-2.4 6 0', 'none', ' stroke="' + f2 + '"') : '');
  const leaf = (d, f) => P(d, f || '#43C463');

  const COL = {
    red: '#FF5A5F', rose: '#FF4F8B', pink: '#FF9EC4', peach: '#FFB38A', orange: '#FF9F43', yellow: '#FFD93D', gold: '#FFC93C',
    green: '#6BD46B', leaf: '#43C463', teal: '#3DDBD9', sea: '#4CC9F0', seaD: '#2BA8DE', sky: '#BDE7FF', blue: '#4D8DFF', navy: '#2E3A6E',
    lilac: '#B79CFF', purple: '#7B61FF', cream: '#FFF6E8', white: '#FFFFFF', sand: '#FFE3A6', wood: '#C98A4B', woodD: '#9C6233',
    stone: '#BFB3A6', stoneD: '#9A8C7E', snow: '#F5F9FF', grey: '#C9C3D6'
  };

  const A = {};
  // ----- destinasi -----
  A.kotatua = () => shadow(32, 57, 24) +
    R(10, 31, 44, 24, 2, COL.cream) + P('M6 32 32 20l26 12z', COL.red) +
    R(25, 13, 14, 20, 1.5, COL.white) + P('M23 14 32 5l9 9z', COL.red) + c1(32, 21, 3.4, COL.yellow) + p1('M32 19.4v1.8l1.2.8', 'none') +
    r1(14, 37, 6, 8, 3, COL.sky) + r1(44, 37, 6, 8, 3, COL.sky) + P('M27 55V46a5 5 0 0 1 10 0v9', COL.wood) + p1('M10 50h17M37 50h17', 'none');
  A.bandung = () => en(32, 57, 27, 4, COL.green) +
    R(6, 37, 52, 17, 2, COL.white) + P('M18 37h28l-4-6H22z', '#6E5B8F') + P('M23 31h18l-3.4-5H26.4z', '#6E5B8F') + P('M27.5 26h9L32 18z', '#6E5B8F') +
    p1('M32 18V5', 'none') + c1(32, 15.6, 1.6, COL.gold) + c1(32, 12, 1.6, COL.gold) + c1(32, 8.4, 1.6, COL.gold) +
    [11, 18, 25, 36, 43, 50].map(x => r1(x, 42, 4, 6, 2, COL.sky)).join('') + p1('M6 51h52', 'none');
  A.jogja = () => cn(47, 17, 9, '#FFD27A') + shadow(32, 57, 25) +
    R(8, 47, 48, 8, 1.5, COL.stoneD) + R(14, 40, 36, 8, 1.5, COL.stone) +
    P('M17 41c0-11 6.5-17.5 15-17.5S47 30 47 41z', COL.stone) +
    p1('M24 33l3 3-3 3-3-3zM32 30l3 3-3 3-3-3zM40 33l3 3-3 3-3-3z', COL.stoneD) +
    R(29.5, 15, 5, 9, 1, COL.stone) + R(28, 11, 8, 4.5, 1, COL.stoneD);
  A.bromo = () => cn(21, 24, 10, '#FFB86B') + cn(21, 24, 6.5, '#FFD27A') +
    P('M3 56 23 27h18l20 29z', '#B68564') + P('M23 27q9 4 18 0', '#7E5A45') + p1('M28 34l-4 9M37 34l3 8M31 40l-1 7', 'none', ' stroke="#8C6248"') +
    C(31, 19, 5, COL.white) + C(37, 13, 4, COL.white) + C(42, 8, 3, COL.white) + en(32, 58, 30, 4, COL.sand);
  A.lombok = () => wave(42, COL.sea, '#ffffff') +
    P('M5 46c4-3 12-4 18-1 1 3-3 7-18 7z', COL.sand) +
    P('M14 46c-1-9 1-18 6-26', 'none', ' stroke-width="3.2"') + leaf('M20 20c-6-4-13-3-16 1 5-1 10 0 16-1z') + leaf('M20 20c3-6 10-8 15-5-5 1-10 2-15 5z') + leaf('M20 20c6-1 12 3 13 8-5-3-9-5-13-8z') + leaf('M20 20c-3 3-6 9-5 13 2-5 3-9 5-13z') +
    P('M35 50V18M57 50V18M33 18h26', 'none', ' stroke-width="2.6"') + p1('M40 18v20M52 18v20', 'none') + R(38, 37, 16, 3.4, 1.5, COL.wood);
  A.bali = () => shadow(32, 58, 26) +
    P('M6 56V44h4v-8h4v-8h4v-8h5v-6h4v42z', '#E08A5E') + P('M58 56V44h-4v-8h-4v-8h-4v-8h-5v-6h-4v42z', '#E08A5E') +
    p1('M10 44h17M14 36h13M18 28h9M54 44H37M50 36H37M46 28h-9', 'none', ' stroke="#B6603D"') +
    P('M27 56h10v-4H27zM25 59h14', COL.stone) + c1(32, 9, 3, COL.white) + cn(32, 9, 1.2, COL.yellow) +
    [[6, -6], [0, -9], [-6, -6]].map(([dx, dy]) => '').join('') + c1(29, 8, 2.4, '#FFFFFF') + c1(35, 8, 2.4, '#FFFFFF') + c1(32, 5.5, 2.4, '#FFFFFF') + c1(32, 9, 1.8, COL.yellow);
  A.komodo = () => en(32, 57, 27, 4, COL.sand) +
    P('M16 45C10 46 5 44 3 39c4 3 8 3 13 1', '#7FBF5A') +
    P('M14 46c2-8 13-11 24-10 6 .5 9 3 10 6 1 4-2 6-7 6H18c-3 0-4-1-4-2z', '#7FBF5A') +
    P('M44 38c3-4 10-6 15-3 3 2 3 5 0 7-3 1.6-8 1.6-13 1z', '#7FBF5A') +
    p1('M20 37.6l2-2.4 2 2.2 2-2.6 2 2.4 2-2.6 2 2.4 2-2.2', 'none', ' stroke="#4E8F3A"') +
    P('M19 48l-3 6h5M27 48l1 6h4M36 48l-2 6h5M43 47l2 6h4', 'none') +
    cn(52, 36.4, 2, K) + cn(52.6, 35.8, 0.7, '#fff') + cn(58.6, 37.6, 0.8, K) +
    p1('M59 41.6h3.6l1.8-1.6M62.6 41.6l1.8 1.4', 'none', ' stroke="#FF5A5F"') +
    cn(24, 42, 1.8, '#5FA544') + cn(31, 40.6, 2, '#5FA544') + cn(37, 43, 1.6, '#5FA544') + en(49, 39.8, 2.2, 1.2, COL.pink, ' opacity=".8"');
  A.seoul = () => en(32, 57, 26, 7, COL.green) +
    P('M29.5 52 31 24h2l1.5 28z', COL.white) + R(23, 18, 18, 7, 3.5, COL.lilac) + R(27.5, 13, 9, 5, 2, COL.white) + P('M32 13V3', 'none') +
    heart(15, 44, 4, COL.rose) + heart(48, 46, 3.4, COL.red) + heart(42, 51, 2.6, COL.pink);
  A.jeju = () => shadow(30, 58, 24) +
    C(27, 39, 15, '#FFA23A') + C(27, 23, 5, '#FFA23A') + leaf('M28 19c4-6 11-6 14-3-5 2-9 3-14 3z') + leaf('M26 19c-4-5-10-5-12-2 4 1 8 2 12 2z') +
    C(47, 46, 9.5, '#FFB04F') + leaf('M47 37c2-4 7-4 9-2-3 1.5-6 2-9 2z') +
    en(21, 33, 3.4, 5, '#fff', ' opacity=".6"') + en(43, 42, 2, 3, '#fff', ' opacity=".6"');
  A.kyoto = () => en(32, 58, 26, 4, '#E9DCCB') +
    P('M17 56V22M47 56V22', 'none', ' stroke-width="6" stroke="' + K + '"') + P('M17 56V22M47 56V22', 'none', ' stroke-width="3" stroke="#E8453C"') +
    P('M7 14q25 6 50 0l-2 6q-23 4-46 0z', '#E8453C') + R(12, 24, 40, 4.4, 1, '#E8453C') + R(29, 19, 6, 6, 1, '#E8453C') +
    [[10, 36], [54, 40], [36, 46], [24, 42]].map(([x, y]) => cn(x, y, 2.6, COL.pink) + cn(x, y, 1, '#fff')).join('');
  A.roma = () => shadow(32, 57, 27) +
    P('M5 54V30c0-9 54-9 54 0v24z', '#F2C98A') + P('M5 30c0-9 54-9 54 0', 'none') + P('M44 23.6c7 1.2 12 3.6 15 6.4v-8c-3-2-8-4-15-5z', '#F2C98A') +
    [9, 18, 27, 36, 45].map(x => r1(x, 34, 6, 8, 3, '#C98F57')).join('') + [9, 18, 27, 36, 45].map(x => r1(x, 45, 6, 9, 3, '#C98F57')).join('') +
    p1('M5 43h54', 'none');
  A.praha = () => shadow(32, 57, 25) +
    R(12, 33, 40, 22, 2, '#F4E3C6') + P('M14 34 22.5 4 31 34z', '#4A4170') + P('M33 34 41.5 4 50 34z', '#4A4170') +
    cn(22.5, 4.5, 2, COL.gold) + cn(41.5, 4.5, 2, COL.gold) + cn(17, 22, 1.4, COL.gold) + cn(28, 22, 1.4, COL.gold) + cn(36, 22, 1.4, COL.gold) + cn(47, 22, 1.4, COL.gold) +
    r1(18, 40, 7, 9, 3.5, COL.sky) + r1(39, 40, 7, 9, 3.5, COL.sky) + P('M29 55v-9a3 3 0 0 1 6 0v9', COL.wood);
  A.paris = () => shadow(32, 58, 18) +
    P('M17 56 27 30h10l10 26h-7q-3-10-8-10t-8 10z', '#B9836A') + P('M27 30 30 10h4l3 20z', '#B9836A') + P('M30 10 32 2l2 8z', '#B9836A') +
    R(24, 28, 16, 3.4, 1, '#9C6B55') + R(28.5, 17, 7, 2.6, 1, '#9C6B55') + heart(51, 15, 4.4, COL.rose);
  A.venice = () => wave(44, COL.sea, '#ffffff') +
    P('M50 52V9', 'none', ' stroke-width="4"') + p1('M50 52V9', 'none', ' stroke="#ffffff" stroke-width="2.4" stroke-dasharray="4 4"') + C(50, 8, 3, COL.blue) +
    P('M4 40q22 14 50-2 4-3 6-8l-2-1q-3 6-9 8-20 7-45 3z', '#3A2B4A') + p1('M10 42q12 4 26 1', 'none', ' stroke="#FFC93C"') + P('M57 29q3-1 2-4', 'none') +
    P('M22 39V24', 'none') + p1('M18 24h8', 'none') + heart(31, 15, 3.4, COL.rose);
  A.santorini = () => wave(48, COL.sea, '#ffffff') + cn(52, 14, 6, '#FFD27A') +
    R(10, 31, 28, 20, 1.5, COL.white) + P('M13 31a11 11 0 0 1 22 0z', '#2F6FED') + p1('M24 20v-6M21.6 16h4.8', 'none') +
    R(38, 37, 16, 14, 1.5, COL.white) + r1(43, 42, 6, 9, 3, '#2F6FED') + r1(15, 37, 5, 6, 2.5, '#2F6FED') + r1(28, 37, 5, 6, 2.5, '#2F6FED');
  A.swiss = () => P('M3 56 30 9l27 47z', '#8FA6CC') + P('M21 25 30 9l9 16-4-2-3 4-3-4-3 3z', COL.snow) + p1('M30 9l-6 27M30 9l9 23', 'none', ' stroke="#7389B3"') +
    P('M10 56 16 40l6 16z', '#43B061') + R(36, 44, 18, 12, 1.5, COL.wood) + P('M33 45 45 35l12 10z', '#E8453C') + r1(42, 48, 6, 5, 1, COL.sky) + en(32, 58, 29, 3, COL.snow);
  A.aurora = () => rn(2, 2, 60, 60, 12, '#2B2D5E') +
    pn('M2 30q15-16 30-6t30-10v10q-15 12-30 4T2 38z', '#5CE1A6', ' opacity=".85"') + pn('M2 22q15-12 30-4t30-8v6q-15 10-30 4T2 28z', '#3DDBD9', ' opacity=".7"') +
    sparkle(12, 10, 2.6) + sparkle(48, 8, 2) + sparkle(30, 6, 1.6) +
    P('M2 56 18 36l10 12 10-16 24 24z', '#4B4D85') + P('M34 38l4-6 4 6z', COL.snow) + R(40, 47, 10, 8, 1, '#8A5B3B') + P('M38 48l7-6 7 6z', '#5C3B2B') + rn(43, 50, 3, 3, 0.5, COL.yellow);
  A.maldives = () => cn(50, 13, 7, '#FFD27A') + wave(42, COL.teal, '#ffffff') +
    P('M16 30h30v12H16z', COL.cream) + P('M12 31 31 17l19 14z', '#D9A066') + p1('M16 25h30', 'none', ' stroke="#B07A45"') +
    P('M20 42v10M28 42v10M36 42v10M44 42v10', 'none') + r1(28, 34, 6, 8, 1, COL.wood) + P('M2 44h14', 'none', ' stroke-width="3"');
  A.hawaii = () => wave(48, COL.sea, '#ffffff') +
    P('M42 6c7 4 9 20 4 40-2 8-6 8-8 0-4-18-2-36 4-40z', COL.orange) + p1('M42 8c-4 9-5 22-2 38', 'none', ' stroke="#ffffff" stroke-width="2.6"') + p1('M44 8c-3 9-3 22 0 38', 'none', ' stroke="#FF5A5F"') +
    [0, 72, 144, 216, 288].map(a => '<ellipse cx="18" cy="26" rx="5.4" ry="8.6" transform="rotate(' + a + ' 18 33)" fill="' + COL.rose + '"' + S + '/>').join('') + c1(18, 33, 3, COL.yellow) + p1('M18 33l6-7', 'none') + cn(24, 26, 1.4, COL.yellow);

  // ----- tempat wisata -----
  A.ferris = () => shadow(32, 58, 18) + P('M21 57 32 30 43 57', 'none', ' stroke-width="3"') +
    '<g class="spin">' + C(32, 30, 20, 'none', ' stroke-width="2.6"') + C(32, 30, 3, COL.purple) +
    [0, 45, 90, 135].map(a => '<line x1="12" y1="30" x2="52" y2="30" transform="rotate(' + a + ' 32 30)"' + S1 + '/>').join('') + '</g>' +
    [[32, 10, COL.rose], [46, 16, COL.yellow], [52, 30, COL.teal], [46, 44, COL.lilac], [32, 50, COL.orange], [18, 44, COL.sea], [12, 30, COL.green], [18, 16, COL.pink]].map(([x, y, f]) => C(x, y + 2.6, 3.6, f)).join('');
  A.garden = () => en(32, 52, 30, 9, '#7BCF5D') + p1('M4 46q28-8 56 0', 'none', ' stroke="#5DB548"') +
    [[11, 38, COL.red], [22, 34, COL.yellow], [33, 31, COL.rose], [44, 34, COL.lilac], [54, 38, COL.orange], [17, 46, COL.pink], [39, 45, COL.red], [28, 45, COL.lilac]].map(([x, y, f]) =>
      p1('M' + x + ' ' + (y + 4) + 'v9', 'none', ' stroke="#3A8F3E"') + P('M' + (x - 3.6) + ' ' + (y - 3) + 'l1.8 2 1.8-3 1.8 3 1.8-2v4.6a3.6 3.6 0 0 1-7.2 0z', f)).join('') +
    heart(32, 9, 4.6, COL.rose);
  A.cablecar = () => P('M2 56 20 30l12 14 10-18 20 30z', '#79C77A') + P('M18 33l2-3 3 3.6zM40 29l2-3 2.8 3.4z', COL.snow) +
    p1('M2 10 62 24', 'none', ' stroke-width="2"') + P('M33 17v7', 'none') + R(24, 24, 18, 15, 4, COL.red) + r1(27, 27, 5, 6, 1.5, COL.sky) + r1(34, 27, 5, 6, 1.5, COL.sky) + rn(24, 35, 18, 2.4, 0, '#C9363B');
  A.balloon = () => en(14, 52, 10, 4, '#ffffff', ' opacity=".9"') + en(52, 46, 8, 3.4, '#ffffff', ' opacity=".9"') +
    P('M32 4c11 0 18 8 18 18 0 9-8 15-12 21h-12c-4-6-12-12-12-21 0-10 7-18 18-18z', COL.red) +
    pn('M32 4c-5 4-7 11-7 18 0 8 3 15 1 21h12c-2-6 1-13 1-21 0-7-2-14-7-18z', COL.yellow) + P('M32 4c11 0 18 8 18 18 0 9-8 15-12 21h-12c-4-6-12-12-12-21 0-10 7-18 18-18z', 'none') +
    p1('M32 4c-5 4-7 11-7 18 0 8 3 15 1 21M32 4c5 4 7 11 7 18 0 8-3 15-1 21', 'none') +
    p1('M26 43l1 6M38 43l-1 6', 'none') + R(26, 49, 12, 8, 2, COL.wood);
  A.cruise = () => wave(46, COL.sea, '#ffffff') +
    P('M6 38h52l-6 12H12z', COL.navy) + R(12, 28, 40, 10, 1.5, COL.white) + R(18, 20, 28, 8, 1.5, COL.white) +
    R(24, 10, 6, 10, 1, COL.red) + R(34, 10, 6, 10, 1, COL.red) + rn(24, 10, 6, 3, 0, K) + rn(34, 10, 6, 3, 0, K) +
    [16, 22, 28, 34, 40, 46].map(x => c1(x + 1, 33, 1.6, COL.sky)).join('') + p1('M20 24h24', 'none', ' stroke-dasharray="2 3"') + heart(57, 22, 2.8, COL.rose);

  // ----- petak spesial -----
  A.start = () => '<path d="M54 44H20" fill="none" stroke="' + K + '" stroke-width="10" stroke-linecap="round"/><path d="M54 44H20" fill="none" stroke="#FF4F8B" stroke-width="6" stroke-linecap="round"/>' +
    P('M24 32 8 44l16 12z', '#FF4F8B') + heart(44, 12, 7, COL.rose) + sparkle(14, 18, 4) + sparkle(56, 28, 3);
  A.island = () => en(32, 52, 30, 10, COL.sea) + P('M10 50c4-8 14-12 24-11s16 6 18 11c-8 3-34 4-42 0z', COL.sand) +
    P('M30 46c0-12 2-22 8-30', 'none', ' stroke-width="3.4"') + leaf('M38 16c-7-4-15-2-18 3 6-1 12-1 18-3z') + leaf('M38 16c3-7 11-9 16-6-6 1-11 3-16 6z') + leaf('M38 16c7-1 13 3 14 9-5-3-9-6-14-9z') + leaf('M38 16c-3 4-6 10-4 14 1-5 2-9 4-14z') +
    '<g transform="rotate(-24 50 50)">' + R(46, 46, 9, 5, 2, '#A5E4D8') + R(54, 47.5, 3, 2, 0.6, COL.wood) + rn(48, 47.4, 4, 2.2, 0.6, '#ffffff') + '</g>' + heartN(14, 38, 2.4, COL.rose);
  A.festival = () => p1('M2 12q15 8 30 2t30 2', 'none') + [[6, 13, COL.rose], [15, 16, COL.yellow], [24, 16, COL.teal], [33, 14, COL.purple], [42, 14, COL.orange], [51, 15, COL.rose], [59, 15, COL.yellow]].map(([x, y, f]) => p1('M' + (x - 3) + ' ' + y + 'l3 6 3-6', f)).join('') +
    [0, 45, 90, 135, 180, 225, 270, 315].map(a => '<line x1="20" y1="30" x2="20" y2="24" transform="rotate(' + a + ' 20 34)" stroke="#FFC93C" stroke-width="2.4" stroke-linecap="round"/>').join('') +
    [0, 60, 120, 180, 240, 300].map(a => '<line x1="46" y1="27" x2="46" y2="22" transform="rotate(' + a + ' 46 30)" stroke="#FF4F8B" stroke-width="2.4" stroke-linecap="round"/>').join('') +
    p1('M31 42q-3 6 1 12q2 4-1 8', 'none') + heart(31, 34, 8, COL.rose) + cn(20, 34, 2, COL.yellow) + cn(46, 30, 2, COL.pink);
  A.plane = () => C(30, 36, 20, COL.sea) + P('M16 26c5 0 8 3 7 7s-6 4-8 8c-2-3-3-6-3-9 0-3 1-5 4-6zM34 20c5-1 10 2 11 6-3 0-6 2-8 0s-5-3-3-6zM36 42c4-1 9 2 8 6-2 3-6 5-9 4 1-3 0-7 1-10z', '#6BD46B') +
    '<g transform="rotate(-18 42 16)">' + P('M26 16c0-2 2-3 4-3h18c4 0 8 1.5 8 3s-4 3-8 3H30c-2 0-4-1-4-3z', COL.white) + P('M38 13l-6-8h4l8 8zM38 19l-6 8h4l8-8zM28 13l-3-5h2.6l3.4 5z', COL.rose) + '</g>' +
    p1('M6 22q4-6 12-8', 'none', ' stroke-dasharray="2 3"');
  A.card = () => '<g transform="rotate(8 34 34)">' + R(14, 16, 38, 28, 3, '#E7DBFF') + '</g>' + R(8, 20, 42, 30, 3, COL.cream) + P('M8 21l21 16 21-16', 'none') + C(29, 37, 6.6, COL.red) + heartN(29, 35.2, 2.6, '#ffffff') + sparkle(53, 12, 5) + sparkle(8, 12, 3, '#FF9EC4');
  A.tax = () => shadow(32, 58, 20) + El(30, 38, 20, 15, COL.pink) + P('M38 25l4-6 2 7', COL.pink) + C(46, 38, 5, '#FFB3CF') + cn(44.6, 37.4, 1, K) + cn(47.4, 37.4, 1, K) +
    cn(36, 32, 1.6, K) + p1('M24 26h8', 'none', ' stroke-width="2.4"') + R(16, 50, 5, 6, 1.5, COL.pink) + R(34, 50, 5, 6, 1.5, COL.pink) + p1('M10 38c-3 0-4 3-2 5', 'none') +
    C(28, 11, 7, COL.gold) + p1('M28 8v6M26 10h4', 'none');

  // ----- bangunan (warna atap = warna pemilik, lewat --oc) -----
  const OC = 'var(--oc,#FF4F8B)';
  A.b1 = () => shadow(32, 58, 18) + R(17, 34, 30, 22, 2, COL.cream) + P('M12 36 32 18l20 18z', OC) + r1(22, 40, 7, 7, 1.5, COL.sky) + P('M35 56V45h7v11', COL.wood) + R(40, 19, 5, 9, 1, '#E0D2C2');
  A.b2 = () => shadow(32, 58, 20) + R(14, 22, 36, 34, 2, COL.white) + rn(14, 22, 36, 7, 2, OC) + R(14, 22, 36, 34, 2, 'none') +
    [19, 28, 37].map(x => r1(x, 33, 6, 6, 1, COL.sky) + r1(x, 43, 6, 6, 1, COL.sky)).join('') + P('M28 56v-5h8v5', COL.wood);
  A.b3 = () => shadow(32, 59, 18) + R(18, 12, 28, 45, 2.5, COL.white) + rn(18, 12, 28, 9, 2.5, OC) + R(18, 12, 28, 45, 2.5, 'none') +
    C(32, 16.5, 3.6, COL.gold) + '<text x="32" y="19.2" text-anchor="middle" font-family="Fredoka,Nunito,system-ui,sans-serif" font-weight="700" font-size="6" fill="' + K + '">H</text>' +
    [23, 30, 37].map(x => [26, 33, 40].map(y => r1(x, y, 4, 4, 1, COL.sky)).join('')).join('') + P('M28 57v-6h8v6', COL.wood) + heart(32, 3.4, 3, COL.rose);
  A.b4 = () => '<g class="lm-glow">' + cn(32, 30, 27, '#FFE58A', ' opacity=".45"') + '</g>' + shadow(32, 59, 24) +
    R(10, 34, 44, 23, 2.5, COL.gold) + R(16, 24, 32, 12, 2, '#FFD966') + P('M22 24c0-9 4.5-14 10-14s10 5 10 14z', COL.gold) +
    p1('M32 10V3', 'none') + P('M32 3h9l-3 2.6 3 2.6h-9z', OC) + heart(32, 14.6, 3.6, COL.rose) +
    [15, 26, 34, 45].map(x => r1(x, 42, 5, 9, 2.5, '#FFF3C4')).join('') + sparkle(8, 20, 4, '#FFFFFF') + sparkle(56, 16, 3.4, '#FFFFFF');

  // ----- robot lawan (AI) -----
  A.bot = () => shadow(32, 58, 18) + P('M32 14V7', 'none') + heart(32, 6, 3.2, COL.rose) + R(13, 14, 38, 30, 11, COL.lilac) + R(18, 20, 28, 18, 7, '#F6F1FF') +
    en(26, 29, 3, 3.8, K) + en(38, 29, 3, 3.8, K) + cn(27, 27.6, 1.1, '#fff') + cn(39, 27.6, 1.1, '#fff') + en(21.5, 34, 2.6, 1.6, COL.pink, ' opacity=".8"') + en(42.5, 34, 2.6, 1.6, COL.pink, ' opacity=".8"') +
    P('M29 34q3 2.4 6 0', 'none') + R(9, 24, 5, 10, 2.5, COL.purple) + R(50, 24, 5, 10, 2.5, COL.purple) + R(20, 44, 24, 12, 5, COL.lilac) + c1(32, 50, 3, COL.yellow);

  // ----- bendera pemilik -----
  A.flag = () => P('M18 58V8', 'none', ' stroke-width="3"') + P('M19 9h26l-6 8 6 8H19z', OC) + heartN(28, 13.4, 2.4, '#ffffff');

  function art(name, cls, title) {
    const f = A[name];
    if (!f) return '';
    return '<svg class="art' + (cls ? ' ' + cls : '') + '" viewBox="0 0 64 64"' + (title ? ' role="img" aria-label="' + title + '"' : ' aria-hidden="true"') + '>' + f() + '</svg>';
  }

  // ----- maskot: Merpi, merpati pos pembawa surat cinta -----
  // ekspresi lewat kelas pada <svg>: is-happy, is-sad, is-wow, is-love, is-think, is-sleep
  function merpi(cls) {
    const body = '#F6F1FF', shade = '#E4D9FF', wing = '#E9E0FF';
    return '<svg class="merpi' + (cls ? ' ' + cls : '') + '" viewBox="0 0 120 120" aria-hidden="true">' +
      '<ellipse class="mp-shadow" cx="60" cy="113" rx="26" ry="4.5" fill="' + K + '" opacity=".14"/>' +
      '<g class="mp-bob">' +
      '<g class="mp-feet">' + P('M50 104l-3 6M50 104l0 7M50 104l3 6', 'none', ' stroke="#FF9F43" stroke-width="3"') + P('M70 104l-3 6M70 104l0 7M70 104l3 6', 'none', ' stroke="#FF9F43" stroke-width="3"') + '</g>' +
      '<g class="mp-tail">' + P('M26 86c-10 2-16 8-17 14 7 0 14-3 20-8z', shade) + '</g>' +
      '<g class="mp-wing-l">' + P('M27 72c-11 2-17 12-14 22 8 1 16-5 19-14z', wing) + '</g>' +
      '<g class="mp-wing-r">' + P('M93 72c11 2 17 12 14 22-8 1-16-5-19-14z', wing) + '</g>' +
      P('M60 30c22 0 37 16 37 38 0 23-16 38-37 38S23 91 23 68c0-22 15-38 37-38z', body) +
      pn('M33 79c4 9 14 15 27 15s23-6 27-15c-6 4-16 6-27 6s-21-2-27-6z', shade) +
      // syal
      P('M35 80q25 12 50 0l1 6q-26 13-52 0z', '#5ED6C0') + P('M41 86l-6 11 8-2 2 7 4-13z', '#5ED6C0') + c1(43, 86, 3.4, '#45C2AC') +
      // topi pos
      P('M34 44c3-14 14-21 26-21s23 7 26 21c-8-4-17-6-26-6s-18 2-26 6z', '#FF4F8B') + P('M30 46c9-5 19-7 30-7s21 2 30 7c-2 3-5 4-8 3-7-3-14-4-22-4s-15 1-22 4c-3 1-6 0-8-3z', '#E2356F') +
      C(60, 30, 6.4, '#ffffff') + heartN(60, 28.6, 2.6, '#FF4F8B') +
      // mata
      '<g class="mp-eyes mp-eyes-open">' + en(46, 61, 5.4, 7, K) + en(74, 61, 5.4, 7, K) + cn(48, 58.4, 2.2, '#fff') + cn(76, 58.4, 2.2, '#fff') + cn(44.6, 64, 1.1, '#fff') + cn(72.6, 64, 1.1, '#fff') + '</g>' +
      '<g class="mp-eyes mp-eyes-happy">' + P('M40 62q6-8 12 0M68 62q6-8 12 0', 'none', ' stroke-width="3.2"') + '</g>' +
      '<g class="mp-eyes mp-eyes-sad">' + P('M40 60q6 5 12 0M68 60q6 5 12 0', 'none', ' stroke-width="3.2"') + pn('M44 66c-2 4-2 7 0 8 2-1 2-4 0-8z', '#7CC7FF') + '</g>' +
      '<g class="mp-eyes mp-eyes-wow">' + C(46, 61, 6.6, '#fff') + C(74, 61, 6.6, '#fff') + cn(46, 61, 3, K) + cn(74, 61, 3, K) + '</g>' +
      '<g class="mp-eyes mp-eyes-love">' + heartN(46, 56.4, 5, '#FF4F8B') + heartN(74, 56.4, 5, '#FF4F8B') + '</g>' +
      '<g class="mp-eyes mp-eyes-think">' + en(46, 61, 5.4, 7, K) + en(74, 61, 5.4, 7, K) + cn(47.6, 57.4, 2.2, '#fff') + cn(75.6, 57.4, 2.2, '#fff') + P('M39 50l12-2M69 48l12 2', 'none', ' stroke-width="2.4"') + '</g>' +
      '<g class="mp-blink">' + P('M40 61h12M68 61h12', 'none', ' stroke-width="3"') + '</g>' +
      en(36, 72, 6.4, 4, '#FF9EC4', ' opacity=".85"') + en(84, 72, 6.4, 4, '#FF9EC4', ' opacity=".85"') +
      // paruh
      '<g class="mp-beak">' + P('M54 68c2-3 10-3 12 0-1 4-4 6-6 6s-5-2-6-6z', '#FFB347') + p1('M54.6 69.4q5.4 2 10.8 0', 'none') + '</g>' +
      // tas surat
      p1('M84 79q8 2 8 7', 'none', ' stroke="#B77A3F" stroke-width="3"') +
      '<g class="mp-bag">' + R(78, 84, 22, 16, 4, '#FFC93C') + P('M78 88q11 8 22 0', 'none') + heartN(89, 92, 2.6, '#FF4F8B') + '</g>' +
      '<g class="mp-sweat">' + pn('M90 46c-3 4-3 7 0 8 3-1 3-4 0-8z', '#7CC7FF') + '</g>' +
      '</g></svg>';
  }

  G.LoveArt = { art, merpi, heartPath: heartN, A };
})(typeof window !== 'undefined' ? window : globalThis);
