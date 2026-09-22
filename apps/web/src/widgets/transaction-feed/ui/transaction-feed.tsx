'use client';

import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { TransactionItem, useTransactionList } from '@/entities/transaction';
import { DeleteTransactionButton } from '@/features/delete-transaction';
import {
  TransactionFiltersBar,
  type TransactionFiltersValue,
} from '@/features/transaction-filters';
import { formatMonthTitle, monthRange, type MonthValue } from '@/shared/lib/date/month';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';

import { TransactionFeedSkeleton } from './transaction-feed-skeleton';

interface TransactionFeedProps {
  month: MonthValue;
  filters: TransactionFiltersValue;
  onFiltersChange: (value: TransactionFiltersValue) => void;
  /** Пропсом, а не импортом AddEntryMenu — виджеты соседями друг друга не видят. */
  emptyAction: ReactNode;
}

/** '1 операция' / '2 операции' / '5 операций' — русская плюрализация для role="status". */
function pluralizeOperations(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return 'операция';
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'операции';
  }
  return 'операций';
}

export function TransactionFeed({
  month,
  filters,
  onFiltersChange,
  emptyAction,
}: TransactionFeedProps) {
  const { dateFrom, dateTo } = monthRange(month);
  const query = useTransactionList({ dateFrom, dateTo, ...filters });

  const transactions = query.data ?? [];
  const hasFilters = Boolean(filters.type || filters.categoryId);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Транзакции</h2>
        <TransactionFiltersBar value={filters} onChange={onFiltersChange} />
      </div>

      {query.isPending ? (
        <TransactionFeedSkeleton />
      ) : query.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <div className="flex items-center justify-between gap-3">
              <span>Не удалось загрузить транзакции.</span>
              <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}>
                Повторить
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : transactions.length === 0 ? (
        hasFilters ? (
          <div className="grid justify-items-center gap-3 py-6 text-center">
            <p className="text-muted-foreground">Под выбранные фильтры ничего не нашлось.</p>
            <Button type="button" variant="outline" onClick={() => onFiltersChange({})}>
              Сбросить фильтры
            </Button>
          </div>
        ) : (
          <div className="grid justify-items-center gap-3 py-6 text-center">
            <p className="text-muted-foreground">
              За {formatMonthTitle(month).toLowerCase()} ещё нет операций.
            </p>
            {emptyAction}
          </div>
        )
      ) : (
        <>
          <ul>
            {transactions.map((transaction, index) => (
              <li key={transaction.id}>
                {index > 0 && <Separator />}
                <TransactionItem
                  transaction={transaction}
                  action={<DeleteTransactionButton transactionId={transaction.id} />}
                />
              </li>
            ))}
          </ul>

          {query.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetchingNextPage}
              aria-busy={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Загружаем…
                </>
              ) : (
                'Показать ещё'
              )}
            </Button>
          )}

          {query.isFetchNextPageError && (
            // Ошибка подгрузки не стирает уже показанные строки — компактная строка у кнопки.
            <p className="text-sm text-destructive">Не удалось загрузить ещё — попробуйте снова.</p>
          )}

          <p role="status" className="text-sm text-muted-foreground">
            Показано {transactions.length} {pluralizeOperations(transactions.length)}
          </p>
        </>
      )}
    </div>
  );
}
