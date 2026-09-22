import { formatMoney, type Transaction } from '@expense-tracker/shared';
import type { ReactNode } from 'react';

import { formatTransactionDate } from '@/shared/lib/date/format-date';
import { cn } from '@/shared/lib/cn';
import { ColorDot } from '@/shared/ui/color-dot';

interface TransactionItemProps {
  transaction: Transaction;
  /** Кнопка удаления — слот, entity не имеет права импортировать фичу. */
  action?: ReactNode;
}

export function TransactionItem({ transaction, action }: TransactionItemProps) {
  const isIncome = transaction.type === 'INCOME';
  const amount = formatMoney(transaction.amount, transaction.currency);
  // Дата форматируется в UTC (formatTransactionDate): сохранённая как UTC-полночь,
  // у пользователя в UTC−5 она иначе показалась бы предыдущим днём.
  const date = formatTransactionDate(transaction.date);

  return (
    <div className="flex items-center gap-3 py-3">
      <ColorDot color={transaction.category.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{transaction.category.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {transaction.description ? `${transaction.description} · ${date}` : date}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 font-medium tabular-nums',
          isIncome ? 'text-primary' : 'text-foreground',
        )}
      >
        {isIncome ? '+' : '−'}
        {amount}
      </span>
      {action}
    </div>
  );
}
