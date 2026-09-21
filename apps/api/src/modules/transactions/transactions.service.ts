import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  subtractMoney,
  sumMoney,
  toMoneyString,
  type CreateTransactionData,
  type TransactionFilters,
  type TransactionSummaryQuery,
  type UpdateTransactionData,
} from '@expense-tracker/shared';
// Не `import type`: нужен instanceof для распознавания P2003/P2025 при гонке на FK категории.
import { Prisma } from '@expense-tracker/database';

import { PrismaService } from '../../prisma/prisma.service';

/** Ровно поля transactionSchema: userId — деталь хранилища, клиенту он не нужен. */
const TRANSACTION_SELECT = {
  id: true,
  amount: true,
  type: true,
  currency: true,
  categoryId: true,
  description: true,
  date: true,
  createdAt: true,
  updatedAt: true,
  // Ровно поля categorySchema — те же, что CATEGORY_SELECT в categories.service.ts.
  category: {
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.TransactionSelect;

@Injectable()
export class TransactionsService {
  // @Inject: см. common/guards/jwt-auth.guard.ts.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Курсорная выборка: берём на одну запись больше лимита, чтобы понять,
   * есть ли следующая страница, без отдельного COUNT. id вторым ключом
   * сортировки — тай-брейкер: без него курсорная пагинация может задвоить
   * или пропустить запись при одинаковых date.
   */
  async findAll(userId: string, filters: TransactionFilters) {
    const { cursor, limit, dateFrom, dateTo, type, categoryId } = filters;

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(type ? { type } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(dateFrom || dateTo
        ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
    };

    const rows = await this.prisma.client.transaction.findMany({
      where,
      select: TRANSACTION_SELECT,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const items = rows.slice(0, limit);

    return {
      items: items.map((item) => this.serialize(item)),
      nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  /**
   * findFirst с userId, а не findUnique по id: чужая транзакция должна давать 404,
   * а не 403 — существование чужого id не подтверждаем.
   */
  async findOne(userId: string, id: string) {
    const row = await this.prisma.client.transaction.findFirst({
      where: { id, userId },
      select: TRANSACTION_SELECT,
    });

    if (!row) {
      throw new NotFoundException('Транзакция не найдена');
    }

    return this.serialize(row);
  }

  async create(userId: string, input: CreateTransactionData) {
    await this.assertCategoryUsable(userId, input.categoryId);

    try {
      const created = await this.prisma.client.transaction.create({
        data: { ...input, userId },
        select: TRANSACTION_SELECT,
      });

      return this.serialize(created);
    } catch (error) {
      throw this.normalizeCategoryError(error);
    }
  }

  async update(userId: string, id: string, input: UpdateTransactionData) {
    const existing = await this.prisma.client.transaction.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Транзакция не найдена');
    }

    // Категорию проверяем только когда её действительно меняют: при PATCH { amount }
    // лишний запрос ни к чему.
    if (input.categoryId !== undefined) {
      await this.assertCategoryUsable(userId, input.categoryId);
    }

    try {
      const updated = await this.prisma.client.transaction.update({
        where: { id },
        data: input,
        select: TRANSACTION_SELECT,
      });

      return this.serialize(updated);
    } catch (error) {
      throw this.normalizeCategoryError(error);
    }
  }

  /**
   * Удаление физическое: в отличие от категорий, на транзакции никто не ссылается.
   * deleteMany, а не delete — только он позволяет отфильтровать по userId
   * в одном запросе с id (то же рассуждение, что в CategoriesService.remove).
   */
  async remove(userId: string, id: string) {
    const { count } = await this.prisma.client.transaction.deleteMany({
      where: { id, userId },
    });

    if (count === 0) {
      throw new NotFoundException('Транзакция не найдена');
    }
  }

  async summary(userId: string, query: TransactionSummaryQuery) {
    const { month, year } = query;

    // Date.UTC сам переносит 12-й месяц в январь следующего года.
    // new Date(year, month - 1, 1) сюда не годится: он строит полночь в зоне
    // процесса, а колонка date хранит UTC — границы поехали бы на смещение TZ сервера.
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    // Суммировать RUB с USD в один totalIncome — численная ложь, а курсов в проекте
    // нет. Считаем в базовой валюте пользователя и явно возвращаем её в ответе.
    const { baseCurrency } = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { baseCurrency: true },
    });

    const where: Prisma.TransactionWhereInput = {
      userId,
      currency: baseCurrency,
      date: { gte: start, lt: end },
    };

    const rows = await this.prisma.client.transaction.groupBy({
      by: ['categoryId', 'type'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    const categoryIds = [...new Set(rows.map((row) => row.categoryId))];

    // isArchived не фильтруем: у архивной категории остаются транзакции, и без её
    // имени разбивка показала бы сумму без подписи.
    const categories = categoryIds.length
      ? await this.prisma.client.category.findMany({
          where: { id: { in: categoryIds }, userId },
          select: { id: true, name: true, color: true },
        })
      : [];
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    const totalsByType = (type: 'INCOME' | 'EXPENSE') =>
      sumMoney(
        rows.filter((row) => row.type === type).map((row) => toMoneyString(row._sum.amount ?? 0)),
      );

    const totalIncome = totalsByType('INCOME');
    const totalExpense = totalsByType('EXPENSE');

    return {
      currency: baseCurrency,
      month,
      year,
      totalIncome,
      totalExpense,
      balance: subtractMoney(totalIncome, totalExpense),
      categories: rows.map((row) => ({
        categoryId: row.categoryId,
        categoryName: categoryById.get(row.categoryId)?.name ?? '',
        categoryColor: categoryById.get(row.categoryId)?.color ?? null,
        type: row.type,
        total: toMoneyString(row._sum.amount ?? 0),
        count: row._count._all,
      })),
    };
  }

  /**
   * FK проверяет только существование категории, но не владельца: без этой проверки
   * чужой cuid в теле запроса повесил бы транзакцию на чужую категорию, и она
   * всплыла бы в сводке.
   */
  private async assertCategoryUsable(userId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.client.category.findFirst({
      where: { id: categoryId, userId },
      select: { isArchived: true },
    });

    // 404, а не 403: чужая категория для этого пользователя не существует — иначе
    // ответ подтверждал бы, что такой id есть у кого-то другого.
    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }

    // Архивная категория принадлежит пользователю, но выбирать её больше нельзя —
    // это ошибка ввода, а не «не найдено».
    if (category.isArchived) {
      throw new BadRequestException('Категория архивирована — выберите другую');
    }
  }

  /**
   * Страховка от гонки между assertCategoryUsable и записью (категорию успели
   * заархивировать физическим удалением между проверкой и вставкой). Голый
   * PrismaClientKnownRequestError — не HttpException, AllExceptionsFilter отдал бы
   * на него 500 вместо внятного ответа, поэтому catch обязателен даже здесь.
   */
  private normalizeCategoryError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2003' || error.code === 'P2025')
    ) {
      return new NotFoundException('Категория не найдена');
    }

    return error;
  }

  /**
   * Prisma отдаёт amount объектом Decimal — JSON.stringify превратил бы его
   * в что-то неочевидное. Приводим к канонической строке на выходе из сервиса,
   * ровно как ожидает transactionSchema из @expense-tracker/shared.
   */
  private serialize<T extends { amount: Prisma.Decimal }>(transaction: T) {
    return { ...transaction, amount: toMoneyString(transaction.amount) };
  }
}
