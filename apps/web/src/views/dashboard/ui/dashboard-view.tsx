'use client';

import type { Transaction } from '@expense-tracker/shared';
import { Suspense } from 'react';

import { useTransactionSummary } from '@/entities/transaction';
import { MonthSwitcher } from '@/features/month-switcher';
import { AddEntryMenu } from '@/widgets/add-entry-menu';
import { AppHeader } from '@/widgets/app-header';
import { CategoryBreakdown } from '@/widgets/category-breakdown';
import { MonthSummary } from '@/widgets/month-summary';
import { TransactionFeed } from '@/widgets/transaction-feed';

import { useDashboardParams } from '../model/use-dashboard-params';

function monthOfTransaction(transaction: Transaction) {
  const date = new Date(transaction.date);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function DashboardContent() {
  const { month, filters, setMonth, setFilters } = useDashboardParams();
  const summaryQuery = useTransactionSummary(month);

  // Транзакция могла быть создана задним числом — иначе она молча «исчезает»
  // из вида, и это выглядит как потеря данных, а не выбор фильтра.
  function handleTransactionCreated(transaction: Transaction) {
    const createdMonth = monthOfTransaction(transaction);
    if (createdMonth.year !== month.year || createdMonth.month !== month.month) {
      setMonth(createdMonth);
    }
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <MonthSwitcher value={month} onChange={setMonth} />
          <AddEntryMenu onTransactionCreated={handleTransactionCreated} />
        </div>

        <MonthSummary summary={summaryQuery.data} isLoading={summaryQuery.isPending} />

        <CategoryBreakdown summary={summaryQuery.data} isLoading={summaryQuery.isPending} />

        <TransactionFeed
          month={month}
          filters={filters}
          onFiltersChange={setFilters}
          emptyAction={<AddEntryMenu onTransactionCreated={handleTransactionCreated} />}
        />
      </main>
    </div>
  );
}

/**
 * useSearchParams() в Next 16 требует обёртки <Suspense> в статически рендерящейся
 * ветке — RequireAuth (в отличие от RedirectIfAuthenticated) её не содержит,
 * поэтому границу ставим здесь, иначе next build падает.
 */
export function DashboardView() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <DashboardContent />
    </Suspense>
  );
}
