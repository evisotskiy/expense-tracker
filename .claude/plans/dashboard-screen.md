# Главный экран трекера расходов

## Контекст

Бэкенд транзакций и категорий готов: `GET/POST/PATCH/DELETE /api/v1/transactions`,
`GET /api/v1/transactions/summary`, CRUD категорий. Фронтенд доходит только до входа — после
`/login` пользователь попадает на `/dashboard`, где стоит заглушка на 17 строк
(`apps/web/src/views/dashboard/ui/dashboard-view.tsx`) с текстом «Вы вошли как …». Ни одной
транзакции через интерфейс создать или увидеть нельзя; `authorizedFetch` — транспорт для
защищённых ручек — написан, но **ни разу не вызван**, дашборд будет его первым потребителем.

Задача — сделать главный экран рабочим: сводка за месяц, лента транзакций с подгрузкой,
создание транзакций и категорий, удаление, фильтры, профиль в шапке.

**Задача целиком фронтендовая: API и `packages/shared` не меняются.** Курсорная пагинация,
уже реализованная в `TransactionsService.findAll`, ложится на подгрузку по кнопке один в один.

Ветка `feature/dashboard-screen`.

## Решения пользователя

1. **Меню «Добавить»** с пунктами «Транзакция» / «Категория» — каждый открывает диалог прямо на
   дашборде. Плюс фильтры над лентой: тип и категория.
2. **Лента по 10 транзакций с кнопкой «Показать ещё».** Номеров страниц нет: пагинация остаётся
   курсорной, как она устроена в API сейчас. Клик по кнопке дописывает следующие 10 записей к уже
   показанным.
3. **Сводка за месяц** — карточки «Доходы / Расходы / Баланс».
4. **Разбивка по категориям** — список с суммами и цветными метками, без диаграмм.
5. **Профиль в шапке** — email с выпадающим меню, в нём «Выйти».
6. **Переключатель месяца** — управляет и сводкой, и лентой.
7. **Объём операций:** создание и удаление транзакций. Редактирование (`PATCH`) в задачу не
   входит, хотя на бэкенде готово.
8. **Состояние экрана — в URL.**

---

## Ключевые проектные решения

1. **API не трогаем.** `GET /transactions?cursor&limit&dateFrom&dateTo&type&categoryId` уже отдаёт
   `{ items, nextCursor }` — ровно то, из чего состоит `useInfiniteQuery`. Курсор здесь ещё и
   объективно правильнее offset: лента пополняется сверху, и при offset-пагинации записи
   «сползают» между подгрузками (именно это написано в комментарии к `paginationQuerySchema`).
   Дефолтный `limit` в схеме — 20, фронт явно шлёт 10.

2. **Лента — `useInfiniteQuery`, курсор берётся прямо из ответа.**
   `getNextPageParam: (last) => last.nextCursor ?? undefined` — когда сервер отдаёт `null`,
   `hasNextPage` становится `false` и кнопка исчезает сама, без ручного счёта страниц.

3. **`placeholderData` для ленты не используем.** При смене месяца или фильтра `keepPreviousData`
   показал бы длинный накопленный список (скажем, 30 строк), который через мгновение схлопнулся бы
   до 10 — скачок заметнее того мигания, от которого он спасает. Показываем скелетон.

4. **Общего числа записей нет и не нужно.** Курсор его дать не может; вместо «Показано 20 из 43»
   под лентой живёт `role="status"` с «Показано 20 операций» — иначе пользователь скринридера
   после нажатия кнопки не узнает, что что-то произошло.

5. **Месяц и фильтры — в URL** (`?month=2026-09&type=EXPENSE&category=<cuid>`) через
   `router.replace(..., { scroll: false })`: переживает перезагрузку, работает «назад», ссылкой
   можно поделиться. Накопленные страницы в URL не кладём — «Показать ещё» не навигация, и ссылка
   честно открывается на первых 10 записях того же месяца и фильтра.

   **`useSearchParams` в Next 16 требует `<Suspense>` в статической ветке.** `RequireAuth` обёртки
   не содержит (в отличие от `RedirectIfAuthenticated`, где это уже решено) — границу ставим внутри
   `views/dashboard`, иначе `next build` упадёт.

