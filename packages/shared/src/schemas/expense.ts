import { z } from 'zod';

import { categorySchema } from './category';
import { currencySchema, idSchema, isoDateSchema, paginationQuerySchema } from './common';
import { moneyInputSchema, moneySchema } from './money';

/**
 * Дата траты.
 *
 * Будущие даты отклоняем: трекер фиксирует уже потраченное, а запись «вперёд» —
 * это почти всегда опечатка в годе. Запас в сутки оставлен под расхождение
 * часовых поясов между клиентом и сервером.
 */
const spentAtSchema = isoDateSchema.refine(
  (date) => date.getTime() <= Date.now() + 24 * 60 * 60 * 1000,
  { message: 'Дата траты не может быть в будущем' },
);

export const createExpenseSchema = z.object({
  amount: moneyInputSchema,
  currency: currencySchema,
  /// null означает «без категории» — это допустимое состояние, а не отсутствие поля.
  categoryId: idSchema.nullish(),
  note: z.string().trim().max(500, 'Заметка не длиннее 500 символов').nullish(),
  spentAt: spentAtSchema,
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseSchema = z.object({
  id: idSchema,
  amount: moneySchema,
  currency: currencySchema,
  categoryId: idSchema.nullable(),
  category: categorySchema.nullable(),
  note: z.string().nullable(),
  spentAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** Фильтры ленты расходов. Наследует курсорную пагинацию из common. */
export const expenseFiltersSchema = paginationQuerySchema.extend({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  categoryId: idSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

/** Агрегат для круговой диаграммы «на что уходят деньги». */
export const categoryBreakdownSchema = z.object({
  categoryId: idSchema.nullable(),
  categoryName: z.string(),
  categoryColor: z.string().nullable(),
  total: moneySchema,
  /// Доля в процентах, 0–100, округлённая до одного знака.
  share: z.number().min(0).max(100),
  count: z.number().int().nonnegative(),
});

/** Точка на графике динамики расходов. */
export const dailyTotalSchema = z.object({
  date: z.iso.date(),
  total: moneySchema,
});

/**
 * Input — то, что отправляет клиент (сумма числом или строкой, дата ISO-строкой).
 * Data — то, что получает сервер после валидации (сумма нормализована, дата уже Date).
 * Путать их нельзя: формы на фронтенде типизируются через Input, сервисы — через Data.
 */
export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type CreateExpenseData = z.output<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;
export type UpdateExpenseData = z.output<typeof updateExpenseSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;
export type CategoryBreakdown = z.infer<typeof categoryBreakdownSchema>;
export type DailyTotal = z.infer<typeof dailyTotalSchema>;
