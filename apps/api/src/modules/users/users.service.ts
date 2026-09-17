import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { GetUserProfileQuery } from './queries/get-user-profile.query';

@Injectable()
export class UsersService {
  // @Inject: QueryBus используется здесь только как тип параметра —
  // подробности в common/guards/jwt-auth.guard.ts.
  constructor(@Inject(QueryBus) private readonly queryBus: QueryBus) {}

  async findById(id: string) {
    const user = await this.queryBus.execute(new GetUserProfileQuery(id));

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return user;
  }
}
