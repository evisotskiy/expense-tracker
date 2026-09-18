# Страницы входа и регистрации: Feature-Sliced Design, shadcn/ui, контур сессии

## Контекст

API аутентификации готов и работает: `POST /api/v1/auth/{register,login,refresh,logout}` и
`GET /api/v1/users/me` реализованы (коммит `bbc05ad`), заглушек в `AuthService` нет.
Фронтенд же остаётся пустым каркасом: `apps/web/src` — семь файлов (layout, лендинг,
`QueryProvider`, `apiFetch`, `cn`), `src/components/ui` пуст, войти в приложение через
браузер невозможно.

Задача: сделать страницы `/login` и `/register`, заглушку `/dashboard` после входа с кнопкой
«Выйти», и заодно заложить фронтенд-архитектуру, которой пока нет вообще — Feature-Sliced
Design и подключённый ui-кит shadcn/ui, чтобы следующие экраны (расходы, категории, бюджеты)
строились по готовым правилам, а не изобретали их заново.

**Решения пользователя:** формы + полноценный контур сессии (хранение токена, авто-refresh,
редиректы) + страница-заглушка с кнопкой «Выйти»; в регистрации — подтверждение пароля,
переключатель показа пароля и индикатор надёжности; тесты компонентов; адаптивность,
обязательно iPhone; разделы про design system и FSD добавить в `CLAUDE.md`.

---

## Ключевые проектные решения

1. **Access-токен — модульный синглтон в `shared/api`, не React-контекст.** `apiFetch`
   вызывается вне React (в `queryFn`, в перехватчике 401 внутри самого транспорта) — из
   контекста токен там не достать. Токен не участвует в рендере: в контексте он давал бы
   перерисовку всего дерева каждые 15 минут на ротации. Файл помечается `import 'client-only'`
   (пакет есть, ставится с Next) — иначе модуль, утянутый в серверный компонент, стал бы
   общим на всех пользователей.

2. **Пользователь — в кэше TanStack Query под `['session','current']`, отдельного
   AuthContext нет.** `QueryClientProvider` уже есть; `setQueryData` из мутации логина
   мгновенно переводит гарды в `authenticated` без лишнего запроса. Три состояния кодируются
   бесплатно: `undefined` — «ещё не знаем», `null` — аноним, объект — авторизован.

3. **Refresh — single-flight внутри вкладки + `navigator.locks` между вкладками.** Это не
   оптимизация, а защита от самоподрыва: бэкенд ротирует refresh-токен и при повторном
   предъявлении отозванного вызывает `revokeAllForUser` (`auth.service.ts`). Пять вкладок,
   восстановленных при старте браузера, без блокировки одновременно пошлют одну и ту же
   cookie → первая ротация пройдёт, остальные четыре попадут в reuse detection → пользователя
   выкинет со всех устройств. Обычный сценарий, а не краевой.

4. **Проактивного таймера обновления нет.** Реактивная ветка на 401 обязательна в любом случае
   (только она переживает сон ноутбука, заморозку фоновых вкладок и отзыв токена сервером).
   Дешёвая проактивность берётся проверкой `isExpiring()` по локальным часам прямо в
   `authorizedFetch` — она снимает лишний круговой рейс, не порождая фоновой активности.

5. **Guard — клиентский, middleware Next невозможен.** Refresh-cookie выдана с
   `path=/api/v1/auth` (`auth.cookies.ts`) — браузер не приложит её к навигации на
   `/dashboard`, а проверить refresh-токен фронт не может: у него нет `JWT_REFRESH_SECRET`.

6. **Слой FSD `app` живёт в `src/app/_providers`.** Папки с префиксом `_` App Router исключает
   из роутинга, поэтому коллизии имён нет и единый алиас `@/* → ./src/*` сохраняется. Слой
   `pages` переименован в `views` — иначе путаница с Pages Router.

7. **Формы — чистые компоненты с `onSubmit: (values) => Promise<void>`.** Навигация и мутации
   живут в `views`, формы про них не знают. Отсюда тесты форм не мокают ни `next/navigation`,
   ни react-query, ни `fetch`.

