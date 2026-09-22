/**
 * Месяц как целочисленная пара, без Date внутри. Вся арифметика (сдвиг, парсинг)
 * идёт через год*12+месяц — не нужно думать, в какой зоне «полночь».
 */
export interface MonthValue {
  year: number;
  /** 1–12, как в календаре, а не 0–11, как у Date. */
  month: number;
}

const MONTH_NAMES = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const;

const MONTH_PARAM_PATTERN = /^(\d{4})-(\d{2})$/;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Текущий месяц в UTC — та же зона, в которой посчитаны границы monthRange. */
export function currentMonth(): MonthValue {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/**
 * Целочисленный сдвиг месяца через общий индекс year*12+month — без Date и без
 * ловушки «31 января + 1 месяц». Работает в обе стороны, включая переход через
 * границу года.
 */
export function shiftMonth({ year, month }: MonthValue, delta: number): MonthValue {
  const index = year * 12 + (month - 1) + delta;
  const normalizedMonth = ((index % 12) + 12) % 12;
  const normalizedYear = Math.floor(index / 12);
  return { year: normalizedYear, month: normalizedMonth + 1 };
}

/** «Сентябрь 2026» — свой массив вместо Intl: month:'long' в ru-RU добавляет «г.». */
export function formatMonthTitle({ year, month }: MonthValue): string {
  return `${capitalize(MONTH_NAMES[month - 1]!)} ${year}`;
}

/**
 * Границы месяца для фильтра ленты — ровно то же самое, что API считает для
 * summary (Date.UTC(year, month-1, 1) / Date.UTC(year, month, 1)).
 */
export function monthRange({ year, month }: MonthValue): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    // dateTo уходит в lte на бэкенде (transactions.service.ts), поэтому это должна
    // быть последняя миллисекунда месяца, а не его начало: '2026-09-30' отрезало бы
    // всё, что случилось позже полуночи того дня.
    dateTo: new Date(Date.UTC(year, month, 1) - 1).toISOString(),
  };
}

/** '2026-09' → { year: 2026, month: 9 }. */
export function formatMonthParam({ year, month }: MonthValue): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * today аргументом, а не new Date() внутри — иначе поведение «по умолчанию
 * текущий месяц» зависело бы от дня запуска теста.
 */
export function parseMonthParam(raw: string | null | undefined, today: Date): MonthValue {
  if (raw) {
    const match = MONTH_PARAM_PATTERN.exec(raw);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) {
        return { year, month };
      }
    }
  }

  return { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 };
}
