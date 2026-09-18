# Задачи: реализация web-auth-fsd.md

Статус отмечается по ходу выполнения. Порядок соответствует разделу «Порядок работ» плана.

## 1. Baseline

- [x] `nvm use` (в оболочке Node 20.10, ниже корневого `engines.node: ">=20.19"`)
- [x] `pnpm install`
- [x] `pnpm build` — собран `packages/shared/dist`
- [x] `pnpm typecheck && pnpm lint` зелёные до любых правок (потребовалась внеплановая
      правка — см. раздел 16: понижение eslint до 9.x, коммит `576b26d`)

## 2. Токены темы (коммит ДО запуска shadcn CLI)

- [x] `apps/web/src/app/globals.css` — `@theme`: `card*`, `secondary*`, `accent*`, `input`, `ring`, `destructive-foreground`, `--radius-sm/md/lg/xl`
- [x] `globals.css` — те же переменные в блоке `@media (prefers-color-scheme: dark)`
- [x] `globals.css` — `@layer base` с `border-color: var(--color-border)` на `*`, `::before`, `::after`
- [x] `apps/web/src/app/layout.tsx` — `export const viewport` с `viewportFit: 'cover'`
- [x] `layout.tsx` — `min-h-dvh` вместо `min-h-screen`
- [x] `pnpm build` зелёный (коммит `9147e28`); визуальная проверка лендинга — отложена до сквозного прогона в шаге 15

## 3. Каркас FSD и переезд

- [x] `git mv src/lib/api-client.ts src/shared/api/api-client.ts` + экспорт `RequestOptions`
- [x] `git mv src/lib/utils.ts src/shared/lib/cn.ts`
- [x] `git mv src/providers/query-provider.tsx src/app/_providers/query-provider.tsx`
- [x] Удалить каталог `src/components` (пустой `ui/.gitkeep`)
- [x] Поправить два сломанных импорта (`query-provider.tsx`, `app/layout.tsx`)
- [x] `components.json` — алиасы на `@/shared/ui`, `@/shared/lib/cn`, `@/shared/lib`, `@/shared/lib/hooks`
- [x] `pnpm typecheck && pnpm lint && pnpm build` (коммит `e533860`)

## 4. shadcn/ui

