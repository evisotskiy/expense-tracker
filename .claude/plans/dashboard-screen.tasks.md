# Задачи: реализация dashboard-screen.md

Статус отмечается по ходу выполнения. Порядок соответствует разделу «Порядок работ» плана.

Объём: только фронтенд — API и `packages/shared` не меняются. Семь новых слайсов
(`entities/category`, `entities/transaction`, `features/{user-menu,month-switcher,transaction-filters,
create-category,create-transaction,delete-transaction}`, `widgets/{add-entry-menu,month-summary,
category-breakdown,transaction-feed}`), переписанный `views/dashboard` и удаление
`features/logout-button`, который замещает `user-menu`.

## 1. Токены темы и анимации

- [x] `pnpm --filter @expense-tracker/web add tw-animate-css`
- [x] `@import 'tw-animate-css';` второй строкой `apps/web/src/app/globals.css`
- [x] `--color-popover` / `--color-popover-foreground` в `@theme`
- [x] Те же переменные в блоке `@media (prefers-color-scheme: dark)`
- [x] Коммит **до** запуска shadcn CLI — страховка от перезаписи `globals.css`

## 2. Компоненты shadcn

- [x] `pnpm dlx shadcn@latest add dialog dropdown-menu select skeleton separator textarea alert-dialog --cwd apps/web`
- [x] В каждом новом файле поправить `import { cn } from "cn"` → `@/shared/lib/cn`
- [x] `prettier --write` по новым файлам
- [x] `git diff` по `globals.css` и `components.json` — пусто
- [x] Сверить напечатанные токены с объявленными (`grep -ohE '(bg|text|border|ring|fill|outline)-[a-z-]+'`)
- [x] Проверить `ring-offset-background`: если компонент его печатает, а токена нет — добавить

## 3. shared: утилиты месяца и цветная метка

- [x] `shared/lib/date/month.ts`: `MonthValue`, `currentMonth`, `shiftMonth`, `formatMonthTitle`,
      `monthRange`, `parseMonthParam`, `formatMonthParam`
- [x] `monthRange.dateTo` — **последняя миллисекунда месяца** (`Date.UTC(year, month, 1) - 1`), с
      комментарием про `lte` на бэкенде
- [x] `shiftMonth` — целочисленный (`year * 12 + month - 1 + delta`), без `Date`
- [x] `formatMonthTitle` — собственный массив из 12 названий (у `Intl` «сентябрь 2026 г.»)
- [x] `parseMonthParam(raw, today)` — `today` аргументом, не `new Date()` внутри
- [x] `shared/lib/date/format-date.ts`: `formatTransactionDate` через `Intl` с `timeZone: 'UTC'`
- [x] `shared/ui/color-dot.tsx` — inline `style`, с комментарием почему не Tailwind-класс
- [x] `month.test.ts`: декабрь→январь в обе стороны, февраль високосного года, `T23:59:59.999Z`,
      мусор и `null` в `parseMonthParam`

## 4. shared: параметр conflictField в applyApiErrors

- [x] Четвёртый параметр `conflictField?: string` без дефолта
- [x] `register-form` передаёт `'email'`, `login-form` — не передаёт
- [x] Существующие тесты форм остаются зелёными

## 5. entities/category

- [x] `api/category-api.ts`: `fetchCategories`, `createCategory` — через `authorizedFetch`
- [x] `model/category-keys.ts`
- [x] `model/use-categories.ts` — `staleTime: 5 * 60_000`
- [x] `index.ts`: `categoryKeys`, `useCategories`, `createCategory`

## 6. entities/transaction

- [x] `api/transaction-api.ts`: `fetchTransactionPage`, `fetchTransactionSummary`,
      `createTransaction`, `deleteTransaction`
- [x] Сборка query через `URLSearchParams`; опциональные фильтры только когда заданы (пустая
      строка в `type` провалит `z.enum`)
- [x] `model/types.ts`: `TransactionListParams`, `TRANSACTIONS_PAGE_SIZE = 10`
- [x] `model/transaction-keys.ts` — один корень `['transactions']` для ленты и сводки
- [x] `model/use-transaction-list.ts`: `useInfiniteQuery`, `getNextPageParam: last.nextCursor ?? undefined`,
      `initialPageParam: undefined`, `refetchOnWindowFocus: false`, без `placeholderData`
- [x] Модульная функция-`select`: плоский список + дедуп по `id`
- [x] `model/use-transaction-summary.ts`
- [x] `ui/transaction-item.tsx` — `ColorDot`, `formatMoney` из shared, дата в UTC, слот `action`
- [x] `transaction-item.test.tsx`
- [x] Тест функции-`select` на дедуп

