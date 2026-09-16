import globals from 'globals';

import base from './base.js';

/**
 * Конфиг для Nest.js-приложений.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // guard'ы, filter'ы и interceptor'ы работают с нетипизированным Express-контекстом
      '@typescript-eslint/no-explicit-any': 'warn',
      // Nest объявляет зависимости как parameter properties: `constructor(private readonly x: S) {}`
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
    },
  },
];
