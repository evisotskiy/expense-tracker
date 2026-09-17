import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { UsersRepository } from '../users.repository';
import { GetUserCredentialsQuery } from './get-user-credentials.query';

@QueryHandler(GetUserCredentialsQuery)
export class GetUserCredentialsHandler implements IQueryHandler<GetUserCredentialsQuery> {
  // @Inject: UsersRepository используется здесь только как тип параметра —
  // подробности в common/guards/jwt-auth.guard.ts.
  constructor(@Inject(UsersRepository) private readonly users: UsersRepository) {}

  execute({ email }: GetUserCredentialsQuery) {
    return this.users.findCredentialsByEmail(email);
  }
}
