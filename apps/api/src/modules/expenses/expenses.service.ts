import { Inject, Injectable } from '@nestjs/common';
import {
  toMoneyString,
  type CreateExpenseData,
  type ExpenseFilters,
  type UpdateExpenseData,
} from '@expense-tracker/shared';
import type { Prisma } from '@expense-tracker/database';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  // @Inject: см. common/guards/jwt-auth.guard.ts.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Курсорная выборка: берём на одну запись больше лимита, чтобы понять,
   * есть ли следующая страница, без отдельного COUNT.
   */
  async findAll(userId: string, filters: ExpenseFilters) {
    const { cursor, limit, from, to, categoryId, search } = filters;

    const where: Prisma.ExpenseWhereInput = {
      userId,
      ...(categoryId ? { categoryId } : {}),
      ...(from || to
        ? { spentAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(search ? { note: { contains: search, mode: 'insensitive' } } : {}),
    };

    const rows = await this.prisma.client.expense.findMany({
      where,
      include: { category: true },
      orderBy: { spentAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const items = rows.slice(0, limit);

    return {
      items: items.map((item) => this.serialize(item)),
      nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async create(_userId: string, _input: CreateExpenseData) {
    throw new Error('Не реализовано');
  }

  async update(_userId: string, _id: string, _input: UpdateExpenseData) {
    throw new Error('Не реализовано');
  }

  async remove(_userId: string, _id: string) {
    throw new Error('Не реализовано');
  }

  /**
   * Prisma отдаёт amount объектом Decimal — JSON.stringify превратил бы его
   * в что-то неочевидное. Приводим к канонической строке на выходе из сервиса,
   * ровно как ожидает expenseSchema из @expense-tracker/shared.
   */
  private serialize<T extends { amount: Prisma.Decimal }>(expense: T) {
    return { ...expense, amount: toMoneyString(expense.amount) };
  }
}
