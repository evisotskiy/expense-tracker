# Аутентификация: модуль пользователя, CQRS между модулями, JWT-авторизация

## Контекст

`apps/api` — каркас: контуры auth/users написаны, но все методы `AuthService`
(`register`, `login`, `refresh`, `logout`) бросают `throw new Error('Не реализовано')`.
Войти в API невозможно, а глобальный `JwtAuthGuard` закрывает всё — ни один защищённый
эндпоинт нельзя даже проверить вручную.

Инфраструктура уже заложена:

- таблицы `users` и `refresh_tokens` смигрированы (`20260915144948_mig1`) — **схему БД менять не нужно**;
- Zod-схемы `registerSchema` / `loginSchema` / `authResponseSchema` готовы в `packages/shared/src/schemas/auth.ts`;
- `JwtStrategy`, `JwtAuthGuard`, `@Public()`, `@CurrentUser()` реализованы;
- env: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=30d`;
- `cookieParser()` и CORS с `credentials: true` подключены в `main.ts`;
- `argon2@0.45.1` установлен, но нигде не используется.

Итог: рабочий цикл `register → login → refresh → logout`, access-токен в заголовке,
refresh — в httpOnly cookie с ротацией. Модуль `users` получает слой репозитория,
а взаимодействие между модулями идёт **через CQRS-шины**, а не через прямой вызов сервисов.

**Решения пользователя:** полный цикл из четырёх эндпоинтов; стартовые категории при
регистрации не создаём; новый код покрываем unit-спеками; межмодульное взаимодействие — CQRS.

---

## Блокер, который надо снять первым

`jwt.signAsync(payload, { secret, expiresIn: config.get('JWT_REFRESH_TTL') })` **не компилируется**.
`@types/jsonwebtoken@9.0.10` объявляет `expiresIn?: number | ms.StringValue`, где `StringValue` —
шаблонный литеральный тип; обычный `string` туда не присваивается. Проверено компилятором
на реальном `apps/api/tsconfig.json`:

```
Type 'string' is not assignable to type 'number | StringValue | undefined'.
```

В `auth.module.ts` это сейчас проходит только потому, что `useFactory: (...args: any[]) => JwtModuleOptions`
теряет контекстную проверку возвращаемого литерала.

**Решение:** переводить TTL в секунды и передавать числом. То же число уходит в
`AuthResponse.expiresIn` — одна операция закрывает обе задачи.

Пакета `ms` в `apps/api` нет (только транзитивно через `jsonwebtoken`, pnpm его не хойстит),
поэтому пишем свой парсер на ~15 строк, а не тянем зависимость.

---

## CQRS: граница между модулями

Зависимость: **добавить `@nestjs/cqrs@^11`** в `apps/api/package.json` (сейчас её нет).

### Принцип

`AuthModule` **не импортирует** `UsersModule` и ничего не знает ни о `UsersService`,
ни о `UsersRepository`. Всё, что ему нужно от домена пользователей, он запрашивает
через `QueryBus` / `CommandBus`. Модуль `users` публикует хендлеры — это его контракт
с остальным приложением. Внутримодульные обращения (auth → свои же refresh-токены)
остаются прямыми: CQRS здесь про **границу между модулями**, а не про каждый вызов.

### Контракт модуля users

`apps/api/src/modules/users/queries/` и `.../commands/`:

| Сообщение | Результат | Кто шлёт |
| --- | --- | --- |
| `CreateUserCommand { email, passwordHash, name?, baseCurrency? }` | `AuthUser \| null` (`null` = email занят) | `AuthService.register` |
| `GetUserCredentialsQuery { email }` | `UserCredentials \| null` (единственный носитель `passwordHash`) | `AuthService.login` |
| `GetAuthUserQuery { userId }` | `AuthUser \| null` | `AuthService.refresh` |
| `GetUserProfileQuery { userId }` | `UserProfile \| null` | `UsersService.findById` |

Типизация результата — через дженерики шины: `queryBus.execute<GetAuthUserQuery, AuthUser | null>(...)`.
Если версия `@nestjs/cqrs` поддерживает базовый класс `Query<TResult>`, наследуемся от него
и получаем вывод типа без явных параметров — проверить на этапе установки пакета.

Хендлеры — тонкие, вся работа с Prisma остаётся в `UsersRepository`:

```ts
@QueryHandler(GetUserCredentialsQuery)
export class GetUserCredentialsHandler implements IQueryHandler<GetUserCredentialsQuery> {
  constructor(private readonly users: UsersRepository) {}