8. **`confirmPassword` — только на клиенте, в `features/register-form/model/schema.ts`.** В
   `packages/shared` его быть не должно: поле не уходит на сервер, а `shared` импортируется
   бэкендом и попало бы в Swagger-модель. Плюс `shared` потребляется из `dist` — каждая правка
   требует пересборки.

---

## Целевая структура `apps/web/src`

```
app/                                   # ТОЛЬКО роутинг Next + слой app FSD
  _providers/app-providers.tsx         # QueryProvider + SessionProvider (переезд)
  (auth)/layout.tsx                    # <RedirectIfAuthenticated>
  (auth)/login/page.tsx                # тонкий re-export из views
  (auth)/register/page.tsx
  (protected)/layout.tsx               # <RequireAuth>
  (protected)/dashboard/page.tsx
  layout.tsx  page.tsx  globals.css
views/                                 # слой pages FSD: композиция экрана
  login/ | register/ | dashboard/      # ui/*-view.tsx + index.ts
widgets/
  auth-layout/                         # центрированная карточка, safe-area, футер-ссылка
  app-header/                          # шапка дашборда с LogoutButton
features/
  login-form/      model/{schema,use-login}.ts  ui/login-form.tsx        + index.ts
  register-form/   model/{schema,use-register}.ts  lib/password-strength.ts
                   ui/{register-form,password-strength-meter}.tsx        + index.ts
  logout-button/   model/use-logout.ts  ui/logout-button.tsx             + index.ts
  session-guard/   ui/{require-auth,redirect-if-authenticated,session-splash}.tsx
entities/
  session/         api/session-api.ts  model/{types,session-keys,use-session,session-provider}.ts
shared/
  api/{api-client,access-token-store,refresh-session,authorized-fetch}.ts
  lib/{cn.ts, form/apply-api-errors.ts, navigation/safe-next-path.ts, test/render-with-providers.tsx}
  config/routes.ts
  ui/                                  # shadcn + password-input.tsx
```

**Public API.** Барель `index.ts` — ровно один на слайс `entities`/`features`/`widgets`/`views`.
У `shared` барелей нет: `import { Button } from '@/shared/ui'` втянул бы `form.tsx` →
`react-hook-form` в каждый файл, где нужна кнопка. Правило одной строкой:
_`@/shared/...` импортируем файлом; `@/<слой>/<слайс>` — только корнем слайса._

**Переезд существующих файлов** (`git mv`, чтобы не потерять историю) — ломаются ровно две
строки импортов:

| Было                               | Стало                                                              |
| ---------------------------------- | ------------------------------------------------------------------ |
| `src/lib/api-client.ts`            | `src/shared/api/api-client.ts` (+ экспортировать `RequestOptions`) |
| `src/lib/utils.ts`                 | `src/shared/lib/cn.ts`                                             |
| `src/providers/query-provider.tsx` | `src/app/_providers/query-provider.tsx`                            |
| `src/components/ui/.gitkeep`       | каталог `src/components` удалить                                   |

---

## Изменения по файлам

### 1. `shared/api` — транспорт и токен (новые файлы)

`access-token-store.ts` — синглтон: `get`, `set`, `clear`, `isExpiring`, `onExpired`/`emitExpired`.
Событие, а не прямой вызов `router`: `shared` не знает о слоях выше.
**`expiresIn` приходит в секундах** (дефолт 900) — `Date.now() + expiresIn * 1_000`.

`refresh-session.ts` — single-flight:

```ts
let refreshPromise: Promise<AuthResponse | null> | null = null;

export function refreshSession(): Promise<AuthResponse | null> {
  refreshPromise ??= runRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
```

Внутри — `navigator.locks.request('expense-tracker:auth-refresh', …)` с тихим фолбэком, если
API недоступен. Запрос идёт через `apiFetch` (не `authorizedFetch`) — рекурсия невозможна по
построению. **Только 401/403 означают «сессии нет»** (`clear()` + `emitExpired()` + `return null`);
сеть, 429 и 5xx пробрасываются наверх — гасить сессию из-за отвалившегося wi-fi нельзя.