6. **Сводку запрашивает `views/dashboard`, а не каждый виджет.** `MonthSummary` и
   `CategoryBreakdown` живут на одном ответе `/transactions/summary`. Позови хук в обоих —
   react-query дедуплицирует запрос, но не разметку: скелетоны и сообщение об ошибке пришлось бы
   рисовать дважды, и они бы рассинхронились. Виджеты получают данные пропсами.

7. **`entities/transaction` не импортирует `entities/category`.** Ответ `transactionSchema` уже
   содержит вложенную `category` целиком, поэтому строка ленты рисует цветную метку без похода в
   соседний слайс (что ESLint и запрещает). Сама метка — `shared/ui/color-dot.tsx`: цветная точка
   не бизнес-сущность.

8. **`features/logout-button` переезжает в `features/user-menu`.** Правило «соседние слайсы одного
   слоя друг друга не видят» делает импорт `user-menu → logout-button` невозможным. Композиция в
   `widgets/app-header` возможна, но `LogoutButton` (`variant="outline"`) внутрь пункта меню не
   встаёт, и компонент с тестом стали бы мёртвым кодом. Переносим `model/use-logout.ts` через
   `git mv`, старый слайс удаляем целиком, его тест-кейсы переезжают в `user-menu.test.tsx`.

9. **Валюту в форме транзакции не спрашиваем — всегда `user.baseCurrency`.** Сводка считает только
   базовую валюту (`transactions.service.ts:174`); дай мы селектор валют — первый же расход в USD
   появился бы в ленте и отсутствовал в сводке, и это выглядело бы багом, а не фичей.

10. **Дата в форме — нативный `<input type="date">`.** `calendar` + `popover` тянут новую
    зависимость `react-day-picker` ради поля, которое почти всегда остаётся «сегодня». Нативное
    значение — строка `YYYY-MM-DD`, ровно то, что принимает `isoDateSchema`: ноль преобразований и
    никакой возни со смещением зоны. На телефоне системный пикер лучше кастомного, а поле живёт
    внутри `Dialog`, где popover-в-диалоге регулярно дерётся с focus-trap. Атрибут `max` = сегодня
    закрывает правило схемы «не дальше чем сейчас + сутки» ещё до отправки.

11. **Никаких оптимистичных обновлений — только инвалидация.** Сводку считает сервер: группировка
    по категориям, фильтр по базовой валюте, арифметика в копейках. Повторять это на клиенте —
    дублировать бизнес-правило и рисковать показать неверный баланс; неверные деньги на экране
    дороже 200 мс ожидания.

12. **`date-fns` не подключаем**, хотя он в зависимостях. Его арифметика идёт через `Date` в
    локальной зоне, а границы месяца обязаны быть в UTC (см. риск 1). Нужны ровно две вещи:
    целочисленный сдвиг месяца и форматирование — обе закрываются платформой.

13. **`formatMoney` не пишем — он уже есть** в `packages/shared/src/schemas/money.ts:132`
    (`formatMoney(value, currency, locale = 'ru-RU')` → `"1 234,56 ₽"`). Импортируем из
    `@expense-tracker/shared`.

---

## 1. Структура фронтенда

Все импорты сверены с генератором запретов в `apps/web/eslint.config.mjs`.

### `shared`

| Файл | Содержимое |
| --- | --- |
| `shared/ui/{dialog,dropdown-menu,select,skeleton,separator,textarea,alert-dialog}.tsx` | shadcn, см. раздел 2 |
| `shared/ui/color-dot.tsx` | цветная точка; `style={{ backgroundColor: color }}` — цвет приходит произвольным HEX из БД, `bg-[${color}]` Tailwind не соберёт (JIT видит только литералы). `null` → `bg-muted-foreground/40`, `aria-hidden` |
| `shared/lib/date/month.ts` + `month.test.ts` | `MonthValue { year, month }` (месяц 1–12), `currentMonth()`, `shiftMonth(v, delta)`, `formatMonthTitle(v)`, `monthRange(v)`, `parseMonthParam(raw, today)`, `formatMonthParam(v)` |
| `shared/lib/date/format-date.ts` | `formatTransactionDate(iso)` → «15 сент.» через `Intl` с `timeZone: 'UTC'` |
| `shared/lib/form/apply-api-errors.ts` | правка: параметр `conflictField` вместо захардкоженного `'email'` |

**`monthRange` — самое опасное место плана.** API кладёт `dateTo` в `lte`
(`transactions.service.ts:60`), поэтому граница обязана быть последней миллисекундой месяца:

