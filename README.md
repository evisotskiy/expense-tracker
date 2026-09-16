# Трекер расходов

Монорепозиторий: Next.js (веб) + Nest.js (API) + Postgres через Prisma.

## Стек

| Слой       | Технологии                                                              |
| ---------- | ----------------------------------------------------------------------- |
| Монорепо   | pnpm workspaces + Turborepo                                             |
| Фронтенд   | Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui, TanStack Query |
| Бэкенд     | Nest.js 11, Zod через `nestjs-zod`, Swagger, JWT (Passport) + argon2     |
| База       | Postgres 16, Prisma 7 (driver adapter `@prisma/adapter-pg`)             |
| Инструменты| TypeScript 5.9, ESLint 10 (flat config), Prettier 3                     |

## Структура

```
apps/
  web/        Next.js, порт 3000
  api/        Nest.js, порт 4000, префикс /api/v1
packages/
  database/   Prisma: схема, миграции, singleton клиента
  shared/     Zod-схемы и типы, общие для веба и API
  tsconfig/   базовые tsconfig
  eslint-config/  общий flat-config ESLint
```

Внутренние пакеты подключаются как `workspace:*` и компилируются в `dist`
своим `tsconfig.build.json`; порядок сборки обеспечивает Turborepo через `dependsOn: ["^build"]`.

## Требования

- **Node ≥ 20.19** — этого требует Prisma 7. В репозитории `.nvmrc` на 24.21.0:
  `nvm install && nvm use`
- **pnpm 8.6+** (`corepack enable`)
- **Docker** для локального Postgres (Docker Desktop или OrbStack)

## Запуск с нуля

```bash
# 1. Переменные окружения
cp env.example .env
cp apps/api/api.env.example apps/api/.env
cp apps/web/web.env.example apps/web/.env.local

# сгенерировать секреты JWT и вписать их в apps/api/.env
openssl rand -base64 48

# 2. Зависимости
pnpm install

# 3. База
pnpm db:up                 # docker compose up -d
pnpm db:migrate            # первая миграция + prisma generate

# 4. Разработка
pnpm dev                   # web :3000, api :4000
```

Проверка, что всё живо:

```bash
curl http://localhost:4000/api/v1/health
open http://localhost:4000/api/docs     # Swagger
open http://localhost:3000
```

## Команды

| Команда            | Что делает                                       |
| ------------------ | ------------------------------------------------ |
| `pnpm dev`         | Запускает web и api одновременно                 |
| `pnpm build`       | Сборка всех пакетов в правильном порядке         |
| `pnpm typecheck`   | `tsc --noEmit` во всех пакетах                    |
| `pnpm lint`        | ESLint во всех пакетах                            |
| `pnpm format`      | Prettier по всему репозиторию                     |
| `pnpm db:up` / `db:down` | Поднять / остановить Postgres в Docker      |
| `pnpm db:migrate`  | Создать и применить миграцию (dev)                |
| `pnpm db:deploy`   | Применить миграции без интерактива (CI, prod)     |
| `pnpm db:studio`   | Prisma Studio — браузер по данным                 |

## Окружение

Файлы `.env` в git не попадают, в репозитории лежат только шаблоны:

| Шаблон                     | Копировать в           | Кто читает                        |
| -------------------------- | ---------------------- | --------------------------------- |
| `env.example`              | `.env`                 | docker compose, `prisma.config.ts`|
| `apps/api/api.env.example` | `apps/api/.env`        | Nest `ConfigModule`               |
| `apps/web/web.env.example` | `apps/web/.env.local`  | Next.js                           |

Nest читает свой `.env`, а следом корневой — поэтому `DATABASE_URL` достаточно
задать один раз в корне.

## Особенности Prisma 7

- Генератор называется `prisma-client` (не `prisma-client-js`), поле `output` обязательно.
- Строка подключения задаётся в `packages/database/prisma.config.ts`, а не в `datasource`.
- CLI больше не читает `.env` автоматически — за это отвечает `import 'dotenv/config'`
  в `prisma.config.ts`.
- Клиент работает через driver adapter `@prisma/adapter-pg` поверх пула `pg`.
