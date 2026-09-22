import type { MonthValue } from '@/shared/lib/date/month';

import type { TransactionListParams } from './types';

/**
 * Один корень ['transactions'] для ленты и сводки: одна инвалидация
 * transactionKeys.all() после мутации накрывает обе.
 */
export const transactionKeys = {
  all: () => ['transactions'] as const,
  lists: () => [...transactionKeys.all(), 'list'] as const,
  list: (params: TransactionListParams) => [...transactionKeys.lists(), params] as const,
  summaries: () => [...transactionKeys.all(), 'summary'] as const,
  summary: (month: MonthValue) => [...transactionKeys.summaries(), month] as const,
};
