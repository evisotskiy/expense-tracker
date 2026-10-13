import {
  createTransactionSchema,
  transactionFiltersSchema,
  transactionSummaryQuerySchema,
  updateTransactionSchema,
} from '@expense-tracker/shared';
import { createZodDto } from 'nestjs-zod';

/** Тело запроса на создание транзакции — валидация и Swagger-модель из `createTransactionSchema`. */
export class CreateTransactionDto extends createZodDto(createTransactionSchema) {}

/** Тело запроса на частичное изменение транзакции (PATCH) — поля `createTransactionSchema`, все опциональны. */
export class UpdateTransactionDto extends createZodDto(updateTransactionSchema) {}

/** Query-параметры ленты транзакций: курсорная пагинация и фильтры по дате/типу/категории. */
export class TransactionFiltersDto extends createZodDto(transactionFiltersSchema) {}

/** Query-параметры месячной сводки — обязательные `month` и `year`, без значений по умолчанию. */
export class TransactionSummaryQueryDto extends createZodDto(transactionSummaryQuerySchema) {}
