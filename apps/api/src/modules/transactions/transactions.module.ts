import { Module } from '@nestjs/common';

import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

/**
 * Модуль транзакций: лента доходов/расходов пользователя, CRUD и месячная сводка.
 *
 * `TransactionsService` экспортируется для переиспользования другими модулями
 * (например, будущим расчётом фактических трат по категории в бюджетах).
 */
@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