`authorized-fetch.ts` — обёртка для защищённых эндпоинтов: `isExpiring()` → упреждающий refresh,
затем `apiFetch` с `Bearer`; на 401 — один `refreshSession()` и ровно один повтор через `apiFetch`.

### 2. `entities/session`

`session-keys.ts` (`['session','current']`), `use-session.ts` (`useQuery` с
`staleTime: Infinity`, `gcTime: Infinity`, `retry: false`, `refetchOnWindowFocus: false` —
актуальность токена держит транспорт, перезапрос по фокусу давал бы лишние ротации),
`session-provider.tsx` — единственное место, где транспорт встречается с навигацией: запускает
bootstrap и подписывается на `onExpired` → `queryClient.clear()` +
`setQueryData(sessionKeys.current(), null)` + `router.replace('/login')`.

Bootstrap: один `POST /auth/refresh` на старте через тот же `refreshSession()`, поэтому гонка
«bootstrap ↔ первый запрос данных» схлопывается автоматически. `GET /users/me` в контуре не
используется — `refresh` и `login` уже возвращают пользователя.

### 3. `features/session-guard` и route-группы

`RequireAuth`: при `anonymous` → `router.replace('/login?next=' + encodeURIComponent(pathname))`;
при `loading` и `anonymous` рендерит `SessionSplash` и **не монтирует детей** — иначе их `queryFn`
стартуют без токена и устроят лавину 401. `RedirectIfAuthenticated` — зеркально, на
`safeNextPath(searchParams.get('next')) ?? '/dashboard'`.

`safe-next-path.ts` — защита от open redirect (`//evil.com`) и от кольца редиректов (`/login`,
`/register` в `next` не пускаем).

### 4. `shared/lib/form/apply-api-errors.ts`

Раскладывает `ApiRequestError.errors` (`Record<string,string[]>`) по полям через `setError`,
возвращает текст для общего алерта или `null`. Детали, вытекающие из `AllExceptionsFilter`
и `auth.service.ts`:

- ключ поля = `issue.path.join('.')`, ошибки уровня объекта приходят под `'_'` → в алерт;
- нужен белый список полей формы: `setError` на несуществующее поле молча теряет сообщение;
- `shouldFocus` только на первом поле, иначе фокус прыгнет на последнее;
- 409 («email уже зарегистрирован») приходит без `errors` → привязываем к полю `email`;
- 401 на входе **не** привязываем к полю: бэкенд намеренно не различает «нет email» и
  «неверный пароль» (защита от тайминг-атаки), подсветка выдала бы больше, чем он готов сказать;
- 429 от throttler даёт английский текст → подменяем своим.

### 5. Мутации `features/*/model`

`use-login` / `use-register` — `apiFetch` (не `authorizedFetch`: токена ещё нет, а 401 здесь
легитимный ответ); `onSuccess` → `accessTokenStore.set(session)` +
`queryClient.setQueryData(sessionKeys.current(), session.user)` + `router.replace(...)`.
Пользователя берём из ответа — не тратим лишний рейс и не ротируем свежий refresh-токен.

`use-logout` — `onSettled`, а не `onSuccess`: при недоступном сервере локально выйти всё равно
обязаны. Порядок критичен: `clear()` токена → `queryClient.clear()` → **сразу**
`setQueryData(sessionKeys.current(), null)`. Без последнего смонтированный observer перезапустит
`queryFn`, и при живой cookie пользователь молча «войдёт обратно». `clear()`, а не
`invalidateQueries` — на общем компьютере следующий пользователь не должен увидеть чужие расходы.

### 6. `apps/web/src/app/globals.css` — токены темы

