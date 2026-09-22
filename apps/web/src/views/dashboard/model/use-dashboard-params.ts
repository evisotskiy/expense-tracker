'use client';

import { idSchema } from '@expense-tracker/shared';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import type { TransactionFiltersValue } from '@/features/transaction-filters';
import { formatMonthParam, parseMonthParam, type MonthValue } from '@/shared/lib/date/month';

function parseFiltersParams(searchParams: URLSearchParams): TransactionFiltersValue {
  const rawType = searchParams.get('type');
  const rawCategoryId = searchParams.get('category');
  // Мусор в query (чужой формат, обрезанная ссылка) иначе уходит прямо в запрос
  // к API: transactionFiltersSchema отвечает 400, и лента навсегда виснет в
  // «Не удалось загрузить» — кнопка «Повторить» такую ошибку никогда не лечит.
  return {
    type: rawType === 'EXPENSE' || rawType === 'INCOME' ? rawType : undefined,
    categoryId:
      rawCategoryId && idSchema.safeParse(rawCategoryId).success ? rawCategoryId : undefined,
  };
}

/**
 * Месяц и фильтры — в URL (?month=2026-09&type=EXPENSE&category=<cuid>): переживает
 * перезагрузку, ссылкой можно поделиться. Накопленные страницы ленты в URL не
 * кладём — «Показать ещё» не навигация.
 *
 * router.replace, а не push: переключения месяца/фильтров не плодят записи
 * в истории — кнопка «Назад» браузера уводит со страницы целиком, а не на
 * предыдущий месяц. Осознанный выбор для этого экрана: иначе десяток кликов
 * по переключателю месяца устроил бы такой же длинный хвост в истории.
 */
export function useDashboardParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const month = useMemo(
    () => parseMonthParam(searchParams.get('month'), new Date()),
    [searchParams],
  );
  const filters = useMemo(() => parseFiltersParams(searchParams), [searchParams]);

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      // typedRoutes не выводит Route для шаблонных строк с query — каст не убирать.
      router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setMonth = useCallback(
    (next: MonthValue) => replaceParams((params) => params.set('month', formatMonthParam(next))),
    [replaceParams],
  );

  const setFilters = useCallback(
    (next: TransactionFiltersValue) =>
      replaceParams((params) => {
        if (next.type) {
          params.set('type', next.type);
        } else {
          params.delete('type');
        }
        if (next.categoryId) {
          params.set('category', next.categoryId);
        } else {
          params.delete('category');
        }
      }),
    [replaceParams],
  );

  return { month, filters, setMonth, setFilters };
}
