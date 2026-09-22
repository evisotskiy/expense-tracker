import { Skeleton } from '@/shared/ui/skeleton';

const SKELETON_ROWS = Array.from({ length: 10 }, (_, index) => index);

export function TransactionFeedSkeleton() {
  return (
    <ul className="grid gap-3" aria-hidden="true">
      {SKELETON_ROWS.map((key) => (
        <li key={key} className="flex items-center gap-3">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-16" />
        </li>
      ))}
    </ul>
  );
}
