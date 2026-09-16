import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * @Global избавляет от импорта PrismaModule в каждый доменный модуль —
 * доступ к базе нужен практически везде.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
