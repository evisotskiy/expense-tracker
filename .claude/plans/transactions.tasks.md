# Задачи: реализация transactions.md

Статус отмечается по ходу выполнения. Порядок соответствует разделу «Порядок работ» плана.

Объём: новая модель + миграция, новый файл схем в `shared`, новый модуль API из пяти файлов — и
удаление expense-слоя (модель, модуль, схемы), который `Transaction` замещает.

## 1. Схема Prisma
- [ ] `enum TransactionType { INCOME EXPENSE }`
- [ ] `model Transaction`: `id cuid`, `userId`, `categoryId` (NOT NULL), `amount Decimal(12,2)`, `type`, `currency VarChar(3)`, `description VarChar(500)?`, `date`, `createdAt`, `updatedAt`
- [ ] Связи: `user` — `onDelete: Cascade`, `category` — `onDelete: Restrict`
- [ ] Индексы `@@index([userId, date(sort: Desc)])` и `@@index([categoryId])` (второй — под проверку Restrict), `@@map("transactions")`
- [ ] Комментарии `///` по-русски: почему категория обязательна, почему amount всегда положительна, почему currency дублируется
- [ ] `User.expenses` → `transactions Transaction[]`; `Category.expenses` → `transactions Transaction[]`
- [ ] Удалить `model Expense`
- [ ] Поправить комментарий над `User.baseCurrency` («для новых расходов» → «для новых транзакций»)

## 2. Миграция
- [ ] `SELECT count(*) FROM expenses;` — убедиться, что терять нечего
- [ ] `prisma migrate dev --name add-transactions --create-only`
- [ ] Прочитать сгенерированный SQL: `CREATE TYPE` + `CREATE TABLE transactions` + `DROP TABLE expenses`, FK и индексы на месте
- [ ] `pnpm db:migrate` — применить
- [ ] `pnpm --filter @expense-tracker/database build` (без него нет `Prisma.TransactionSelect`)

## 3. shared: деньги
- [ ] `signedMoneySchema` в `money.ts` (regex `^-?\d{1,10}\.\d{2}$` + `refine` против `'-0.00'`), `moneySchema` НЕ ослаблять
- [ ] Починить `toMinorUnits`: знак сейчас применяется только к целой части — `toMinorUnits('-123.45')` даёт `-12255` вместо `-12345`
- [ ] `subtractMoney(minuend, subtrahend)` — парная к `sumMoney`

## 4. shared: схемы транзакций
- [ ] Новый `packages/shared/src/schemas/transaction.ts`
- [ ] `transactionTypeSchema` — `z.enum`, независимо от Prisma (как `budgetPeriodSchema`)
- [ ] `transactionDateSchema` — перенос `spentAtSchema` (не дальше «сейчас + сутки»)
- [ ] `createTransactionSchema`, `updateTransactionSchema` (`.partial()` работает — refine на поле, не на объекте)
- [ ] `transactionSchema` — `category: categorySchema` НЕ nullable
- [ ] `transactionFiltersSchema` — `paginationQuerySchema.extend({ dateFrom, dateTo, type, categoryId })`
- [ ] `transactionSummaryQuerySchema` — `month` 1–12, `year` 1970–2100 (границы года защищают от `Invalid Date`), оба обязательные, `z.coerce`
- [ ] `transactionCategorySummarySchema`, `transactionSummarySchema` (`currency`, `balance: signedMoneySchema`)
- [ ] Типы `...Input`/`...Data` для create/update, `z.infer` для остальных
- [ ] `index.ts`: `'./schemas/expense'` → `'./schemas/transaction'`
- [ ] Удалить `packages/shared/src/schemas/expense.ts`
- [ ] `pnpm --filter @expense-tracker/shared build`

## 5. Удаление expense-слоя в API
- [ ] Удалить каталог `apps/api/src/modules/expenses/` (4 файла, тестов нет)
- [ ] `app.module.ts`: импорт `ExpensesModule` → `TransactionsModule`
- [ ] `app.module.ts`: элемент массива `imports`