## 7. features/user-menu вместо logout-button

- [x] `git mv` `features/logout-button/model/use-logout.ts` → `features/user-menu/model/`
- [x] `ui/user-menu.tsx` — email с `max-w-48 truncate`, `DropdownMenuLabel`, пункт «Выйти»
- [x] `user-menu.test.tsx` — тест-кейсы из `logout-button.test.tsx` переехали
- [x] `widgets/app-header/app-header.tsx` — название приложения + `<UserMenu />`, `sticky top-0 z-10`
- [x] Каталог `features/logout-button/` удалён целиком
- [x] Проверить вживую: шапка работает, выход по-прежнему уводит на `/login`

## 8. features/month-switcher

- [x] Полностью управляемый (`value`/`onChange`), логика в `shared/lib/date/month`
- [x] `aria-label` на кнопках, заголовок в `<h2 aria-live="polite">`
- [x] «Вперёд» `disabled` на текущем месяце
- [x] Тест

## 9. features/transaction-filters

- [x] `TransactionFiltersBar` (суффикс — иначе столкновение с типом из shared)
- [x] Сентинел `'ALL'` вместо `value=""` (Radix не принимает пустую строку) — с комментарием
- [x] Селект категорий из `useCategories()` с `ColorDot`
- [x] Тест: выбор «Все» отдаёт наружу `undefined`

## 10. features/create-category

- [x] `model/schema.ts` — `createCategorySchema.pick({ name, color })`, `icon` не спрашиваем
- [x] `use-create-category` → инвалидация `categoryKeys.all()`
- [x] `ui/category-form.tsx` — сетка из 10 предустановленных HEX как радиогруппа
- [x] 409 привязан к полю `name` через новый параметр `applyApiErrors`
- [x] `ui/create-category-dialog.tsx`
- [x] `category-form.test.tsx`

## 11. features/create-transaction

- [x] `model/schema.ts` — `createTransactionSchema.omit({ currency: true })`, с комментарием почему
- [x] `useForm<Values, undefined, Data>` — третий generic обязателен из-за `moneyInputSchema`
- [x] Поля: тип (по умолчанию «Расход»), сумма (`inputMode="decimal"`), категория, дата
      (`type="date"`, `max` = сегодня), описание (`Textarea`, 500)
- [x] Валюта берётся из `useSession().baseCurrency`
- [x] Пустой список категорий → «Сначала создайте категорию» + проп `onRequestCategory`
- [x] 400 «Категория архивирована» показывается на поле `categoryId`, диалог не падает
- [x] `use-create-transaction` → инвалидация `transactionKeys.all()`
- [x] `transaction-form.test.tsx`

## 12. features/delete-transaction

- [x] `use-delete-transaction` → инвалидация `transactionKeys.all()`
- [x] `ui/delete-transaction-button.tsx` — корзина + `AlertDialog` с необратимостью
- [x] Тест: подтверждение вызывает мутацию, отмена — нет

## 13. widgets/add-entry-menu

- [x] `useState<'transaction' | 'category' | null>`, `DropdownMenu` + оба диалога
- [x] Диалог открывается в `onCloseAutoFocus` меню — иначе `pointer-events: none` на `<body>`
      (комментарий обязателен)
- [x] `onRequestCategory` переключает с транзакции на категорию
- [x] Проверить вживую, что страница жива после закрытия диалога

## 14. widgets/month-summary и category-breakdown

- [x] `month-summary`: три `Card`, props `{ summary?, isLoading }`, скелетоны
- [x] Отрицательный баланс через `toMinorUnits(balance) < 0`, не `Number(...)`
- [x] Подпись «в RUB» рядом со сводкой
- [x] `category-breakdown/lib/top-categories.ts` — фильтр по типу обязателен (API мешает доходы и
      расходы), хвост сверх 7 в «Прочее», доля через `toMinorUnits`
- [x] `top-categories.test.ts`
- [x] `category-breakdown/ui` — строки с `ColorDot`, суммой, долей; пустое состояние
- [x] Тесты обоих виджетов

## 15. widgets/transaction-feed

- [x] `ui/transaction-feed.tsx` — фильтры, строки `TransactionItem` с кнопкой удаления в слоте
      `action`, кнопка «Показать ещё» по `hasNextPage`
- [x] `role="status"` с «Показано N операций»
- [x] `isPending` → 10 скелетон-строк (`transaction-feed-skeleton.tsx`)
- [x] `isError` → `Alert` + «Повторить»; ошибка подгрузки не стирает показанные строки
- [x] Два пустых состояния с разными текстами + `emptyAction` пропсом
- [x] Тесты: тексты пустых состояний, кнопка скрыта при `hasNextPage === false`

