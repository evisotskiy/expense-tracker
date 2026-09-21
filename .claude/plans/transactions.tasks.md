# Задачи: реализация transactions.md

Статус отмечается по ходу выполнения. Порядок соответствует разделу «Порядок работ» плана.

Объём: новая модель + миграция, новый файл схем в `shared`, новый модуль API из пяти файлов — и
удаление expense-слоя (модель, модуль, схемы), который `Transaction` замещает.

## 1. Схема Prisma

- [x] `enum TransactionType { INCOME EXPENSE }`
- [x] `model Transaction`: `id cuid`, `userId`, `categoryId` (NOT NULL), `amount Decimal(12,2)`, `type`, `currency VarChar(3)`, `description VarChar(500)?`, `date`, `createdAt`, `updatedAt`
- [x] Связи: `user` — `onDelete: Cascade`, `category` — `onDelete: Restrict`
- [x] Индексы `@@index([userId, date(sort: Desc)])` и `@@index([categoryId])` (второй — под проверку Restrict), `@@map("transactions")`
- [x] Комментарии `///` по-русски: почему категория обязательна, почему amount всегда положительна, почему currency дублируется
- [x] `User.expenses` → `transactions Transaction[]`; `Category.expenses` → `transactions Transaction[]`
- [x] Удалить `model Expense`
- [x] Поправить комментарий над `User.baseCurrency` («для новых расходов» → «для новых транзакций»)

## 2. Миграция

- [x] `SELECT count(*) FROM expenses;` — убедиться, что терять нечего (0 строк)
- [x] `prisma migrate dev --name add-transactions --create-only`
- [x] Прочитать сгенерированный SQL: `CREATE TYPE` + `CREATE TABLE transactions` + `DROP TABLE expenses`, FK и индексы на месте
- [x] `pnpm db:migrate` — применить
- [x] `pnpm --filter @expense-tracker/database build` (без него нет `Prisma.TransactionSelect`)

## 3. shared: деньги

- [x] `signedMoneySchema` в `money.ts` (regex `^-?\d{1,10}\.\d{2}$` + `refine` против `'-0.00'`), `moneySchema` НЕ ослаблена
- [x] Починить `toMinorUnits`: знак применялся только к целой части — регресс `toMinorUnits('-123.45') === -12345` подтверждён в тесте и вживую (сводка с отрицательным балансом)
- [x] `subtractMoney(minuend, subtrahend)` — парная к `sumMoney`

## 4. shared: схемы транзакций

- [x] Новый `packages/shared/src/schemas/transaction.ts`
- [x] `transactionTypeSchema` — `z.enum`, независимо от Prisma (как `budgetPeriodSchema`)
- [x] `transactionDateSchema` — перенос `spentAtSchema` (не дальше «сейчас + сутки»)
- [x] `createTransactionSchema`, `updateTransactionSchema` (`.partial()` работает — refine на поле, не на объекте)
- [x] `transactionSchema` — `category: categorySchema` НЕ nullable
- [x] `transactionFiltersSchema` — `paginationQuerySchema.extend({ dateFrom, dateTo, type, categoryId })`
- [x] `transactionSummaryQuerySchema` — `month` 1–12, `year` 1970–2100 (границы года защищают от `Invalid Date`), оба обязательные, `z.coerce`
- [x] `transactionCategorySummarySchema`, `transactionSummarySchema` (`currency`, `balance: signedMoneySchema`)
- [x] Типы `...Input`/`...Data` для create/update, `z.infer` для остальных
- [x] `index.ts`: `'./schemas/expense'` → `'./schemas/transaction'`
- [x] Удалить `packages/shared/src/schemas/expense.ts`
- [x] `pnpm --filter @expense-tracker/shared build`

## 5. Удаление expense-слоя в API

- [x] Удалить каталог `apps/api/src/modules/expenses/` (4 файла, тестов нет)
- [x] `app.module.ts`: импорт `ExpensesModule` → `TransactionsModule`
- [x] `app.module.ts`: элемент массива `imports`

## 6. Модуль транзакций

- [x] `dto/transaction.dto.ts` — 4 класса через `createZodDto`
- [x] `TRANSACTION_SELECT satisfies Prisma.TransactionSelect` (поля `transactionSchema` + вложенный `category` полями `categorySchema`, без `userId`)
- [x] Приватный `serialize` — Decimal → `toMoneyString`
- [x] `assertCategoryUsable`: чужая/несуществующая → 404, архивная → 400
- [x] `findAll` — фильтры, `take: limit + 1`, `orderBy: [{ date: 'desc' }, { id: 'desc' }]` (тай-брейкер обязателен)
- [x] `findOne` — `findFirst({ id, userId })`, иначе 404 (не 403 — чужой id не подтверждаем)
- [x] `create` — проверка категории, `data: { ...input, userId }`, catch P2003/P2025 → 404
- [x] `update` — владение транзакцией → 404; категорию проверяем только если `categoryId` пришёл
- [x] `remove` — `deleteMany({ id, userId })`, `count === 0` → 404
- [x] `summary` — границы через `Date.UTC`, `gte`/`lt`; фильтр по `User.baseCurrency`; один `groupBy([categoryId, type])`; догрузка имён категорий **без** фильтра `isArchived`; `subtractMoney` для баланса
- [x] `transactions.controller.ts` — `@Get('summary')` объявлен до `@Get(':id')`, с комментарием почему; подтверждено вживую
- [x] `@Inject(TransactionsService)` в конструкторе контроллера, `@CurrentUser('sub')`, `@ApiTags`/`@ApiOperation`
- [x] `transactions.module.ts` (PrismaModule не импортируем — он `@Global`)

