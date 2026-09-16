import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { prisma, type PrismaClient } from '@expense-tracker/database';

/**
 * Тонкая обёртка над singleton-клиентом из @expense-tracker/database.
 *
 * Клиент не создаётся здесь заново: и Nest, и Next используют один и тот же модуль,
 * а значит один пул соединений на процесс.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  readonly client: PrismaClient = prisma;

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Подключение к Postgres установлено');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
