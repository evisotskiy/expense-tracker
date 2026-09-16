import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { type CategoriesService } from './categories.service';
import { type CreateCategoryDto, type UpdateCategoryDto } from './dto/category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Список категорий пользователя' })
  findAll(@CurrentUser('sub') userId: string) {
    return this.categoriesService.findAll(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать категорию' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Изменить категорию' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить категорию' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.categoriesService.remove(userId, id);
  }
}
