import type { TransactionSummary } from '@expense-tracker/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MonthSummary } from './month-summary';

const SUMMARY: TransactionSummary = {
  currency: 'RUB',
  month: 9,
  year: 2026,
  totalIncome: '5000.00',
  totalExpense: '1234.56',
  balance: '3765.44',
  categories: [],
};

describe('MonthSummary', () => {
  it('показывает скелетоны во время загрузки', () => {
    const { container } = render(<MonthSummary summary={undefined} isLoading />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('показывает доходы, расходы и баланс', () => {
    render(<MonthSummary summary={SUMMARY} isLoading={false} />);

    expect(screen.getByText(/5\s*000,00/)).toBeInTheDocument();
    expect(screen.getByText(/1\s*234,56/)).toBeInTheDocument();
    expect(screen.getByText(/3\s*765,44/)).toBeInTheDocument();
    expect(screen.getByText(/RUB/)).toBeInTheDocument();
  });

  it('отрицательный баланс подсвечивается text-destructive', () => {
    render(<MonthSummary summary={{ ...SUMMARY, balance: '-100.00' }} isLoading={false} />);

    const balance = screen.getByText(/-?100,00/);
    expect(balance.className).toContain('text-destructive');
  });

  it('положительный баланс не подсвечивается', () => {
    render(<MonthSummary summary={SUMMARY} isLoading={false} />);

    const balance = screen.getByText(/3\s*765,44/);
    expect(balance.className).not.toContain('text-destructive');
  });
});