Компоненты shadcn печатают `bg-card`, `border-input`, `ring-ring/50`, `bg-accent`,
`bg-secondary`, `rounded-md/lg/xl` — сейчас этих токенов нет, компоненты выглядели бы сломанными.
Добавляем в `@theme`, сохраняя выбранный зелёный `--color-primary: oklch(0.55 0.18 150)`:
`card`/`card-foreground`, `secondary*`, `accent*`, `destructive-foreground`, `input`,
`ring` (фокус в фирменном зелёном), `--radius-sm/md/lg/xl` от существующей базы `--radius`.
Те же переменные переопределяются в блоке `@media (prefers-color-scheme: dark)`.
Плюс `@layer base` с `border-color: var(--color-border)` на `*`, `::before`, `::after` —
`Card`/`Input` печатают `border` без цвета.

**Не добавляем:** `popover*` и `chart-1..5` (нужны только компонентам на Radix Popover и
дашборду с recharts — добавятся вместе с ними).

**`tw-animate-css` не нужен** — анимации есть только у оверлеев, `animate-spin` в ядре Tailwind 4.
**`@custom-variant dark` не добавляем**: объявив его, мы заставим `dark:`-утилиты внутри
shadcn-компонентов ждать класс `.dark`, которого никто не ставит, и тёмная тема сломается
наполовину. Переход на классовую стратегию — отдельная задача целиком (`next-themes`,
дублирование переменных, `suppressHydrationWarning`).

### 7. `apps/web/components.json` — алиасы под FSD

`components`/`ui` → `@/shared/ui`, `utils` → `@/shared/lib/cn`, `lib` → `@/shared/lib`,
`hooks` → `@/shared/lib/hooks`. Остальное не трогаем.

Компоненты — минимальный достаточный набор:

```bash
pnpm dlx shadcn@latest add button input label card alert form --cwd apps/web
```

`form` ключевой: `FormField/FormItem/FormLabel/FormControl/FormMessage` сами разводят `id`,
`aria-invalid` и `aria-describedby` — руками их не проставляем, иначе дубли id.
Не берём `sonner` (ошибки показываем инлайн), `separator`, `progress` (у Radix Progress
семантика «прогресс задачи», а нам нужна декоративная шкала + `aria-live`-текст).

Притянет: `radix-ui` (единый пакет, не `@radix-ui/react-*`), `react-hook-form@^7.88`,
`@hookform/resolvers@^5.9.1`.

**Риск перезаписи CLI.** `shadcn init` **не запускать никогда** — только он штатно перезаписывает
`components.json` и CSS. Токены коммитим **до** `add`, тогда откат — один `git checkout`.
Порядок: `--dry-run` → `add` → `git diff -- apps/web/src/app/globals.css apps/web/components.json`
(ожидаем пусто) → `pnpm format` (shadcn пишет двойные кавычки).

### 8. Схемы форм

`features/login-form/model/schema.ts` — реэкспорт `loginSchema` из shared + типы (одна точка,
если завтра появится «запомнить меня»).

`features/register-form/model/schema.ts`:

```ts
export const registerFormSchema = registerSchema
  .pick({ email: true, password: true }) // name и baseCurrency не спрашиваем: оба optional,
  // валюту сервер подставит, имя — задача профиля
  .extend({ confirmPassword: z.string().min(1, 'Повторите пароль') })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'], // без path ошибка сядет на форму целиком, а не на поле
  });
```

`emailSchema` содержит `.toLowerCase().trim()` — типы совпадают (`string`), но **значения нет**.
Поэтому `useForm<RegisterFormValues, undefined, RegisterFormData>` — третий generic RHF даёт в
`handleSubmit` уже нормализованный email. Payload на сервер собираем явным литералом, а не
деструктуризацией с `confirmPassword: _`.

`mode: 'onTouched'`, `<form noValidate>`. `onChange` красит «Некорректный email» по первой букве,
`onSubmit` заставляет ходить кругами; `noValidate` обязателен — иначе браузер покажет свой
англоязычный пузырь поверх наших сообщений.

Атрибуты полей: email — `type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
autoCorrect="off" spellCheck={false}`; пароль входа — `autoComplete="current-password"`;
пароль и подтверждение регистрации — `autoComplete="new-password"`; `enterKeyHint` на последнем
поле — `"go"`. Поля формы регистрации: email, пароль, подтверждение пароля — и всё.

### 9. Индикатор надёжности пароля

