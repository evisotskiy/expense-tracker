# Транзакции: доходы и расходы вместо расходов

## Контекст

ТЗ (`.claude/prompts/transactions.md`): создать `TransactionsModule` — центральный модуль учёта
доходов и расходов (модель `Transaction` с типом `INCOME`/`EXPENSE`, CRUD + сводка за месяц).

При разведке выяснилось, что задача пересекается с существующим каркасом:

| Слой | Состояние |
| --- | --- |
| `model Expense` в `schema.prisma` | **есть**: `amount Decimal(12,2)`, `currency`, `note`, `spentAt`, `categoryId?` (SetNull) |
| `apps/api/src/modules/expenses/` | **есть**: модуль, контроллер, dto; из сервиса реализован только `findAll`, `create/update/remove` — `throw new Error('Не реализовано')` |
| `packages/shared/src/schemas/expense.ts` | **есть**: схемы расходов + неиспользуемые `categoryBreakdownSchema`, `dailyTotalSchema` |

`Transaction` этот каркас почти полностью дублирует. Принятые решения:

1. **`Transaction` заменяет `Expense`.** Модель, модуль `expenses` и схемы `expense.ts`
   удаляются. Данные не теряются: через API в таблицу `expenses` физически нельзя было ничего
   записать (все три метода записи — заглушки), а FK на неё не ссылается никто — в
   `migrations/20260915144948_mig1/migration.sql` `expenses` фигурирует только как дочерняя
   таблица, у `budgets` FK на `users` и `categories`.
2. **Поля — по конвенциям проекта, а не буквально по ТЗ.** `@default(cuid())` вместо `uuid()`
   (иначе `idSchema = z.cuid()` завернёт все id в 400), плюс `currency` (как у `Expense` и
   `Budget` — чтобы смена `User.baseCurrency` не переписывала историю) и `updatedAt`.
3. **`categoryId` обязательный, `onDelete: Restrict`.** Физического удаления категорий в коде
   нет (`CategoriesService.remove` — это `updateMany({ isArchived: true })`), поэтому Restrict
   пользователю не мешает и работает как страховка от случайного стирания истории.
4. **Сводка отдаёт итоги и разбивку по категориям.**

Прочие расхождения ТЗ с конвенциями: параметры фильтра называем по ТЗ (`dateFrom`/`dateTo`, а не
`from`/`to` как у расходов), поле даты — `date` (для доходов `spentAt` был бы неправдой), но
курсорную пагинацию из `paginationQuerySchema` сохраняем — это сквозная конвенция проекта.

## Изменения

### 1. `packages/database/prisma/schema.prisma`

Удалить `model Expense`, добавить взамен:

```prisma
/// Доход или расход. Одна таблица на оба вида: отличаются они только знаком в отчётах,
/// а запросы (лента, фильтры, итоги за месяц) у них общие.
enum TransactionType {
  INCOME
  EXPENSE
}

model Transaction {
  id     String @id @default(cuid())
  userId String
  /// Категория обязательна: транзакция без неё не попадает ни в одну строку отчёта
  /// и молча искажает итоги. Удаление категорий мягкое (isArchived), поэтому Restrict
  /// не мешает «удалить» категорию — он лишь запрещает стереть ту, на которой висит история.
  categoryId String

  /// Decimal(12, 2) — как у Budget: точная арифметика в Postgres, на границе API строка.
  /// Всегда положительная: знак несёт type, иначе «расход -500» и «расход 500» стали бы
  /// двумя способами записать одно и то же.
  amount Decimal         @db.Decimal(12, 2)
  type   TransactionType

  /// ISO 4217. Дублируется в транзакции, чтобы смена User.baseCurrency не переписывала историю.
  currency String @db.VarChar(3)

  description String?  @db.VarChar(500)
  /// Когда деньги реально пришли или ушли (не когда запись создана).
  date        DateTime

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  /// Главный запрос приложения: «транзакции пользователя за период, свежие сверху».
  /// Он же обслуживает сводку: она фильтрует ровно по userId + диапазону date.
  @@index([userId, date(sort: Desc)])
  /// Нужен проверке Restrict: без него Postgres делает seq scan по transactions
  /// при каждой попытке удалить категорию.
  @@index([categoryId])
  @@map("transactions")
}
```