```ts
export function monthRange({ year, month }: MonthValue) {
  return {
    dateFrom: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    // dateTo уходит в lte, поэтому это последняя миллисекунда месяца, а не его первое
    // число: '2026-09-30' отрезало бы всё, что случилось позже полуночи.
    dateTo: new Date(Date.UTC(year, month, 1) - 1).toISOString(),
  };
}
```

Это ровно те же границы, что считает `summary` (`gte start, lt end` через `Date.UTC`) — лента и
сводка гарантированно про один интервал.

`shiftMonth` — целочисленный, без `Date`: `const i = year * 12 + (month - 1) + delta`. Нет вопросов
«в какой зоне полночь» и нет ловушки `addMonths(31 января, 1)`.

`formatMonthTitle` — через собственный массив из 12 названий: `Intl` с `month:'long'` + год отдаёт
«сентябрь 2026 г.», а вместе с `day` — родительный падеж «сентября».

`parseMonthParam(raw, today)` — `today` аргументом, а не `new Date()` внутри, иначе тест «по
умолчанию текущий месяц» зависит от дня запуска.

**Правка `apply-api-errors.ts`:** строка 51 хардкодит «409 → поле email», а форме категории нужно
«409 → поле name». Добавляем четвёртый параметр `conflictField?: string` без дефолта; вызов в
`register-form` передаёт `'email'`, в `login-form` — ничего (401 там намеренно не привязывается к
полю).

### `entities/category`

```
api/category-api.ts      fetchCategories(): Promise<Category[]>
                         createCategory(input): Promise<Category>
model/category-keys.ts   categoryKeys = { all, list }
model/use-categories.ts  useCategories()   // staleTime 5 мин: меняются редко, инвалидируются явно
index.ts                 categoryKeys, useCategories, createCategory
```

UI у слайса нет — метка живёт в `shared/ui/color-dot`, чтобы ею мог пользоваться и
`entities/transaction`. Функция запроса лежит в entity, хук-мутация — в фиче: entity владеет
доступом к данным, фича — взаимодействием и инвалидацией.

### `entities/transaction`

```
api/transaction-api.ts          fetchTransactionPage, fetchTransactionSummary,
                                createTransaction, deleteTransaction
model/types.ts                  TransactionListParams, TRANSACTIONS_PAGE_SIZE = 10
model/transaction-keys.ts       all / lists / list(params) / summaries / summary(month)
model/use-transaction-list.ts   useTransactionList(params)
model/use-transaction-summary.ts
ui/transaction-item.tsx + .test.tsx
index.ts
```

Один корень `['transactions']` для ленты и сводки — тогда одна инвалидация после мутации накрывает
обе. В ключе списка лежит ровно то, что уходит в query (`dateFrom`/`dateTo`, а не `{month, year}`),
так класс ошибок «ключ разошёлся с запросом» исчезает конструктивно.

```ts
export function useTransactionList(params: TransactionListParams) {
  return useInfiniteQuery({
    queryKey: transactionKeys.list(params),
    queryFn: ({ pageParam, signal }) => fetchTransactionPage({ ...params, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    // nextCursor === null означает «страниц больше нет» — hasNextPage выключится сам.
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchOnWindowFocus: false,   // иначе фокус вкладки перезапросит все накопленные страницы
  });
}
```

Склейка страниц — модульная функция-`select` (инлайновая пересчитывалась бы каждый рендер): плоский
список + **дедуп по `id`**. Дедуп нужен потому, что между двумя подгрузками пользователь может
создать транзакцию, и запись, уже показанная выше, приедет во второй странице ещё раз — а дубль
ключа в React это баг рендера, а не косметика.

`api/transaction-api.ts` собирает query через `URLSearchParams`, `limit` всегда
`TRANSACTIONS_PAGE_SIZE`, опциональные фильтры добавляются только когда заданы: пустая строка в
`type` провалит `z.enum`. Все функции — через `authorizedFetch`.

`ui/transaction-item.tsx` — презентационный: `ColorDot` по `transaction.category.color`, имя
категории, описание, `formatTransactionDate(transaction.date)`, сумма через `formatMoney` с
префиксом `+`/`−`. Принимает `action?: ReactNode` — слот, куда виджет вставит кнопку удаления
(entity не имеет права импортировать фичу). Дата форматируется в UTC: сохранённая как UTC-полночь,
у пользователя в UTC−5 она иначе показалась бы предыдущим днём.

### `features`

