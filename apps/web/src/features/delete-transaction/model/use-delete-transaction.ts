'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteTransaction, transactionKeys } from '@/entities/transaction';

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
    },
  });
}
