// ESLint (flat config). npm run lint / npm run lint:fix
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'test/out/', 'legacy/', '.firebase/', 'docs/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },
  // aplikasi browser
  { files: ['src/**/*.js'], languageOptions: { globals: { ...globals.browser } } },
  // engine harus murni: tanpa DOM / API browser (dipakai juga di Node & host online)
  { files: ['src/engine/**/*.js'], languageOptions: { globals: { structuredClone: 'readonly' } } },
  // uji & alat: Node, plus fungsi page.evaluate yang berjalan di browser
  { files: ['test/**/*.js', 'tools/**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { files: ['*.config.js'], languageOptions: { globals: { ...globals.node } } },
  { files: ['src/service-worker.js'], languageOptions: { globals: { ...globals.serviceworker } } },
];
