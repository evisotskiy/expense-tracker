# Гайд для разработчиков

Повседневные команды, окружение, соглашения по коду, git-флоу и формат коммитов — в корневом
[`CLAUDE.md`](../../CLAUDE.md) и вложенных `apps/api/CLAUDE.md` / `apps/web/CLAUDE.md`. Здесь —
только то, чего там нет: быстрый старт и пошаговые рецепты «как добавить фичу».

## Быстрый старт

```bash
nvm use                  # Node ≥ 20.19, см. .nvmrc
pnpm install

cp env.example .env
cp apps/api/api.env.example apps/api/.env
cp apps/web/web.env.example apps/web/.env.local

pnpm db:up                # Postgres в Docker
pnpm db:migrate           # применить миграции

pnpm dev                  # web :3000 + api :4000
```

Swagger — `http://localhost:4000/api/docs`, health-check — `http://localhost:4000/api/v1/health`.

Повседневная работа (сборка, тесты, lint, работа с одним пакетом через `--filter`) — см.
`CLAUDE.md` → разделы «Команды», «Соглашения», «Git».

## Как добавить новый модуль API

Шаблон — `.claude/templates/feature.md`; структуру копировать с `modules/categories` или
`modules/transactions` (без CQRS) либо с `modules/users` (с CQRS, если домен действительно
нуждается в командах/запросах — для простого CRUD это лишнее).

1. **Схема в shared.** Описать форму данных в `packages/shared/src/schemas/<домен>.ts`:
   схема создания/обновления (`createZodDto`-совместимая), схема сущности для ответа. Если
   есть деньги — через `moneySchema`/`moneyInputSchema` (`packages/shared/src/schemas/money.ts`),
   если даты — через `isoDateSchema` (`packages/shared/src/schemas/common.ts`), не `z.coerce.date()`.
   Пересобрать пакет (`pnpm --filter @expense-tracker/shared build` или дождаться `tsc --watch`
   в `pnpm dev`), иначе `apps/api`/`apps/web` увидят старые типы.
2. **DTO.** `apps/api/src/modules/<домен>/dto/<домен>.dto.ts` — классы вида
   `export class CreateXDto extends createZodDto(createXSchema) {}` (см.
   `transactions/dto/transaction.dto.ts`).
3. **Сервис.** `apps/api/src/modules/<домен>/<домен>.service.ts` — `@Injectable()`,
   доступ к БД через `PrismaService` (`this.prisma.client.*`). Проверка владения ресурсом —
   всегда по `userId` в `where`, а не постфактум (см. `TransactionsService.findOne`: чужой
   ресурс даёт 404, а не 403, — существование чужого id не подтверждаем). Если в select
   попадает `amount` из Prisma — прогнать через `toMoneyString()` перед отдачей.
4. **Контроллер.** `apps/api/src/modules/<домен>/<домен>.controller.ts` — `@Controller('<домен>')`,
   каждый метод с `@ApiOperation({ summary: '...' })`. `@CurrentUser('sub')` для id пользователя.
   Импорт DTO-классов — **не** `import type` (иначе `design:paramtypes` теряет класс и
   `ZodValidationPipe` перестаёт видеть DTO по `metatype` — подробности в комментарии
   `transactions.controller.ts`, где баг обнаружен). Эндпоинт закрыт токеном по умолчанию;
   открыть — явным `@Public()`.
5. **Модуль.** `apps/api/src/modules/<домен>/<домен>.module.ts` — регистрация
   контроллера/сервиса, `exports` если сервис нужен другому модулю.
6. **Подключение.** Добавить модуль в импорты `app.module.ts`.
7. **Тесты.** `<домен>.service.spec.ts` (jest, `*.spec.ts`, `rootDir: src`) — покрыть
   бизнес-правила (владение, валидация, граничные случаи), не повторяя проверку самой Zod-схемы.
8. **Проверка:** `pnpm --filter @expense-tracker/api typecheck/lint/test`, затем `pnpm build`
   из корня (порядок сборки обеспечит Turborepo). Обновить Swagger-описание проверить вручную —
   `http://localhost:4000/api/docs`.
9. **Документация.** Обновить `.claude/docs/api.md` (таблица эндпоинтов) и, если менялась
   схема БД, `.claude/docs/database-schema.md` — правило из `CLAUDE.md` («Обновление docs»).

## Как добавить фичу на фронте (FSD-слайс)

Ориентир — существующий слайс, например `features/create-category`:

```
features/create-category/
├── index.ts                  # единственная точка входа наружу слайса
├── model/
│   ├── schema.ts              # форма валидации (обычно переиспользует *Input из shared)
│   └── use-create-category.ts # хук с мутацией/бизнес-логикой
└── ui/
    ├── category-form.tsx
    └── create-category-dialog.tsx
```

1. **Выбрать слой.** Новая бизнес-сущность — в `entities`; пользовательское действие
   (создать/удалить/отфильтровать) — в `features`; сборка нескольких фич в готовый кусок
   интерфейса — в `widgets`; целый экран — в `views`.
2. **Создать слайс** `src/<слой>/<имя-слайса>/` с `index.ts`, который экспортирует наружу
   только то, что нужно потребителям — остальное (`model/`, `ui/`) наружу не торчит.
3. **Данные и запросы.** Защищённые эндпоинты — через `authorizedFetch`
   (`@/shared/api/authorized-fetch`), публичные (`/auth/*`) — через `apiFetch` напрямую. Формы
   типизировать через `*Input`-тип из `packages/shared` (см. «Поток данных» в
   `.claude/docs/architecture.md`).
4. **Импорты.** Только вниз по слоям; `@/shared/...` — файлом (не через барель
   `@/shared/ui`, чтобы не тянуть лишнее, например `react-hook-form` ради одной кнопки);
   `@/<слой>/<слайс>` у других слоёв — только корнем слайса (`@/features/create-category`, не
   `.../model/schema`). ESLint (`apps/web/eslint.config.mjs`) проверяет это автоматически, но
   не видит `import()`/`require` — остальное на код-ревью.
5. **UI-компоненты.** Новый компонент shadcn — `pnpm dlx shadcn@latest add <имя> --cwd apps/web`
   (никогда не `shadcn init`), затем вручную поправить `import { cn } from "cn"` на
   `@/shared/lib/cn` и убрать пакет `cn` из `apps/web/package.json`, если он там появился.
   Проверить, что все используемые токены темы (`bg-card`, `ring-ring/50` и т.п.) объявлены в
   `@theme` (`apps/web/src/app/globals.css`).
6. **Тесты.** `*.test.tsx` рядом с компонентом (vitest + Testing Library), прогонять через
   `pnpm test` / `turbo run test --filter=@expense-tracker/web` — не напрямую через
   `pnpm --filter @expense-tracker/web test` (см. `apps/web/CLAUDE.md`).
7. **Подключить в `app`.** Роутинг Next — только в `src/app/`; если нужен провайдер — в
   `src/app/_providers` (префикс `_` исключает папку из роутинга).

## Где смотреть дальше

- `.claude/docs/architecture.md` — общая архитектура, поток данных, границы слоёв.
- `.claude/docs/api.md` — таблица эндпоинтов.
- `.claude/docs/database-schema.md` — модели и назначение полей.
- `CLAUDE.md` (корень, `apps/api`, `apps/web`) — команды, соглашения, git-флоу.
- `.claude/TODO.md` — незавершённые задачи между сессиями.
