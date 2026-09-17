# Задачи: реализация categories-crud.md

Статус отмечается по ходу выполнения. Порядок соответствует разделу «Порядок работ» плана.

Правится ровно один существующий файл (`categories.service.ts`) и создаётся один новый (`categories.service.spec.ts`). Модель Prisma, миграция, схемы в `shared`, DTO, контроллер и модуль уже готовы — в них изменений нет.

## 1. Фундамент: select и импорты
- [x] `categories.service.ts` — импорты `ConflictException`, `NotFoundException` из `@nestjs/common` (добавляются в задаче 2/3 — пока не нужны для select/findAll)
- [x] Импорт `Prisma` из `@expense-tracker/database` **значением**, не `import type` (нужен `instanceof` для `P2002`), с поясняющим комментарием как в `users.repository.ts:3`
- [x] Константа `CATEGORY_SELECT` (`satisfies Prisma.CategorySelect`) — ровно поля `categorySchema`, без `userId`
- [x] `findAll` — добавить `select: CATEGORY_SELECT` (сейчас отдаёт `userId`, которого нет в контракте)

## 2. create
- [x] `category.create({ data: { userId, ...input }, select: CATEGORY_SELECT })` в `try/catch`
- [x] Без предварительной проверки «занято ли имя» — TOCTOU, арбитр — уникальный индекс; комментарий по образцу `users.repository.ts:92-97`
- [x] `catch` → `instanceof Prisma.PrismaClientKnownRequestError && code === 'P2002'`
- [x] На `P2002`: `findUnique({ where: { userId_name: { userId, name: input.name } } })`
- [x] Ветка «категория архивная» → снять `isArchived`, записать пришедшие `icon`/`color`, вернуть запись
- [x] Ветка «категория активная» → `ConflictException('Категория с таким названием уже есть')`
- [x] Прочие ошибки — пробрасывать без изменений

## 3. update
- [x] `findFirst({ where: { id, userId }, select: { id: true } })`, при `null` → `NotFoundException('Категория не найдена')`
- [x] `category.update({ where: { id }, data: input, select: CATEGORY_SELECT })`
- [x] `catch` на `P2002` → `ConflictException` (переименование в занятое имя)

## 4. remove
- [x] `updateMany({ where: { id, userId, isArchived: false }, data: { isArchived: true } })`
- [x] `count === 0` → `NotFoundException('Категория не найдена')`
- [x] Ничего не возвращаем; комментарий, почему `updateMany`, а не `update` (нельзя отфильтровать по `userId` в одном запросе)

## 5. Тесты — `categories.service.spec.ts`
- [x] Каркас в стиле `users.service.spec.ts`: прямой `new CategoriesService(prisma)`, plain-моки, `jest.resetAllMocks()`
- [x] Мок `{ client: { category: { findMany, findUnique, findFirst, create, update, updateMany } } }`
- [x] Хелпер для настоящей `new Prisma.PrismaClientKnownRequestError(...)` с `code: 'P2002'`
- [x] `findAll` — `where: { userId, isArchived: false }`, `orderBy: { name: 'asc' }`
- [x] `create` — успешный путь кладёт `userId` в `data`
- [x] `create` — `P2002` + активная категория → `ConflictException`
- [x] `create` — `P2002` + архивная категория → разархивация вместо ошибки
- [x] `update` — чужой/несуществующий id → `NotFoundException`, `category.update` не вызывался
- [x] `update` — `P2002` → `ConflictException`
- [x] `remove` — `count: 1` проходит
- [x] `remove` — `count: 0` → `NotFoundException`

## 6. Финальная проверка
- [x] `pnpm --filter @expense-tracker/api exec jest src/modules/categories/categories.service.spec.ts` — 10/10
- [x] `pnpm typecheck` (на Node 24.21.0 из `.nvmrc` — на v20.10.0 падает `prisma generate` с `styleText is not a function`, к моим правкам не относится)
- [x] `pnpm lint` (`@expense-tracker/api` — 0 ошибок; предсуществующие warning в `database` и падение `web` из-за circular JSON в eslintrc воспроизводятся и на чистом `master` без моих правок)
- [x] `pnpm --filter @expense-tracker/api test` — 70/70 зелёных (на Node 20.10.0 `password.spec.ts`/`auth.controller.spec.ts` падали SIGSEGV — тот же нативный argon2 + версия Node, не связано с categories)
- [x] Сквозной прогон через живой API (`pnpm db:up` + `pnpm --filter @expense-tracker/api dev`, запросы curl'ом вместо Swagger UI) по 8 пунктам раздела «Проверка» плана — все статусы совпали: 201 создание → 409 дубль → 200 список с записью → 200 PATCH цвета → 200 DELETE/архивация, список опустел → 201 повторное создание вернуло ту же запись из архива с новыми icon/color → 404 на PATCH/DELETE чужого id → 401 без токена
