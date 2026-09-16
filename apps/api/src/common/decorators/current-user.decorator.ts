import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { JwtPayload } from '../../modules/auth/auth.types';

/**
 * Достаёт пользователя, положенного в request JwtStrategy.
 *
 * Использование: `@CurrentUser() user: JwtPayload` или `@CurrentUser('sub') userId: string`.
 */
export const CurrentUser = createParamDecorator(
  (key: keyof JwtPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return key ? user[key] : user;
  },
);
