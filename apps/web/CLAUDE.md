Дополняет корневой `CLAUDE.md` — здесь только то, что специфично для `apps/web`.

## Команды

Тесты (vitest + Testing Library, шаблон `*.test.ts(x)`, рядом с кодом) запускать через
`pnpm test` или `turbo run test --filter=@expense-tracker/web`, а **не**
`pnpm --filter @expense-tracker/web test` — последний обходит `dependsOn: ["^build"]` и упадёт
на пустом `packages/shared/dist` (пакет собран в CommonJS и слинкован как workspace-зависимость).

```bash
pnpm --filter @expense-tracker/web lint
```

## Архитектура

### Feature-Sliced Design

`apps/web/src` организован слоями снизу вверх:

| Слой       | Назначение                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| `shared`   | транспорт, утилиты, ui-кит — не знает о домене                                                           |
| `entities` | бизнес-сущности (`session`) — данные и способ их получить                                                |
| `features` | пользовательские действия (`login-form`, `register-form`, `logout-button`, `session-guard`)              |
| `widgets`  | композиция фич в законченный кусок интерфейса (`auth-layout`, `app-header`)                              |
| `views`    | сборка экрана из widgets/features/entities (переименован из `pages` FSD — иначе путаница с Pages Router) |
| `app`      | только роутинг Next (`layout.tsx`, `page.tsx`, route groups)                                             |

Правило импортов — только вниз, с двумя исключениями:

- `@/shared/...` импортируем **файлом** (`@/shared/api/api-client`) — у `shared` нет барелей,
  иначе `import { Button } from '@/shared/ui'` утянул бы `form.tsx` → `react-hook-form` в каждый
  файл, где нужна только кнопка;
- `@/<слой>/<слайс>` для `entities`/`features`/`widgets`/`views` — только **корнем слайса**
  (`@/features/login-form`, не `@/features/login-form/model/schema`) — слайс отдаёт наружу
  только то, что экспортирует его `index.ts`.

Слой `app` занят роутингом Next, поэтому свой код слоя `app` (провайдеры) живёт в
`src/app/_providers` — префикс `_` исключает папку из роутинга, и единый алиас `@/* → ./src/*`
не ломается.

Границы проверяются в `apps/web/eslint.config.mjs`: `@typescript-eslint/no-restricted-imports`
генерируется по списку слоёв и запрещает слои выше, соседние слайсы того же слоя, глубокие
импорты в чужой слайс мимо `index.ts`, старые каталоги (`@/lib`, `@/components`, `@/providers`)
и относительные импорты, пересекающие границу слоя. Правило не видит `import()`/`require` —
остальное на код-ревью.

### Design system: shadcn/ui на Tailwind 4

Компоненты добавляются `pnpm dlx shadcn@latest add <имя> --cwd apps/web`, никогда не через
`shadcn init` — он штатно перезаписывает `components.json` и `globals.css`. Алиасы в
`components.json` ведут в `@/shared/ui` (сами компоненты) и `@/shared/lib/cn` (утилита класс-
мёржа); текущая версия CLI генерирует `import { cn } from "cn"` (отдельный npm-пакет) —
поправлять на `@/shared/lib/cn` вручную после каждого `add`. CLI заодно дописывает пакет `cn`
в зависимости `apps/web/package.json` — проверяйте `git diff package.json` после каждого `add`
и убирайте `cn` из `dependencies`, если импорт поправлен: иначе исполняемый npm-пакет остаётся
мёртвым грузом в проде.

Токены темы живут в `@theme` в `apps/web/src/app/globals.css` (и переопределяются в
`@media (prefers-color-scheme: dark)`): добавляя новый компонент, проверьте, что все токены,
которые он печатает (`bg-card`, `border-input`, `ring-ring/50` и т.п.), уже объявлены — иначе
компонент выглядит сломанным без ошибки сборки.

Тёмная тема сейчас только по `prefers-color-scheme`. `@custom-variant dark` не добавлять
половинчато: он заставит `dark:`-утилиты внутри shadcn-компонентов ждать класс `.dark`, которого
никто не ставит. Переход на классовую стратегию (`next-themes` и переключатель) — отдельная
задача целиком.

## Окружение

`apps/web/web.env.example` → `apps/web/.env.local`, читает Next.js.

## Соглашения

Контур сессии на фронтенде: access-токен хранится в памяти (`shared/api/access-token-store.ts`,
не React-контекст — токен не должен участвовать в рендере). Защищённые эндпоинты — через
`authorizedFetch` (добавляет `Bearer`, упреждающий и реактивный refresh на 401); публичные
(`/auth/login`, `/auth/register`, `/auth/refresh`) — через `apiFetch` напрямую: токена ещё нет,
а 401 там легитимный ответ, а не сигнал разорванной сессии.
