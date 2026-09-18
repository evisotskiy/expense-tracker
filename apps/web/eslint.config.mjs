import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import base from '@expense-tracker/eslint-config/base';

const config = [
  ...base,
  // eslint-config-next начиная с 15-й версии сам публикует flat config
  // (core-web-vitals включает и next/typescript). FlatCompat здесь не
  // подходит: он валидирует пресет как legacy eslintrc-конфиг и падает
  // на самоссылающихся flat-плагинах ("Converting circular structure to JSON")
  ...nextCoreWebVitals,
];

export default config;
