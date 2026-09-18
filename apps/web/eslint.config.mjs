import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import base from '@expense-tracker/eslint-config/base';

// Слои Feature-Sliced Design снизу вверх: каждый слой видит только то, что
// ниже, и только корень чужого слайса (через index.ts), не его внутренности.
const LAYERS = ['shared', 'entities', 'features', 'widgets', 'views', 'app'];
// У этих слоёв есть слайсы с публичным API (index.ts) — у shared и app его нет:
// shared импортируется файлом, app — единственная точка входа Next.
const SLICE_LAYERS = ['entities', 'features', 'widgets', 'views'];

// Общие запреты — одинаковы для всех слоёв, поэтому попадают в каждый
// per-layer блок ниже, а не в отдельный блок: flat config не мержит правила
// с одним и тем же именем между блоками, последний совпавший просто
// перезаписывает предыдущий целиком.
const commonPatterns = [
  {
    group: ['@/lib/*', '@/components/*', '@/providers/*'],
    message: 'Старые пути ушли: lib → shared/lib, components → shared/ui, providers → app/_providers.',
  },
  ...LAYERS.map((layer) => ({
    group: [`../**/${layer}/**`],
    message: `Относительный импорт не пересекает границу слоя "${layer}" — используйте алиас @/${layer}/...`,
  })),
];

const boundaryConfigs = LAYERS.map((layer, i) => {
  const above = LAYERS.slice(i + 1);
  const belowSliceLayers = SLICE_LAYERS.filter((b) => LAYERS.indexOf(b) < i);

  const patterns = [
    ...above.map((a) => ({
      group: [`@/${a}/**`],
      message: `Слой "${layer}" не может импортировать слой "${a}" — это слой выше по FSD.`,
    })),
    ...belowSliceLayers.map((b) => ({
      group: [`@/${b}/*/**`],
      message: `Импортируйте слайс из "${b}" только через его index.ts (@/${b}/<слайс>), без глубокого пути мимо публичного API.`,
    })),
    ...(SLICE_LAYERS.includes(layer)
      ? [
          {
            group: [`@/${layer}/*`],
            message: `Соседние слайсы слоя "${layer}" друг друга не импортируют — общий код выносите в слой ниже.`,
          },
        ]
      : []),
    ...commonPatterns,
  ];

  return {
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns }],
    },
  };
});

const config = [
  ...base,
  // eslint-config-next начиная с 15-й версии сам публикует flat config
  // (core-web-vitals включает и next/typescript). FlatCompat здесь не
  // подходит: он валидирует пресет как legacy eslintrc-конфиг и падает
  // на самоссылающихся flat-плагинах ("Converting circular structure to JSON")
  ...nextCoreWebVitals,
  ...boundaryConfigs,
];

export default config;
