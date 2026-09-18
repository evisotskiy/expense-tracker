import 'client-only';

import { refreshSession } from '@/shared/api/refresh-session';

import type { SessionUser } from '../model/types';

/**
 * Один POST /auth/refresh на старте через refreshSession() (single-flight) —
 * гонка «bootstrap ↔ первый защищённый запрос» схлопывается автоматически.
 * GET /users/me в контуре не используется: refresh и login уже возвращают
 * пользователя в теле ответа.
 */
export async function bootstrapSession(): Promise<SessionUser | null> {
  const result = await refreshSession();
  return result?.user ?? null;
}