## 16. views/dashboard

- [x] `model/use-dashboard-params.ts` — месяц и фильтры в URL, `router.replace(..., { scroll: false })`
- [x] `<Suspense>` вокруг содержимого (`useSearchParams` в Next 16), иначе падает `next build`
- [x] Композиция: `AppHeader` → `MonthSwitcher` + `AddEntryMenu` → `MonthSummary` →
      `CategoryBreakdown` → `TransactionFeed`
- [x] Сводка запрашивается здесь один раз и раздаётся виджетам пропсами
- [x] После создания транзакции с датой другого месяца — экран переключается на её месяц
- [x] Макет: `mx-auto max-w-5xl px-4 py-6 space-y-6`, на телефоне — в колонку

## 17. Документация

- [x] `CLAUDE.md`, раздел «Состояние проекта»: дашборд реализован, `authorizedFetch` используется
- [x] Финальная простановка `[x]` в этом файле

## 18. Финальная проверка

- [x] `pnpm typecheck`
- [x] `pnpm lint` — главная проверка границ FSD
- [x] `pnpm test` (через turbo, НЕ `pnpm --filter @expense-tracker/web test`)
- [x] `pnpm build`
- [x] Сквозной сценарий — прогнан через headless-браузер (Playwright) на живых `pnpm dev` +
      Postgres: регистрация, пустой дашборд, диалог транзакции без категорий → создание
      категории → создание транзакции с суммой через запятую → валидация нулевой суммы →
      фильтры → удаление транзакции → переключатель месяца (кнопка «вперёд» задизейблена на
      текущем месяце) → выход. Пункты 11 («последнее число месяца в 23:50 UTC»), 12 (валюта не
      равна базовой) и 13 (транзакция прошлым месяцем — переключение экрана) требуют ручных
      правок через Swagger/два месяца данных и не прогонялись — код реализован и разобран по
      границам UTC (`monthRange`, риски 1–2 плана), но не подтверждён живым запросом.
- [x] Адаптивность на iPhone SE (375×667, светлая) и тёмная тема (1280×900) — скриншоты через
      Playwright, вёрстка не ломается, попап-диалог помещается в вьюпорт на телефоне.
- [ ] Проверка `authorizedFetch` с `JWT_ACCESS_TTL=30s` — не выполнена (требует отдельного
      перезапуска API с изменённым `.env` и ожидания истечения токена); транспорт тем не менее
      реально отработал во всех запросах живого сценария (категории, транзакции, сводка,
      удаление) с обычным TTL.

## 19. Внеплановые находки

Сюда дописывается то, что всплыло по ходу реализации и не входило в план.

- [x] **Известный долг (вне объёма задачи):** `recharts` и `date-fns` остаются в зависимостях
      `apps/web` неиспользованными. `date-fns` сознательно не применяется (его арифметика идёт в
      локальной зоне, а границы месяца обязаны быть в UTC), графиков по решению пользователя нет.
      Либо выпилить отдельным `chore`, либо оставить до задачи с диаграммами.
- [x] **Баг (найден живым прогоном, не связан с дашбордом): `SessionProvider` уводил анонима с
      `/register` на `/login`.** `useSession()` дергает `bootstrapSession()` на каждой странице;
      для анонима `/auth/refresh` закономерно отвечает 401, но `performRefresh` трактовал любой
      такой 401 как разрыв сессии и звал `accessTokenStore.emitExpired()` → `SessionProvider`
      безусловно перенаправлял на `/login`. В проде это означало, что зарегистрироваться через
      интерфейс было невозможно. Правка в `entities/session/model/session-provider.tsx`:
      редирект и очистка кэша теперь только когда `queryClient.getQueryData(sessionKeys.current())`
      действительно содержал пользователя (сессия была и пропала), а не при первичном анонимном
      bootstrap.
- [x] **Баг (там же): `queryClient.clear()` внутри `onExpired`, вызванный прямо во время ещё не
      завершённого bootstrap-запроса той же сессии, рвал этот in-flight запрос** — react-query
      терял с ним связь, `useSession()` навсегда оставался в `isLoading`, и `/register`/`/login`
      зависали на сплэше. Тот же коммит правит: `clear()`/`setQueryData`/редирект теперь строго
      внутри ветки «сессия была» — на bootstrap-ветке `bootstrapSession()` сам кладёт `null` в
      кэш через собственный возврат, без вмешательства слушателя.
- [x] **Баг: `UserMenu` не обрезал длинный email.** `truncate` висел прямо на `Button`
      (`inline-flex items-center justify-center`) — при переполнении flex-контейнер центрировал
      содержимое и обрезал текст с обеих сторон без многоточия, а не аккуратно с одного конца.
      Правка в `features/user-menu/ui/user-menu.tsx`: `truncate`/`min-w-0` перенесены на
      внутренний `<span>`, `Button` остаётся только с `max-w-48`.

