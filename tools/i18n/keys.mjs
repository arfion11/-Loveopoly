/* LOVEOPOLY — pengumpul kunci terjemahan (dipakai test/i18n.js & `npm run i18n:keys`).
   Bahasa sumber = Indonesia: kunci kamus adalah teks Indonesia apa adanya. Kunci dikumpulkan dari:
   1. argumen pertama t()/tr()/T()/tx()/L() (semua literal di dalamnya, termasuk cabang ternary & peta objek);
   2. literal lain di kode UI/engine/net yang tampak seperti kalimat (diteruskan ke btn, toast, banner, merpiSay, fail,
      tabel data di kode), disaring supaya id, selektor, CSS, & HTML tidak ikut;
   3. teks data permainan di D (src/engine/data.js): nama, deskripsi, kartu, tantangan, soal harian, dst. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC_DIRS = ['src/ui', 'src/net', 'src/engine/rules'];
const SKIP_FILES = new Set(['src/engine/data.js']);

function files(dir) {
  const out = [];
  for (const f of readdirSync(join(ROOT, dir))) {
    const p = join(dir, f);
    if (statSync(join(ROOT, p)).isDirectory()) out.push(...files(p));
    else if (p.endsWith('.js') && !SKIP_FILES.has(p)) out.push(p);
  }
  return out;
}

// buang komentar tanpa menggeser posisi (string tetap utuh)
function mask(src) {
  let out = '',
    i = 0;
  while (i < src.length) {
    const c = src[i],
      d = src[i + 1];
    if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2);
      const e = j < 0 ? src.length : j + 2;
      out += src.slice(i, e).replace(/[^\n]/g, ' ');
      i = e;
    } else if (c === '/' && d === '/') {
      const j = src.indexOf('\n', i);
      const e = j < 0 ? src.length : j;
      out += ' '.repeat(e - i);
      i = e;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && /[=(,:;!&|?{}[\n]\s*$/.test(out.slice(-20)) && d !== ' ') {
      // literal regex: lewati sampai garis miring penutup (tidak di dalam kelas karakter)
      let j = i + 1,
        cls = false;
      while (j < src.length && src[j] !== '\n' && (cls || src[j] !== '/')) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        j++;
      }
      out += ' '.repeat(j + 1 - i);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const LIT = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.|\$(?!\{))*)`/g;
const unesc = s => s.replace(/\\(.)/g, (m, c) => ({ n: '\n', t: '\t' })[c] || c);

// literal di argumen pertama panggilan penerjemah
const CALL = /(?<![\w$.])(t|tr|T|tx|L)\(|(?<![\w$.])t:\s*(?=['"`])/g;
function firstArgLits(m, at) {
  // dari "(" cari akhir argumen pertama: koma / tutup kurung di kedalaman 0
  let depth = 0,
    i = at;
  const lits = [];
  for (; i < m.length; i++) {
    const c = m[i];
    if (c === "'" || c === '"' || c === '`') {
      LIT.lastIndex = i;
      const mo = LIT.exec(m);
      if (!mo || mo.index !== i) break;
      const v = mo[1] ?? mo[2] ?? mo[3];
      // operan perbandingan (type === 'bluff') & kunci indeks bukan teks
      const before = m.slice(Math.max(0, i - 6), i);
      const after = m.slice(LIT.lastIndex, LIT.lastIndex + 6);
      if (!/(===|!==|==|!=)\s*$/.test(before) && !/^\s*(===|!==|==|!=)/.test(after)) lits.push(unesc(v));
      i = LIT.lastIndex - 1;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break;
      depth--;
    } else if (c === ',' && depth === 0) break;
  }
  return lits;
}

// literal yang tampak seperti teks untuk orang (bukan id/selektor/CSS/HTML)
const CODEY =
  /^(#|\.|\[|:|@|\/|data-|aria-|https?:|mailto:|image\/|application\/|text\/|loveopoly\.)|<\/?[a-z]|[\w-]="|\$\{|\b\d+(px|ms|deg|s|%)\b|\b(rgba?|var|calc|translate|scale|rotate|cubic|ease|linear|solid|inset|blur)\(|^[\w.:/-]*$/;
function looksText(v, lexicon) {
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(v)) return false;
  const s = v.trim();
  if (!s) return false;
  // potongan CSS / transform / daftar kelas
  if (/cubic-bezier|linear\(|(rotate|translate|scale)[XYZ3d]*\(|\bpx\b|deg\)|^[),]|\($|^--/.test(s)) return false;
  if (/^[a-z0-9 _-]+$/.test(s) && (/[a-z]-[a-z]|-$/.test(s) || !s.split(/[\s-]+/).some(w => lexicon.has(w)))) return false;
  if (/^[#.]/.test(s) || /-$/.test(s)) return false;
  // nama font, CSS sisipan, format kabel online (error:…), merek yang tidak diterjemahkan, pesan teknis konsol
  if (/sans-serif|system-ui|\{display:|^error:|^(Love|Lv)$|^canvas kosong$/.test(s)) return false;
  if (/^[A-Z][a-z]+$/.test(s) || /^[A-Z][a-z]+!?$/.test(s)) return lexicon.has(s.replace(/!$/, '').toLowerCase());
  if (CODEY.test(s) && !/\s/.test(s)) return false;
  if (/[\w-]="|<\/?[a-z]|\$\{|\d(px|deg|ms)\b|rgba?\(|perspective\(/.test(s)) return false;
  if (!/\s/.test(s)) {
    const w = s.toLowerCase().replace(/^\(|[!?.…~)]+$/g, '');
    return /^[a-zà-ÿ-]+$/.test(w) && w !== 'love' && lexicon.has(w);
  }
  return true;
}

function dataTexts(D) {
  const out = new Set();
  const SKIP = new Set(['id', 'art', 'icon', 'color', 'ink', 'type', 'kind', 'power', 'group', 'verify', 'md', 'av', 'en', 'ai']);
  const walk = (v, key) => {
    if (typeof v === 'string') {
      if (/[A-Za-zÀ-ÿ]{2,}/.test(v) && !/^#[0-9a-f]{3,8}$/i.test(v) && !/^[a-z0-9_-]+$/.test(v)) out.add(v);
    } else if (Array.isArray(v)) v.forEach(x => walk(x, key));
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) if (!SKIP.has(k)) walk(v[k], k);
  };
  for (const k of Object.keys(D)) {
    if (['CHARADES_EN', 'AVATARS', 'TOKEN_COLORS', 'AUTO_TYPES', 'EMOJI_CLUES', 'RULES'].includes(k)) continue;
    walk(D[k], k);
  }
  return out;
}

/** Semua kunci: { code: Map(kunci → [berkas:baris]), data: Set(kunci), all: Set } */
export async function collectKeys() {
  const { D } = await import(join(ROOT, 'src/engine/data.js'));
  const data = dataTexts(D);
  const code = new Map();
  const add = (k, where) => {
    if (!k || !/[A-Za-zÀ-ÿ]/.test(k)) return;
    if (!code.has(k)) code.set(k, []);
    code.get(k).push(where);
  };
  const srcs = SRC_DIRS.flatMap(files).map(f => ({ f, src: readFileSync(join(ROOT, f), 'utf8') }));
  // leksikon = kata dari kalimat Indonesia (untuk menilai literal satu kata seperti 'Lewati')
  const lexicon = new Set();
  const learn = s =>
    s
      .toLowerCase()
      .replace(/\{[^}]*\}/g, ' ')
      .split(/[^a-zà-ÿ]+/)
      .forEach(w => w.length > 1 && lexicon.add(w));
  data.forEach(learn);
  const pass1 = [];
  for (const { f, src } of srcs) {
    const m = mask(src);
    let mo;
    CALL.lastIndex = 0;
    while ((mo = CALL.exec(m))) {
      const line = m.slice(0, mo.index).split('\n').length;
      // { t: '…' } hanya teks (ada spasi / huruf kapital / tanda kurung), bukan nama event seperti { t: 'tour' }
      const prop = !mo[1];
      for (const v of firstArgLits(m, CALL.lastIndex)) {
        if (prop && !/\s|^[A-Z(]/.test(v)) continue;
        pass1.push(v);
        add(v, f + ':' + line);
      }
    }
  }
  pass1.filter(v => /\s/.test(v)).forEach(learn);
  for (const { f, src } of srcs) {
    const m = mask(src);
    let mo;
    LIT.lastIndex = 0;
    while ((mo = LIT.exec(m))) {
      const v = unesc(mo[1] ?? mo[2] ?? mo[3] ?? '');
      if (code.has(v) || !looksText(v, lexicon)) continue;
      const pre = m.slice(Math.max(0, mo.index - 60), mo.index);
      // argumen API browser / kunci penyimpanan / nama event analitik bukan teks
      if (
        /(querySelector(All)?|getElementById|closest|matches|addEventListener|removeEventListener|setAttribute|getAttribute|removeAttribute|classList\.\w+|matchMedia|store\.(get|set|del)|track|createElement|setProperty|supports|play|buzz|ic|SND\.play|reportError|console\.\w+|\$\$?)\(\s*$/.test(
          pre
        )
      )
        continue;
      add(v, f + ':' + m.slice(0, mo.index).split('\n').length);
    }
  }
  // teks statis index.html yang ditandai data-i18n="atribut"
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const tag of html.match(/<[a-z]+\b[^>]*data-i18n="[^"]+"[^>]*>/g) || []) {
    const attr = /data-i18n="([^"]+)"/.exec(tag)[1];
    const v = new RegExp('\\s' + attr + '="([^"]*)"').exec(tag);
    if (v) add(v[1].replace(/&amp;/g, '&'), 'index.html');
  }
  const all = new Set([...code.keys(), ...data]);
  return { code, data, all, D };
}

// placeholder sebuah templat: {nama} dan bentuk jamak {n|satu|banyak} → nama
export const holes = s => [...String(s).matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map(m => m[1]).sort();

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { EN } = await import(join(ROOT, 'src/i18n/en.js'));
  const { code, data, all } = await collectKeys();
  const miss = [...all].filter(k => !Object.prototype.hasOwnProperty.call(EN, k));
  const arg = process.argv[2] || '';
  if (arg === '--missing-json') console.log(JSON.stringify(miss, null, 1));
  else {
    for (const k of miss) console.log((code.get(k) || ['data'])[0].padEnd(42) + ' ' + JSON.stringify(k));
    console.log('\nkunci kode ' + code.size + ' · data ' + data.size + ' · belum ada terjemahan ' + miss.length);
  }
  void relative;
}
