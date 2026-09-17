# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Язык

Код, комментарии, сообщения об ошибках и документация в этом репозитории — на русском. Придерживайтесь этого стиля: комментарии объясняют *почему*, а не *что*.

## Команды

```bash
pnpm dev                 # web :3000 + api :4000 одновременно (turbo)
pnpm build               # сборка в порядке зависимостей
pnpm typecheck           # tsc --noEmit во всех пакетах
pnpm lint                # eslint во всех пакетах
pnpm format              # prettier по репозиторию

pnpm db:up / db:down     # Postgres в Docker
pnpm db:migrate          # prisma migrate dev (создать + применить)
pnpm db:deploy           # prisma migrate deploy (CI/prod)
pnpm db:generate         # перегенерировать клиент после правки schema.prisma
pnpm db:studio
```

Работа с одним пакетом — через `--filter`:

```bash
pnpm --filter @expense-tracker/api dev
pnpm --filter @expense-tracker/api test
pnpm --filter @expense-tracker/api exec jest src/modules/auth/auth.service.spec.ts   # один файл
pnpm --filter @expense-tracker/api exec jest -t "название теста"                     # один тест
pnpm --filter @expense-tracker/web lint
```

Тесты настроены только в `apps/api` (jest + ts-jest, `rootDir: src`, шаблон `*.spec.ts`). В остальных пакетах задачи `test` нет — `pnpm test` их просто пропускает.

Требования: Node ≥ 20.19 (`.nvmrc` → 24.21.0, `nvm use`), pnpm 8.6+, Docker.

## Состояние проекта

Каркас: схема БД, валидация, аутентификационный контур и контроллеры написаны, но большинство методов сервисов — заглушки `throw new Error('Не реализовано')` (auth, expenses `create/update/remove`, categories, budgets). Реализован `ExpensesService.findAll` и health-check. Фронтенд — пустой каркас: только layout, QueryProvider и `api-client`; `src/components/ui` пуст (shadcn/ui настроен через `components.json`, компоненты добавляются `pnpm dlx shadcn@latest add ...`).

## Архитектура

### Поток данных: одна Zod-схема на всё

`packages/shared` — единственный источник правды по формам данных. Схема из `packages/shared/src/schemas/` → `createZodDto(schema)` в `apps/api/src/modules/*/dto/` → класс DTO работает одновременно как тип `@Body()`, как правило валидации (глобальный `ZodValidationPipe` в `app.module.ts`) и как источник модели для Swagger. Тот же пакет импортируется фронтендом для типов и валидации форм.

Отсюда следуют два правила:

- Меняя контракт API, правьте схему в `shared`, а не DTO.
- Схемы с `transform` дают **два** разных типа: `z.input` (что шлёт клиент) и `z.output` (что получает сервис после валидации). Формы фронтенда типизируются через `*Input`, сервисы — через `*Data`. См. конец `schemas/expense.ts`.

### Деньги — строки, не числа

`packages/shared/src/schemas/money.ts` — обязательное чтение перед любой работой с суммами. В БД `Decimal(12,2)`, по сети — каноническая строка `"1234.56"`, арифметика — через `toMinorUnits`/`sumMoney` (в копейках). Сервисы обязаны прогонять `amount` из Prisma через `toMoneyString()` перед отдачей — паттерн в `ExpensesService.serialize`.

### Даты

`isoDateSchema` принимает ISO-строку и отдаёт `Date`. Именно `z.union([...iso...]).transform(...)`, а **не** `z.coerce.date()`: Swagger строится через `z.toJSONSchema()`, а `Date` в JSON Schema непредставим и сборка документа падает.

### Безопасность по умолчанию закрыта

`JwtAuthGuard` подключён глобально через `APP_GUARD`. Новый эндпоинт автоматически требует токен; открывать нужно явным `@Public()` (см. `health.controller.ts`). `@CurrentUser('sub')` достаёт id пользователя из `request.user`, положенного `JwtStrategy`. Токены: access — в заголовке (хранится в памяти клиента), refresh — в httpOnly cookie; отсюда `credentials: 'include'` в `api-client.ts` и `credentials: true` в CORS.

### Ошибки

