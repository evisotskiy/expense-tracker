import { Loader2 } from 'lucide-react';

/** Заглушка на время, пока не известно, авторизован ли пользователь. */
export function SessionSplash() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}
