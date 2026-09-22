'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Category } from '@expense-tracker/shared';

import { categoryKeys, createCategory } from '@/entities/category';

import type { CreateCategoryFormData } from './schema';

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation<Category, unknown, CreateCategoryFormData>({
    mutationFn: (values) => createCategory(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all() });
    },
  });
}