- [x] `pnpm dlx shadcn@latest add button input label card alert form --cwd apps/web --dry-run`
- [x] То же без `--dry-run`
- [x] `git diff -- apps/web/src/app/globals.css apps/web/components.json` — пусто
- [x] В `apps/web/package.json` появились `radix-ui`, `react-hook-form`, `@hookform/resolvers`
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm build` (коммит `dd5f513`); формат — точечно на новые
      файлы (`npx prettier --write apps/web/src/shared/ui/*.tsx`), не через общий `pnpm format` —
      см. раздел 16

## 5. Границы слоёв в ESLint

- [x] `apps/web/eslint.config.mjs` — генерация запретов по слоям `shared → entities → features → widgets → views → app`
- [x] Запрет глубоких импортов мимо `index.ts` слайса и старых каталогов `@/lib`, `@/components`, `@/providers`
- [x] `pnpm lint` зелёный (коммит `e806790`); вручную проверено на временных файлах —
      все 4 категории нарушений ловятся, легитимные импорты проходят

## 6. Тестовый стенд

- [x] devDependencies: `vitest@^4`, `vite@^7`, `@vitejs/plugin-react@^5`, `jsdom@^27`, `@testing-library/{react,dom,jest-dom,user-event}`
- [x] `apps/web/vitest.config.ts` (jsdom, alias `@`, `globals: false`, `server.deps.external: ['@expense-tracker/shared']`)
- [x] `apps/web/vitest.setup.ts` (jest-dom, `cleanup`, `ResizeObserver`, `matchMedia`, Pointer Events)
- [x] Скрипты `test` / `test:watch` в `apps/web/package.json` (`turbo.json` не трогали — задача уже была)
- [x] `features/register-form/lib/password-strength.ts` + `.test.ts` — первый живой тест стенда
- [x] `pnpm test` (коммит `d469843`)

## 7. Транспорт

- [x] `shared/api/access-token-store.ts` (`client-only`, `expiresIn` в секундах → `* 1_000`)
- [x] `shared/api/refresh-session.ts` (single-flight + `navigator.locks`, 401/403 ≠ сеть/5xx)
- [x] `shared/api/authorized-fetch.ts` (Bearer, упреждающий refresh, ровно один повтор на 401)

## 8. Сессия

- [x] `entities/session/model/session-keys.ts`, `types.ts`
- [x] `entities/session/model/use-session.ts` (`staleTime`/`gcTime: Infinity`, `retry: false`)
- [x] `entities/session/model/session-provider.tsx` (bootstrap + подписка на `onExpired`)
- [x] `entities/session/api/session-api.ts`
- [x] `app/_providers/app-providers.tsx` и подключение в `app/layout.tsx`

## 9. Утилиты shared/lib

- [x] `shared/lib/form/apply-api-errors.ts` (белый список полей, `'_'` → алерт, 409 → email, 401 → алерт, 429 → свой текст)
- [x] `shared/lib/navigation/safe-next-path.ts` (open redirect, кольцо `/login`↔`/register`)
- [x] `shared/lib/test/render-with-providers.tsx`

## 10. Примитив PasswordInput

- [x] `shared/ui/password-input.tsx` (кнопка `type="button"`, `aria-pressed`, возврат фокуса и каретки)
- [x] Тест: переключение `type`, `aria-pressed`, `aria-label`

## 11. Формы

- [x] `features/login-form/model/schema.ts` + `model/use-login.ts`
- [x] `features/login-form/ui/login-form.tsx` (чистая, props `onSubmit`) + `index.ts`
- [x] `features/login-form/ui/login-form.test.tsx` — 8 тестов, покрывают 10 кейсов из плана
- [x] `features/register-form/model/schema.ts` (`pick` + `extend` + `refine` с `path`)
- [x] `features/register-form/model/use-register.ts`
- [x] `features/register-form/ui/password-strength-meter.tsx` (`aria-live`, анонс только при смене уровня;
      внутри `<FormDescription>` — только `span`, `<div>` внутри `<p>` невалиден и рвёт aria-describedby)
- [x] `features/register-form/ui/register-form.tsx` + `index.ts`
- [x] `features/register-form/ui/register-form.test.tsx` — 8 тестов, покрывают кейсы из плана
- [x] `pnpm test` — 25/25 (коммит следующим)

## 12. Маршруты входа и регистрации (одним шагом — typedRoutes)

- [x] `features/session-guard/ui/session-splash.tsx`
- [x] `features/session-guard/ui/require-auth.tsx`
- [x] `features/session-guard/ui/redirect-if-authenticated.tsx` (обёртка `<Suspense>` под `useSearchParams`)
- [x] `widgets/auth-layout` (safe-area, `max-w-sm sm:max-w-md`)
- [x] `views/login`, `views/register`
- [x] `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`
- [x] `pnpm build` (проверка typedRoutes — `'/login'`/`'/dashboard'` касты из шагов 8/11 остаются:
      `/dashboard` появится только в шаге 13); smoke через `next dev` — оба маршрута отдают 200,
      SSR корректно показывает SessionSplash до бутстрапа сессии

## 13. Дашборд

- [x] `features/logout-button/model/use-logout.ts` (`onSettled`, порядок `clear` → `clear()` → `setQueryData(null)`)
- [x] `features/logout-button/ui/logout-button.tsx` + `.test.tsx`
- [x] `widgets/app-header`
- [x] `views/dashboard`
- [x] `app/(protected)/layout.tsx`, `app/(protected)/dashboard/page.tsx`
- [x] `pnpm build` — все 4 маршрута (`/`, `/login`, `/register`, `/dashboard`); `pnpm test` 26/26

## 14. Документация

- [x] `CLAUDE.md` → `## Архитектура`: подраздел «Фронтенд: Feature-Sliced Design»
- [x] `CLAUDE.md` → `## Архитектура`: подраздел «Design system: shadcn/ui на Tailwind 4»
- [x] `CLAUDE.md` → `## Команды`: тесты web через turbo, убрать «тесты только в apps/api»
- [x] `CLAUDE.md` → `## Состояние проекта`: auth реализован (устарело с `bbc05ad`), фронтенд не пустой
- [x] `CLAUDE.md` → `## Соглашения`: `authorizedFetch` для защищённых, `apiFetch` для публичных

## 15. Финальная проверка

- [x] `pnpm db:up` + `pnpm db:deploy` (миграции уже применены, `No pending migrations`)
- [x] `pnpm build` — все 7 задач, 4 маршрута web
- [x] `pnpm typecheck` — 7/7
- [x] `pnpm lint` — 7/7
- [x] `pnpm test` — api 70/70, web 26/26
- [x] API-уровень сквозного флоу проверен curl'ом с cookie jar (см. раздел 16): register → 409 на
      повтор → login с неверным паролем 401 → refresh с cookie 200 (новые токены) → logout 204 →
      refresh после logout 401. Контракт, под который написан фронтенд, подтверждён.
- [ ] Сквозной прогон **в браузере** (9 сценариев из раздела «Проверка» плана) — не выполнен:
      в этой сессии не было доступа к браузерным инструментам (пользователь отклонил подключение
      Claude in Chrome). Нужен ручной прогон: `pnpm dev`, затем сценарии 1-9 из плана, особо
      внимательно — сценарий 5 (два таба + F5, проверка navigator.locks) и сценарий 6
      (JWT_ACCESS_TTL=30s, авто-refresh).
- [ ] Адаптивность (iPhone SE/15 Pro, реальный Safari) и клавиатурная навигация — та же причина,
      не проверено; нужен ручной прогон по чек-листу плана.

## 16. Внеплановые находки

- [x] Baseline `pnpm lint` в `apps/web` падал ещё до плана: `eslint@10.10.0` несовместим
      с `eslint-plugin-react` (удалённые legacy-методы `context`) и с `FlatCompat.extends(...)`
      против современного flat-конфига `eslint-config-next` (circular JSON). Понижен `eslint`
      до `^9.39.5` во всех пакетах монорепо, `apps/web/eslint.config.mjs` импортирует
      `eslint-config-next/core-web-vitals` напрямую без `FlatCompat`, TS-специфичные правила
      в `packages/eslint-config/base.js` ограничены `*.ts`/`*.tsx`. Коммит `576b26d`.
- [x] Текущий `shadcn@latest` генерирует компоненты с `import { cn } from "cn"` (отдельный
      npm-пакет-дублёр), а не через алиас `utils` из `components.json`, как предполагал план.
      Импорт заменён на `@/shared/lib/cn`, пакет `cn` удалён из зависимостей — утилита
      класс-мёржа остаётся одна на проект. Коммит `dd5f513`.
- [x] `pnpm format` (без пути) переформатировал десятки несвязанных файлов по всему репозиторию
      (другие планы, `apps/api/src/**`, `README.md`, `CLAUDE.md`, `pnpm-workspace.yaml`) —
      расхождение версии/настроек prettier с тем, что закоммичено ранее, никак не связанное
      с этой задачей. Изменения вне `apps/web` отменены; для новых файлов shadcn форматирование
      запускалось точечно (`npx prettier --write <файлы>`). В рамках этой задачи `pnpm format`
      (без аргументов) больше не запускать.
- [x] `PasswordStrengthMeter` рендерится внутри `<FormDescription>`, а это `<p>` — вложенный `<div>`
      внутри `<p>` невалиден, браузер закрывает `<p>` раньше времени, и aria-describedby перестаёт
      видеть текст подсказки. Переписан на `span` с `display` через Tailwind-классы.
- [x] Подсказка индикатора надёжности пароля может дословно совпасть с текстом ошибки
      `passwordSchema` (оба говорят «Добавьте цифру» и т.п.) — `getByText`/`findByText` в тестах
      падают на неоднозначности (найдено 2 совпадения). В тестах на такие сообщения — `getAllByText`.
- [x] `next dev` при первом запуске сам сгенерировал `apps/web/AGENTS.md` и `apps/web/CLAUDE.md`
      («Generated AGENTS.md and CLAUDE.md for AI agents», опция `agentRules` в `next.config.ts`).
      Файлы удалены, в коммиты не попали — конфликтовали бы с соглашением репозитория вести
      документацию на русском и в корневом `CLAUDE.md`. Если поведение мешает, отключить
      `agentRules: false` в `apps/web/next.config.ts` (отдельная правка, не делал — вне плана).
- [x] Полный браузерный прогон (раздел «Проверка» плана, 9 сценариев + адаптивность + клавиатура)
      не выполнен — в сессии не было браузерных инструментов (см. раздел 15). Проверен только
      API-контракт curl'ом: register/login/refresh/logout ведут себя точно так, как ожидает
      фронтенд (401/409/204, ротация refresh-cookie).
