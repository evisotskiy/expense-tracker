import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
// Не `import type` (несмотря на то, что классы используются здесь только как типы
// параметров): `import type` стирает класс из design:paramtypes при emitDecoratorMetadata,
// и глобальный ZodValidationPipe перестаёт узнавать DTO по metatype — валидация тела
// запроса молча отключается (баг воспроизводится и в остальных контроллерах проекта,
// импортирующих DTO как type; см. отчёт по этой задаче).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateTransactionDto,
  TransactionFiltersDto,
  TransactionSummaryQueryDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  // @Inject: см. common/guards/jwt-auth.guard.ts.
  constructor(
    @Inject(TransactionsService) private readonly transactionsService: TransactionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Лента транзакций с фильтрами и курсорной пагинацией' })
  findAll(@CurrentUser('sub') userId: string, @Query() filters: TransactionFiltersDto) {
    return this.transactionsService.findAll(userId, filters);
  }

  // Объявлено до @Get(':id'): Nest сопоставляет маршруты в порядке объявления,
  // и при обратном порядке /transactions/summary ушёл бы в findOne с id = "summary".
  @Get('summary')
  @ApiOperation({ summary: 'Сводка за месяц: доходы, расходы, баланс и разбивка по категориям' })
  summary(@CurrentUser('sub') userId: string, @Query() query: TransactionSummaryQueryDto) {
    return this.transactionsService.summary(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Одна транзакция' })
  findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.transactionsService.findOne(userId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать транзакцию' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Изменить транзакцию' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить транзакцию' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.transactionsService.remove(userId, id);
  }
}