В `User` и `Category` заменить `expenses Expense[]` → `transactions Transaction[]` (иначе
`prisma validate` упадёт раньше миграции). Поправить комментарий над `User.baseCurrency` («для
новых расходов» → «для новых транзакций»).

Отдельный индекс по `type` не заводим: селективность 1/2, планировщик всё равно возьмёт
`(userId, date)`.

### 2. Миграция `add-transactions`

Сначала посмотреть, есть ли что терять: `SELECT count(*) FROM expenses;`. Если ноль (ожидаемо —
запись через API была невозможна, сидов нет):

```bash
pnpm db:up
pnpm --filter @expense-tracker/database exec prisma migrate dev --name add-transactions --create-only
# прочитать SQL глазами: CREATE TYPE + CREATE TABLE transactions + DROP TABLE expenses
pnpm db:migrate
```

`--create-only` нужен потому, что при DROP **непустой** таблицы `migrate dev` требует
интерактивного подтверждения и в неинтерактивной сессии просто упадёт. Если строки всё же есть и
их нужно сохранить — в сгенерированный файл **до** `DROP TABLE` вписывается перенос
`INSERT INTO transactions SELECT … 'EXPENSE' … FROM expenses WHERE "categoryId" IS NOT NULL`, и
отдельно решается судьба расходов без категории (у транзакций `categoryId` NOT NULL):
fallback-категория или осознанная потеря.

`migrate dev` по завершении сам вызывает `prisma generate`.

### 3. `packages/shared/src/schemas/money.ts`

**`signedMoneySchema`.** `balance = totalIncome − totalExpense` бывает отрицательным, а
`moneySchema` построена на `/^\d{1,10}\.\d{2}$/` — минус не проходит. `moneySchema` при этом
**не ослабляем**: отрицательная сумма транзакции — ошибка, и она должна отклоняться.

```ts
/** То же, что NORMALIZED_MONEY, но допускает ведущий минус. */
const SIGNED_MONEY = /^-?\d{1,10}\.\d{2}$/;

/**
 * Сумма, которая может быть отрицательной: баланс за период, остаток бюджета.
 * Отдельно от moneySchema намеренно: иначе "-100.00" молча прошёл бы валидацию
 * в поле amount при создании расхода.
 */
export const signedMoneySchema = z
  .string()
  .regex(SIGNED_MONEY, 'Сумма должна быть строкой вида "1234.56" или "-1234.56"')
  .refine((value) => value !== '-0.00', { message: 'Ноль записывается без знака' });
```

**Починить `toMinorUnits`** — в нём подтверждённый баг на отрицательных строках: знак
применяется только к целой части, копейки прибавляются вместо вычитания.

```
toMinorUnits('-123.45') → -12255   (проверено в node; ожидалось -12345)
```

Сейчас он не стреляет, потому что отрицательных денежных строк в системе нет. Ровно это
`signedMoneySchema` и меняет, поэтому чинить надо в том же шаге:

```ts
export function toMinorUnits(value: string): number {
  const normalized = normalizeMoney(value);
  const negative = normalized.startsWith('-');
  const [whole = '0', fraction = '00'] = (negative ? normalized.slice(1) : normalized).split('.');
  const minor = Number(whole) * 100 + Number(fraction);
  return negative ? -minor : minor;
}
```

Плюс `subtractMoney(minuend, subtrahend)` — обёртка над `fromMinorUnits(toMinorUnits(a) −
toMinorUnits(b))`, парная к существующей `sumMoney`: вычитание денег называется один раз и в
одном месте.

### 4. `packages/shared/src/schemas/transaction.ts` — новый файл

Состав по конвенции (образец — `expense.ts`, который этот файл замещает):

- `transactionTypeSchema = z.enum(['INCOME', 'EXPENSE'])` — объявляется независимо от Prisma,
  ровно как `budgetPeriodSchema` в `budget.ts`: `shared` не зависит от `@expense-tracker/database`,
  и фронтенд не должен тянуть Prisma-клиент ради двух строк.
- `transactionDateSchema` — `isoDateSchema.refine(дата ≤ сейчас + сутки, 'Дата операции не может
  быть в будущем')`, перенос `spentAtSchema` из `expense.ts`.
