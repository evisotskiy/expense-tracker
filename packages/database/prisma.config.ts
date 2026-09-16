import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 больше не подхватывает .env автоматически — грузим его сами.
// Скрипты запускаются из корня через `pnpm --filter @expense-tracker/database ...`,
// поэтому cwd = packages/database, а единственный .env лежит в корне монорепо.
loadEnv({ path: '../../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
