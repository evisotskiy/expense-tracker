import { formatMoney, toMinorUnits, type TransactionSummary } from '@expense-tracker/shared';

import { cn } from '@/shared/lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

interface MonthSummaryProps {
  summary?: TransactionSummary;
  isLoading: boolean;
}

const CARD_SKELETON_KEYS = ['income', 'expense', 'balance'];

export function MonthSummary({ summary, isLoading }: MonthSummaryProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {CARD_SKELETON_KEYS.map((key) => (
          <Card key={key}>
            <CardHeader>
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Через целые копейки, а не Number(...): деньги остаются строками.
  const isNegativeBalance = toMinorUnits(summary.balance) < 0;

  return (
    <div className="grid gap-3">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Доходы</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(summary.totalIncome, summary.currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Расходы</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(summary.totalExpense, summary.currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Баланс</CardTitle>
          </CardHeader>
          <CardContent
            className={cn('text-2xl font-semibold', isNegativeBalance && 'text-destructive')}
          >
            {formatMoney(summary.balance, summary.currency)}
          </CardContent>
        </Card>
      </div>
      {/* Объясняет, почему сумма может не сойтись с лентой: сводка режет по
          baseCurrency пользователя, а лента показывает все валюты (риск 3 плана). */}
      <p className="text-sm text-muted-foreground">
        Суммы показаны в {summary.currency}: операции в других валютах в сводку не входят.
      </p>
    </div>
  );
}
