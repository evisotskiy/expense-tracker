import type { Transaction } from '@expense-tracker/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type * as EntitiesTransaction from '@/entities/transaction';
import { renderWithProviders } from '@/shared/lib/test/render-with-providers';

vi.mock('@/entities/category', () => ({
  useCategories: () => ({ data: [] }),
}));

const { useTransactionListMock } = vi.hoisted(() => ({ useTransactionListMock: vi.fn() }));

vi.mock('@/entities/transaction', async (importOriginal) => {
  const actual = await importOriginal<typeof EntitiesTransaction>();
  return {
    ...actual,
    useTransactionList: useTransactionListMock,
  };
});

import { TransactionFeed } from './transaction-feed';

const MONTH = { year: 2026, month: 9 };

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

function baseQuery(overrides: Partial<ReturnType<typeof useTransactionListMock>> = {}) {
  return {
    data: [],
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('TransactionFeed', () => {
  it('показывает скелетон во время первой загрузки', () => {
    useTransactionListMock.mockReturnValue(baseQuery({ isPending: true }));
    const { container } = renderWithProviders(
      <TransactionFeed month={MONTH} filters={{}} onFiltersChange={vi.fn()} emptyAction={null} />,
    );

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('при ошибке показывает алерт с кнопкой «Повторить»', async () => {
    const refetch = vi.fn();
    useTransactionListMock.mockReturnValue(baseQuery({ isError: true, refetch }));
    const user = userEvent.setup();
    renderWithProviders(
      <TransactionFeed month={MONTH} filters={{}} onFiltersChange={vi.fn()} emptyAction={null} />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('пустая лента без фильтров показывает «нет операций» и emptyAction', () => {
    useTransactionListMock.mockReturnValue(baseQuery());
    renderWithProviders(
      <TransactionFeed
        month={MONTH}
        filters={{}}
        onFiltersChange={vi.fn()}
        emptyAction={<button>Добавить</button>}
      />,
    );

    expect(screen.getByText('За сентябрь 2026 ещё нет операций.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument();
  });

  it('пустая лента с фильтрами показывает «ничего не нашлось» и сбрасывает фильтры', async () => {
    useTransactionListMock.mockReturnValue(baseQuery());
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TransactionFeed
        month={MONTH}
        filters={{ type: 'EXPENSE' }}
        onFiltersChange={onFiltersChange}
        emptyAction={null}
      />,
    );

    expect(screen.getByText('Под выбранные фильтры ничего не нашлось.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('кнопка «Показать ещё» видна при hasNextPage и скрыта без него', () => {
    useTransactionListMock.mockReturnValue(
      baseQuery({ data: [makeTransaction('1')], hasNextPage: true }),
    );
    const { rerender } = renderWithProviders(
      <TransactionFeed month={MONTH} filters={{}} onFiltersChange={vi.fn()} emptyAction={null} />,
    );
    expect(screen.getByRole('button', { name: 'Показать ещё' })).toBeInTheDocument();

    useTransactionListMock.mockReturnValue(
      baseQuery({ data: [makeTransaction('1')], hasNextPage: false }),
    );
    rerender(
      <TransactionFeed month={MONTH} filters={{}} onFiltersChange={vi.fn()} emptyAction={null} />,
    );
    expect(screen.queryByRole('button', { name: 'Показать ещё' })).not.toBeInTheDocument();
  });

  it('показывает статус с числом показанных операций', () => {
    useTransactionListMock.mockReturnValue(
      baseQuery({ data: [makeTransaction('1'), makeTransaction('2')] }),
    );
    renderWithProviders(
      <TransactionFeed month={MONTH} filters={{}} onFiltersChange={vi.fn()} emptyAction={null} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Показано 2 операции');
  });
});
