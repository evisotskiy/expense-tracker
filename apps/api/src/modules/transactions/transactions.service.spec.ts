import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@expense-tracker/database';

import { type PrismaService } from '../../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

/** Реальный экземпляр, а не заглушка: сервис распознаёт код ошибки через instanceof. */
function p2003() {
  return new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
    code: 'P2003',
    clientVersion: '7.10.0',
  });
}

/** Мок Decimal из Prisma — toMoneyString требует только метод toFixed. */
function decimal(value: string) {
  return { toFixed: () => value };
}

describe('TransactionsService', () => {
  const transaction = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  };
  const category = { findFirst: jest.fn(), findMany: jest.fn() };
  const user = { findUniqueOrThrow: jest.fn() };
  const prisma = { client: { transaction, category, user } } as unknown as PrismaService;
  let service: TransactionsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new TransactionsService(prisma);
  });

  describe('findAll', () => {
    it('фильтрует по userId и сортирует по дате с id как тай-брейкером', async () => {
      transaction.findMany.mockResolvedValue([]);

      await service.findAll('user_1', { limit: 20 });

      expect(transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user_1' },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: 21,
        }),
      );
    });

    it('добавляет dateFrom/dateTo/type/categoryId в where только когда они переданы', async () => {
      transaction.findMany.mockResolvedValue([]);

      await service.findAll('user_1', {
        limit: 20,
        dateFrom: new Date('2026-09-01'),
        dateTo: new Date('2026-09-30'),
        type: 'EXPENSE',
        categoryId: 'cat_1',
      });

      expect(transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user_1',
            type: 'EXPENSE',
            categoryId: 'cat_1',
            date: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') },
          },
        }),
      );
    });

    it('берёт на одну запись больше лимита и отдаёт nextCursor', async () => {
      transaction.findMany.mockResolvedValue([
        { id: 't3', amount: decimal('300.00') },
        { id: 't2', amount: decimal('200.00') },
        { id: 't1', amount: decimal('100.00') },
      ]);

      const result = await service.findAll('user_1', { limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.amount).toBe('300.00');
      expect(result.nextCursor).toBe('t2');
    });

    it('отдаёт nextCursor null, когда записей меньше лимита', async () => {
      transaction.findMany.mockResolvedValue([{ id: 't1', amount: decimal('100.00') }]);

      const result = await service.findAll('user_1', { limit: 20 });

      expect(result.nextCursor).toBeNull();
    });
  });

  describe('findOne', () => {
    it('ищет по id и userId одновременно', async () => {
      transaction.findFirst.mockResolvedValue({ id: 't1', amount: decimal('100.00') });

      await service.findOne('user_1', 't1');

      expect(transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't1', userId: 'user_1' } }),
      );
    });

    it('бросает NotFoundException для чужой или несуществующей транзакции', async () => {
      transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user_1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const input = {
      amount: '100.00',
      type: 'EXPENSE' as const,
      currency: 'RUB' as const,
      categoryId: 'cat_1',
      description: null,
      date: new Date('2026-09-10'),
    };

    it('проверяет принадлежность категории до вставки', async () => {
      category.findFirst.mockResolvedValue(null);

      await expect(service.create('user_1', input)).rejects.toThrow(NotFoundException);
      expect(transaction.create).not.toHaveBeenCalled();
    });

    it('бросает BadRequestException, если категория архивная', async () => {
      category.findFirst.mockResolvedValue({ isArchived: true });

      await expect(service.create('user_1', input)).rejects.toThrow(BadRequestException);
      expect(transaction.create).not.toHaveBeenCalled();
    });

    it('кладёт userId из аргумента в data', async () => {
      category.findFirst.mockResolvedValue({ isArchived: false });
      transaction.create.mockResolvedValue({ id: 't1', amount: decimal('100.00') });

      await service.create('user_1', input);

      expect(transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...input, userId: 'user_1' } }),
      );
    });

    it('превращает P2003 в NotFoundException', async () => {
      category.findFirst.mockResolvedValue({ isArchived: false });
      transaction.create.mockRejectedValue(p2003());

      await expect(service.create('user_1', input)).rejects.toThrow(NotFoundException);
    });

    it('пробрасывает прочие ошибки без изменений', async () => {
      category.findFirst.mockResolvedValue({ isArchived: false });
      const error = new Error('boom');
      transaction.create.mockRejectedValue(error);

      await expect(service.create('user_1', input)).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('бросает NotFoundException, если транзакция чужая', async () => {
      transaction.findFirst.mockResolvedValue(null);

      await expect(service.update('user_1', 't1', { amount: '50.00' })).rejects.toThrow(
        NotFoundException,
      );
      expect(transaction.update).not.toHaveBeenCalled();
    });

    it('не проверяет категорию, если categoryId не передан', async () => {
      transaction.findFirst.mockResolvedValue({ id: 't1' });
      transaction.update.mockResolvedValue({ id: 't1', amount: decimal('50.00') });

      await service.update('user_1', 't1', { amount: '50.00' });

      expect(category.findFirst).not.toHaveBeenCalled();
    });

    it('проверяет новую категорию, когда categoryId передан', async () => {
      transaction.findFirst.mockResolvedValue({ id: 't1' });
      category.findFirst.mockResolvedValue({ isArchived: false });
      transaction.update.mockResolvedValue({ id: 't1', amount: decimal('50.00') });

      await service.update('user_1', 't1', { categoryId: 'cat_2' });

      expect(category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cat_2', userId: 'user_1' } }),
      );
    });

    it('обновляет найденную транзакцию и сериализует amount', async () => {
      transaction.findFirst.mockResolvedValue({ id: 't1' });
      transaction.update.mockResolvedValue({ id: 't1', amount: decimal('50.00') });

      const result = await service.update('user_1', 't1', { amount: '50.00' });

      expect(result.amount).toBe('50.00');
    });
  });

  describe('remove', () => {
    it('удаляет по id и userId', async () => {
      transaction.deleteMany.mockResolvedValue({ count: 1 });

      await service.remove('user_1', 't1');

      expect(transaction.deleteMany).toHaveBeenCalledWith({
        where: { id: 't1', userId: 'user_1' },
      });
    });

    it('бросает NotFoundException при count: 0', async () => {
      transaction.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove('user_1', 't1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('summary', () => {
    it('ограничивает выборку границами месяца в UTC', async () => {
      user.findUniqueOrThrow.mockResolvedValue({ baseCurrency: 'RUB' });
      transaction.groupBy.mockResolvedValue([]);

      await service.summary('user_1', { month: 1, year: 2026 });

      expect(transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user_1',
            currency: 'RUB',
            date: { gte: new Date(Date.UTC(2026, 0, 1)), lt: new Date(Date.UTC(2026, 1, 1)) },
          },
        }),
      );
    });

    it('декабрь корректно переходит в следующий год', async () => {
      user.findUniqueOrThrow.mockResolvedValue({ baseCurrency: 'RUB' });
      transaction.groupBy.mockResolvedValue([]);

      await service.summary('user_1', { month: 12, year: 2026 });

      expect(transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { gte: new Date(Date.UTC(2026, 11, 1)), lt: new Date(Date.UTC(2027, 0, 1)) },
          }),
        }),
      );
    });

    it('считает баланс как доходы минус расходы', async () => {
      user.findUniqueOrThrow.mockResolvedValue({ baseCurrency: 'RUB' });
      transaction.groupBy.mockResolvedValue([
        {
          categoryId: 'cat_1',
          type: 'INCOME',
          _sum: { amount: decimal('1000.00') },
          _count: { _all: 1 },
        },
        {
          categoryId: 'cat_2',
          type: 'EXPENSE',
          _sum: { amount: decimal('250.50') },
          _count: { _all: 2 },
        },
      ]);
      category.findMany.mockResolvedValue([
        { id: 'cat_1', name: 'Зарплата', color: '#22c55e' },
        { id: 'cat_2', name: 'Еда', color: '#ef4444' },
      ]);

      const result = await service.summary('user_1', { month: 9, year: 2026 });

      expect(result.totalIncome).toBe('1000.00');
      expect(result.totalExpense).toBe('250.50');
      expect(result.balance).toBe('749.50');
    });

    it('отдаёт отрицательный баланс строкой со знаком', async () => {
      user.findUniqueOrThrow.mockResolvedValue({ baseCurrency: 'RUB' });
      transaction.groupBy.mockResolvedValue([
        {
          categoryId: 'cat_1',
          type: 'INCOME',
          _sum: { amount: decimal('100.00') },
          _count: { _all: 1 },
        },
        {
          categoryId: 'cat_2',
          type: 'EXPENSE',
          _sum: { amount: decimal('350.25') },
          _count: { _all: 1 },
        },
      ]);
      category.findMany.mockResolvedValue([
        { id: 'cat_1', name: 'X', color: null },
        { id: 'cat_2', name: 'Y', color: null },
      ]);

      const result = await service.summary('user_1', { month: 9, year: 2026 });

      expect(result.balance).toBe('-250.25');
    });

    it('отдаёт нули, когда за месяц ничего нет', async () => {
      user.findUniqueOrThrow.mockResolvedValue({ baseCurrency: 'RUB' });
      transaction.groupBy.mockResolvedValue([]);

      const result = await service.summary('user_1', { month: 9, year: 2026 });

      expect(result.totalIncome).toBe('0.00');
      expect(result.totalExpense).toBe('0.00');
      expect(result.balance).toBe('0.00');
      expect(result.categories).toEqual([]);
      expect(category.findMany).not.toHaveBeenCalled();
    });

    it('подставляет имя и цвет категории в разбивку', async () => {
      user.findUniqueOrThrow.mockResolvedValue({ baseCurrency: 'RUB' });
      transaction.groupBy.mockResolvedValue([
        {
          categoryId: 'cat_1',
          type: 'EXPENSE',
          _sum: { amount: decimal('500.50') },
          _count: { _all: 2 },
        },
      ]);
      category.findMany.mockResolvedValue([{ id: 'cat_1', name: 'Еда', color: '#ef4444' }]);

      const result = await service.summary('user_1', { month: 9, year: 2026 });

      expect(result.categories).toEqual([
        {
          categoryId: 'cat_1',
          categoryName: 'Еда',
          categoryColor: '#ef4444',
          type: 'EXPENSE',
          total: '500.50',
          count: 2,
        },
      ]);
    });
  });
});