`features/register-form/lib/password-strength.ts` — чистая функция, без zxcvbn (это ~800 КБ
словарей в бандл ради подсказки). По баллу за: длину ≥ 8, длину ≥ 12, наличие обоих регистров,
цифру, спецсимвол → `score = min(points, 4)`. Штрафы: длина < 8 → `score = 0` (базовое требование
`passwordSchema` не выполнено, врать зелёным нельзя); повтор одного символа или короткий
чёрный список (`password`, `qwerty`, `12345678`, `пароль`, `admin`) → не выше 1. Пустая строка → `null`.

Уровни: «Очень слабый», «Слабый», «Средний», «Хороший», «Надёжный». `hint` — первое
невыполненное улучшение.

Доступность: шкала из четырёх сегментов `aria-hidden`, текст в `role="status" aria-live="polite"`.
Компонент рендерится **внутри `<FormDescription>`** — его `id` тогда автоматически попадает в
`aria-describedby` поля. Анонсируем только при смене уровня (`useRef` предыдущего `score`),
иначе `aria-live` тараторит на каждый символ.

### 10. Вёрстка и адаптивность

`app/layout.tsx`: добавить `export const viewport: Viewport = { width: 'device-width',
initialScale: 1, viewportFit: 'cover' }` — без `viewportFit` все `env(safe-area-inset-*)` равны
нулю. `maximum-scale` не задаём — блокировка масштабирования нарушает доступность.
`body` → `min-h-dvh` вместо `min-h-screen`: `100vh` в Safari считается без адресной строки,
из-за чего низ карточки уезжает под неё.

`widgets/auth-layout` — центрирование с safe-area-паддингами
(`pt-[max(1.5rem,env(safe-area-inset-top))]` и т.д.), `max-w-sm sm:max-w-md`, заголовок,
`<Card>`, футер-ссылка на соседнюю страницу. На широких экранах — та же центрированная карточка;
двухколоночный промо-макет сознательно не делаем.

Поля и кнопки — `h-11` (44px, дефолтные `h-9` ниже рекомендованного тач-таргета). Шрифт полей:
`Input` из shadcn имеет `text-base md:text-sm` — на мобильном это 16px и Safari не зумит при
фокусе, **глобально на `text-sm` не переопределять**. В `PasswordInput` поле получает `pr-11`,
кнопка-«глаз» — `absolute inset-y-0 right-0 h-11 w-11`, `type="button"`, переключаемые
`aria-label` («Показать пароль» / «Скрыть пароль») и `aria-pressed`; после клика возвращаем
фокус и позицию каретки в поле, иначе iOS закрывает клавиатуру.

Сабмит: `disabled={isSubmitting} aria-busy`, `Loader2` с `animate-spin` и текст «Входим…» —
состояние видно не только цветом. Общая ошибка — `form.setError('root', …)` и `<Alert
variant="destructive" role="alert">` **над** полями (ниже его закроет клавиатура).
Кольцо фокуса и `aria-invalid:border-destructive` приходят из компонентов — своих классов
ошибки не пишем.

### 11. Тестовый стенд

`nvm use` обязателен первым шагом: в оболочке Node 20.10, что ниже корневого
`engines.node: ">=20.19"`.

Версии подобраны под `engines`, а не «самые свежие»: `vitest@5` требует Node `^22.12 || ^24`,
и на 20.19 сломается. Ставим **`vitest@^4`**, `vite@^7` (обязательный peer, pnpm 8 сам не
поставит), `@vitejs/plugin-react@^5` (шестая требует `vite ^8`), `jsdom@^27` (тридцатая требует
Node ≥ 22.22), `@testing-library/react@^16.3`, `@testing-library/dom@^10.4` (у RTL это peer),
`@testing-library/jest-dom@^7`, `@testing-library/user-event@^14.6`.

`vitest.config.ts`: плагин react, `environment: 'jsdom'`, alias `@ → ./src`, `globals: false`
(иначе пришлось бы задавать `compilerOptions.types`, что выключает автоподхват остальных
`@types/*`), и главное —
`server.deps.external: ['@expense-tracker/shared']`: пакет собран в **CommonJS** и слинкован как
workspace, Vite иначе пытается инлайнить его как ESM.