| Слайс | Содержимое |
| --- | --- |
| `user-menu` | `model/use-logout.ts` (`git mv` из `logout-button`), `ui/user-menu.tsx` + тест. Триггер — `Button variant="ghost"` с email (`max-w-48 truncate` — иначе длинный email разносит шапку на телефоне), внутри `DropdownMenuLabel` с полным email, разделитель, пункт «Выйти» |
| `month-switcher` | Полностью управляемый: `{ value, onChange }`. Две `size="icon"` кнопки с `aria-label`, заголовок в `<h2 aria-live="polite">`. «Вперёд» `disabled` на текущем месяце — будущие даты схема всё равно не примет |
| `transaction-filters` | `TransactionFiltersBar` (суффикс, чтобы не столкнуться с типом `TransactionFilters` из shared). Два `Select`. **Radix `Select.Item` не принимает `value=""`** — «все» кодируется сентинелом `'ALL'`, наружу компонент отдаёт `undefined` |
| `create-category` | `model/schema.ts` (`createCategorySchema.pick({ name, color })`), `use-create-category`, `ui/category-form.tsx` + тест, `ui/create-category-dialog.tsx`. `icon` не спрашиваем: без пикера иконок поле «введите utensils» — полуфабрикат, схема допускает `null`. `color` — сетка из 10 предустановленных HEX как радиогруппа: свободный `<input type="color">` позволил бы выбрать тёмно-серый на тёмном фоне |
| `create-transaction` | `model/schema.ts` (`createTransactionSchema.omit({ currency: true })`), `use-create-transaction`, `ui/transaction-form.tsx` + тест, `ui/create-transaction-dialog.tsx` |
| `delete-transaction` | `model/use-delete-transaction.ts`, `ui/delete-transaction-button.tsx` + тест: иконка-корзина → `AlertDialog` «Удалить транзакцию? Действие необратимо» |

Форма транзакции: `useForm<Values, undefined, Data>` — третий generic обязателен, как в
`register-form`, потому что `amount` проходит через `moneyInputSchema` и на выходе становится
нормализованной строкой. Поля: тип (`Select`, по умолчанию «Расход» — их вводят чаще), сумма
(`Input inputMode="decimal"`, схема сама принимает запятую), категория (`Select` из
`useCategories()`), дата (`Input type="date"`, `max` = сегодня), описание (`Textarea maxLength=500`).

`CreateTransactionDialog` при `categories.length === 0` показывает не форму, а «Сначала создайте
хотя бы одну категорию» и кнопку, дёргающую проп `onRequestCategory`. Это не краевой случай: у
нового пользователя категорий ровно ноль — ни сида, ни создания при регистрации в проекте нет.

Мутации: создание транзакции и удаление → `invalidateQueries({ queryKey: transactionKeys.all() })`
(накрывает и ленту, и сводку); создание категории → `categoryKeys.all()`. Инвалидация
инфинити-запроса перезапрашивает все накопленные страницы по порядку, заново выстраивая цепочку
курсоров, — поэтому удалённая запись не ломает курсор, даже если именно она его и задавала.

### `widgets`

| Слайс | Содержимое |
| --- | --- |
| `add-entry-menu` | Плоский слайс (прецедент — `app-header`). Держит `useState<'transaction' \| 'category' \| null>`, рендерит `DropdownMenu` и оба диалога, прокидывает `onRequestCategory`. **Ловушка Radix:** закрытие меню и открытие диалога в одном тике дерутся за focus-trap и оставляют `pointer-events: none` на `<body>` — страница «мертвеет». Открывать диалог в `onCloseAutoFocus` меню |
| `app-header` | Правка существующего файла: название приложения + `<UserMenu />`, `sticky top-0 z-10` с safe-area-паддингом |
| `month-summary` | Props `{ summary?, isLoading }`. Три `Card` в `grid sm:grid-cols-3`. Отрицательный баланс → `text-destructive`, проверка через `toMinorUnits(balance) < 0`, а не `Number(...)` — деньги остаются строками. Подпись «в RUB» честно объясняет, почему сумма может не сойтись с лентой |
| `category-breakdown` | `lib/top-categories.ts` + тест — чистая функция: API отдаёт категории отсортированными, но **вперемешку доходы и расходы** (`groupBy(['categoryId','type'])`), поэтому фильтр по типу обязателен; хвост сверх 7 схлопывается в «Прочее», доля считается через `toMinorUnits` |
| `transaction-feed` | `ui/{transaction-feed,transaction-feed-skeleton}.tsx`, `index.ts`. Заголовок «Транзакции» + `TransactionFiltersBar` → строки `TransactionItem` с разделителями → кнопка «Показать ещё» |