## 6. Модуль транзакций
- [ ] `dto/transaction.dto.ts` — 4 класса через `createZodDto`
- [ ] `TRANSACTION_SELECT satisfies Prisma.TransactionSelect` (поля `transactionSchema` + вложенный `category` полями `categorySchema`, без `userId`)
- [ ] Приватный `serialize` — Decimal → `toMoneyString`
- [ ] `assertCategoryUsable`: чужая/несуществующая → 404, архивная → 400
- [ ] `findAll` — фильтры, `take: limit + 1`, `orderBy: [{ date: 'desc' }, { id: 'desc' }]` (тай-брейкер обязателен)
- [ ] `findOne` — `findFirst({ id, userId })`, иначе 404 (не 403 — чужой id не подтверждаем)
- [ ] `create` — проверка категории, `data: { ...input, userId }`, catch P2003/P2025 → 404
- [ ] `update` — владение транзакцией → 404; категорию проверяем только если `categoryId` пришёл
- [ ] `remove` — `deleteMany({ id, userId })`, `count === 0` → 404
- [ ] `summary` — границы через `Date.UTC`, `gte`/`lt`; фильтр по `User.baseCurrency`; один `groupBy([categoryId, type])`; догрузка имён категорий **без** фильтра `isArchived`; `subtractMoney` для баланса
- [ ] `transactions.controller.ts` — `@Get('summary')` ОБЯЗАТЕЛЬНО до `@Get(':id')`, с комментарием почему
- [ ] `@Inject(TransactionsService)` в конструкторе контроллера, `@CurrentUser('sub')`, `@ApiTags`/`@ApiOperation`
- [ ] `transactions.module.ts` (PrismaModule не импортируем — он `@Global`)

## 7. Тесты
- [ ] Каркас в стиле `categories.service.spec.ts`: прямой `new TransactionsService(prisma)`, ручной мок `{ client: { transaction, category, user } }`, `jest.resetAllMocks()`
- [ ] Мок суммы — объект с `toFixed`, а не строка (иначе `serialize` не проверяется)
- [ ] `findAll` — фильтры в `where`, сортировка с тай-брейкером, `nextCursor` есть/нет
- [ ] `findOne`/`update`/`remove` — изоляция по `userId`: чужой id → 404, мутирующий вызов не состоялся
- [ ] `create` — чужая категория → 404 и `transaction.create` не вызывался; архивная → 400
- [ ] `create` — P2003 → `NotFoundException`; прочие ошибки пробрасываются
- [ ] `update` — без `categoryId` `category.findFirst` не вызывался
- [ ] `summary` — границы января и декабря (переход через год) в UTC
- [ ] `summary` — баланс, отрицательный баланс строкой со знаком
- [ ] `summary` — пустой месяц: нули, `categories: []`, второй запрос не делался
- [ ] `summary` — имя и цвет категории подставлены в разбивку
- [ ] Регресс на деньги: `toMinorUnits('-123.45') === -12345`, `subtractMoney('100.00','130.25') === '-30.25'`

## 8. Документация
- [ ] `CLAUDE.md` «Состояние проекта» — убрать expenses из списка заглушек, добавить транзакции
- [ ] `CLAUDE.md` «Деньги» — `ExpensesService.serialize` → `TransactionsService.serialize`
- [ ] `CLAUDE.md` «Поток данных» — «См. конец `schemas/expense.ts`» → `schemas/transaction.ts`

## 9. Финальная проверка
- [ ] `pnpm --filter @expense-tracker/api exec jest src/modules/transactions/transactions.service.spec.ts`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build` (прямой пункт ТЗ)
- [ ] Сквозной прогон по 14 пунктам раздела «Проверка» плана

## 10. Внеплановые находки

Сюда дописывается то, что всплыло по ходу реализации и не входило в план.

- [ ] **Известный долг (вне объёма задачи):** `budgetProgressSchema.remaining`
      (`packages/shared/src/schemas/budget.ts:54`) объявлен как `moneySchema`, хотя при
      перерасходе бюджета уходит в минус — сломается ровно так же, как сломался бы `balance`.
      Чинится заменой на `signedMoneySchema`, но `BudgetsService.findProgress` пока заглушка,
      поэтому трогать сейчас необязательно.
