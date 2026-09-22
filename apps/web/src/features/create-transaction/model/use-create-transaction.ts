'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Transaction } from '@expense-tracker/shared';

import { useSession } from '@/entities/session';
import { createTransaction, transactionKeys } from '@/entities/transaction';

import type { CreateTransactionFormData } from './schema';

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { data: user } = useSession();

  return useMutation<Transaction, unknown, CreateTransactionFormData>({
    mutationFn: (values) => {
      if (!user) {
        // Диалог доступен только внутри RequireAuth — сюда не дойти анонимно,
        // но throw честнее, чем молча отправить запрос без валюты.
        throw new Error('Транзакцию может создать только авторизованный пользователь');
      }

      // date после zodResolver — уже Date (isoDateSchema трансформирует строку из
      // <input type="date">), а API ждёт ISO-строку — конвертируем обратно.
      // description: '' → null — незаполненное поле формы не должно ложиться в БД
      // пустой строкой, схема принимает null/undefined как «описания нет».
      return createTransaction({
        ...values,
        currency: user.baseCurrency,
        date: values.date.toISOString(),
        description: values.description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
    },
  });
}
