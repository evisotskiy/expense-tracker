import { Module } from '@nestjs/common';

import { CreateUserHandler } from './commands/create-user.handler';
import { GetAuthUserHandler } from './queries/get-auth-user.handler';
import { GetUserCredentialsHandler } from './queries/get-user-credentials.handler';
import { GetUserProfileHandler } from './queries/get-user-profile.handler';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

// CqrsModule не импортируется здесь: CqrsModule.forRoot() вызывается один раз
// в AppModule и глобален (global: true) — CommandBus/QueryBus уже доступны
// без повторного импорта, как и PrismaModule.
const CQRS_HANDLERS = [
  CreateUserHandler,
  GetUserCredentialsHandler,
  GetAuthUserHandler,
  GetUserProfileHandler,
];

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, ...CQRS_HANDLERS],
  exports: [UsersService],
})
export class UsersModule {}
