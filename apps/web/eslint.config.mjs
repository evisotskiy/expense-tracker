import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import base from '@expense-tracker/eslint-config/base';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  ...base,
  // eslint-config-next всё ещё распространяется в старом формате,
  // FlatCompat переводит его в flat config
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];