`transaction-feed` — единственный потребитель `useTransactionList`; фильтры держит у себя в
`useState`, месяц получает пропсами (`dateFrom`/`dateTo`). Кнопка «Показать ещё» рендерится по
`hasNextPage`, при `isFetchingNextPage` — `disabled` + `Loader2` + «Загружаем…». Под ней —
`role="status"` с «Показано N операций».

Состояния: `isPending` → 10 скелетон-строк; `isError` → `Alert variant="destructive"` + «Повторить»
(`refetch`); ошибка подгрузки **не стирает** уже показанные строки, а выводится компактной строкой у
кнопки. Пустых состояния два, и это разные тексты: «Под выбранные фильтры ничего не нашлось» +
«Сбросить фильтры» против «За сентябрь 2026 ещё нет операций» + `emptyAction`.

`emptyAction` приходит пропсом, а не импортом `AddEntryMenu`: виджеты соседями друг друга не видят.

### `views/dashboard`

Переписывается целиком. Внешний компонент оборачивает содержимое в `<Suspense>` (из-за
`useSearchParams`), внутренний держит состояние экрана:

```tsx
const { month, setMonth, filters, setFilters } = useDashboardParams();  // model/, читает URL
const range = useMemo(() => monthRange(month), [month]);
const summaryQuery = useTransactionSummary(month);
// AppHeader → MonthSwitcher + AddEntryMenu → MonthSummary → CategoryBreakdown → TransactionFeed
```

Накопленные страницы сбрасывать вручную не нужно: месяц и фильтры входят в `queryKey`, и при их
смене react-query отдаёт свежую запись кэша, начинающуюся с первой страницы.

После успешного создания транзакции виджет отдаёт созданный объект наверх, и если его месяц не
совпадает с выбранным — переключаем месяц на него. Иначе запись, введённая задним числом, просто
«исчезает», и это выглядит как потеря данных.

### Сводная проверка границ FSD

| Импорт | Вердикт |
| --- | --- |
| `entities/transaction` → `entities/category` | **не нужен** — категория вложена в ответ, метка в `shared/ui` |
| `features/*` → `@/entities/*` | ок (слой ниже) |
| `features/user-menu` → `features/logout-button` | **запрещено** → решено переездом `use-logout` внутрь слайса |
| `widgets/add-entry-menu` → `@/features/create-{transaction,category}` | ок |
| `widgets/transaction-feed` → `@/widgets/add-entry-menu` | **запрещено** → решено пропсом `emptyAction` |
| `entities/transaction/ui` → кнопка удаления из `features` | **запрещено** → решено слотом `action?: ReactNode` |

---

## 2. shadcn/ui и токены темы

```bash
pnpm dlx shadcn@latest add dialog dropdown-menu select skeleton separator textarea alert-dialog --cwd apps/web
```

Только `add`, никогда `init` (он перезаписывает `components.json` и `globals.css`). После каждого
`add` — вручную поправить сгенерированный `import { cn } from "cn"` на `@/shared/lib/cn` и прогнать
prettier. Проверить `git diff` по `globals.css` и `components.json` — там должно быть пусто.

**Токены.** Добавить в `@theme` и продублировать в `@media (prefers-color-scheme: dark)`:
`--color-popover` / `--color-popover-foreground`. Их печатают `DropdownMenuContent` и
`SelectContent`; без них меню будет прозрачным поверх ленты — сломано, но без ошибки сборки.
`chart-1..5` не добавляем: графиков нет, категории красятся HEX-цветом из БД.

Контроль после `add` — выгрести используемые утилиты и сверить с объявленными токенами:

```bash
grep -ohE '(bg|text|border|ring|fill|outline)-[a-z-]+' apps/web/src/shared/ui/{dialog,dropdown-menu,select,skeleton,separator,textarea,alert-dialog}.tsx | sort -u
```

**`tw-animate-css` теперь нужен.** В прошлой задаче его сознательно не ставили — «анимации есть
только у оверлеев». Оверлеи появились: `DialogOverlay`, `DropdownMenuContent`, `SelectContent`
печатают `animate-in fade-in-0 zoom-in-95` и `data-[state=closed]:animate-out`, которых в ядре
Tailwind 4 нет. `pnpm --filter @expense-tracker/web add tw-animate-css` + `@import 'tw-animate-css';`
второй строкой `globals.css`. Зависимость чисто CSS-ная.

