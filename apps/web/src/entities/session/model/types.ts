import type { AuthUser } from '@expense-tracker/shared';

/** Отдельный тип сущности сессии — сущность session не обязана совпадать с формой shared. */
export type SessionUser = AuthUser;
