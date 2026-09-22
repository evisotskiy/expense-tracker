'use client';

import type { Transaction } from '@expense-tracker/shared';

import { useCategories } from '@/entities/category';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Skeleton } from '@/shared/ui/skeleton';

import { useCreateTransaction } from '../model/use-create-transaction';
import { TransactionForm } from './transaction-form';

interface CreateTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** У нового пользователя категорий ровно ноль — это первый экран, а не краевой случай. */
  onRequestCategory: () => void;
  /** Наверх — чтобы views/dashboard переключил месяц, если дата задним числом. */
  onCreated?: (transaction: Transaction) => void;
}

export function CreateTransactionDialog({
  open,
  onOpenChange,
  onRequestCategory,
  onCreated,
}: CreateTransactionDialogProps) {
  const categoriesQuery = useCategories();
  const createTransactionMutation = useCreateTransaction();
  const categories = categoriesQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая транзакция</DialogTitle>
        </DialogHeader>

        {categoriesQuery.isPending ? (
          <div className="grid gap-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : categoriesQuery.isError ? (
          // Без этой ветки categories === undefined проваливался в «нет категорий»:
          // форма рендерилась с пустым селектом молча, без единого намёка на ошибку.
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              <div className="flex items-center justify-between gap-3">
                <span>Не удалось загрузить категории.</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => categoriesQuery.refetch()}
                >
                  Повторить
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : categories && categories.length === 0 ? (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Сначала создайте хотя бы одну категорию.
            </p>
            <Button type="button" onClick={onRequestCategory}>
              Создать категорию
            </Button>
          </div>
        ) : (
          <TransactionForm
            categories={categories ?? []}
            onSubmit={async (values) => {
              const transaction = await createTransactionMutation.mutateAsync(values);
              onOpenChange(false);
              onCreated?.(transaction);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