**Не берём:** `pagination` (номеров страниц нет), `badge` (тип показываем цветом суммы), `sonner`
(ошибки инлайн, консистентно с формами входа), `table` (на телефоне всё равно стал бы списком),
`calendar`/`popover` (см. решение 10), `chart` (графиков нет).

---

## 3. Порядок работ

Каждый пункт — отдельный коммит; после каждого `pnpm typecheck && pnpm lint && pnpm test` зелёные.
Промежуточные этапы оставляют экспорты, которые ещё никто не использует — это норма, так уже шла
задача `web-auth-fsd`.

1. **`feat(web): добавить токены popover и tw-animate-css`** — до запуска shadcn CLI, страховка от
   перезаписи `globals.css`.
2. **`feat(web): подключить компоненты shadcn для диалогов, меню и селектов`**
3. **`feat(web): добавить утилиты месяца и цветную метку в shared`** — чистая логика с тестами.
4. **`refactor(web): вынести поле конфликта в параметр applyApiErrors`**
5. **`feat(web): добавить сущность category`**
6. **`feat(web): добавить сущность transaction`**
7. **`refactor(web): заменить logout-button на слайс user-menu`** — видно в браузере сразу.
8. **`feat(web): добавить переключатель месяца`**
9. **`feat(web): добавить фильтры ленты транзакций`**
10. **`feat(web): добавить создание категории`**
11. **`feat(web): добавить создание транзакции`** — после 10: диалог ссылается на сценарий «сначала
    создайте категорию».
12. **`feat(web): добавить удаление транзакции`**
13. **`feat(web): добавить меню создания записей`** — требует 10 и 11.
14. **`feat(web): добавить виджеты сводки за месяц и разбивки по категориям`** — оба на одном ответе
    API.
15. **`feat(web): добавить ленту транзакций с подгрузкой`** — требует 6, 9, 12.
16. **`feat(web): собрать главный экран дашборда`** — первый этап, видимый целиком.
17. **`docs: обновить CLAUDE.md`** — раздел «Состояние проекта»: дашборд реализован,
    `authorizedFetch` в деле.

### Тесты, которые пишем по ходу

Чистая логика без React — `month.ts` (переход через декабрь в обе стороны, февраль високосного
года, `dateTo` заканчивается на `T23:59:59.999Z`, мусор в `parseMonthParam`), `top-categories.ts`,
функция-`select` (дедуп по `id`). Компоненты — по образцу существующих форм: данные пропсами,
`vi.fn()` вместо мутаций (пустые состояния — разные тексты; формы — валидация и разбор ошибок API;
`user-menu` — клик вызывает выход и блокирует пункт на время). Из
`shared/lib/test/render-with-providers.tsx` дополнительно экспортировать `createQueryWrapper()` —
для `renderHook` нужен wrapper, а не `render`.

---

## 4. Проверка

```bash
nvm use && pnpm install
pnpm db:up
pnpm build
pnpm typecheck
pnpm lint           # главная проверка границ FSD — иначе ошибку слоя не поймать
pnpm test           # именно так, НЕ pnpm --filter @expense-tracker/web test
pnpm dev
```

**Сквозной сценарий** (строго `http://localhost:3000`, не `127.0.0.1` — иначе cookie `sameSite=lax`
не уйдёт), на свежем пользователе:

1. Регистрация → `/dashboard`: шапка с email, текущий месяц, три карточки с нулями, пустая лента.
2. «Добавить» → «Транзакция»: вместо формы — «Сначала создайте категорию» и кнопка, переключающая
   на диалог категории. Проверить, что после закрытия страница жива (не залип `pointer-events`).
3. Создать категорию «Еда» с цветом. Создать её же повторно → 409 подсвечивает поле «Название».
4. Расход `1 234,56` (**с запятой**) на «Еду», дата сегодня → сумма в ленте «1 234,56 ₽», карточка
   «Расходы» и разбивка обновились без перезагрузки.
5. Сумма `0` и дата завтра → сообщения из схем `shared`, отправки нет.
6. Создать 25 транзакций (быстрее через Swagger) → в ленте 10 записей и кнопка «Показать ещё».
7. «Показать ещё» → 20 записей, подпись «Показано 20 операций». Ещё раз → 25 записей, кнопка
   исчезла.
