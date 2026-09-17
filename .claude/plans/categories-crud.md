# Категории трат: реализация CRUD

## Контекст

Авторизация в проекте готова, следующий шаг — категории трат. При разведке выяснилось, что **каркас категорий уже написан целиком**, недостающее — только тела трёх методов сервиса:

| Слой | Состояние |
| --- | --- |
| `packages/database/prisma/schema.prisma` → `model Category` | **есть**: `id`, `userId`, `name`, `icon?`, `color? @db.VarChar(7)`, `isArchived`, timestamps, `@@unique([userId, name])`, `@@index([userId, isArchived])` |
| Миграция `20260915144948_mig1` | **есть**: таблица `categories` и FK от `expenses` (SetNull) и `budgets` (Cascade) созданы |
| `packages/shared/src/schemas/category.ts` | **есть**: `createCategorySchema`, `updateCategorySchema`, `categorySchema` |
| `apps/api/src/modules/categories/dto/category.dto.ts` | **есть**: `createZodDto(...)` |
| `categories.controller.ts` | **есть**: `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `@CurrentUser('sub')` |
| `categories.module.ts` + регистрация в `app.module.ts` | **есть** |
| `CategoriesService.findAll` | **есть** |
| `CategoriesService.create / update / remove` | `throw new Error('Не реализовано')` ← **задача** |

Итог: ни новой сущности, ни миграции, ни нового модуля не требуется. Работа сводится к одному файлу сервиса + тесты.

**Принятые решения:**

- **Валидация — Zod, а не class-validator.** `class-validator` и `class-transformer` в репозитории не установлены ни в одном `package.json`; валидация идёт через глобальный `ZodValidationPipe` (`APP_PIPE` в `app.module.ts`) и `createZodDto`. CLAUDE.md объявляет `packages/shared` единственным источником правды по формам данных. DTO категорий уже написаны в этом стиле — валидация заработает сама, править нечего.
- **DELETE — архивация**, а не физическое удаление: `Budget.categoryId` имеет `onDelete: Cascade`, то есть hard-delete безвозвратно снёс бы бюджеты пользователя. Поле `isArchived` и фильтр `isArchived: false` в `findAll` заведены ровно под этот сценарий.
- **Тесты пишем** — `categories.service.spec.ts`.

`packages/shared` не меняется → пересборка пакета не нужна.

## Изменения

### 1. `apps/api/src/modules/categories/categories.service.ts` — основная работа

Эталон стиля: `apps/api/src/modules/users/users.repository.ts` (обработка `P2002`) и `apps/api/src/modules/expenses/expenses.service.ts` (доступ через `this.prisma.client.*`).

**Импорты.** Добавить `ConflictException`, `NotFoundException` из `@nestjs/common` и `Prisma` из `@expense-tracker/database` — именно значением, а не `import type`: нужен `instanceof` для распознавания `P2002` (тот же комментарий, что в `users.repository.ts:3`).

**Константа `CATEGORY_SELECT`** по образцу `AUTH_USER_SELECT` из `users.repository.ts`:

```ts
/** Ровно поля categorySchema: userId — деталь хранилища, клиенту он не нужен. */
const CATEGORY_SELECT = {
  id: true, name: true, icon: true, color: true,
  isArchived: true, createdAt: true, updatedAt: true,
} satisfies Prisma.CategorySelect;
```

Применить во всех четырёх методах, включая существующий `findAll` — сейчас он отдаёт сырую строку Prisma вместе с `userId`, которого нет в `categorySchema`. Правка одной строки, но без неё ответы методов разъедутся между собой.

**`create(userId, input)`** — `category.create({ data: { userId, ...input }, select: CATEGORY_SELECT })` в `try/catch`.

Предварительной проверки «занято ли имя» нет намеренно — это TOCTOU-гонка, уникальный индекс `@@unique([userId, name])` единственный арбитр (то же рассуждение, что в `users.repository.ts:92-97`).

В `catch` на `P2002` — **не сразу 409**. Из-за архивации имя может быть занято скрытой категорией, которой пользователь в списке не видит: тогда 409 выглядел бы как ошибка на пустом месте. Поэтому: найти `category.findUnique({ where: { userId_name: { userId, name: input.name } } })`;

- если `isArchived === true` → снять флаг и заодно записать пришедшие `icon`/`color`, вернуть эту запись (пользователь фактически возвращает категорию из архива);
- иначе → `ConflictException('Категория с таким названием уже есть')`.

**`update(userId, id, input)`** — сначала `category.findFirst({ where: { id, userId }, select: { id: true } })`; если `null` → `NotFoundException('Категория не найдена')`. Проверка обязательна: `update({ where: { id } })` без `userId` задел бы чужую запись. Затем `category.update({ where: { id }, data: input, select: CATEGORY_SELECT })`, в `catch` на `P2002` → `ConflictException` (переименование в занятое имя).

**`remove(userId, id)`** — мягкое удаление:

```ts
const { count } = await this.prisma.client.category.updateMany({
  where: { id, userId, isArchived: false },
  data: { isArchived: true },
});
if (count === 0) throw new NotFoundException('Категория не найдена');
```

`updateMany`, а не `update`, потому что `update` умеет искать только по уникальному полю и не даёт отфильтровать по `userId` в одном запросе. Ничего не возвращаем — контроллер отдаст пустое тело. Повторный `DELETE` по уже архивированной категории даст 404: она не видна в `findAll`, поэтому для клиента её и правда нет.

HTTP-исключения руками приводить не надо — `AllExceptionsFilter` сам приведёт их к `apiErrorSchema`.

### 2. `apps/api/src/modules/categories/categories.service.spec.ts` — новый файл

Стиль берётся из `apps/api/src/modules/users/users.service.spec.ts`: без `Test.createTestingModule`, прямой `new CategoriesService(prismaMock)`, plain-моки `{ method: jest.fn() }`, `jest.resetAllMocks()` в `beforeEach`, названия тестов по-русски.

Мок Prisma (готового в репозитории нет):

```ts
const category = { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(),
                   create: jest.fn(), update: jest.fn(), updateMany: jest.fn() };
