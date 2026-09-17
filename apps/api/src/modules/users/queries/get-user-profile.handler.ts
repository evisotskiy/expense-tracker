import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { UsersRepository } from '../users.repository';
import { GetUserProfileQuery } from './get-user-profile.query';

@QueryHandler(GetUserProfileQuery)
export class GetUserProfileHandler implements IQueryHandler<GetUserProfileQuery> {
  // @Inject: UsersRepository используется здесь только как тип параметра —
  // подробности в common/guards/jwt-auth.guard.ts.
  constructor(@Inject(UsersRepository) private readonly users: UsersRepository) {}

  execute({ userId }: GetUserProfileQuery) {
    return this.users.findProfileById(userId);
  }
}