`AllExceptionsFilter` приводит всё к форме `apiErrorSchema` из shared. `ZodValidationException` проверяется **до** `HttpException` (она его наследник) — иначе теряется разбор ошибок по полям. Детали 5xx уходят только в лог.

### Prisma 7 — отличия от привычного

- Генератор `prisma-client` (не `-js`), `output` обязателен → клиент лежит в `packages/database/src/generated/`.
- Строка подключения задаётся в `packages/database/prisma.config.ts`, а не в блоке `datasource`.
- CLI не читает `.env` сам — это делает `dotenv/config` в `prisma.config.ts` (путь `../../.env` от `packages/database`).
- Соединение идёт через driver adapter `@prisma/adapter-pg` поверх пула `pg`.
- Экспортируемый `prisma` — **Proxy с ленивой инициализацией**. Так сделано намеренно: модуль загружается раньше, чем Nest поднимет `ConfigModule`, и жадное создание клиента роняло бы старт с «DATABASE_URL не задан». Клиент кэшируется в `globalThis`, чтобы hot reload не плодил пулы соединений. `PrismaService` — тонкая обёртка над этим singleton, доступ к моделям через `this.prisma.client.*`.

### Сборка и tsconfig

Внутренние пакеты подключаются как `workspace:*` и потребляются из `dist`, а не из исходников. Порядок обеспечивает Turborepo (`dependsOn: ["^build"]`, `build` дополнительно зависит от `db:generate`). Следствие: после правки `packages/shared` пересоберите его, иначе приложения увидят старые типы (в dev это делает `tsc --watch` из `dev`-скрипта пакета).

`incremental` в `packages/tsconfig/base.json` выключен намеренно: кэш `.tsbuildinfo` от `tsc --noEmit` вместе с `deleteOutDir` в `nest-cli.json` давал молча пустой `dist`. Не включайте обратно.

## Окружение

Три `.env`, ни один не в git:

| Шаблон | Копировать в | Кто читает |
| --- | --- | --- |
| `env.example` | `.env` | docker compose, `prisma.config.ts` |
| `apps/api/api.env.example` | `apps/api/.env` | Nest `ConfigModule` |
| `apps/web/web.env.example` | `apps/web/.env.local` | Next.js |

`envFilePath: ['.env', '../../.env']` — первый файл побеждает, поэтому `DATABASE_URL` достаточно задать в корне. Переменные API валидируются на старте схемой `apps/api/src/config/env.schema.ts`; добавляя переменную, добавьте её и туда, иначе она не пройдёт в `ConfigService`.

## Соглашения

- Prettier: одинарные кавычки, `printWidth: 100`, точки с запятой, `trailingComma: all`.
- ESLint (flat config): обязательны inline type imports (`import { type Foo }` / `import type`), `no-console` кроме `warn`/`error`, `eqeqeq: smart`. Для Nest отключены правила о «бесполезном конструкторе» — это parameter properties DI.
- TS строгий, включая `noUncheckedIndexedAccess` и `noImplicitOverride` (отсюда `override canActivate` в guard).
- Новый модуль API: `modules/<имя>/{<имя>.module.ts, .controller.ts, .service.ts, dto/<имя>.dto.ts}`, регистрация в `app.module.ts`, схемы — в `packages/shared`.

## Планы

Планы заметных задач хранятся в репозитории, в `.claude/plans/`, парой файлов:

| Файл | Содержимое |
| --- | --- |
| `<имя>.md` | сам план: контекст (зачем задача), изменения по файлам, раздел «Порядок работ», раздел «Проверка» |
| `<имя>.tasks.md` | чеклист `- [ ]` по разделам, порядок совпадает с «Порядком работ» плана |

Образец — пара `auth-users-cqrs-jwt.md` / `auth-users-cqrs-jwt.tasks.md`.

Чеклист ведётся по ходу реализации (`[ ]` → `[x]`) и коммитится вместе с кодом: план остаётся в истории проекта рядом с изменениями, которые он описывает, а не только в переписке. Внеплановые находки дописываются в конец tasks-файла отдельным разделом — см. раздел 8 в `auth-users-cqrs-jwt.tasks.md`.

Оба файла — на русском, как и весь остальной репозиторий.
