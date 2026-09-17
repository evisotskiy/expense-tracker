import { Query } from '@nestjs/cqrs';

import type { UserCredentials } from '../users.repository';

/** Единственный запрос, способный вернуть passwordHash — используется только AuthService.login. */
export class GetUserCredentialsQuery extends Query<UserCredentials | null> {
  constructor(readonly email: string) {
    super();
  }
}
