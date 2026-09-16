import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { type CreateExpenseDto, type ExpenseFiltersDto, type UpdateExpenseDto } from './dto/expense.dto';
import { type ExpensesService } from './expenses.service';

@ApiTags('expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

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
