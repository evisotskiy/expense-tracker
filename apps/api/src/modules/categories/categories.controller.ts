import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';
// Не `import type` (несмотря на то, что классы используются здесь только как типы параметров):
// `import type` стирает класс из design:paramtypes при emitDecoratorMetadata, и глобальный
// ZodValidationPipe перестаёт узнавать DTO по metatype — валидация тела запроса молча
// отключается. Подробности — в transactions.controller.ts, где баг обнаружен.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  // @Inject: см. common/guards/jwt-auth.guard.ts.
  constructor(@Inject(CategoriesService) private readonly categoriesService: CategoriesService) {}

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
