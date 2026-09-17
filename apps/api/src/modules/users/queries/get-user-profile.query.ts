import { Query } from '@nestjs/cqrs';

import type { UserProfile } from '../users.repository';

/** Профиль для GET users/me. */
export class GetUserProfileQuery extends Query<UserProfile | null> {
  constructor(readonly userId: string) {
    super();
  }
}
