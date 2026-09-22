import { describe, expect, it } from 'vitest';

import {
  currentMonth,
  formatMonthParam,
  formatMonthTitle,
  monthRange,
  parseMonthParam,
  shiftMonth,
} from './month';

describe('shiftMonth', () => {
  it('декабрь + 1 переходит на январь следующего года', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('январь - 1 переходит на декабрь предыдущего года', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('сдвиг на несколько месяцев вперёд и назад', () => {
    expect(shiftMonth({ year: 2026, month: 9 }, 5)).toEqual({ year: 2027, month: 2 });
    expect(shiftMonth({ year: 2026, month: 9 }, -11)).toEqual({ year: 2025, month: 10 });
  });
});

describe('monthRange', () => {
  it('февраль високосного года заканчивается 29 числом', () => {
    const { dateFrom, dateTo } = monthRange({ year: 2028, month: 2 });
    expect(dateFrom).toBe('2028-02-01T00:00:00.000Z');
    expect(dateTo).toBe('2028-02-29T23:59:59.999Z');
  });

  it('февраль невисокосного года заканчивается 28 числом', () => {
    const { dateTo } = monthRange({ year: 2026, month: 2 });
    expect(dateTo).toBe('2026-02-28T23:59:59.999Z');
  });

  it('dateTo — последняя миллисекунда месяца, а не его начало', () => {
    const { dateTo } = monthRange({ year: 2026, month: 9 });
    expect(dateTo.endsWith('T23:59:59.999Z')).toBe(true);
    expect(dateTo).toBe('2026-09-30T23:59:59.999Z');
  });

  it('декабрь корректно переносится в январь следующего года', () => {
    const { dateTo } = monthRange({ year: 2026, month: 12 });
    expect(dateTo).toBe('2026-12-31T23:59:59.999Z');
  });
});

describe('formatMonthTitle', () => {
  it('форматирует месяц и год без родительного падежа и без "г."', () => {
    expect(formatMonthTitle({ year: 2026, month: 9 })).toBe('Сентябрь 2026');
    expect(formatMonthTitle({ year: 2026, month: 1 })).toBe('Январь 2026');
  });
});

describe('formatMonthParam / parseMonthParam', () => {
  const today = new Date('2026-09-22T12:00:00.000Z');

  it('formatMonthParam дополняет месяц нулём', () => {
    expect(formatMonthParam({ year: 2026, month: 9 })).toBe('2026-09');
    expect(formatMonthParam({ year: 2026, month: 12 })).toBe('2026-12');
  });

  it('parseMonthParam разбирает корректную строку', () => {
    expect(parseMonthParam('2026-03', today)).toEqual({ year: 2026, month: 3 });
  });

  it('parseMonthParam откатывается на today при мусоре', () => {
    expect(parseMonthParam('не месяц', today)).toEqual({ year: 2026, month: 9 });
    expect(parseMonthParam('2026-13', today)).toEqual({ year: 2026, month: 9 });
    expect(parseMonthParam('2026-00', today)).toEqual({ year: 2026, month: 9 });
    expect(parseMonthParam('', today)).toEqual({ year: 2026, month: 9 });
    expect(parseMonthParam(null, today)).toEqual({ year: 2026, month: 9 });
    expect(parseMonthParam(undefined, today)).toEqual({ year: 2026, month: 9 });
  });
});

describe('currentMonth', () => {
  it('возвращает объект с year и month 1–12', () => {
    const value = currentMonth();
    expect(value.month).toBeGreaterThanOrEqual(1);
    expect(value.month).toBeLessThanOrEqual(12);
  });
});
