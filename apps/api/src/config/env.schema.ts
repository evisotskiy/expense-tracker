import { z } from 'zod';

/**
 * Схема переменных окружения.
 *
 * Валидируется на старте приложения: лучше упасть при запуске с внятным сообщением,
 * чем отдать 500 на первом же запросе к базе через час после деплоя.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),

  JWT_ACCESS_SECRET: z.string().min(32, 'Секрет должен быть не короче 32 символов'),
  JWT_REFRESH_SECRET: z.string().min(32, 'Секрет должен быть не короче 32 символов'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  /** Список origin-ов через запятую. */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Некорректные переменные окружения:\n${details}`);
  }

  return result.data;
}
