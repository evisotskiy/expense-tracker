import { z } from 'zod';

import { categorySchema } from './category';
import { currencySchema, idSchema, isoDateSchema, paginationQuerySchema } from './common';
import { moneyInputSchema, moneySchema, signedMoneySchema } from './money';

/// Объявлена независимо от Prisma-enum: shared не зависит от @expense-tracker/database,
/// и фронтенд не должен тянуть Prisma-клиент ради двух строк.
export const transactionTypeSchema = z.enum(['INCOME', 'EXPENSE']);

/**
 * Дата операции.
 *
 * Будущие даты отклоняем: трекер фиксирует уже случившееся, а запись «вперёд» —
 * почти всегда опечатка в годе. Запас в сутки оставлен под расхождение
 * часовых поясов между клиентом и сервером.
 */
const transactionDateSchema = isoDateSchema.refine(
  (date) => date.getTime() <= Date.now() + 24 * 60 * 60 * 1000,
  { message: 'Дата операции не может быть в будущем' },
);

export const createTransactionSchema = z.object({
  amount: moneyInputSchema,
  type: transactionTypeSchema,
  currency: currencySchema,
  /// Обязательна: без категории транзакция не попадает ни в одну строку отчёта.
  categoryId: idSchema,
  description: z.string().trim().max(500, 'Описание не длиннее 500 символов').nullish(),
  date: transactionDateSchema,
});

/** Частичное обновление: PATCH, а не PUT. .partial() работает — refine висит на поле date. */
export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionSchema = z.object({
  id: idSchema,
  amount: moneySchema,
  type: transactionTypeSchema,
  currency: currencySchema,
  categoryId: idSchema,
  category: categorySchema,
  description: z.string().nullable(),
  date: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** Фильтры ленты. Имена dateFrom/dateTo — из ТЗ; пагинация курсорная, как везде в проекте. */
export const transactionFiltersSchema = paginationQuerySchema.extend({
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  type: transactionTypeSchema.optional(),
  categoryId: idSchema.optional(),
});

/**
 * Месяц и год сводки — оба обязательные (по ТЗ), без значений по умолчанию:
 * «сводка за текущий месяц» должна быть явным выбором клиента, иначе ответ
 * молча меняется на границе месяца.
 * z.coerce — query приходит строками (тот же приём, что у limit в paginationQuerySchema).
 */
export const transactionSummaryQuerySchema = z.object({
  month: z.coerce.number().int().min(1, 'Месяц от 1 до 12').max(12, 'Месяц от 1 до 12'),
  // Верхняя граница не формальность: Date.UTC(1000000, 0, 1) даёт Invalid Date,
  // и Prisma уронит запрос невнятной ошибкой сериализации вместо честного 400.
  year: z.coerce.number().int().min(1970).max(2100),
});

/** Строка разбивки сводки: сколько и по какой категории прошло за месяц. */
export const transactionCategorySummarySchema = z.object({
  categoryId: idSchema,
  categoryName: z.string(),
  categoryColor: z.string().nullable(),
  type: transactionTypeSchema,
  total: moneySchema,
  count: z.number().int().nonnegative(),
});

export const transactionSummarySchema = z.object({
  /// Валюта отчёта: суммы в других валютах в него не входят — курсов в приложении нет.
  currency: currencySchema,
  month: z.number().int(),
  year: z.number().int(),
  totalIncome: moneySchema,
  totalExpense: moneySchema,
  /// Может быть отрицательным — отсюда signedMoneySchema, а не moneySchema.
  balance: signedMoneySchema,
  categories: z.array(transactionCategorySummarySchema),
});

/**
 * Input — то, что отправляет клиент (сумма числом или строкой, дата ISO-строкой).
 * Data — то, что получает сервер после валидации (сумма нормализована, дата уже Date).
 */
export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type CreateTransactionData = z.output<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;
export type UpdateTransactionData = z.output<typeof updateTransactionSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type TransactionSummaryQuery = z.infer<typeof transactionSummaryQuerySchema>;
export type TransactionCategorySummary = z.infer<typeof transactionCategorySummarySchema>;
export type TransactionSummary = z.infer<typeof transactionSummarySchema>;