  execute({ email }: GetUserCredentialsQuery) {
    return this.users.findCredentialsByEmail(email);
  }
}
```

### Регистрация

`CqrsModule` импортируется в `AppModule`, `UsersModule` и `AuthModule`. Хендлеры
перечисляются в `providers` того модуля, которому принадлежат (`UsersModule`) —
`ExplorerService` находит их по декораторам и связывает с шинами.

**Что важно знать про этот подход:** связь «команда → хендлер» проверяется в рантайме,
а не компилятором. Забытый хендлер в `providers` даёт не ошибку сборки, а исключение
при первом запросе. Поэтому спек «каждая команда/запрос имеет зарегистрированный хендлер»
(поднять `AppModule` через `Test.createTestingModule` и убедиться, что `execute` не бросает
`CommandHandlerNotFoundException`) — не формальность, а замена потерянной проверки типов.

---

## Проектные решения

1. **Пароль — argon2id** с профилем OWASP: `{ type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }`.
   Библиотечные дефолты (64 MiB, t=3, p=4) втрое дороже по памяти: десятки одновременных
   логинов × 64 MiB упрутся в RSS раньше, чем в CPU. Соль argon2 генерирует сам и кладёт в PHC-строку.
2. **`tokenHash` — SHA-256 от полной строки refresh-JWT**, не argon2. Схема предписывает:
   `tokenHash String @unique`, а уникальный индекс возможен только по детерминированному хешу —
   argon2 солёный, два хеша одного токена различаются, и `findUnique` по нему невозможен в принципе.
   Refresh-токен к тому же не пароль: его энтропия равна энтропии секрета, перебирать нечего,
   а 19 MiB на каждое продление каждой сессии — готовый вектор DoS.
3. **Refresh подписывается вторым секретом** (`JWT_REFRESH_SECRET`) — украденный access нельзя
   предъявить как refresh, и наоборот.
4. **`tokenId` генерируем сами** (`randomUUID()`) и кладём как первичный ключ строки `refresh_tokens`.
   Иначе не выйдет: `tokenHash` — хеш уже подписанного токена, а подписать токен без `tokenId` нельзя.
   Формат uuid вместо `@default(cuid())` безвреден — этот id не пересекает границу API
   и не валидируется `idSchema`; нужен комментарий в коде, иначе кто-нибудь «починит».
5. **Никакой предварительной проверки занятости email.** Между `SELECT` и `INSERT` есть окно;
   единственный арбитр — уникальный индекс. `P2002` → `null` из репозитория → `409` в сервисе.
6. **Защита от user enumeration на login:** при неизвестном email всё равно выполняем
   `argon2.verify` против фиктивного хеша, иначе «нет такого email» вернётся за 1 мс,
   а «неверный пароль» — за 50 мс, и тайминги выдадут список зарегистрированных адресов.
7. **Reuse detection:** предъявление отозванного токена → гасим **все** живые сессии пользователя.
   Точечно нельзя — в `refresh_tokens` нет `familyId`, а схему в этой итерации не меняем.

---

## Файлы

### Создать

| Путь | Назначение |
| --- | --- |
| `apps/api/src/common/utils/duration.ts` + `.spec.ts` | `parseDurationToSeconds`, `isDuration` |
| `apps/api/src/modules/users/users.repository.ts` | доступ к `users`, три `select`-набора, P2002 → `null` |
| `apps/api/src/modules/users/commands/create-user.{command,handler}.ts` | CQRS-контракт |
| `apps/api/src/modules/users/queries/get-user-credentials.{query,handler}.ts` | — |
| `apps/api/src/modules/users/queries/get-auth-user.{query,handler}.ts` | — |
| `apps/api/src/modules/users/queries/get-user-profile.{query,handler}.ts` | — |
| `apps/api/src/modules/auth/refresh-tokens.repository.ts` | доступ к `refresh_tokens` + атомарный `rotate` |
| `apps/api/src/modules/auth/auth.cookies.ts` | единая фабрика `CookieOptions` для set и clear |
| `apps/api/src/modules/auth/decorators/refresh-token.decorator.ts` | `@RefreshToken()` |
| `apps/api/src/modules/auth/decorators/session-context.decorator.ts` | `@Session()` |
| `apps/api/src/modules/auth/auth.service.spec.ts`, `auth.controller.spec.ts` | основные спеки |
| `apps/api/src/modules/users/users.service.spec.ts`, `users.handlers.spec.ts` | спеки users |

### Изменить

| Путь | Что |
| --- | --- |
| `apps/api/package.json` | `+ @nestjs/cqrs@^11` |
| `apps/api/src/modules/auth/auth.service.ts` | реализация 4 методов; конструктор на `CommandBus`/`QueryBus`, без Prisma |
| `apps/api/src/modules/auth/auth.controller.ts` | 4 эндпоинта, `@Res({ passthrough: true })`, точечный троттлинг |
| `apps/api/src/modules/auth/auth.types.ts` | `SessionContext`, `AuthResult`, `REFRESH_TOKEN_COOKIE_PATH` |
| `apps/api/src/modules/auth/auth.module.ts` | `imports: [PassportModule, JwtModule…, CqrsModule]`, `expiresIn` числом |
| `apps/api/src/modules/users/users.module.ts` | `CqrsModule`, `UsersRepository` и хендлеры в `providers` |
| `apps/api/src/modules/users/users.service.ts` | через `QueryBus`; `findByEmail` удалить (0 вызывающих) |
| `apps/api/src/app.module.ts` | `CqrsModule` в `imports` |
| `apps/api/src/config/env.schema.ts` | `.refine(isDuration)` на оба TTL |

**Не трогать:** `packages/database/prisma/schema.prisma`, `packages/shared/**`,
`common/guards/jwt-auth.guard.ts`, `strategies/jwt.strategy.ts`, `dto/auth.dto.ts`.

---

## Реализация

### 1. Парсер длительностей + env

```ts
// common/utils/duration.ts
const SECONDS_IN_UNIT = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;
const DURATION = /^(\d+)(s|m|h|d)?$/;

/**
 * Переводит TTL вида '15m', '30d', '900' в секунды.
 *
 * Секунды нужны в двух местах: AuthResponse.expiresIn и signOptions.expiresIn —
 * @types/jsonwebtoken принимает там не любой string, а шаблонный ms.StringValue,
 * куда результат config.get() не присваивается. Пакета ms в apps/api нет.
 */
