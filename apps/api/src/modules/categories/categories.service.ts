import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateCategoryInput, UpdateCategoryInput } from '@expense-tracker/shared';
// Не `import type`: нужен instanceof для распознавания P2002 при гонке на unique(userId, name).
import { Prisma } from '@expense-tracker/database';

import { PrismaService } from '../../prisma/prisma.service';

/** Ровно поля categorySchema: userId — деталь хранилища, клиенту он не нужен. */
const CATEGORY_SELECT = {
  id: true,
  name: true,
  icon: true,
  color: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

@Injectable()
export class CategoriesService {
  // @Inject: см. common/guards/jwt-auth.guard.ts.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * userId приходит из токена и всегда участвует в where — это и есть изоляция данных
   * между пользователями. Отдельного «слоя прав» в приложении такого размера не нужно.
   */
  findAll(userId: string) {
    return this.prisma.client.category.findMany({
      where: { userId, isArchived: false },
      orderBy: { name: 'asc' },
      select: CATEGORY_SELECT,
    });
  }

  /**
   * Предварительной проверки «занято ли имя» нет: это TOCTOU-гонка между SELECT
   * и INSERT, уникальный индекс @@unique([userId, name]) — единственный настоящий
   * арбитр (то же рассуждение, что в users.repository.ts).
   */
  async create(userId: string, input: CreateCategoryInput) {
    try {
      return await this.prisma.client.category.create({
        data: { userId, ...input },
        select: CATEGORY_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.reviveArchived(userId, input);
      }

      throw error;
    }
  }

  /**
   * findFirst с userId в where обязателен: update({ where: { id } }) без него
   * задел бы чужую категорию — id угадывается, userId в токене нет смысла проверять
   * отдельно.
   */
  async update(userId: string, id: string, input: UpdateCategoryInput) {
    const existing = await this.prisma.client.category.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Категория не найдена');
    }

    try {
      return await this.prisma.client.category.update({
        where: { id },
        data: input,
        select: CATEGORY_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Категория с таким названием уже есть');
      }

      throw error;
    }
  }

  /**
   * Мягкое удаление: Budget.categoryId имеет onDelete: Cascade, физическое удаление
   * категории безвозвратно снесло бы связанные бюджеты. updateMany, а не update —
   * только он позволяет отфильтровать по userId в одном запросе с id.
   */
  async remove(userId: string, id: string) {
    const { count } = await this.prisma.client.category.updateMany({
      where: { id, userId, isArchived: false },
      data: { isArchived: true },
    });

    if (count === 0) {
      throw new NotFoundException('Категория не найдена');
    }
  }

  /**
   * P2002 на @@unique([userId, name]) означает конфликт с уже существующей записью —
   * активной или архивной. Архивная не видна в findAll, поэтому для пользователя
   * это выглядит как свободное имя: восстанавливаем её с новыми icon/color вместо
   * того, чтобы вернуть 409 на пустом месте.
   */
  private async reviveArchived(userId: string, input: CreateCategoryInput) {
    const existing = await this.prisma.client.category.findUnique({
      where: { userId_name: { userId, name: input.name } },
    });

    if (!existing || !existing.isArchived) {
      throw new ConflictException('Категория с таким названием уже есть');
    }

    return this.prisma.client.category.update({
      where: { id: existing.id },
      data: { isArchived: false, icon: input.icon, color: input.color },
      select: CATEGORY_SELECT,
    });
  }
}