8. Фильтр «Доходы», затем «Категория: Еда» → лента перезапрашивается с первых 10, кнопка
   пересчитывается.
9. «‹» на переключателе месяца → прошлый месяц, лента снова с первых 10, сводка и разбивка тоже за
   прошлый месяц. URL содержит `?month=…`; перезагрузка сохраняет месяц и фильтр; «Назад»
   возвращает предыдущий месяц.
10. Удалить транзакцию из середины накопленной ленты → подтверждение, строка исчезает, сводка
    пересчитывается, остальные строки на месте (проверка, что цепочка курсоров пересобралась).
11. Транзакция на **последнее число месяца в 23:50 UTC** (через Swagger) → видна в ленте за этот
    месяц. Прямая проверка `dateTo`/`lte`: при `monthRange`, отдающем дату без времени, её не будет.
12. Транзакция в валюте, отличной от базовой (через Swagger) → в ленте есть, в сводке нет; подпись
    «в RUB» объясняет почему.
13. Создать транзакцию с датой прошлого месяца → экран переключается на её месяц, запись видна.
14. `/dashboard` анонимом → `/login?next=%2Fdashboard`, после входа обратно; в Network нет ни одного
    401 перед `/transactions`.
15. `JWT_ACCESS_TTL=30s` в `apps/api/.env`, перезапуск API, подождать, «Показать ещё» → проходит
    прозрачно. **Первая настоящая проверка `authorizedFetch`.**
16. «Выйти» из меню в шапке → `/login`; «Назад» не возвращает на дашборд.

Адаптивность — DevTools iPhone SE (375×667): диалоги скроллятся и не уезжают за экран, `Select`
открывается поверх диалога, нативный пикер даты не зумит страницу, email обрезан, тач-таргеты
≥ 44px. Клавиатура: Tab обходит меню и фильтры, Esc закрывает диалог, фокус возвращается на триггер.
Тёмная тема (`prefers-color-scheme: dark`) — все новые компоненты.

---

## 5. Риски

**Данные**

1. **`dateTo` — это `lte`**, а `isoDateSchema` принимает голое `'2026-09-30'` и делает из него
   UTC-полночь: конец месяца без времени отрезал бы всё, что позже 00:00 последнего дня. Закрыто
   `monthRange` и обязательным тестом на него.
2. **Границы месяца — только UTC.** `summary` строит их через `Date.UTC`. Посчитай ленту локальным
   `startOfMonth`, и у пользователя в UTC+3 лента и сводка разъедутся на краях месяца — баланс «не
   сойдётся» без единой ошибки в логах.
3. **Сводка режет по `baseCurrency`, лента — нет.** Смягчаем отказом от селектора валют и подписью
   «в RUB»; полностью не решается без курсов.
4. **Архивная категория → 400** при создании транзакции. `useCategories` отдаёт только активные, но
   категорию можно заархивировать в другой вкладке между открытием диалога и отправкой — форма
   обязана показать это сообщение на поле `categoryId`, а не молча уронить диалог.
5. **Создание категории с именем архивной «воскрешает» её** вместо 409, причём с новым цветом
   (`reviveArchived`). Поведение корректное; внесено в чеклист явно, чтобы его не приняли за баг и
   не «починили».

**Фронтенд**

6. **Инвалидация `transactionKeys.all()` перезапрашивает все накопленные страницы** по очереди —
   при 3–4 нажатиях «Показать ещё» это 3–4 запроса после каждого создания. Приемлемо; ограничитель —
   сам пользователь. Зато цепочка курсоров пересобирается заново, и удаление записи её не ломает.
7. **Radix `Select.Item` не принимает пустую строку** — рантайм-ошибка, не типовая. Сентинел `'ALL'`.
8. **`DropdownMenu` → `Dialog` в одном тике** оставляет `pointer-events: none` на `<body>`.
9. **Новый пользователь без категорий** — не краевой случай, а первый экран после регистрации.
10. **`ColorDot` — единственный оправданный inline `style` в проекте**, нужен комментарий, иначе его
    «почистят» при следующем ревью.
11. **`recharts` и `date-fns` остаются неиспользованными.** Формально мёртвые зависимости — выпилить
    отдельным `chore` или осознанно оставить; предлагаю отметить в tasks-файле как внеплановую
    находку, а не раздувать эту задачу.