export function parseDurationToSeconds(value: string): number
export function isDuration(value: string): boolean
```

В `env.schema.ts`: `.refine(isDuration, 'Формат: 15m, 2h, 30d')` на оба TTL — опечатка
в `.env` роняет приложение на старте, а не первый логин в проде. В `auth.module.ts`
`signOptions.expiresIn` тоже переводим в число, иначе заявленный `expiresIn`
разъедется с реальным `exp` токена.

### 2. `UsersRepository`

Репозиторий знает про Prisma и не знает про HTTP; возвращает данные или `null`.
Исключения (`NotFoundException`, `ConflictException`) — ответственность вызывающей стороны.

```ts
/** Ровно поля authUserSchema — то, что уходит в AuthResponse.user. */
const AUTH_USER_SELECT = { id: true, email: true, name: true, baseCurrency: true } as const;
/** Профиль для GET users/me. passwordHash не включён намеренно. */
const PROFILE_SELECT = { ...AUTH_USER_SELECT, createdAt: true } as const;
/** Единственное место, где из базы поднимается passwordHash. */
const CREDENTIALS_SELECT = { ...AUTH_USER_SELECT, passwordHash: true } as const;
```

Методы: `findProfileById`, `findAuthById`, `findCredentialsByEmail`, `create`.

Два подводных камня:

- **`baseCurrency`**: Prisma отдаёт `string` (колонка `VarChar(3)`), а `AuthUser.baseCurrency` —
  это `SupportedCurrency`. Прямое присваивание не скомпилируется. Прогонять ответ через
  `authUserSchema.parse()` **нельзя**: `ZodError` попадёт в `AllExceptionsFilter` и превратится
  в 400 «Ошибка валидации» на совершенно исправном ответе. Нужен приватный маппер
  с приведением и честным комментарием, почему оно безопасно.
- **Ловля P2002** требует значения, а не типа: `import { Prisma } from '@expense-tracker/database'`
  (без `type`) — `Prisma.PrismaClientKnownRequestError` доступен как `const`.

Утечку `passwordHash` предотвращаем структурно: ни одного запроса без `select`;
хеш появляется ровно в одном типе (`UserCredentials`) с ровно одним потребителем
(`GetUserCredentialsHandler` → `AuthService.login`) и не покидает `login`.
Глобальный `omit` в Prisma-клиенте не годится — клиент общий с Next, логин перестал бы работать.

### 3. `RefreshTokensRepository`

Внутренний для `AuthModule`, через CQRS не ходит.

```ts
create(data): Promise<void>
findById(id): Promise<StoredRefreshToken | null>
rotate(oldId, next): Promise<boolean>   // атомарно: гасит старую, создаёт новую
revoke(id): Promise<void>               // updateMany, не update — отсутствие записи не P2025
revokeAllForUser(userId): Promise<void>
```

`rotate` — интерактивная транзакция с оптимистической блокировкой:

```ts
return this.prisma.client.$transaction(async (tx) => {
  // revokedAt: null в where — если два запроса пришли с одним токеном,
  // ровно один увидит count === 1.
  const { count } = await tx.refreshToken.updateMany({
    where: { id: oldId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count !== 1) return false;
  await tx.refreshToken.create({ data: next });
  return true;
});
```

### 4. `AuthService`

Конструктор: `(commandBus, queryBus, refreshTokens, jwt, config)` — `PrismaService` уходит.

Новые типы в `auth.types.ts`: `SessionContext { userAgent, ip }`, `AuthResult { response, refreshToken, refreshTokenMaxAgeMs }`,
`REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth'`. Сигнатуры методов меняются относительно каркаса:
контроллер владеет HTTP и ставит cookie, значит сервис обязан вернуть ему сырой refresh-токен.
Внедрять `@Res` в сервис нельзя — это привязало бы доменный сервис к Express.

**`issueTokens(user, context)`** — общая выдача пары: подписываем access; генерируем `tokenId`;
подписываем refresh вторым секретом с `expiresIn` **числом**; сохраняем `sha256(refreshToken)`.

**`register`** — `argon2.hash` → `CreateUserCommand`; `null` → `ConflictException`.
Email уже нормализован (`emailSchema` делает `.toLowerCase().trim()` в глобальном пайпе).
Стартовые категории не создаём — оставить комментарий-якорь, чтобы это читалось
как решение, а не забытый TODO.

**`login`** — `GetUserCredentialsQuery`; `verify` вызывается **всегда**, при отсутствии
пользователя — против `dummyHash`. Одна ошибка на оба случая: `UnauthorizedException('Неверный email или пароль')`.
`dummyHash` считается в `onModuleInit` от случайной строки с теми же `ARGON2_OPTIONS` —
захардкоженный разъехался бы с параметрами при их пересмотре, и тайминги снова разошлись бы.

**`refresh`** — проверки от дешёвых к дорогим:

1. `verifyAsync` с `JWT_REFRESH_SECRET` — ошибка → 401, в базу не ходим вообще;
2. `findById(payload.tokenId)`; `null` → 401;
3. `revokedAt !== null` → **reuse detection**: `logger.warn`, `revokeAllForUser`, 401;
4. `expiresAt <= now` → `revoke` + 401 (дублирует JWT `exp` намеренно: база — источник истины);
5. `timingSafeEqual` хеша с `tokenHash` → иначе `revokeAllForUser` + 401;
6. `GetAuthUserQuery` — свежие данные из базы, за 30 дней `name`/`baseCurrency` могли поменяться;
7. `rotate(stored.id, next)`; `false` (параллельная ротация) → `revokeAllForUser` + 401.

**`logout`** — идемпотентен: нет куки, истёкший или уже погашенный токен — не ошибка,
cookie контроллер очистит в любом случае. 401 здесь означал бы «не могу вас выпустить».

### 5. `AuthController`

Опции cookie — одна функция на set и clear (браузер не удалит cookie, если `path`/`sameSite`/`secure` разойдутся):

```ts
{ httpOnly: true,
  secure: isProduction,                   // в dev https нет — иначе cookie не установится
  sameSite: isProduction ? 'none' : 'lax',
  path: REFRESH_TOKEN_COOKIE_PATH,        // полный путь, включая setGlobalPrefix('api/v1')
  maxAge: refreshTokenMaxAgeMs }
```

`path` сужен до `/api/v1/auth` — refresh-кука не уходит с каждым запросом к `/expenses`.

Все четыре эндпоинта — `@Public()`. Для `refresh` это не послабление, а условие
работоспособности: его дёргают ровно тогда, когда access протух, и глобальный `JwtAuthGuard`
ответил бы 401 — обновить сессию стало бы нечем. Аутентификация здесь — сам refresh-токен из cookie.
Для `logout` — та же причина плюс идемпотентность.

Точечный троттлинг поверх глобальных 100/мин: `@Throttle({ default: { limit: 5, ttl: 60_000 } })`
на `register`, `10` на `login`, `30` на `refresh`. Имя `default` соответствует безымянному
лимитеру из `ThrottlerModule.forRoot([{ ttl, limit }])`.

Два декоратора по образцу `current-user.decorator.ts`, чтобы не тащить `@Req()` в четыре метода:
`@RefreshToken()` → `request.cookies?.[REFRESH_TOKEN_COOKIE]`, `@Session()` → `{ userAgent, ip }`.

---

## Тесты

Ограничения: jest-конфиг инлайн в `apps/api/package.json`, `rootDir: src`, `testRegex: .*\.spec\.ts$` —
спеки лежат рядом с кодом внутри `src`. **`turbo test` зависит от `^build`**: без собранных
`packages/shared/dist` и `packages/database/dist` спеки не запустятся.

**Как мокать.** `PrismaService` мокать не нужно вообще — благодаря репозиториям и шинам
`AuthService` его не видит. `CommandBus`/`QueryBus` — плоские `{ execute: jest.fn() }`;
разные ответы на разные типы сообщений через `mockImplementation` с `instanceof`.
`argon2` — фабричный мок (`jest.mock('argon2', () => ({ argon2id: 2, hash: jest.fn(), verify: jest.fn() }))`):
19 MiB × 2 итерации — это ~50 мс на вызов, а их два десятка; фабричный мок к тому же
не грузит нативный биндинг. Отдельным файлом — один настоящий round-trip `hash`/`verify`
с удешевлёнными параметрами, чтобы доказать, что объект опций argon2 вообще принимает.

**Ключевые кейсы** (~30 всего, перечислены самые ценные):

- `register`: в `CreateUserCommand` уходит хеш, а не пароль; ответ не содержит `refreshToken`;
  `expiresIn === 900` при `'15m'`; `tokenHash === sha256(result.refreshToken)`; `null` → `ConflictException`.
- `login`: при неизвестном email `argon2.verify` **всё равно вызван** и именно с dummy-хешем —
  без этого теста регрессия защиты по таймингу пройдёт незаметно; тексты ошибок
  для «нет email» и «неверный пароль» совпадают; `passwordHash` не просачивается в `response.user`.
- `refresh`: `revokedAt !== null` → 401 + `revokeAllForUser`; несовпадение `tokenHash` → то же;
  `rotate → false` → то же; `verifyAsync` вызван именно с `JWT_REFRESH_SECRET`.
- `logout`: невалидный токен и `undefined` не бросают.
- Контроллер: `clearCookie` вызывается с **теми же** `path`/`sameSite`/`secure`, что и `cookie`
  (регрессия «cookie не удаляется»); тело ответа не содержит ключа `refreshToken`.
- CQRS: поднять `AppModule` и убедиться, что каждая команда и запрос находят хендлер —
  это замена проверки типов, потерянной на границе шины.

---

## Про `packages/shared`

Правок не требуется: `/auth/refresh` возвращает тот же `authResponseSchema`, что login/register,
`/auth/logout` отвечает 204 без тела, а `SessionContext`/`AuthResult` — внутренние типы API.

`z.toJSONSchema()` ничего не сломает: новых DTO не добавляется, а `authResponseSchema`
состоит только из `string` / `number().int().positive()` / `z.enum` / `nullable` — ни `Date`,
ни `transform`, то есть ни одной из ловушек, описанных в CLAUDE.md.

Если всё же тронем `shared` — обязателен пересбор (`pnpm --filter @expense-tracker/shared build`),
иначе `apps/api` молча увидит старые типы: внутренние пакеты потребляются из `dist`.

---

## Порядок работ

1. `@nestjs/cqrs` в зависимости; `duration.ts` + спек; `.refine` в `env.schema.ts`;
   `expiresIn` числом в `auth.module.ts` → `pnpm --filter @expense-tracker/api typecheck` зелёный.
2. `users.repository.ts`, команды и запросы + хендлеры, `users.module.ts`, `UsersService` через `QueryBus`.
3. `refresh-tokens.repository.ts`, новые типы в `auth.types.ts`.
4. `auth.service.ts`: `issueTokens` → `register` → `login` → `logout` → `refresh` (самый сложный, последним).
5. `auth.cookies.ts`, два декоратора, `auth.controller.ts`, `auth.module.ts`.
6. Спеки.
7. `pnpm build && pnpm typecheck && pnpm lint && pnpm --filter @expense-tracker/api test`.

---

## Проверка

```bash
pnpm db:up && pnpm build
pnpm --filter @expense-tracker/api test
pnpm typecheck && pnpm lint
pnpm dev
```

Ручной сквозной прогон (флаг `-c` для cookie-jar обязателен):

```bash
# регистрация — 201, accessToken в теле, Set-Cookie с HttpOnly и Path=/api/v1/auth
curl -i -c jar.txt -X POST localhost:4000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Passw0rd","name":"Тест"}'

curl -s localhost:4000/api/v1/users/me -H "Authorization: Bearer <accessToken>"   # профиль
curl -i localhost:4000/api/v1/users/me                                            # 401

curl -i -b jar.txt -c jar.txt -X POST localhost:4000/api/v1/auth/refresh          # новый access
curl -i -b jar.txt -X POST localhost:4000/api/v1/auth/logout                      # 204
curl -i -b jar.txt -X POST localhost:4000/api/v1/auth/refresh                     # 401
```

Отдельно проверить reuse detection: сохранить куку до ротации, прогнать `refresh`,
затем повторить запрос **старой** кукой — ожидаем 401 и погашенные сессии.

Swagger на `http://localhost:4000/api/docs` должен собраться и показать четыре ручки в `auth`.

---

## Риски

- **`expiresIn: string` не компилируется** — доказано прогоном компилятора. Реализация
  «в лоб» по каркасу уронит `pnpm typecheck`.
- **CQRS теряет проверку типов на границе.** Забытый хендлер в `providers` — исключение
  в рантайме, а не ошибка сборки. Закрывается спеком на резолв всех сообщений.
- **Гонка refresh из двух вкладок.** Обе пошлют один токен; вторая получит 401 и погасит
  все сессии — пользователя выкинет на ровном месте. Нужен single-flight
  в `apps/web/src/lib/api-client.ts` (один общий `Promise` на обновление). Grace-period
  потребовал бы колонки `replacedById` → миграция, в эту итерацию не входит.
- **`refresh_tokens` никогда не чистится.** 30 дней TTL × ротация каждые 15 минут ≈ 2880 строк
  в месяц на активную сессию. Индекс есть, нужна периодическая чистка — отдельная задача.
- **Сужение `baseCurrency: string → SupportedCurrency`** — приведение типа. Значение вне enum
  (ручной SQL, миграция) сломает контракт молча.
- **Плейсхолдеры в `api.env.example` короче 32 символов**, а `env.schema.ts` требует `.min(32)`:
  копирование примера «как есть» уронит API на старте. Секреты генерировать `openssl rand -base64 48`.
- **`sameSite: 'none'` в проде** оправдан, только если web и api окажутся на разных сайтах (eTLD+1).
  На одном домене это бессмысленное ослабление CSRF-защиты — тогда `'lax'`.
- **`argon2` — нативный модуль**: в Docker-образе с другой архитектурой/libc prebuild может
  не подойти и потребуется `node-gyp`. Проявится на деплое.