const prisma = { client: { category } } as unknown as PrismaService;
```

Ошибку `P2002` строить настоящим `new Prisma.PrismaClientKnownRequestError(...)` с `code: 'P2002'` — сервис распознаёт её через `instanceof`, самодельный объект не пройдёт.

Покрыть:

- `findAll` — фильтрует по `userId` и `isArchived: false`, сортирует по имени;
- `create` — успешный путь кладёт `userId` в `data`;
- `create` — `P2002` + активная категория → `ConflictException`;
- `create` — `P2002` + архивная категория → разархивация вместо ошибки;
- `update` — чужой/несуществующий id → `NotFoundException` (и `category.update` не вызывался);
- `update` — `P2002` → `ConflictException`;
- `remove` — `count: 1` проходит; `count: 0` → `NotFoundException`.

### Чего не делаем

Фронтенд (`apps/web`) не трогаем — запрос про сущность, сервис и контроллер. `packages/shared` не меняем. Эндпоинт аналитики по категориям (`categoryBreakdownSchema` в `shared/src/schemas/expense.ts` объявлена, но нигде не используется) — вне объёма.

## Порядок работ

1. `CATEGORY_SELECT` + правка `findAll` — общий фундамент для остальных методов.
2. `create` (включая разархивацию по `P2002`).
3. `update`.
4. `remove`.
5. `categories.service.spec.ts`.
6. Финальная проверка: typecheck, lint, тесты, сквозной прогон через Swagger.

Чеклист — в `categories-crud.tasks.md`.

## Проверка

```bash
pnpm --filter @expense-tracker/api exec jest src/modules/categories/categories.service.spec.ts
pnpm typecheck
pnpm lint
```

Затем сквозная проверка вживую:

```bash
pnpm db:up && pnpm dev          # api :4000
```

Через Swagger UI на `http://localhost:4000/api/docs` (bearer-токен из `POST /api/v1/auth/register`):

1. `POST /categories` `{"name":"Еда","icon":"utensils","color":"#22c55e"}` → 201, в ответе нет `userId`;
2. тот же запрос повторно → 409 «Категория с таким названием уже есть»;
3. `GET /categories` → созданная категория в списке;
4. `PATCH /categories/:id` `{"color":"#ef4444"}` → 200 с новым цветом;
5. `DELETE /categories/:id` → 200, после него `GET /categories` пуст, а в `psql` строка на месте с `isArchived = true`;
6. `POST /categories` с тем же именем «Еда» → 201, категория вернулась из архива;
7. `PATCH`/`DELETE` с чужим id → 404;
8. любой запрос без заголовка `Authorization` → 401 (глобальный `JwtAuthGuard`).
