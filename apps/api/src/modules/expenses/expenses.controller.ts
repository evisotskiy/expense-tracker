import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { type CreateExpenseDto, type ExpenseFiltersDto, type UpdateExpenseDto } from './dto/expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@Controller('expenses')
export class ExpensesController {
  // @Inject: ExpensesService используется здесь только как тип параметра, а при
  // emitDecoratorMetadata это стирает класс из design:paramtypes (design:paramtypes
  // получил бы global Function вместо класса) — подробности в
  // common/guards/jwt-auth.guard.ts. Тот же фикс применён во всех модулях ниже.
  constructor(@Inject(ExpensesService) private readonly expensesService: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'Лента расходов с фильтрами и курсорной пагинацией' })
  findAll(@CurrentUser('sub') userId: string, @Query() filters: ExpenseFiltersDto) {
    return this.expensesService.findAll(userId, filters);
  }

  @Post()
  @ApiOperation({ summary: 'Добавить расход' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Изменить расход' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить расход' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.expensesService.remove(userId, id);
  }
}