- `createTransactionSchema` — `amount: moneyInputSchema`, `type`, `currency: currencySchema`,
  `categoryId: idSchema` (не `nullish`, в отличие от расходов), `description` (trim, max 500,
  nullish), `date`.
- `updateTransactionSchema = createTransactionSchema.partial()` — `.partial()` тут работает,
  потому что `refine` висит на поле, а не на объекте (в `budget.ts` из-за объектного `refine`
  форму пришлось дублировать вручную).
- `transactionSchema` — ответ; `category: categorySchema` **не** nullable: `categoryId` NOT NULL
  плюс Restrict гарантируют, что категория есть всегда.
- `transactionFiltersSchema = paginationQuerySchema.extend({ dateFrom, dateTo, type, categoryId })`.
- `transactionSummaryQuerySchema` — `month` (1–12) и `year` через `z.coerce.number()` (query
  приходит строками), оба обязательные, без значений по умолчанию: «сводка за текущий месяц»
  должна быть явным выбором клиента, иначе ответ молча меняется на границе месяца. У `year`
  границы **1970–2100** не для красоты: `Date.UTC(1000000, 0, 1)` даёт `Invalid Date`, и Prisma
  уронит запрос невнятной ошибкой сериализации вместо честного 400.
- `transactionCategorySummarySchema` — `categoryId`, `categoryName`, `categoryColor`, `type`,
  `total: moneySchema`, `count`. Прямой наследник неиспользуемой `categoryBreakdownSchema` из
  `expense.ts`, но с `type` вместо `share` и ненулевым `categoryId`.
- `transactionSummarySchema` — `currency`, `month`, `year`, `totalIncome`, `totalExpense`,
  `balance: signedMoneySchema`, `categories: [...]`.
- Типы: пара `z.input`/`z.output` (`...Input`/`...Data`) для create/update, `z.infer` для
  остальных — как в `expense.ts`.

В `packages/shared/src/index.ts` строка `export * from './schemas/expense'` заменяется на
`'./schemas/transaction'`.

### 5. Удаление expense-слоя

| Что | Действие |
| --- | --- |
| `packages/shared/src/schemas/expense.ts` | удалить |
| `apps/api/src/modules/expenses/` (4 файла, тестов нет) | удалить каталог |
| `apps/api/src/app.module.ts` | `ExpensesModule` → `TransactionsModule` в импорте и в массиве `imports` |

Внешних потребителей expense-схем нет: во фронтенде (`apps/web/src/**`) ссылок на них нет вообще,
`budget.ts` и `budgets.service.ts` импортируют только `categorySchema`, `common` и `money`.
`dailyTotalSchema` удаляется вместе с файлом — потребителя нет, эндпоинта динамики нет,
восстанавливается из git history одной командой.

Протухшие упоминания (текст, не код): `CLAUDE.md` — «Состояние проекта» (заглушки `expenses`),
«См. конец `schemas/expense.ts`», «паттерн в `ExpensesService.serialize`»; комментарии
`budget.ts:61`, `auth.cookies.ts:21`, `apps/web/next.config.ts:11`. Первые три поправить
обязательно — это документация проекта; остальные по желанию.

### 6. `apps/api/src/modules/transactions/` — новый модуль

Структура по образцу `categories`: `transactions.module.ts`, `transactions.controller.ts`,
`transactions.service.ts`, `dto/transaction.dto.ts`, `transactions.service.spec.ts`.

**DTO** — четыре класса через `createZodDto`: `CreateTransactionDto`, `UpdateTransactionDto`,
`TransactionFiltersDto`, `TransactionSummaryQueryDto`.

**Контроллер** — `@ApiTags('transactions')`, `@ApiOperation` на каждом методе,
`@Inject(TransactionsService)` в конструкторе (иначе `emitDecoratorMetadata` + type-only импорт
ломают DI — комментарий-отсылка `// @Inject: см. common/guards/jwt-auth.guard.ts.`),
`@CurrentUser('sub') userId: string`. Локальных guard-ов и `@ApiResponse` нет — как везде в
проекте.

