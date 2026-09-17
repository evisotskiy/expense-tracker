import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { UsersRepository } from '../users.repository';
import { CreateUserCommand } from './create-user.command';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  // @Inject: UsersRepository используется здесь только как тип параметра —
  // подробности в common/guards/jwt-auth.guard.ts.
  constructor(@Inject(UsersRepository) private readonly users: UsersRepository) {}

  execute(command: CreateUserCommand) {
    return this.users.create({
      email: command.email,
      passwordHash: command.passwordHash,
      name: command.name,
      baseCurrency: command.baseCurrency,
    });
  }
}
