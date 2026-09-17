import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '@expense-tracker/shared';

/** Компактный пользователь для тела AuthResponse — используется при ротации refresh-токена. */
export class GetAuthUserQuery extends Query<AuthUser | null> {
  constructor(readonly userId: string) {
    super();
  }
}
