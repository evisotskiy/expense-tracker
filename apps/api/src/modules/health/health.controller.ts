import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { type PrismaService } from '../../prisma/prisma.service';

// Защита включена глобально, но проверку здоровья дёргают оркестратор и балансировщик,
// у которых нет и не может быть токена. Без @Public() ручка отвечала бы 401,
// и healthcheck считал бы живой сервис мёртвым.
@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Живо ли приложение и отвечает ли база. */
  @Get()
  @ApiOperation({ summary: 'Проверка состояния сервиса и подключения к базе' })
  async check(): Promise<{ status: string; database: 'up' | 'down'; uptime: number }> {
    let database: 'up' | 'down' = 'down';

    try {
      // SELECT 1 — самый дешёвый способ убедиться, что соединение живое
      await this.prisma.client.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: Math.floor(process.uptime()),
    };
  }
}
