import { useQuery } from '@tanstack/react-query';

import { fetchCategories } from '../api/category-api';
import { categoryKeys } from './category-keys';

/** staleTime 5 минут: категории меняются редко, а после мутаций кэш инвалидируется явно. */
export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: 5 * 60_000,
  });
}
