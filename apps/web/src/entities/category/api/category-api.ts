import type { Category, CreateCategoryInput } from '@expense-tracker/shared';

import { authorizedFetch } from '@/shared/api/authorized-fetch';

export function fetchCategories(signal?: AbortSignal): Promise<Category[]> {
  return authorizedFetch<Category[]>('/categories', { signal });
}

export function createCategory(input: CreateCategoryInput): Promise<Category> {
  return authorizedFetch<Category>('/categories', { method: 'POST', body: input });
}
