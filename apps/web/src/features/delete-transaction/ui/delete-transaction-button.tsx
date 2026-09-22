'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';

import { useDeleteTransaction } from '../model/use-delete-transaction';

interface DeleteTransactionButtonProps {
  transactionId: string;
}

export function DeleteTransactionButton({ transactionId }: DeleteTransactionButtonProps) {
  const deleteTransactionMutation = useDeleteTransaction();
  // open своим стейтом, а не Radix'ом: диалог должен остаться открытым при ошибке
  // (см. handleConfirm) — Uncontrolled AlertDialog закрыл бы его сразу по клику.
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    try {
      await deleteTransactionMutation.mutateAsync(transactionId);
      setOpen(false);
    } catch {
      // Диалог остаётся открытым — ошибка показана ниже через isError,
      // мутацию можно повторить той же кнопкой.
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          deleteTransactionMutation.reset();
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Удалить транзакцию">
          <Trash2 aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить транзакцию?</AlertDialogTitle>
          <AlertDialogDescription>Действие необратимо.</AlertDialogDescription>
        </AlertDialogHeader>

        {deleteTransactionMutation.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>Не удалось удалить транзакцию. Попробуйте снова.</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteTransactionMutation.isPending}
            aria-busy={deleteTransactionMutation.isPending}
            onClick={(event) => {
              // preventDefault — иначе Radix закрывает диалог сразу же, до того как
              // мутация успеет завершиться и показать ошибку (тот же приём, что в UserMenu).
              event.preventDefault();
              void handleConfirm();
            }}
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
