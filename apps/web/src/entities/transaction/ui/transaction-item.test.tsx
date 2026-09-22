import type { Transaction } from '@expense-tracker/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TransactionItem } from './transaction-item';

const BASE_TRANSACTION: Transaction = {
  id: 'tx-1',
  amount: '1234.56',
  type: 'EXPENSE',
  currency: 'RUB',
  categoryId: 'cat-1',
  category: {
    id: 'cat-1',
    name: 'Еда',
    icon: null,
    color: '#ff0000',
    isArchived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  description: 'Обед',
  date: '2026-09-15T12:00:00.000Z',
  createdAt: '2026-09-15T12:00:00.000Z',
  updatedAt: '2026-09-15T12:00:00.000Z',
};

describe('TransactionItem', () => {
  it('показывает категорию, описание, дату и сумму с минусом для расхода', () => {
    render(<TransactionItem transaction={BASE_TRANSACTION} />);

    expect(screen.getByText('Еда')).toBeInTheDocument();
    expect(screen.getByText(/Обед/)).toBeInTheDocument();
    expect(screen.getByText(/15 сент/)).toBeInTheDocument();
    expect(screen.getByText(/−.*1\s*234,56/)).toBeInTheDocument();
  });

  it('доход показывается с плюсом', () => {
    render(<TransactionItem transaction={{ ...BASE_TRANSACTION, type: 'INCOME' }} />);

    expect(screen.getByText(/\+.*1\s*234,56/)).toBeInTheDocument();
  });

  it('без описания показывает только дату', () => {
    render(<TransactionItem transaction={{ ...BASE_TRANSACTION, description: null }} />);

    expect(screen.getByText(/^15 сент/)).toBeInTheDocument();
  });

  it('слот action рендерится рядом с суммой', () => {
    render(<TransactionItem transaction={BASE_TRANSACTION} action={<button>Удалить</button>} />);

    expect(screen.getByRole('button', { name: 'Удалить' })).toBeInTheDocument();
  });
});
