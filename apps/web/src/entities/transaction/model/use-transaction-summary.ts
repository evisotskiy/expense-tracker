'use client';

import { useQuery } from '@tanstack/react-query';

import type { MonthValue } from '@/shared/lib/date/month';

import { fetchTransactionSummary } from '../api/transaction-api';
import { transactionKeys } from './transaction-keys';

export function useTransactionSummary(month: MonthValue) {
  return useQuery({
    queryKey: transactionKeys.summary(month),
    queryFn: ({ signal }) => fetchTransactionSummary(month, signal),
  });
}