## 7. Тесты

- [x] Каркас в стиле `categories.service.spec.ts`: прямой `new TransactionsService(prisma)`, ручной мок `{ client: { transaction, category, user } }`, `jest.resetAllMocks()`
- [x] Мок суммы — объект с `toFixed`, а не строка (иначе `serialize` не проверяется)
- [x] `findAll` — фильтры в `where`, сортировка с тай-брейкером, `nextCursor` есть/нет
- [x] `findOne`/`update`/`remove` — изоляция по `userId`: чужой id → 404, мутирующий вызов не состоялся
- [x] `create` — чужая категория → 404 и `transaction.create` не вызывался; архивная → 400
- [x] `create` — P2003 → `NotFoundException`; прочие ошибки пробрасываются
- [x] `update` — без `categoryId` `category.findFirst` не вызывался
- [x] `summary` — границы января и декабря (переход через год) в UTC
- [x] `summary` — баланс, отрицательный баланс строкой со знаком
- [x] `summary` — пустой месяц: нули, `categories: []`, второй запрос не делался
- [x] `summary` — имя и цвет категории подставлены в разбивку
- [x] Регресс на деньги: `toMinorUnits('-123.45') === -12345`, `subtractMoney('100.00','130.25') === '-30.25'` (23/23 тестов зелёные)

## 8. Документация

- [x] `CLAUDE.md` «Состояние проекта» — убрать expenses из списка заглушек, добавить транзакции
- [x] `CLAUDE.md` «Деньги» — `ExpensesService.serialize` → `TransactionsService.serialize`
- [x] `CLAUDE.md` «Поток данных» — «См. конец `schemas/expense.ts`» → `schemas/transaction.ts`

## 9. Финальная проверка

- [x] `pnpm --filter @expense-tracker/api exec jest src/modules/transactions/transactions.service.spec.ts` — 23/23
- [x] `pnpm typecheck` — все 6 пакетов зелёные
- [x] `pnpm lint` — 0 ошибок (1 предсуществующий warning в `packages/database`, не мой)
- [x] `pnpm test` — API 93/93, web 27/27
- [x] `pnpm build` (прямой пункт ТЗ) — все пакеты собрались
- [x] Сквозной прогон по 14 пунктам раздела «Проверка» плана — все статусы и цифры сошлись, включая отрицательный баланс (`-50500.50`) и FK `Restrict` (прямой `DELETE` категории из psql упал с ожидаемой ошибкой)

## 10. Внеплановые находки

Сюда дописывается то, что всплыло по ходу реализации и не входило в план.

- [ ] **Известный долг (вне объёма задачи):** `budgetProgressSchema.remaining`
      (`packages/shared/src/schemas/budget.ts:54`) объявлен как `moneySchema`, хотя при
      перерасходе бюджета уходит в минус — сломается ровно так же, как сломался бы `balance`.
      Чинится заменой на `signedMoneySchema`, но `BudgetsService.findProgress` пока заглушка,
      поэтому трогать сейчас необязательно.

- [x] **Критический баг, обнаруженный и исправленный только в своём модуле (вне объёма
      задачи — затрагивает весь проект):** глобальный `ZodValidationPipe` не валидировал тело
      запроса **ни в одном** контроллере API. Причина: все DTO импортируются в контроллерах как
      `import { type XDto }` — TypeScript при `emitDecoratorMetadata` стирает класс из
      `design:paramtypes` для type-only импортов, и в скомпилированном `dist` параметр получает
      тип `Object`/`Function` вместо самого DTO-класса. `nestjs-zod`'s `ZodValidationPipe` ищет
      схему по `metatype.isZodDto`, это условие не выполняется, и пайп молча пропускает значение
      без валидации.

      **Подтверждено вживую:** `POST /auth/register` с `{"email":"not-an-email","password":"abc"}`
          вернул `201` вместо `400` (email не по формату, пароль без цифр/заглавных). До правки
          `TransactionsController` то же самое подтвердилось на транзакциях: `POST /transactions` с
          некорректной суммой `"1 234"` и датой в будущем давали `500 Внутренняя ошибка сервера`
          (запрос долетал до Prisma необработанным) вместо `400`.

          Проверено на скомпилированном `dist`: `categories.controller.js` и `budgets.controller.js`
          получают `design:paramtypes` вида `[String, Function]` для DTO-параметров — тот же дефект.

          **Что сделано:** в `transactions.controller.ts` импорт DTO переведён с `import type` на
          обычный (value) импорт, с `eslint-disable-next-line @typescript-eslint/consistent-type-imports`
          и комментарием, объясняющим причину — это восстанавливает `design:paramtypes` и делает
          валидацию транзакций рабочей (подтверждено: `400` с разбором по полям на некорректной сумме
          и дате из будущего).

          **Что НЕ сделано (вне объёма этой задачи):** `auth.controller.ts`, `categories.controller.ts`,
          `budgets.controller.ts` не тронуты — там баг остаётся. Исправление требует либо того же
          приёма (value-импорт DTO + eslint-disable) в каждом контроллере, либо смены правила
          `@typescript-eslint/consistent-type-imports` в `packages/eslint-config/base.js`, либо
          локальных пайпов с явной схемой (`@Body(new ZodValidationPipe(schema))`). Это отдельная
          задача, затрагивающая весь проект, а не только транзакции — решение и приоритет должны
          остаться за пользователем.