> **Критично:** `@Get('summary')` объявляется **до** `@Get(':id')`. Nest сопоставляет маршруты в
> порядке объявления, и при обратном порядке `/transactions/summary` уедет в `findOne` с
> `id = "summary"` и вернёт 404 вместо сводки. Тот же порядок уже соблюдён в
> `budgets.controller.ts` (`@Get('progress')` перед параметрическими). Отразить комментарием.

**Сервис** — `TRANSACTION_SELECT satisfies Prisma.TransactionSelect` (поля `transactionSchema`
плюс вложенный `category` ровно с полями `categorySchema`, без `userId`), приватный `serialize`
для Decimal через `toMoneyString` (перенос паттерна из `ExpensesService.serialize`), `userId` в
каждом `where`.

- `findAll` — курсорная выборка `take: limit + 1` по образцу `ExpensesService.findAll`; `where`
  собирается из фильтров; `orderBy: [{ date: 'desc' }, { id: 'desc' }]` — второй ключ
  тай-брейкер, без него пагинация может задвоить или пропустить запись при одинаковых датах.
- `findOne` — `findFirst({ where: { id, userId } })`, при `null` → `NotFoundException('Транзакция
  не найдена')`. Именно `findFirst` с `userId`, а не `findUnique` по id: чужая запись должна
  давать 404, а не 403 — существование чужого id не подтверждаем.
- `create` — `assertCategoryUsable(userId, input.categoryId)`, затем
  `create({ data: { ...input, userId }, select: TRANSACTION_SELECT })`.
- `update` — `findFirst({ id, userId })` → 404; `assertCategoryUsable` только если `categoryId`
  реально пришёл (при `PATCH { amount }` лишний запрос ни к чему); затем `update({ where: { id } })`.
- `remove` — `deleteMany({ where: { id, userId } })`, при `count === 0` → 404. `deleteMany`, а не
  `delete`, по той же причине, что в `CategoriesService.remove`: `delete` ищет только по
  уникальному полю и не даёт отфильтровать по `userId` одним запросом. Удаление физическое — на
  транзакции, в отличие от категорий, никто не ссылается.

**`assertCategoryUsable(userId, categoryId)`** — один `findFirst`, закрывающий сразу владение и
архив. FK проверяет только существование категории, но не владельца: без этой проверки чужой cuid
в теле запроса повесил бы транзакцию на чужую категорию, и она всплыла бы в сводке.

```ts
const category = await this.prisma.client.category.findFirst({
  where: { id: categoryId, userId },
  select: { isArchived: true },
});
// 404, а не 403: чужая категория для этого пользователя не существует — иначе ответ
// подтверждал бы, что такой id есть у кого-то другого. Формулировка как в CategoriesService.
if (!category) throw new NotFoundException('Категория не найдена');
// Архивная принадлежит пользователю, но выбирать её больше нельзя: это ошибка ввода,
// а не «не найдено» — форме на фронте эти случаи надо различать.
if (category.isArchived) throw new BadRequestException('Категория архивирована — выберите другую');
```

В `catch` вокруг записи — страховка от гонки (категорию заархивировали между проверкой и
вставкой) по образцу P2002 в `CategoriesService`:
`instanceof Prisma.PrismaClientKnownRequestError && (code === 'P2003' || code === 'P2025')` →
`NotFoundException('Категория не найдена')`, прочее пробрасываем. Catch обязателен даже там, где
гонка кажется невозможной: голый `PrismaClientKnownRequestError` — не `HttpException`, и
`AllExceptionsFilter` отдаст 500 вместо внятного ответа.

### 7. Сводка за месяц

**Границы — только через `Date.UTC`,** полуинтервал `[start, end)`:

```ts
const start = new Date(Date.UTC(year, month - 1, 1));
// Date.UTC сам переносит 12-й месяц в январь следующего года — отдельной ветки не нужно
const end = new Date(Date.UTC(year, month, 1));
```

`new Date(year, month - 1, 1)` — ловушка: конструктор с раздельными аргументами трактует их в
зоне процесса, и на сервере в UTC+3 сентябрьский отчёт начинался бы 31 августа в 21:00 UTC (три
часа августа внутри сентября и потерянный хвост месяца), а цифры зависели бы от `TZ` контейнера.
Колонка в Postgres — `TIMESTAMP(3)` без зоны, драйвер пишет и читает UTC, так что расхождение
живёт только в JS-коде, который строит границы. `lt: end`, а не `lte`: транзакция ровно в полночь
1-го числа принадлежит начинающемуся месяцу, а не двум сразу (копировать `lte` из
`ExpensesService.findAll` нельзя — там это осознанно, `to` включительная).

