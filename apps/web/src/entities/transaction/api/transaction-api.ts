import type {
  CreateTransactionInput,
  Paginated,
  Transaction,
  TransactionSummary,
} from '@expense-tracker/shared';

import { authorizedFetch } from '@/shared/api/authorized-fetch';
import type { MonthValue } from '@/shared/lib/date/month';

import { TRANSACTIONS_PAGE_SIZE, type TransactionListParams } from '../model/types';

interface FetchTransactionPageParams extends TransactionListParams {
  cursor?: string;
}

export function fetchTransactionPage(
  { dateFrom, dateTo, type, categoryId, cursor }: FetchTransactionPageParams,
  signal?: AbortSignal,
): Promise<Paginated<Transaction>> {
  const query = new URLSearchParams({ dateFrom, dateTo, limit: String(TRANSACTIONS_PAGE_SIZE) });
  // Опциональные фильтры добавляются только когда заданы: пустая строка в type
  // провалит z.enum на бэкенде.
  if (type) {
    query.set('type', type);
  }
  if (categoryId) {
    query.set('categoryId', categoryId);
  }
  if (cursor) {
    query.set('cursor', cursor);
  }

  return authorizedFetch<Paginated<Transaction>>(`/transactions?${query.toString()}`, { signal });
}

export function fetchTransactionSummary(
  { year, month }: MonthValue,
  signal?: AbortSignal,
): Promise<TransactionSummary> {
  const query = new URLSearchParams({ month: String(month), year: String(year) });
  return authorizedFetch<TransactionSummary>(`/transactions/summary?${query.toString()}`, {
    signal,
  });
}

export function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  return authorizedFetch<Transaction>('/transactions', { method: 'POST', body: input });
}

export function deleteTransaction(id: string): Promise<void> {
  return authorizedFetch<void>(`/transactions/${id}`, { method: 'DELETE' });
}
