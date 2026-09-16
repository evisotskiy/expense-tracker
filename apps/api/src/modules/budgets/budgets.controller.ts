import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { type BudgetsService } from './budgets.service';
import { type CreateBudgetDto, type UpdateBudgetDto } from './dto/budget.dto';

@ApiTags('budgets')
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'Бюджеты пользователя' })
  findAll(@CurrentUser('sub') userId: string) {
    return this.budgetsService.findAll(userId);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Бюджеты вместе с фактическими тратами за текущий период' })
  findProgress(@CurrentUser('sub') userId: string) {
    return this.budgetsService.findProgress(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать бюджет' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Изменить бюджет' })
  update(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: UpdateBudgetDto) {
    return this.budgetsService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить бюджет' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.budgetsService.remove(userId, id);
  }
}
