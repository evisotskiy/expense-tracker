import { sumMoney, toMinorUnits, type TransactionCategorySummary } from '@expense-tracker/shared';

const VISIBLE_LIMIT = 7;
const OTHER_ID = 'OTHER';

export interface CategoryShare {
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  total: string;
  /** Доля от суммы по этому типу за месяц, 0..1. */
  share: number;
}

/**
 * API группирует по (categoryId, type) и отдаёт список отсортированным по сумме,
 * но вперемешку доходы и расходы — без фильтра по типу расход и доход одной
 * категории сложились бы в одну строку. Хвост сверх VISIBLE_LIMIT схлопывается
 * в «Прочее», доля считается через toMinorUnits — без плавающей точки.
 */
export function topCategories(
  categories: TransactionCategorySummary[],
  type: TransactionCategorySummary['type'],
): CategoryShare[] {
  const filtered = categories
    .filter((category) => category.type === type)
    .slice()
    .sort((a, b) => toMinorUnits(b.total) - toMinorUnits(a.total));

  if (filtered.length === 0) {
    return [];
  }

  const totalMinor = filtered.reduce((sum, category) => sum + toMinorUnits(category.total), 0);
  const shareOf = (minor: number) => (totalMinor === 0 ? 0 : minor / totalMinor);

  const visible = filtered.slice(0, VISIBLE_LIMIT).map((category) => ({
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    categoryColor: category.categoryColor,
    total: category.total,
    share: shareOf(toMinorUnits(category.total)),
  }));

  const rest = filtered.slice(VISIBLE_LIMIT);
  if (rest.length === 0) {
    return visible;
  }

  const restTotal = sumMoney(rest.map((category) => category.total));

  return [
    ...visible,
    {
      categoryId: OTHER_ID,
      categoryName: 'Прочее',
      categoryColor: null,
      total: restTotal,
      share: shareOf(toMinorUnits(restTotal)),
    },
  ];
}