Это ровно та же шкала, в которой `budgetPeriodRange` (`packages/shared/src/schemas/budget.ts:96`)
считает месяц для бюджетов, включая записанный там компромисс «месяц календарный UTC, таймзоны
пользователя в проекте нет». Расхождения между сводкой и бюджетом за тот же месяц не будет.

**Валюта.** Суммировать RUB с USD в один `totalIncome` — численная ложь, а курсов в проекте нет и
зависимости добавлять нельзя. Поэтому сводка считается **в базовой валюте пользователя**, и эта
валюта явно возвращается в ответе:

```ts
const { baseCurrency } = await this.prisma.client.user.findUniqueOrThrow({
  where: { id: userId },
  select: { baseCurrency: true },
});
const where = { userId, currency: baseCurrency, date: { gte: start, lt: end } };
```

Из токена валюту не достать — `JwtPayload` содержит только `sub` и `email`. Поле `currency` в
`transactionSummarySchema` — не украшение: без него ответ молча умалчивал бы, что часть
транзакций в отчёт не вошла.

**Запросы.** Разбивка и итоги берутся из одного `groupBy` — отдельный агрегат по типам не нужен,
итоги выводятся суммированием той же разбивки через `sumMoney`:

```ts
const rows = await this.prisma.client.transaction.groupBy({
  by: ['categoryId', 'type'],
  where,
  _sum: { amount: true },
  _count: { _all: true },
  orderBy: { _sum: { amount: 'desc' } },
});
```

`_sum.amount` типизирован как `Decimal | null`, поэтому фолбэк обязателен —
`toMoneyString(row._sum.amount ?? 0)` даёт `'0.00'`. `groupBy` не делает join, поэтому имена и
цвета категорий догружаются вторым запросом
`category.findMany({ where: { id: { in: categoryIds }, userId } })` — и он пропускается, если
разбивка пуста.

> **`isArchived` здесь не фильтруем.** У архивной категории остаются транзакции, и копирование
> фильтра `isArchived: false` из `CategoriesService.findAll` выкинуло бы их подписи из отчёта —
> деньги показывались бы без названия.

Итого 3 запроса (валюта + `groupBy` + имена категорий). Альтернатива «вытащить все транзакции
месяца и сложить в JS» отвергнута: число строк за месяц не ограничено, а суммирование Decimal на
стороне Postgres и точнее, и дешевле; `$queryRaw` с JOIN экономит round-trip, но выпадает из
типобезопасности и делает тест на моке Prisma тестом SQL-строки.

**Баланс** — `subtractMoney(totalIncome, totalExpense)`: считаем копейки, а не рубли (`Number` на
строках дал бы хвост IEEE-754), знак расставит `fromMinorUnits`.

### 8. `transactions.service.spec.ts`

Стиль по `categories.service.spec.ts`: без `Test.createTestingModule`, прямой
`new TransactionsService(prisma)`, ручной мок
`{ client: { transaction: {...}, category: {...}, user: {...} } }`, `PrismaService` импортируется
как `type`, `Prisma` — значением (для настоящего `new Prisma.PrismaClientKnownRequestError(msg,
{ code: 'P2003', clientVersion: '7.10.0' })`), `jest.resetAllMocks()` в `beforeEach`, русские
названия кейсов. Мок суммы — объект с `toFixed`, а не строка: так проверяется, что сервис реально
прогоняет Decimal через `serialize`.

### Чего не делаем

Фронтенд (`apps/web`) не трогаем — ТЗ про backend-модуль. Новых зависимостей не добавляем (прямое
ограничение ТЗ). `BudgetsService.findProgress` остаётся заглушкой, хотя теперь ему считать факт по
`transaction` с `type: 'EXPENSE'` — это отдельная задача. Эндпоинт динамики по дням
(`dailyTotalSchema`) не делаем: его в ТЗ нет.

## Порядок работ

1. Схема Prisma: `Transaction` + `TransactionType`, правки `User`/`Category`, удаление `Expense`.
2. Миграция `add-transactions` (проверить `count(*) FROM expenses` → `--create-only` → прочитать
   SQL → `pnpm db:migrate`).
