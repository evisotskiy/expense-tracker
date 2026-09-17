import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@expense-tracker/database';

import { type PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from './categories.service';

/** Реальный экземпляр, а не заглушка: сервис распознаёт код ошибки через instanceof. */
function p2002() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
  });
}

describe('CategoriesService', () => {
  const category = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = { client: { category } } as unknown as PrismaService;
  let service: CategoriesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CategoriesService(prisma);
  });

  describe('findAll', () => {
    it('запрашивает только активные категории пользователя, отсортированные по имени', async () => {
      category.findMany.mockResolvedValue([]);

      await service.findAll('user_1');

      expect(category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user_1', isArchived: false },
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  describe('create', () => {
    it('создаёт категорию с userId из аргумента', async () => {
      const created = { id: 'cat_1', name: 'Еда', icon: null, color: null };
      category.create.mockResolvedValue(created);

      const result = await service.create('user_1', { name: 'Еда' });

      expect(result).toBe(created);
      expect(category.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: 'user_1', name: 'Еда' } }),
      );
    });

    it('бросает ConflictException, если активная категория с таким именем уже есть', async () => {
      category.create.mockRejectedValue(p2002());
      category.findUnique.mockResolvedValue({ id: 'cat_1', isArchived: false });

      await expect(service.create('user_1', { name: 'Еда' })).rejects.toThrow(ConflictException);
      expect(category.update).not.toHaveBeenCalled();
    });

    it('восстанавливает архивную категорию вместо ошибки', async () => {
      category.create.mockRejectedValue(p2002());
      category.findUnique.mockResolvedValue({ id: 'cat_1', isArchived: true });
      const revived = { id: 'cat_1', name: 'Еда', icon: 'utensils', color: '#22c55e' };
      category.update.mockResolvedValue(revived);

      const result = await service.create('user_1', {
        name: 'Еда',
        icon: 'utensils',
        color: '#22c55e',
      });

      expect(result).toBe(revived);
      expect(category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cat_1' },
          data: { isArchived: false, icon: 'utensils', color: '#22c55e' },
        }),
      );
    });

    it('пробрасывает прочие ошибки без изменений', async () => {
      const error = new Error('boom');
      category.create.mockRejectedValue(error);

      await expect(service.create('user_1', { name: 'Еда' })).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('бросает NotFoundException, если категория чужая или не существует', async () => {
      category.findFirst.mockResolvedValue(null);

      await expect(service.update('user_1', 'cat_1', { name: 'Новое' })).rejects.toThrow(
        NotFoundException,
      );
      expect(category.update).not.toHaveBeenCalled();
    });

    it('обновляет найденную категорию', async () => {
      category.findFirst.mockResolvedValue({ id: 'cat_1' });
      const updated = { id: 'cat_1', name: 'Новое' };
      category.update.mockResolvedValue(updated);

      const result = await service.update('user_1', 'cat_1', { name: 'Новое' });

      expect(result).toBe(updated);
    });

    it('бросает ConflictException при переименовании в занятое имя', async () => {
      category.findFirst.mockResolvedValue({ id: 'cat_1' });
      category.update.mockRejectedValue(p2002());

      await expect(service.update('user_1', 'cat_1', { name: 'Занято' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('архивирует найденную категорию', async () => {
      category.updateMany.mockResolvedValue({ count: 1 });

      await service.remove('user_1', 'cat_1');

      expect(category.updateMany).toHaveBeenCalledWith({
        where: { id: 'cat_1', userId: 'user_1', isArchived: false },
        data: { isArchived: true },
      });
    });

    it('бросает NotFoundException, если ничего не обновилось', async () => {
      category.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.remove('user_1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
