import type { Transaction } from '@expense-tracker/shared';

/** Решение пользователя: лента подгружается по 10, номеров страниц нет. */
export const TRANSACTIONS_PAGE_SIZE = 10;

export interface TransactionListParams {
  dateFrom: string;
  dateTo: string;
  type?: Transaction['type'];
  categoryId?: string;
}