3. `pnpm --filter @expense-tracker/database build` — без этого `Prisma.TransactionSelect` не
   существует: приложения потребляют `dist`, а не исходники.
4. shared: `money.ts` (`signedMoneySchema`, починка `toMinorUnits`, `subtractMoney`) → новый
   `schemas/transaction.ts` → удалить `schemas/expense.ts` → поправить `index.ts`.
5. `pnpm --filter @expense-tracker/shared build` — до этого API видит старые типы.
6. Удалить `apps/api/src/modules/expenses/`.
7. Новый модуль: dto → service (`TRANSACTION_SELECT`, `serialize`, `assertCategoryUsable`, затем
   findAll → findOne → create → update → remove → summary) → controller → module.
8. `app.module.ts`: заменить импорт и элемент массива.
9. `transactions.service.spec.ts`.
10. `CLAUDE.md`: три протухших упоминания expenses.
11. Финальная проверка.

Ключевые зависимости: 3 → 4 и 5 → 7. Между шагами 4 и 8 промежуточный `pnpm typecheck` будет
врать, пока shared не пересобран, — это ожидаемо.

Чеклист — в `transactions.tasks.md`.

## Проверка

```bash
pnpm --filter @expense-tracker/api exec jest src/modules/transactions/transactions.service.spec.ts
pnpm typecheck && pnpm lint && pnpm test
pnpm build          # пункт ТЗ «после реализации собирать проект»
```

Затем вживую (`pnpm db:up && pnpm dev`, Swagger `http://localhost:4000/api/docs`, префикс
`/api/v1`, bearer из `POST /auth/register`; для проверок изоляции — второй пользователь):

1. `GET /transactions` без `Authorization` → **401**.
2. `POST /categories` «Зарплата» и «Еда» → **201**, запомнить id.
3. `POST /transactions` доход 150000 по «Зарплате» → **201**, `amount: "150000.00"` строкой,
   вложенный `category`, без `userId`.
4. Ошибки ввода: `"amount":"1 234"` → **400** с разбором по полю; `"date":"2030-01-01"` → **400**
   «Дата операции не может быть в будущем»; чужой `categoryId` → **404**; архивный `categoryId`
   (после `DELETE /categories/:id`) → **400** «Категория архивирована».
5. Два расхода по «Еде» (500.50 и 250.00, разные даты) → **201**.
6. `GET /transactions` → порядок по `date` убыванию, форма `{ items, nextCursor }`.
7. Фильтры: `?type=EXPENSE` → два; `?categoryId=<Еда>` → два; `?dateFrom=` внутри месяца → одна;
   `?dateFrom=` за пределами → пусто и `nextCursor: null`.
8. `?limit=1` → непустой `nextCursor`; `?limit=1&cursor=<nextCursor>` → следующая запись без
   повторов.
9. `GET /transactions/summary?month=9&year=2026` → итоги, `balance` = доходы − расходы, `currency`
   = базовая валюта, `categories` с именами и цветами; пустой месяц → суммы `"0.00"` и
   `categories: []`; без параметров, `?month=13` и `?year=999999` → **400**.
10. Отрицательный баланс: добавить расход больше дохода → `balance` вида `"-250.25"` (ловит и
    схему `signedMoneySchema`, и починенный `toMinorUnits`).
11. **Порядок маршрутов:** `/transactions/summary` отдаёт сводку, а не 404 «Транзакция не
    найдена» (404 означал бы, что `@Get('summary')` объявлен после `@Get(':id')`).
12. `GET/PATCH/DELETE /transactions/:id`: своя запись → **200**; несуществующий и **чужой** id →
    **404**; повторный `DELETE` → **404**.
13. Restrict в деле: `DELETE /categories/<Еда>` → **200** (мягкая архивация, транзакции целы), а
    `DELETE FROM categories WHERE id='<Еда>'` напрямую в psql → ошибка FK
    `transactions_categoryId_fkey`. Сводка за тот же месяц при этом по-прежнему показывает имя
    архивной категории в разбивке.
14. `psql`: `\d transactions` — оба индекса на месте, `\dt` — таблицы `expenses` больше нет.
