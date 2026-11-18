---
name: check-layout
description: Проверить вёрстку на desktop и mobile через Playwright MCP. Использовать после любых изменений во frontend (apps/web — компоненты, страницы, стили, Tailwind-токены), прежде чем сообщать, что задача готова. Также вызывается явно через /check-layout [маршрут].
argument-hint: <маршрут, например /dashboard>
allowed-tools: Bash(pnpm --filter @expense-tracker/web dev:*), Bash(curl:*), Bash(lsof:*), Read, mcp__playwright__browser_navigate, mcp__playwright__browser_resize, mcp__playwright__browser_snapshot, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_console_messages, mcp__playwright__browser_evaluate, mcp__playwright__browser_click, mcp__playwright__browser_fill_form, mcp__playwright__browser_wait_for, mcp__playwright__browser_emulate_media, mcp__playwright__browser_close
---

# Проверка вёрстки (desktop + mobile)

Типы и тесты не ловят визуальные поломки: съехавшую сетку, горизонтальный скролл, перекрытия,
нечитаемую тёмную тему. Поэтому после правок `apps/web` вёрстку смотрят глазами — через
Playwright MCP, в двух вьюпортах.

Skill ничего не стейджит и не коммитит, исходники правит только если пользователь просил
исправить найденное.

## Когда запускать

- Менялись файлы в `apps/web` (компоненты, страницы, стили, `globals.css`) — после правок,
  до отчёта «готово».
- Не запускать, если правки не влияют на отображение (тесты, типы без UI, конфиги).

## Аргументы

`$ARGUMENTS` — необязательный маршрут (`/dashboard`). Без аргумента — определить затронутые
страницы по `git diff --name-only` (слайсы `pages/*`, `widgets/*`, `features/*` → соответствующие
маршруты); если неясно — проверить `/login`, `/register`, `/dashboard`.

## Порядок

1. **Dev-сервер.** `curl -sI http://localhost:3000` — если не отвечает, запустить
   `pnpm --filter @expense-tracker/web dev` в фоне и дождаться ответа. Для защищённых страниц
   нужен ещё API на `:4000` и Postgres (`pnpm db:up`); если их нет — сказать об этом, а не
   молча проверять только экран логина.
2. **Авторизация.** `/dashboard` под guard'ом: перенаправит на `/login`. Войти тестовым
   пользователем (зарегистрировать через `/register`, если нужного нет). Не использовать
   реальные данные.
3. **Desktop — 1440×900.** `browser_resize` → `browser_navigate` на маршрут →
   `browser_snapshot` (структура, доступные имена) → `browser_take_screenshot`.
4. **Mobile — 375×812.** То же самое. Дополнительно через `browser_evaluate` проверить
   горизонтальный скролл:
   `document.documentElement.scrollWidth > document.documentElement.clientWidth`.
5. **Состояния.** Для затронутого UI пройти значимые: открытые диалоги/меню, пустое состояние,
   ошибка валидации формы, длинные значения. Тёмная тема — `browser_emulate_media`
   (`colorScheme: 'dark'`), токены темы переопределяются в `@media (prefers-color-scheme: dark)`.
6. **Консоль.** `browser_console_messages` — ошибки и предупреждения (hydration mismatch, 404
   ресурсов) считаются находками.
7. `browser_close`.

## Что искать

- Горизонтальный скролл страницы на mobile.
- Обрезанный/налезающий текст, элементы за границей экрана, перекрытия.
- Тач-цели меньше ~44px на mobile; фильтры и переключатель месяца, не помещающиеся в строку.
- Диалоги и выпадающие меню, выходящие за вьюпорт.
- Нечитаемый контраст в тёмной теме, отсутствующие токены.
- Суммы/даты, ломающие сетку при длинных значениях.

## Отчёт

Кратко, на русском: какие маршруты и вьюпорты проверены, что найдено (с указанием экрана и
вьюпорта), что не удалось проверить и почему. Если проблем нет — так и написать. Найденные, но
не исправленные проблемы — в `.claude/TODO.md`. Скриншоты не коммитить.
