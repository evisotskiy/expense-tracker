'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  currentMonth,
  formatMonthTitle,
  shiftMonth,
  type MonthValue,
} from '@/shared/lib/date/month';
import { Button } from '@/shared/ui/button';

interface MonthSwitcherProps {
  value: MonthValue;
  onChange: (value: MonthValue) => void;
}

export function MonthSwitcher({ value, onChange }: MonthSwitcherProps) {
  const current = currentMonth();
  // Индекс год*12+месяц — тот же приём, что в shiftMonth: дальше текущего месяца
  // уйти нельзя, будущие даты схема транзакций всё равно не примет.
  const isAtOrAfterCurrent = value.year * 12 + value.month >= current.year * 12 + current.month;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Предыдущий месяц"
        onClick={() => onChange(shiftMonth(value, -1))}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <h2 aria-live="polite" className="min-w-44 text-center text-lg font-semibold">
        {formatMonthTitle(value)}
      </h2>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Следующий месяц"
        disabled={isAtOrAfterCurrent}
        onClick={() => onChange(shiftMonth(value, 1))}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
