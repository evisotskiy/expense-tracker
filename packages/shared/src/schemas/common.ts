import { z } from 'zod';

import { SUPPORTED_CURRENCIES } from '../constants/currencies';

/** cuid(), который генерирует Prisma. */
export const idSchema = z.cuid();

export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

/**
 * Дата во входящих данных.
 *
 * Принимает ISO-строку («2026-09-15T10:00:00Z» или «2026-09-15») и отдаёт Date.
 * Именно строка, а не z.coerce.date(): Swagger-документ строится через
 * z.toJSONSchema(), а тип Date в JSON Schema не представим — сборка падает
 * с «Date cannot be represented in JSON Schema». Строка описывается честно,
 * а преобразование остаётся на стороне сервера.
 */
export const isoDateSchema = z
  .union([z.iso.datetime({ offset: true }), z.iso.date()])
  .transform((value) => new Date(value));

/**
 * Курсорная пагинация, а не offset: список расходов постоянно пополняется сверху,
 * и при offset-пагинации записи «сползают» между страницами.
 */
export const paginationQuerySchema = z.object({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/** Форма ошибки, которую отдаёт глобальный exception filter на бэкенде. */
export const apiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
  path: z.string(),
  timestamp: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
