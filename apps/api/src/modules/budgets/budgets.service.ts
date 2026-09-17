import { Inject, Injectable } from '@nestjs/common';
import {
  toMoneyString,
  type CreateBudgetData,
  type UpdateBudgetData,
} from '@expense-tracker/shared';
import type { Prisma } from '@expense-tracker/database';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BudgetsService {
  // @Inject: см. common/guards/jwt-auth.guard.ts.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const rows = await this.prisma.client.budget.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({ ...row, amount: toMoneyString(row.amount) }));
  }

  async create(_userId: string, _input: CreateBudgetData) {
    throw new Error('Не реализовано');
  }

  async update(_userId: string, _id: string, _input: UpdateBudgetData) {
    throw new Error('Не реализовано');
  }

  async remove(_userId: string, _id: string) {
    throw new Error('Не реализовано');
  }

  /**
   * Прогресс по бюджетам: сколько потрачено в текущем периоде.
   * Границы периода даёт budgetPeriodRange из @expense-tracker/shared —
   * одна и та же функция считает их и здесь, и на фронтенде.
   */
  async findProgress(_userId: string): Promise<Prisma.BudgetGetPayload<object>[]> {
    throw new Error('Не реализовано');
  }
}
