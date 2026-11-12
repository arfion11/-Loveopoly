/* Pemeriksa: panggilan penerjemah (t / tr / T / L / tile / tLog) yang ternyata mengenai variabel lokal bernama sama
   (mis. `const t = TILES[i]` lalu `t('Kota')`) — error hanya muncul saat runtime, jadi dicek di sini (test/i18n.js). */
import { Linter } from 'eslint';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NAMES = new Set(['t', 'tr', 'T', 'L', 'tile', 'tLog']);
const files = dir =>
  readdirSync(join(ROOT, dir)).flatMap(f => {
    const p = join(dir, f);
    return statSync(join(ROOT, p)).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
  });

const rule = {
  create(ctx) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || !NAMES.has(node.callee.name)) return;
        let scope = ctx.sourceCode.getScope(node);
        let v = null;
        while (scope && !v) {
          v = scope.set.get(node.callee.name);
          scope = scope.upper;
        }
        if (!v) return;
        const def = v.defs[0];
        // aman: impor modul, atau deklarasi tingkat modul (const T = x => …)
        if (def.type === 'ImportBinding') return;
        if (v.scope.type === 'module') return;
        ctx.report({
          node,
          message: node.callee.name + '() mengenai variabel lokal (baris ' + def.name.loc.start.line + '), bukan penerjemah',
        });
      },
    };
  },
};

export function shadowCalls() {
  const linter = new Linter({ configType: 'flat' });
  const out = [];
  for (const f of ['src/ui', 'src/net'].flatMap(files)) {
    const msgs = linter.verify(
      readFileSync(join(ROOT, f), 'utf8'),
      [
        {
          files: ['**/*.js'],
          languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
          linterOptions: { reportUnusedDisableDirectives: 'off' },
          plugins: { i18n: { rules: { shadow: rule } } },
          rules: { 'i18n/shadow': 'error' },
        },
      ],
      f
    );
    msgs.forEach(m => out.push(f + ':' + m.line + ' ' + m.message));
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = shadowCalls();
  console.log(r.join('\n') || 'tidak ada');
  process.exit(r.length ? 1 : 0);
}
