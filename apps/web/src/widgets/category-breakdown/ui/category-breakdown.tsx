import { formatMoney, type TransactionSummary } from '@expense-tracker/shared';

import { ColorDot } from '@/shared/ui/color-dot';
import { Skeleton } from '@/shared/ui/skeleton';

import { topCategories } from '../lib/top-categories';

interface CategoryBreakdownProps {
  summary?: TransactionSummary;
  isLoading: boolean;
}

export function CategoryBreakdown({ summary, isLoading }: CategoryBreakdownProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const rows = topCategories(summary.categories, 'EXPENSE');

  return (
    <div className="grid gap-3">
      <h3 className="font-semibold">Расходы по категориям</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">За этот месяц расходов ещё нет.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.categoryId} className="flex items-center gap-3">
              <ColorDot color={row.categoryColor} />
              <span className="min-w-0 flex-1 truncate">{row.categoryName}</span>
              <span className="text-sm text-muted-foreground">{Math.round(row.share * 100)}%</span>
              <span className="font-medium tabular-nums">
                {formatMoney(row.total, summary.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