### Код-ревью 2026-09-22: находки и исправления

- [x] **Зависимость:** shadcn CLI дописал `cn@0.3.2` (отдельный npm-пакет) в
      `dependencies` `apps/web/package.json`, хотя импорт везде уже был поправлен на
      `@/shared/lib/cn` — исполняемый пакет мёртвым грузом висел в проде. Удалён
      (`pnpm --filter @expense-tracker/web remove cn`); в `CLAUDE.md` дописано требование
      проверять `package.json` после каждого `shadcn add`, не только импорты.
- [x] **Баг: диалог создания транзакции молча показывал пустую форму при ошибке
      `/categories`.** `categoriesQuery.isPending ? … : categories && categories.length === 0 ? …`
      при `isError` даёт `categories === undefined` → ветка пустоты ложна → рендерится
      `TransactionForm` с `categories={[]}`, без единого намёка на ошибку. Добавлена явная
      ветка `isError` (`create-transaction-dialog.tsx`) с `Alert` и «Повторить» —
      тот же паттерн, что в `TransactionFeed`. Заодно `TransactionFiltersBar`: при той же
      ошибке селект категорий теперь блокируется и меняет плейсхолдер вместо молчаливого
      показа одного пункта «Все категории».
- [x] **Баг: неудачное удаление транзакции проходило молча.** `deleteTransactionMutation.mutate(...)`
      без `onError` — диалог закрывался (Radix `AlertDialogAction` закрывает сам), строка
      оставалась, пользователь считал, что удалил. `delete-transaction-button.tsx` переписан на
      управляемый `open`: `AlertDialogAction` больше не закрывает диалог сам
      (`event.preventDefault()`, как в `UserMenu`), при ошибке диалог остаётся открытым и
      показывает `Alert` с текстом ошибки; кнопку можно нажать повторно. Тест на этот сценарий
      добавлен.
- [x] **Баг: `categoryId` фильтра из URL не валидировался.** `type`/`month` сверяются со
      схемой, а `?category=` бралось как есть и уходило прямо в запрос — мусор в query давал 400
      от API, и лента навсегда виснет в «Не удалось загрузить» (кнопка «Повторить» такую ошибку
      никогда не лечит, в отличие от прочих ошибок ленты). `use-dashboard-params.ts`:
      `categoryId` теперь прогоняется через `idSchema.safeParse` из `@expense-tracker/shared`,
      невалидное значение отбрасывается в `undefined`.
- [x] **Мелочь:** комментарий в `use-dashboard-params.ts` утверждал, что месяц/фильтры в URL
      «работают назад» — неверно, `router.replace` не создаёт записи в истории. Комментарий
      исправлен на честное объяснение (`replace`, а не `push`, — осознанный выбор против длинного
      хвоста в истории от переключателя месяца).
- [x] **Мелочь:** `max` у поля даты транзакции считался в UTC
      (`new Date().toISOString().slice(0,10)`) — в окне 00:00–03:00 по местному времени
      в часовом поясе UTC+3 это на день меньше реального «сегодня» и блокирует в календаре
      дату, которую схема (`transactionDateSchema`, запас 24 часа) приняла бы. `todayDateInputValue`
      в `transaction-form.tsx` переведена на локальную дату — граница хранения остаётся в UTC,
      меняется только то, что видит пользователь в пикере.
- [x] **Мелочь:** пустое описание транзакции уходило на сервер как `''`, а не `null`
      (схема допускает оба, но пустая строка — не то же самое, что «описания нет»).
      `use-create-transaction.ts`: `description: values.description || null`.
- [x] **Мелочь:** `conflictField` в `applyApiErrors` был типизирован как голый `string` —
      опечатка в имени поля молча ничего не подсвечивала. Переписан на `const TField extends
      readonly string[]` с `conflictField?: TField[number]` — опечатка теперь ошибка компиляции
      (проверено на скретч-файле, что `'emeil'` при `FIELD_NAMES = ['email', 'password']`
      не проходит `tsc`).
- [x] **Мелочь:** цветовой `radiogroup` в `CategoryForm` был доступен только кликом — все 10
      кнопок стояли в общем tab-порядке страницы, без стрелочной навигации. Вынесен в
      `ColorRadioGroup` с roving tabindex (в tab-порядке только выбранная кнопка) и стрелками
      (`ArrowLeft/Right/Up/Down`, `Home`/`End`) — соответствует паттерну WAI-ARIA radiogroup.
      Тест на клавиатурную навигацию добавлен.
