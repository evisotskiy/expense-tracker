import type { TransactionCategorySummary } from '@expense-tracker/shared';
import { describe, expect, it } from 'vitest';

import { topCategories } from './top-categories';

function row(
  categoryId: string,
  type: TransactionCategorySummary['type'],
  total: string,
  categoryName = categoryId,
): TransactionCategorySummary {
  return { categoryId, categoryName, categoryColor: '#ff0000', type, total, count: 1 };
}

describe('topCategories', () => {
  it('фильтрует по типу — доходы и расходы одной категории не смешиваются', () => {
    const rows = [row('cat-1', 'EXPENSE', '100.00'), row('cat-1', 'INCOME', '500.00')];

    const expenses = topCategories(rows, 'EXPENSE');
    expect(expenses).toHaveLength(1);
    expect(expenses[0]!.total).toBe('100.00');
  });

  it('сортирует по убыванию суммы', () => {
    const rows = [
      row('cat-1', 'EXPENSE', '50.00'),
      row('cat-2', 'EXPENSE', '200.00'),
      row('cat-3', 'EXPENSE', '100.00'),
    ];

    expect(topCategories(rows, 'EXPENSE').map((r) => r.categoryId)).toEqual([
      'cat-2',
      'cat-3',
      'cat-1',
    ]);
  });

  it('считает долю через целые копейки', () => {
    const rows = [row('cat-1', 'EXPENSE', '75.00'), row('cat-2', 'EXPENSE', '25.00')];

    const result = topCategories(rows, 'EXPENSE');
    expect(result[0]!.share).toBeCloseTo(0.75);
    expect(result[1]!.share).toBeCloseTo(0.25);
  });

  it('хвост сверх 7 категорий схлопывается в «Прочее»', () => {
    const rows = Array.from({ length: 9 }, (_, index) =>
      row(`cat-${index}`, 'EXPENSE', `${100 - index}.00`),
    );

    const result = topCategories(rows, 'EXPENSE');
    expect(result).toHaveLength(8);
    const other = result.at(-1)!;
    expect(other.categoryName).toBe('Прочее');
    expect(other.categoryColor).toBeNull();
    // 9 категорий с суммами 100.00..92.00 по убыванию — в хвост уходят 93.00 и 92.00.
    expect(other.total).toBe('185.00');
  });

  it('пустой результат, если операций такого типа нет', () => {
    expect(topCategories([], 'EXPENSE')).toEqual([]);
  });
});
