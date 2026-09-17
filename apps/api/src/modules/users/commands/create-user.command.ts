import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '@expense-tracker/shared';

/**
 * Наследование от Command<TResult> даёt типизацию результата на стороне
 * commandBus.execute() без явных дженериков — TS выводит AuthUser | null сам.
 *
 * Результат null означает «email уже занят» (см. UsersRepository.create) —
 * решение о том, что с этим делать (409 Conflict), принимает AuthService.
 */
export class CreateUserCommand extends Command<AuthUser | null> {
  constructor(
    readonly email: string,
    readonly passwordHash: string,
    readonly name?: string,
    readonly baseCurrency?: string,
  ) {
    super();
  }
}
