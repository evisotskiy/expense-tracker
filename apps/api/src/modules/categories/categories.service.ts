import { Injectable } from '@nestjs/common';
import type { CreateCategoryInput, UpdateCategoryInput } from '@expense-tracker/shared';

import { type PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * userId приходит из токена и всегда участвует в where — это и есть изоляция данных
   * между пользователями. Отдельного «слоя прав» в приложении такого размера не нужно.
   */
  findAll(userId: string) {
    return this.prisma.client.category.findMany({
      where: { userId, isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  async create(_userId: string, _input: CreateCategoryInput) {
    throw new Error('Не реализовано');
  }

  async update(_userId: string, _id: string, _input: UpdateCategoryInput) {
    throw new Error('Не реализовано');
  }

  async remove(_userId: string, _id: string) {
    throw new Error('Не реализовано');
  }
}
