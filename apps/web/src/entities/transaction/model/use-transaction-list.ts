'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchTransactionPage } from '../api/transaction-api';
import { selectTransactionPages } from './select-transaction-pages';
import { transactionKeys } from './transaction-keys';
import type { TransactionListParams } from './types';

/**
 * placeholderData/keepPreviousData сознательно не используем: при смене месяца
 * или фильтра он показал бы длинный накопленный список, который тут же
 * схлопнулся бы до 10 записей — заметнее скелетона, от которого спасает.
 */
export function useTransactionList(params: TransactionListParams) {
  return useInfiniteQuery({
    queryKey: transactionKeys.list(params),
    queryFn: ({ pageParam, signal }) =>
      fetchTransactionPage({ ...params, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    // nextCursor === null означает «страниц больше нет» — hasNextPage выключится сам.
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Иначе фокус вкладки перезапросит все накопленные страницы.
    refetchOnWindowFocus: false,
    select: selectTransactionPages,
  });
}