`vitest.setup.ts`: `@testing-library/jest-dom/vitest`, `cleanup()` в `afterEach` (при
`globals: false` автоочистка не включается), заглушки `ResizeObserver`, `matchMedia` и
Pointer Events (`hasPointerCapture` и др.) — без них падают Radix и `user-event`.

Скрипты `test` / `test:watch` в `apps/web/package.json`. `turbo.json` править **не нужно** —
задача `test` уже описана с `dependsOn: ["^build"]`, и это ровно то, что нужно: перед тестами
соберётся `shared/dist`. Следствие для документации: запускать через `pnpm test` или
`turbo run test --filter=@expense-tracker/web`, а не `pnpm --filter … test` — последний обходит
`^build` и упадёт на пустом `dist`.

**Тест-кейсы.** `password-strength.test.ts`: пустая строка → `null`; `'abc'` → 0; `'abcdefgh'` →
«Слабый» + hint про заглавную; `'Abcdefghij12!'` → «Надёжный», `hint === null`; чёрный список и
повтор символа не выше «Слабый»; границы ровно 8 и ровно 12.

`login-form.test.tsx`: поля находятся через `getByLabelText` (заодно проверка связки label/input);
атрибуты `type`/`autoComplete`/`inputMode`; пустой сабмит → сообщения и `onSubmit` **не вызван**;
ошибка появляется по blur до сабмита (проверка `onTouched`); валидные данные → `onSubmit` ровно
один раз; **нормализация transform**: ввод `'  USER@Example.COM  '` → в аргументе
`'user@example.com'`; поле с ошибкой имеет `aria-invalid="true"` и `aria-describedby` на текст
ошибки; висящий промис → кнопка `disabled` и текст «Входим…»; реджект `ApiRequestError(401)` →
элемент с `role="alert"`; два клика подряд → один вызов.

`register-form.test.tsx`: рендер всех полей; слабый пароль → сообщения из `passwordSchema` shared
(«Добавьте заглавную букву», «Добавьте цифру») — проверяет, что схема действительно взята из
shared; несовпадение → «Пароли не совпадают» **на поле подтверждения**; успешный сабмит →
payload ровно `{ email, password }`, **без** `confirmPassword`; «глаз» меняет `type` и
`aria-pressed`/`aria-label`, повторный клик возвращает; индикатор скрыт до ввода, меняет уровень,
связан с полем через `aria-describedby`.

`logout-button.test.tsx`: клик вызывает `onLogout`, во время выполнения кнопка заблокирована.

Асинхронность RHF: сообщения проверять через `await screen.findByText(...)`, вызовы — через
`waitFor`. `userEvent.setup()` в каждом тесте.

### 12. Границы слоёв в ESLint

`@typescript-eslint/no-restricted-imports` (TS-версия, корректно обрабатывает `import type`),
без новых зависимостей: `eslint-plugin-boundaries` даёт +1 зависимость и свою модель
`elements/rules` — на шесть слайсов неоправданно. Порог перехода: больше ~10–12 слайсов.

В `apps/web/eslint.config.mjs` — генерация по списку слоёв `shared → entities → features →
widgets → views → app`: для каждого слоя запрещены все слои выше, соседние слайсы того же слоя,
глубокие импорты в чужой слайс (`@/features/*/**` мимо `index.ts`), старые каталоги
(`@/lib/*`, `@/components/*`, `@/providers/*`) и относительные побеги между слоями.

Важно: в flat-config опции правила **заменяются**, а не сливаются между объектами, поэтому общие
паттерны подмешиваются в каждый слоевой блок, а не выносятся отдельным объектом.
Правило не видит `import()` и `require` — это осознанный предел, остальное на код-ревью.

### 13. `CLAUDE.md`

Добавить в `## Архитектура` два подраздела (сейчас там только бэкенд):

