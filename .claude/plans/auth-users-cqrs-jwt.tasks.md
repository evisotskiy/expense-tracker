# Задачи: реализация auth-users-cqrs-jwt.md

Статус отмечается по ходу выполнения. Порядок соответствует разделу «Порядок работ» плана.

## 1. Фундамент: длительности, env, зависимость cqrs
- [x] Добавить `@nestjs/cqrs` в `apps/api/package.json`, `pnpm install`
- [x] `apps/api/src/common/utils/duration.ts` — `parseDurationToSeconds`, `isDuration`
- [x] `apps/api/src/common/utils/duration.spec.ts`
- [x] `env.schema.ts` — `.refine(isDuration)` на `JWT_ACCESS_TTL`/`JWT_REFRESH_TTL`
- [x] `auth.module.ts` — `expiresIn` числом через `parseDurationToSeconds`
- [x] `pnpm --filter @expense-tracker/api typecheck` зелёный

## 2. Модуль users: репозиторий + CQRS-контракт
- [x] `users.repository.ts` — `findProfileById`, `findAuthById`, `findCredentialsByEmail`, `create`
- [x] `commands/create-user.command.ts` + `create-user.handler.ts`
- [x] `queries/get-user-credentials.query.ts` + handler
- [x] `queries/get-auth-user.query.ts` + handler
- [x] `queries/get-user-profile.query.ts` + handler
- [x] `users.module.ts` — регистрация репозитория и хендлеров (CqrsModule глобален, импортируется 1 раз в AppModule)
- [x] `users.service.ts` — через `QueryBus`, `findByEmail` удалён (0 вызывающих)
- [x] `app.module.ts` — `CqrsModule.forRoot()` в imports

## 3. Модуль auth: refresh-токены и типы
- [x] `refresh-tokens.repository.ts` — `create`, `findById`, `rotate`, `revoke`, `revokeAllForUser`
- [x] `auth.types.ts` — `SessionContext`, `AuthResult`, `REFRESH_TOKEN_COOKIE_PATH`

## 4. AuthService
- [x] Конструктор на `CommandBus`/`QueryBus`/`RefreshTokensRepository`/`JwtService`/`ConfigService`
- [x] `issueTokens` (общая выдача пары)
- [x] `register`
- [x] `login` + dummy-хеш в `onModuleInit`
- [x] `logout`
- [x] `refresh` (ротация + reuse detection)

## 5. AuthController
- [x] `auth.cookies.ts` — фабрика `CookieOptions`
- [x] `decorators/refresh-token.decorator.ts`
- [x] `decorators/session-context.decorator.ts` (экспортирует `SessionInfo`, не `Session` — избегаем коллизии с `@nestjs/common`)
- [x] `auth.controller.ts` — 4 эндпоинта, throttling
- [x] `auth.module.ts` — итоговая сборка providers/imports (уже была готова к моменту правки expiresIn)

## 6. Тесты
- [x] `password.spec.ts` (реальный round-trip argon2, без мока)
- [x] `auth.service.spec.ts`
- [x] `auth.controller.spec.ts`
- [x] `users.service.spec.ts`
- [x] `users.handlers.spec.ts` (включая проверку резолва CQRS-сообщений)

## 7. Финальная проверка
- [x] `pnpm build`
- [x] `pnpm typecheck`
- [x] `pnpm lint` (0 ошибок)
- [x] `pnpm --filter @expense-tracker/api test` — 60/60 зелёных
- [x] Сквозной прогон на реальном Postgres: register→login→me→refresh→reuse-detection→logout→409 на дубль email — все статусы совпали с ожиданием

## 8. Внеплановая находка: системный баг DI (устранён)
`import { type X }` для DI-параметров стирает класс из `design:paramtypes` (получаем
`Function` вместо класса) — Nest не мог поднять приложение вообще ни на одном модуле.
Исправлено через `@Inject(X)` + обычный (не type-only) импорт во ВСЕХ файлах с
конструктор-инъекцией по всему `apps/api/src`, включая ранее нетронутые заглушки
(categories, budgets, expenses, health) — иначе `AppModule` не поднимался бы при
старте (все модули грузятся eager). Подтверждено живым запуском: приложение стартует,
все роуты замаплены, Swagger собирается.
