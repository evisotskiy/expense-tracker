import { z } from 'zod';

import { CURRENCY_FRACTION_DIGITS, type SupportedCurrency } from '../constants/currencies';

/**
 * Денежные суммы ходят по сети строками, а не числами.
 *
 * В базе это Decimal(12, 2) — точная десятичная арифметика Postgres.
 * Если отдавать такую сумму как JSON-число, она проходит через IEEE-754 double,
 * и 1234.56 может вернуться как 1234.5599999999999. Строка переживает
 * сериализацию без потерь, а разбирает её тот, кому нужна арифметика.
 */

/** Максимум для Decimal(12, 2): 10 цифр до запятой и 2 после. */
export const MONEY_MAX = 9_999_999_999.99;

/** Нормализованный вид: всегда ровно два знака после запятой, без знака и пробелов. */
const NORMALIZED_MONEY = /^\d{1,10}\.\d{2}$/;

/**
 * Что готовы принять на входе: "1234.5", "1234,50", ".5", 1234.5.
 * Количество цифр до запятой здесь не ограничено намеренно — иначе слишком
 * большая сумма получила бы сообщение «некорректная сумма» вместо «превышает максимум».
 */
const ACCEPTED_MONEY = /^(?=.*\d)\d*[.,]?\d{0,2}$/;

/**
 * Сумма в ответах API. Всегда строка канонического вида "1234.56".
 */
export const moneySchema = z
  .string()
  .regex(NORMALIZED_MONEY, 'Сумма должна быть строкой вида "1234.56"');

/**
 * Сумма во входящих данных.
 *
 * Принимает число или строку (в том числе с запятой — так её вводят
 * на русской раскладке), отдаёт канонический вид "1234.56".
 */
export const moneyInputSchema = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === 'number' ? String(value) : value.trim()))
  .refine((value) => ACCEPTED_MONEY.test(value), {
    message: 'Некорректная сумма: ожидается число не более чем с двумя знаками после запятой',
  })
  .transform((value) => value.replace(',', '.'))
  .refine((value) => Number(value) > 0, { message: 'Сумма должна быть больше нуля' })
  .refine((value) => Number(value) <= MONEY_MAX, {
    message: `Сумма не может превышать ${MONEY_MAX}`,
  })
  .transform(normalizeMoney);

export type Money = z.infer<typeof moneySchema>;

/** То же, что NORMALIZED_MONEY, но допускает ведущий минус. */
const NORMALIZED_SIGNED_MONEY = /^-?\d{1,10}\.\d{2}$/;

/**
 * Сумма, которая может быть отрицательной: баланс за период, остаток бюджета.
 * Отдельно от moneySchema намеренно: иначе "-100.00" молча прошёл бы валидацию
 * в поле amount при создании расхода.
 */
export const signedMoneySchema = z
  .string()
  .regex(NORMALIZED_SIGNED_MONEY, 'Сумма должна быть строкой вида "1234.56" или "-1234.56"')
  .refine((value) => value !== '-0.00', { message: 'Ноль записывается без знака' });

export type SignedMoney = z.infer<typeof signedMoneySchema>;

/**
 * Приводит сумму к виду "1234.56".
 *
 * Дополняется строка, а не число: toFixed(2) на больших значениях уже
 * работает через double и способен потерять последнюю копейку.
 */
export function normalizeMoney(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  // whole может быть пустым при вводе вида ".50" — тогда целая часть это ноль
  return `${whole || '0'}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

/**
 * Превращает Decimal из Prisma (или строку/число) в каноническую строку.
 * Prisma возвращает объект с методом toFixed — этого достаточно, поэтому
 * пакет не тянет зависимость от decimal.js ради одного типа.
 */
export function toMoneyString(
  value: { toFixed(digits: number): string } | string | number,
): string {
  if (typeof value === 'string') {
    return normalizeMoney(value);
  }

  if (typeof value === 'number') {
    return normalizeMoney(String(value));
  }

  return value.toFixed(2);
}

/**
 * Сумма в минорных единицах — нужна для арифметики без потери копеек.
 *
 * Знак разбирается отдельно от цифр: "-123.45" — это не Number("-123") + Number("45"),
 * иначе минус применился бы только к целой части и копейки прибавлялись бы, а не вычитались.
 */
export function toMinorUnits(value: string): number {
  const normalized = normalizeMoney(value);
  const negative = normalized.startsWith('-');
  const [whole = '0', fraction = '00'] = (negative ? normalized.slice(1) : normalized).split('.');
  const minor = Number(whole) * 100 + Number(fraction);
  return negative ? -minor : minor;
}

export function fromMinorUnits(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(minor));
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

/** Сложение сумм без плавающей точки: складываем копейки, а не рубли. */
export function sumMoney(values: readonly string[]): string {
  return fromMinorUnits(values.reduce((total, value) => total + toMinorUnits(value), 0));
}

/** Разность сумм без плавающей точки; результат может быть отрицательным. */
export function subtractMoney(minuend: string, subtrahend: string): string {
  return fromMinorUnits(toMinorUnits(minuend) - toMinorUnits(subtrahend));
}

/** Человекочитаемый вид для интерфейса: "1 234,56 ₽". */
export function formatMoney(value: string, currency: SupportedCurrency, locale = 'ru-RU'): string {
  const digits = CURRENCY_FRACTION_DIGITS[currency];

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}
