import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Общая база для всех пакетов монорепо (flat config, ESLint 9+).
 * Prettier идёт последним и гасит все правила форматирования.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // TS-специфичные правила — только на .ts/.tsx: на .js/.mjs (конфиги вроде
    // eslint.config.mjs) typescript-eslint-парсер может быть подменён другим
    // пресетом (например, eslint-config-next), и тогда парсер, отдающий
    // сервисы типов, не совпадает с ожидаемым — правило падает с ошибкой
    // "requires type information" вместо применения
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  prettier,
];
