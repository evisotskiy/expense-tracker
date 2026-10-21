import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { type PrismaService } from '../../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const queryRaw = jest.fn();
  const prisma = { client: { $queryRaw: queryRaw } } as unknown as PrismaService;
  let controller: HealthController;

  beforeEach(() => {
    jest.restoreAllMocks();
    queryRaw.mockReset();
    controller = new HealthController(prisma);
  });

  describe('check', () => {
    it('отвечает ok/up, когда база доступна', async () => {
      queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.check();

      expect(result).toEqual({ status: 'ok', database: 'up', uptime: expect.any(Number) });
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    // Падение базы не должно превращаться в 500: оркестратору нужен читаемый «degraded»,
    // а не исключение, по которому не отличить мёртвый процесс от живого без базы.
    it('отвечает degraded/down и не пробрасывает ошибку, когда база недоступна', async () => {
      queryRaw.mockRejectedValue(new Error('connection refused'));

      await expect(controller.check()).resolves.toEqual({
        status: 'degraded',
        database: 'down',
        uptime: expect.any(Number),
      });
    });

    it('округляет uptime вниз до целых секунд', async () => {
      queryRaw.mockResolvedValue([]);
      jest.spyOn(process, 'uptime').mockReturnValue(12.9);

      const { uptime } = await controller.check();

      expect(uptime).toBe(12);
    });
  });

  // Защита глобальная: потеряв @Public(), healthcheck начнёт получать 401,
  // и оркестратор перезапустит здоровый сервис.
  it('ручка помечена @Public()', () => {
    const isPublic = new Reflector().get<boolean>(IS_PUBLIC_KEY, HealthController);

    expect(isPublic).toBe(true);
  });
});
