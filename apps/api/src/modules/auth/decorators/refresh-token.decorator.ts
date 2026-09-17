import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { REFRESH_TOKEN_COOKIE } from '../auth.types';

/**
 * Достаёт refresh-токен из httpOnly cookie.
 *
 * cookieParser() без secret кладёт значения в request.cookies (не signedCookies) —
 * см. main.ts, где cookie-parser подключён без аргумента secret.
 */
export const RefreshToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<Request>();

    return request.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
  },
);
