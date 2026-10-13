Дополняет корневой `CLAUDE.md` — здесь только то, что специфично для `apps/api`.

## Команды

```bash
pnpm --filter @expense-tracker/api dev
pnpm --filter @expense-tracker/api test
pnpm --filter @expense-tracker/api exec jest src/modules/auth/auth.service.spec.ts   # один файл
pnpm --filter @expense-tracker/api exec jest -t "название теста"                     # один тест
```

Тесты — jest + ts-jest, `rootDir: src`, шаблон `*.spec.ts`.

## Архитектура

### Безопасность по умолчанию закрыта

`JwtAuthGuard` подключён глобально через `APP_GUARD`. Новый эндпоинт автоматически требует токен; открывать нужно явным `@Public()` (см. `health.controller.ts`). `@CurrentUser('sub')` достаёт id пользователя из `request.user`, положенного `JwtStrategy`. Токены: access — в заголовке (хранится в памяти клиента), refresh — в httpOnly cookie; отсюда `credentials: 'include'` в `api-client.ts` (фронтенд) и `credentials: true` в CORS.

### Ошибки

`AllExceptionsFilter` приводит всё к форме `apiErrorSchema` из shared. `ZodValidationException` проверяется **до** `HttpException` (она его наследник) — иначе теряется разбор ошибок по полям. Детали 5xx уходят только в лог.

### Prisma 7 — отличия от привычного

- Генератор `prisma-client` (не `-js`), `output` обязателен → клиент лежит в `packages/database/src/generated/`.
- Строка подключения задаётся в `packages/database/prisma.config.ts`, а не в блоке `datasource`.
- CLI не читает `.env` сам — это делает `dotenv/config` в `prisma.config.ts` (путь `../../.env` от `packages/database`).
- Соединение идёт через driver adapter `@prisma/adapter-pg` поверх пула `pg`.
- Экспортируемый `prisma` — **Proxy с ленивой инициализацией**. Так сделано намеренно: модуль загружается раньше, чем Nest поднимет `ConfigModule`, и жадное создание клиента роняло бы старт с «DATABASE_URL не задан». Клиент кэшируется в `globalThis`, чтобы hot reload не плодил пулы соединений. `PrismaService` — тонкая обёртка над этим singleton, доступ к моделям через `this.prisma.client.*`.

## Окружение

`apps/api/api.env.example` → `apps/api/.env`, читает Nest `ConfigModule`.
`envFilePath: ['.env', '../../.env']` — первый файл побеждает, поэтому `DATABASE_URL` достаточно
задать в корневом `.env`. Переменные валидируются на старте схемой
`apps/api/src/config/env.schema.ts`; добавляя переменную, добавьте её и туда, иначе она не
пройдёт в `ConfigService`.

## Соглашения

Новый модуль API: `modules/<имя>/{<имя>.module.ts, .controller.ts, .service.ts, dto/<имя>.dto.ts}`, регистрация в `app.module.ts`, схемы — в `packages/shared`.
