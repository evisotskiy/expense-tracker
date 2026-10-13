import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
// Не `import type` (несмотря на то, что классы используются здесь только как типы
// параметров): `import type` стирает класс из design:paramtypes при emitDecoratorMetadata,
// и глобальный ZodValidationPipe перестаёт узнавать DTO по metatype — валидация тела
// запроса молча отключается. Тот же приём — в auth/categories/budgets контроллерах.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateTransactionDto,
  TransactionFiltersDto,
  TransactionSummaryQueryDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

/**
 * HTTP-слой транзакций: эндпоинты требуют JWT (глобальный `JwtAuthGuard`),
 * вся логика и исключения — в `TransactionsService`.
 */
@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  // @Inject: см. common/guards/jwt-auth.guard.ts.
  constructor(
    @Inject(TransactionsService) private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * `GET /transactions` — лента транзакций пользователя.
   *
   * @param userId - id текущего пользователя из access-токена.
   * @param filters - курсор, лимит и фильтры по дате/типу/категории.
   * @returns Страница транзакций (`items`) и курсор следующей страницы (`nextCursor`).
   */
  @Get()
  @ApiOperation({ summary: 'Лента транзакций с фильтрами и курсорной пагинацией' })
  findAll(@CurrentUser('sub') userId: string, @Query() filters: TransactionFiltersDto) {
    return this.transactionsService.findAll(userId, filters);
  }

  // Объявлено до @Get(':id'): Nest сопоставляет маршруты в порядке объявления,
  // и при обратном порядке /transactions/summary ушёл бы в findOne с id = "summary".
  /**
   * `GET /transactions/summary` — сводка за месяц.
   *
   * @param userId - id текущего пользователя из access-токена.
   * @param query - месяц и год сводки (оба обязательны).
   * @returns Доходы/расходы/баланс в базовой валюте пользователя и разбивку по категориям.
   */
  @Get('summary')
  @ApiOperation({ summary: 'Сводка за месяц: доходы, расходы, баланс и разбивка по категориям' })
  summary(@CurrentUser('sub') userId: string, @Query() query: TransactionSummaryQueryDto) {
    return this.transactionsService.summary(userId, query);
  }

  /**
   * `GET /transactions/:id` — одна транзакция.
   *
   * @param userId - id текущего пользователя из access-токена.
   * @param id - id транзакции.
   * @returns Транзакция с развёрнутой категорией.
   * @throws NotFoundException если транзакция не найдена или принадлежит другому пользователю.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Одна транзакция' })
  findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.transactionsService.findOne(userId, id);
  }

  /**
   * `POST /transactions` — создать транзакцию.
   *
   * @param userId - id текущего пользователя из access-токена.
   * @param dto - сумма, тип, валюта, категория, дата и необязательное описание.
   * @returns Созданная транзакция с развёрнутой категорией.
   * @throws NotFoundException если категория не найдена или принадлежит другому пользователю.
   * @throws BadRequestException если категория архивирована.
   */
  @Post()
  @ApiOperation({ summary: 'Создать транзакцию' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(userId, dto);
  }

  /**
   * `PATCH /transactions/:id` — изменить транзакцию.
   *
   * @param userId - id текущего пользователя из access-токена.
   * @param id - id транзакции.
   * @param dto - частичный набор полей для изменения.
   * @returns Обновлённая транзакция с развёрнутой категорией.
   * @throws NotFoundException если транзакция не найдена, либо (при смене категории)
   * если новая категория не найдена или принадлежит другому пользователю.
   * @throws BadRequestException если новая категория архивирована.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Изменить транзакцию' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(userId, id, dto);
  }

  /**
   * `DELETE /transactions/:id` — удалить транзакцию.
   *
   * @param userId - id текущего пользователя из access-токена.
   * @param id - id транзакции.
   * @returns Ничего (пустое тело, статус 200 — по умолчанию для Nest без `@HttpCode`).
   * @throws NotFoundException если транзакция не найдена или принадлежит другому пользователю.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Удалить транзакцию' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.transactionsService.remove(userId, id);
  }
}
