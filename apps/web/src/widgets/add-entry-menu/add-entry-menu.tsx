'use client';

import type { Transaction } from '@expense-tracker/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { CreateCategoryDialog } from '@/features/create-category';
import { CreateTransactionDialog } from '@/features/create-transaction';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

type PendingDialog = 'transaction' | 'category' | null;

interface AddEntryMenuProps {
  /** Наверх — чтобы views/dashboard переключил месяц, если дата задним числом. */
  onTransactionCreated?: (transaction: Transaction) => void;
}

export function AddEntryMenu({ onTransactionCreated }: AddEntryMenuProps) {
  const [openDialog, setOpenDialog] = useState<PendingDialog>(null);
  const [nextDialog, setNextDialog] = useState<PendingDialog>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button">
            <Plus aria-hidden="true" />
            Добавить
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            // Ловушка Radix: закрытие меню и открытие диалога в одном тике дерутся
            // за focus-trap и оставляют pointer-events: none на <body> — страница
            // «мертвеет». Открываем диалог уже после того, как меню закрылось
            // и Radix попытался вернуть фокус (preventDefault — чтобы фокус не
            // прыгал на триггер меню за миг до того, как его перехватит диалог).
            if (nextDialog) {
              event.preventDefault();
              setOpenDialog(nextDialog);
              setNextDialog(null);
            }
          }}
        >
          <DropdownMenuItem onSelect={() => setNextDialog('transaction')}>
            Транзакция
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setNextDialog('category')}>Категория</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateTransactionDialog
        open={openDialog === 'transaction'}
        onOpenChange={(open) => setOpenDialog(open ? 'transaction' : null)}
        onRequestCategory={() => setOpenDialog('category')}
        onCreated={onTransactionCreated}
      />
      <CreateCategoryDialog
        open={openDialog === 'category'}
        onOpenChange={(open) => setOpenDialog(open ? 'category' : null)}
      />
    </>
  );
}
