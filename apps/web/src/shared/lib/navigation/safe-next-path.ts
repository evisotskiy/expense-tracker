// Куда не пускаем после входа, даже если next указывает туда: кольцо редиректов.
const BLOCKED_PATHS = new Set(['/login', '/register']);

/**
 * Проверяет query-параметр next перед использованием как редиректа.
 *
 * '//evil.com' — протокол-относительный URL, браузер уходит на внешний хост;
 * '/\\evil.com' — тот же трюк через обратный слеш, который некоторые браузеры
 * нормализуют в '//'. Оба отбрасываются наряду со всем, что не начинается
 * с одного '/'.
 */
export function safeNextPath(next: string | null): string | null {
  if (!next) {
    return null;
  }

  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return null;
  }

  const pathname = next.split(/[?#]/)[0];
  if (pathname && BLOCKED_PATHS.has(pathname)) {
    return null;
  }

  return next;
}