- **«Фронтенд: Feature-Sliced Design»** — таблица слоёв и их назначения, правило импортов
  («только вниз; `@/shared/...` — файлом, `@/<слой>/<слайс>` — корнем слайса»), почему `app`
  занят роутингом Next и слой живёт в `src/app/_providers`, почему `pages` → `views`, где
  проверяются границы (`eslint.config.mjs`).
- **«Design system: shadcn/ui на Tailwind 4»** — компоненты добавляются
  `pnpm dlx shadcn@latest add … --cwd apps/web`, `shadcn init` запускать нельзя, алиасы в
  `components.json` ведут в `@/shared/ui`, токены живут в `@theme` в `globals.css` (добавляя
  компонент — проверить, что все его токены есть), тёмная тема сейчас только по
  `prefers-color-scheme` и `@custom-variant dark` добавлять нельзя половинчато.

Плюс:

- В `## Команды` — тесты теперь есть и в `apps/web` (vitest), запуск через turbo, а не
  `pnpm --filter`; убрать утверждение «тесты настроены только в `apps/api`».
- В `## Состояние проекта` — привести в соответствие: auth реализован (сейчас там написано, что
  это заглушки — устарело с коммита `bbc05ad`), фронтенд больше не пустой каркас.
- В `## Соглашения` — пункт про контур сессии: access-токен в памяти, `authorizedFetch` для
  защищённых эндпоинтов, `apiFetch` для публичных.

---

## Порядок работ

После каждого шага `pnpm typecheck && pnpm lint && pnpm build` зелёные (с шага 6 — ещё `pnpm test`).
Шаги 2–13 — отдельные коммиты.

1. `nvm use`, `pnpm install`, `pnpm build` — зафиксировать зелёный baseline. Ничего не меняем.
2. **Токены темы:** `globals.css` (`@theme` + `@layer base`), `layout.tsx` (`viewport`,
   `min-h-dvh`). Коммит **до** запуска shadcn CLI — это страховка от перезаписи.
3. **Каркас FSD:** `git mv` трёх файлов, удалить `src/components`, поправить два импорта и
   алиасы в `components.json`. Шаг чисто механический.
4. **shadcn add** (`--dry-run`, затем без него), `git diff` по `globals.css`/`components.json`,
   `pnpm format`.
5. **Границы слоёв в ESLint** — код уже разложен, правило включается «в зелёном».
6. **Тестовый стенд:** devDependencies, `vitest.config.ts`, `vitest.setup.ts`, скрипты.
   Первый тест — `password-strength.test.ts` вместе с самой функцией: чистая логика без React,
   проверяет, что стенд живой.
7. **Транспорт:** `shared/api/{access-token-store,refresh-session,authorized-fetch}.ts`,
   экспорт `RequestOptions` из `api-client.ts`.
8. **Сессия:** `entities/session` (ключи, типы, `useSession`, `SessionProvider`),
   `app/_providers/app-providers.tsx`, подключение в `layout.tsx`.
9. **`shared/lib`:** `apply-api-errors.ts`, `safe-next-path.ts`, `test/render-with-providers.tsx`.
10. **`shared/ui/password-input.tsx`** + тест на переключение типа и `aria-pressed`.
11. **Формы:** `features/login-form` и `features/register-form` (схемы, ui, индикатор
    надёжности) с тестами. Компоненты пока никуда не подключены — сборка зелёная.
12. **Маршруты — одним шагом:** `features/session-guard`, `widgets/auth-layout`, `views/login`,
    `views/register`, `app/(auth)/**`. Обязательно вместе: при `typedRoutes: true`
    `<Link href="/register">` со страницы логина не скомпилируется, пока `/register` не существует.
13. **Дашборд:** `features/logout-button`, `widgets/app-header`, `views/dashboard`,
    `app/(protected)/**`.
14. **Документация:** `CLAUDE.md`, финальная отметка чеклиста в `.claude/plans/`.

---

## Проверка

```bash
pnpm db:up && pnpm build
pnpm test                 # через turbo: соберёт shared/dist перед тестами web
pnpm typecheck && pnpm lint
pnpm dev                  # web :3000 + api :4000
```

