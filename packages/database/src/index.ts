import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';

export * from './generated/prisma/client';
export { PrismaClient };

declare global {
  // eslint-disable-next-line no-var
  var __expenseTrackerPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL не задан. Скопируйте env.example в .env в корне монорепозитория.',
    );
  }

  // Prisma 7 работает через driver adapter: соединением управляет пул pg,
  // а не собственный Rust-движок, как было в v6 и раньше.
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

/**
 * Возвращает singleton клиента, создавая его при первом обращении.
 *
 * Кэш в globalThis нужен из-за горячей перезагрузки: и Next.js, и Nest
 * переисполняют модули при изменении файлов, и без него каждая перезагрузка
 * открывала бы новый пул соединений, пока Postgres не упрётся в max_connections.
 */
export function getPrismaClient(): PrismaClient {
  globalThis.__expenseTrackerPrisma ??= createPrismaClient();
  return globalThis.__expenseTrackerPrisma;
}

/**
 * Клиент Prisma.
 *
 * Это прокси, а не готовый экземпляр, и так сделано намеренно. Модуль
 * импортируется раньше, чем Nest успевает поднять ConfigModule и положить
 * переменные из .env в process.env. Создавай мы клиент прямо здесь, приложение
 * падало бы на старте с «DATABASE_URL не задан» — при совершенно корректном .env.
 * Ленивое создание откладывает чтение переменных до первого обращения к базе.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver);

    // методы вроде $connect теряют this, если отдать их без привязки к клиенту
    return typeof value === 'function' ? value.bind(client) : value;
  },

  has(_target, property) {
    return property in getPrismaClient();
  },
});
