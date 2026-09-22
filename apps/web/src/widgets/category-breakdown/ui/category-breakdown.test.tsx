import type { TransactionSummary } from '@expense-tracker/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CategoryBreakdown } from './category-breakdown';

const SUMMARY: TransactionSummary = {
  currency: 'RUB',
  month: 9,
  year: 2026,
  totalIncome: '0.00',
  totalExpense: '150.00',
  balance: '-150.00',
  categories: [
    {
      categoryId: 'cat-1',
      categoryName: 'Еда',
      categoryColor: '#ff0000',
      type: 'EXPENSE',
      total: '100.00',
      count: 2,
    },
    {
      categoryId: 'cat-2',
      categoryName: 'Зарплата',
      categoryColor: '#00ff00',
      type: 'INCOME',
      total: '500.00',
      count: 1,
    },
    {
      categoryId: 'cat-3',
      categoryName: 'Транспорт',
      categoryColor: '#0000ff',
      type: 'EXPENSE',
      total: '50.00',
      count: 1,
    },
  ],
};

describe('CategoryBreakdown', () => {
  it('показывает скелетон во время загрузки', () => {
    const { container } = render(<CategoryBreakdown summary={undefined} isLoading />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('показывает только расходы, доходы не смешивает', () => {
    render(<CategoryBreakdown summary={SUMMARY} isLoading={false} />);

    expect(screen.getByText('Еда')).toBeInTheDocument();
    expect(screen.getByText('Транспорт')).toBeInTheDocument();
    expect(screen.queryByText('Зарплата')).not.toBeInTheDocument();
  });

  it('пустое состояние без расходов', () => {
    render(
      <CategoryBreakdown
        summary={{ ...SUMMARY, categories: SUMMARY.categories.filter((c) => c.type !== 'EXPENSE') }}
        isLoading={false}
      />,
    );

    expect(screen.getByText('За этот месяц расходов ещё нет.')).toBeInTheDocument();
  });
});