Сквозной ручной прогон в браузере (строго `http://localhost:3000`, **не `127.0.0.1`** — иначе
`sameSite=lax` cookie не уйдёт и F5 будет всегда разлогинивать):

1. `/register` → регистрация → редирект на `/dashboard`, виден email пользователя.
2. Повторная регистрация тем же email → 409 подсвечивает поле email, а не общий алерт.
3. `/login` с неверным паролем → общий алерт «Неверный email или пароль», поля не подсвечены.
4. Вход → **F5** → сессия восстановилась (bootstrap `/auth/refresh`), заглушки не мигают.
5. Две вкладки, F5 в обеих одновременно → **никого не выкинуло** (проверка Web Locks + single-flight).
6. `JWT_ACCESS_TTL=30s` в `apps/api/.env`, перезапуск API → подождать → действие на `/dashboard`
   проходит прозрачно (авто-refresh на 401).
7. «Выйти» → `/login`; кнопка «Назад» не возвращает на дашборд.
8. Прямой заход анонимом на `/dashboard` → `/login?next=%2Fdashboard`, после входа — обратно на дашборд.
9. `/login?next=//evil.com` → после входа уводит на `/dashboard`, не наружу.

Адаптивность — DevTools iPhone SE (375×667) и iPhone 15 Pro, плюс живой Safari на iOS если есть:
клавиатура не перекрывает кнопку сабмита, при фокусе в поле страница **не зумится**,
карточка не уезжает под адресную строку и под home indicator, тач-таргеты нажимаются уверенно.
Клавиатурой: Tab обходит все поля и «глаз», Enter отправляет форму, кольцо фокуса зелёное и видно.

---

## Риски

- **Reuse detection × одновременный bootstrap в нескольких вкладках** — главный риск контура.
  Без `navigator.locks` восстановление сессии браузера с несколькими вкладками гарантированно
  разлогинивает пользователя везде. Web Locks требует secure context (localhost считается secure);
  проверить, что фолбэк не молчаливо отключил защиту.
- **`expiresIn` в секундах.** Забыть `* 1000` — токен «протухает» через 900 мс, refresh уходит на
  каждый запрос, лимит 30/мин выбирается за секунды, дальше 429 и каскадный выход.
- **`queryClient.clear()` без последующего `setQueryData(['session','current'], null)`** —
  смонтированный observer перезапросит сессию, и при живой cookie пользователь «войдёт обратно».
- **Ошибку refresh по сети трактовать как «разлогинен»** — самая частая ошибка реализации.
  Разделение 401/403 и всего остального в `runRefresh` менять «для простоты» нельзя.
- **Прод: `sameSite: 'none'` + разные домены** = third-party cookie, Safari ITP их режет.
  Решать до релиза (same-site домены либо прокси API через домен фронта); контур на фронте
  от этого не меняется.
- **`useSearchParams()` в Next 16** требует обёртки `<Suspense>` в статически рендерящейся ветке,
  иначе падает сборка — касается `RedirectIfAuthenticated` и страницы `/login`.
- **`typedRoutes: true`** не выводит `Route` для шаблонных строк с query — нужны явные
  `as Route` в guard и `safeNextPath`, с комментарием, чтобы их не «почистили».
- **Импорт `access-token-store` в серверный компонент** отдал бы один модуль всем пользователям.
  `import 'client-only'` превращает это из утечки данных в ошибку сборки — директиву не удалять.
- **Два экземпляра zod** при расхождении диапазонов `apps/web` и `packages/shared` (сейчас оба
  `^4.6.5`). `zodResolver` работает через `safeParse`, фатального не будет, но сообщения могут
  разъехаться — диапазоны держать синхронными.
- **`tsc --noEmit` увидит `vitest.config.ts` и `vitest.setup.ts`** — они попадают в `include`
  (`**/*.ts`). Компилируются нормально (`@types/node` есть), но typecheck проверить сразу.
- **Node в оболочке 20.10** ниже корневого `engines` — без `nvm use` установка и сборка ведут себя
  непредсказуемо.
