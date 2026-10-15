# Архитектура

## Обзор

Монорепозиторий на pnpm workspaces + Turborepo:

| Пакет                    | Назначение                                                          |
| ------------------------ | ------------------------------------------------------------------- |
| `apps/api`               | Backend — NestJS                                                    |
| `apps/web`               | Frontend — Next.js, Feature-Sliced Design                           |
| `packages/shared`        | Zod-схемы — единственный источник правды по формам данных           |
| `packages/database`      | Prisma 7 client + `schema.prisma`, singleton-подключение к Postgres |
| `packages/tsconfig`      | Общие базовые `tsconfig.json`                                       |
| `packages/eslint-config` | Общий ESLint flat config                                            |

`apps/*` потребляют внутренние пакеты из `dist`, а не из исходников; порядок сборки
обеспечивает Turborepo (`dependsOn: ["^build"]`). После правки `packages/shared` или
`packages/database` зависящие приложения должны увидеть новый `dist` — иначе они продолжат
работать со старыми типами (в dev это делает `tsc --watch` из `dev`-скрипта пакета).

## Поток данных: одна Zod-схема на всё

`packages/shared/src/schemas/` — источник правды по формам данных:

```
packages/shared/schemas/*.ts  →  createZodDto(schema) в apps/api/*/dto/*.dto.ts
                               →  класс DTO: @Body(), правило ZodValidationPipe, модель Swagger
                               →  тот же пакет импортируется apps/web для типов и валидации форм
```

Контракт API меняется в схеме `shared`, а не точечно в DTO. Схемы с `.transform()` дают два
разных типа — `z.input` (что шлёт клиент) и `z.output` (что получает сервис после валидации);
см. конец `packages/shared/src/schemas/transaction.ts`.

Два сквозных соглашения по данным:

- **Деньги** — строки канонического вида `"1234.56"`, не числа (`packages/shared/src/schemas/money.ts`).
  В БД — `Decimal(12, 2)`; арифметика — через `toMinorUnits`/`sumMoney`, сервисы прогоняют
  `amount` через `toMoneyString()` перед отдачей.
- **Даты** — `isoDateSchema` (ISO-строка → `Date` через `z.union([...]).transform(...)`), не
  `z.coerce.date()`: Swagger строится через `z.toJSONSchema()`, а `Date` там непредставим.

## Backend (`apps/api`)

NestJS, модули в `src/modules/`: `auth`, `users`, `categories`, `transactions`, `budgets`, `health`.
Регистрация — в `app.module.ts`.

### Глобальные провайдеры (`APP_*`)

| Провайдер             | Роль                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ZodValidationPipe`   | Валидирует `@Body()`/`@Query()` по схеме, зашитой в DTO через `createZodDto`                                                                             |
| `JwtAuthGuard`        | Безопасность закрыта по умолчанию — каждый новый эндпоинт требует токен, открыть можно только явным `@Public()` (см. `health.controller.ts`)             |
| `ThrottlerGuard`      | Глобальный лимит 100 запросов/мин; на auth-роутах — отдельные, более строгие `@Throttle(...)`                                                            |
| `AllExceptionsFilter` | Приводит все ошибки к форме `apiErrorSchema` из `shared`; `ZodValidationException` проверяется до `HttpException`, иначе теряется разбор ошибок по полям |

### CQRS — только в `users`

`CqrsModule.forRoot()` подключён глобально в `app.module.ts`, но `CommandBus`/`QueryBus`
реально используются только в модуле `users` (`commands/create-user`, `queries/get-user-profile`,
`get-auth-user`, `get-user-credentials`). `auth` обращается к пользователю через эти
команды/запросы, а не напрямую к `UsersService` — так модули общаются без прямой зависимости
друг от друга. Остальные модули (`categories`, `transactions`, `budgets`) — обычный
паттерн `Controller → Service → PrismaService`, без CQRS.

### Аутентификация и сессии

- Access-токен (JWT) — в заголовке `Authorization: Bearer ...`, короткоживущий, проверяется
  `JwtStrategy`; `@CurrentUser('sub')` достаёт id пользователя из `request.user`.
- Refresh-токен — в httpOnly cookie; в БД хранится только его хэш (`RefreshToken.tokenHash`),
  утечка таблицы не даёт выпустить новый access. Каждая ротация (`/auth/refresh`) создаёт новую
  строку и помечает старую `revokedAt`.
- Отсюда `credentials: 'include'` в `apps/web` (`api-client.ts`) и `credentials: true` в CORS
  (`main.ts`).

### Prisma 7

- Генератор `prisma-client` (не `-js`), клиент лежит в `packages/database/src/generated/`.
- Строка подключения — в `packages/database/prisma.config.ts`, не в блоке `datasource`.
- Соединение — через driver adapter `@prisma/adapter-pg` поверх пула `pg`.
- Экспортируемый `prisma` — Proxy с ленивой инициализацией, кэшируется в `globalThis` (hot
  reload не плодит пулы соединений). `PrismaService` — тонкая обёртка, доступ к моделям через
  `this.prisma.client.*`.

Подробнее про API и модули — `.claude/docs/api.md`, про схему БД — `.claude/docs/database-schema.md`.

## Frontend (`apps/web`)

Feature-Sliced Design, слои `src/` снизу вверх:

| Слой       | Назначение                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `shared`   | транспорт, утилиты, ui-кит (shadcn/ui на Tailwind 4) — не знает о домене                                                                  |
| `entities` | бизнес-сущности (`session`, `category`, `transaction`) — данные и способ их получить                                                      |
| `features` | пользовательские действия (`login-form`, `create-transaction`, `delete-transaction`, `month-switcher`, `session-guard`, `user-menu`, ...) |
| `widgets`  | композиция фич в законченный кусок интерфейса (`app-header`, `month-summary`, `transaction-feed`, `category-breakdown`, ...)              |
| `views`    | сборка экрана из widgets/features/entities (`dashboard`, `login`, `register`, ...)                                                        |
| `app`      | только роутинг Next (`layout.tsx`, `page.tsx`, route groups `(auth)`/`(protected)`)                                                       |

Импорты — только вниз по слоям; `@/shared/...` — файлом (без барелей), `@/<слой>/<слайс>` —
только корнем слайса. Границы проверяет ESLint (`apps/web/eslint.config.mjs`).

### Контур сессии

Access-токен хранится в памяти (`shared/api/access-token-store.ts`, не React-контекст — токен
не должен участвовать в рендере). Защищённые запросы идут через `authorizedFetch` (добавляет
`Bearer`, упреждающий и реактивный refresh на 401); публичные (`/auth/login`, `/auth/register`,
`/auth/refresh`) — через `apiFetch` напрямую.

## Границы и инструменты

Подробные правила — в корневом `CLAUDE.md` и во вложенных `apps/api/CLAUDE.md` /
`apps/web/CLAUDE.md`; этот документ описывает архитектуру «как есть», а не повторяет
инструкции по работе с кодом.
