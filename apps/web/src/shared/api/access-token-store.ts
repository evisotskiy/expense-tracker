import 'client-only';

// Модульный синглтон, а не React-контекст: apiFetch/authorizedFetch вызываются
// вне React (в queryFn, в перехватчике 401), и токен не участвует в рендере —
// в контексте он давал бы перерисовку всего дерева на каждой ротации.
// import 'client-only' — иначе модуль, утянутый в серверный компонент,
// стал бы общим на всех пользователей.

// Упреждающий refresh в authorizedFetch срабатывает чуть раньше реального
// истечения — иначе можно успеть отправить запрос с токеном, который
// протухнет по дороге до сервера.
const EXPIRY_BUFFER_MS = 10_000;

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

let state: TokenState | null = null;
const expiredListeners = new Set<() => void>();

function get(): string | null {
  return state?.accessToken ?? null;
}

/** expiresIn приходит от API в секундах, не в миллисекундах. */
function set(accessToken: string, expiresIn: number): void {
  state = { accessToken, expiresAt: Date.now() + expiresIn * 1_000 };
}

function clear(): void {
  state = null;
}

function isExpiring(): boolean {
  if (!state) {
    return true;
  }
  return Date.now() >= state.expiresAt - EXPIRY_BUFFER_MS;
}

/** Возвращает функцию отписки — вызывающий сам решает, когда её вызвать. */
function onExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

/** Событие, а не прямой вызов router: shared не знает о слоях выше. */
function emitExpired(): void {
  for (const listener of expiredListeners) {
    listener();
  }
}

export const accessTokenStore = {
  get,
  set,
  clear,
  isExpiring,
  onExpired,
  emitExpired,
};
