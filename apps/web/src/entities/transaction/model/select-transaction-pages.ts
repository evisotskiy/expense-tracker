import type { Paginated, Transaction } from '@expense-tracker/shared';
import type { InfiniteData } from '@tanstack/react-query';

/**
 * Плоский список + дедуп по id. Между двумя подгрузками пользователь может
 * создать транзакцию, и уже показанная запись приедет во второй странице
 * ещё раз — задвоенный key в React-списке это баг рендера, а не косметика.
 *
 * Модульная функция, а не инлайновая: инлайновая пересчитывалась бы на каждый рендер.
 */
export function selectTransactionPages(data: InfiniteData<Paginated<Transaction>>): Transaction[] {
  const seen = new Set<string>();
  const items: Transaction[] = [];

  for (const page of data.pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      items.push(item);
    }
  }

  return items;
}
