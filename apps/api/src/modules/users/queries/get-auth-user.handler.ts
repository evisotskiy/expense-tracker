import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { UsersRepository } from '../users.repository';
import { GetAuthUserQuery } from './get-auth-user.query';

@QueryHandler(GetAuthUserQuery)
export class GetAuthUserHandler implements IQueryHandler<GetAuthUserQuery> {
  // @Inject: UsersRepository используется здесь только как тип параметра —
  // подробности в common/guards/jwt-auth.guard.ts.
  constructor(@Inject(UsersRepository) private readonly users: UsersRepository) {}

  execute({ userId }: GetAuthUserQuery) {
    return this.users.findAuthById(userId);
  }
}
