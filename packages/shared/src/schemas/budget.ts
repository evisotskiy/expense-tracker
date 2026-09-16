import { z } from 'zod';

import { categorySchema } from './category';
import { currencySchema, idSchema, isoDateSchema } from './common';
import { moneyInputSchema, moneySchema } from './money';

export const budgetPeriodSchema = z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']);

export type BudgetPeriod = z.infer<typeof budgetPeriodSchema>;

export const createBudgetSchema = z
  .object({
    amount: moneyInputSchema,
    currency: currencySchema,
    /// null = общий лимит на все расходы.
    categoryId: idSchema.nullish(),
    period: budgetPeriodSchema.default('MONTHLY'),
    startsAt: isoDateSchema,
    endsAt: isoDateSchema.nullish(),
  })
  .refine((data) => !data.endsAt || data.endsAt > data.startsAt, {
    message: 'Дата окончания должна быть позже даты начала',
    path: ['endsAt'],
  });

/** Нельзя .partial() поверх объекта с .refine(), поэтому берём исходную форму. */
export const updateBudgetSchema = z
  .object({
    amount: moneyInputSchema,
    currency: currencySchema,
    categoryId: idSchema.nullish(),
    period: budgetPeriodSchema,
    startsAt: isoDateSchema,
    endsAt: isoDateSchema.nullish(),
  })
  .partial();

export const budgetSchema = z.object({
  id: idSchema,
  amount: moneySchema,
  currency: currencySchema,
  categoryId: idSchema.nullable(),
  category: categorySchema.nullable(),
  period: budgetPeriodSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** Бюджет вместе с фактом: сколько уже потрачено в текущем периоде. */
export const budgetProgressSchema = budgetSchema.extend({
  spent: moneySchema,
  remaining: moneySchema,
  /// Может превышать 100, если бюджет перерасходован — это важная информация, не ошибка.
  usedPercent: z.number().min(0),
  periodStart: z.iso.datetime(),
  periodEnd: z.iso.datetime(),
});

/** Input — данные от клиента, Data — они же после валидации (см. expense.ts). */
export type CreateBudgetInput = z.input<typeof createBudgetSchema>;
export type CreateBudgetData = z.output<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.input<typeof updateBudgetSchema>;
export type UpdateBudgetData = z.output<typeof updateBudgetSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type BudgetProgress = z.infer<typeof budgetProgressSchema>;

/** Границы одного периода бюджета: [start, end). */
export interface PeriodRange {
  start: Date;
  end: Date;
}

/**
 * Возвращает границы периода бюджета, в который попадает `reference`.
 *
 * Периоды не хранятся в базе — они вычисляются на лету. Эту функцию используют
 * и бэкенд (чтобы просуммировать расходы за период), и фронтенд (чтобы подписать
 * карточку бюджета), поэтому она живёт в shared: разойдись они хоть на день,
 * пользователь увидел бы «потрачено 12 000 из 10 000» там, где уложился в лимит.
 *
 * Периоды выровнены по календарю: месяц идёт с 1-го числа, неделя — с понедельника,
 * год — с 1 января. `startsAt` задаёт только момент, с которого бюджет действует,
 * но не сдвигает сетку периодов. Так думает о «расходах за месяц» большинство людей,
 * и так же приходит зарплата — привязка к произвольной дате начала давала бы
 * «октябрь», который на самом деле идёт с 15 октября по 15 ноября.
 *
 * Границы полуинтервальные: [start, end). Расход ровно в полночь попадает
 * в начинающийся период, а не в два сразу.
 *
 * Считаем в UTC: в базе DateTime хранится в UTC, и сравнение spentAt с границами
 * должно идти в той же шкале. Для пользователей в одной зоне этого достаточно;
 * при поддержке нескольких зон сюда придёт таймзона пользователя.
 */
export function budgetPeriodRange(
  period: BudgetPeriod,
  startsAt: Date,
  reference: Date = new Date(),
): PeriodRange {
  // До начала бюджета показываем его первый период, а не пустой интервал в прошлом.
  const anchor = reference.getTime() < startsAt.getTime() ? startsAt : reference;

  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const day = anchor.getUTCDate();

  switch (period) {
    case 'WEEKLY': {
      // getUTCDay(): 0 — воскресенье. Сдвигаем так, чтобы неделя начиналась с понедельника.
      const weekdayFromMonday = (anchor.getUTCDay() + 6) % 7;

      return {
        // Date.UTC сам разбирается с переходом через границу месяца при отрицательном дне
        start: new Date(Date.UTC(year, month, day - weekdayFromMonday)),
        end: new Date(Date.UTC(year, month, day - weekdayFromMonday + 7)),
      };
    }

    case 'MONTHLY': {
      // month + 1 === 12 корректно превращается в январь следующего года
      return {
        start: new Date(Date.UTC(year, month, 1)),
        end: new Date(Date.UTC(year, month + 1, 1)),
      };
    }

    case 'YEARLY': {
      return {
        start: new Date(Date.UTC(year, 0, 1)),
        end: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    default: {
      // Если в BudgetPeriod добавят значение, компилятор укажет на эту строку
      const exhaustive: never = period;
      throw new Error(`Неизвестный период бюджета: ${String(exhaustive)}`);
    }
  }
}

/** Попадает ли момент в период: [start, end). */
export function isWithinPeriod(date: Date, { start, end }: PeriodRange): boolean {
  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}
