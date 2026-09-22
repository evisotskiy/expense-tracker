import type { Paginated, Transaction } from '@expense-tracker/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { selectTransactionPages } from './select-transaction-pages';

function makeTransaction(id: string): Transaction {
  return {
    id,
    amount: '100.00',
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
    description: null,
    date: '2026-09-10T00:00:00.000Z',
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
  };
}

function makeData(pages: Paginated<Transaction>[]): InfiniteData<Paginated<Transaction>> {
  return { pages, pageParams: pages.map(() => undefined) };
}

describe('selectTransactionPages', () => {
  it('склеивает страницы в плоский список, сохраняя порядок', () => {
    const data = makeData([
      { items: [makeTransaction('1'), makeTransaction('2')], nextCursor: '2' },
      { items: [makeTransaction('3')], nextCursor: null },
    ]);

    expect(selectTransactionPages(data).map((t) => t.id)).toEqual(['1', '2', '3']);
  });

  it('убирает дубли по id между страницами', () => {
    // Запись '2' попала в обе страницы: между подгрузками создали новую транзакцию,
    // и курсор сдвинулся.
    const data = makeData([
      { items: [makeTransaction('1'), makeTransaction('2')], nextCursor: '2' },
      { items: [makeTransaction('2'), makeTransaction('3')], nextCursor: null },
    ]);

    expect(selectTransactionPages(data).map((t) => t.id)).toEqual(['1', '2', '3']);
  });
});
