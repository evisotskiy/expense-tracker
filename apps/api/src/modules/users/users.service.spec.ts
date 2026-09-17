import { NotFoundException } from '@nestjs/common';
import { type QueryBus } from '@nestjs/cqrs';

import { GetUserProfileQuery } from './queries/get-user-profile.query';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const queryBus = { execute: jest.fn() } as unknown as jest.Mocked<QueryBus>;
  let service: UsersService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new UsersService(queryBus);
  });

  it('делегирует поиск в QueryBus и возвращает результат', async () => {
    const profile = {
      id: 'user_1',
      email: 'test@example.com',
      name: 'Тест',
      baseCurrency: 'RUB' as const,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    (queryBus.execute as jest.Mock).mockResolvedValue(profile);

    const result = await service.findById('user_1');

    expect(result).toBe(profile);
    expect(queryBus.execute).toHaveBeenCalledWith(new GetUserProfileQuery('user_1'));
  });

  it('бросает NotFoundException, если репозиторий вернул null', async () => {
    (queryBus.execute as jest.Mock).mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    await expect(service.findById('missing')).rejects.toThrow('Пользователь не найден');
  });
});
