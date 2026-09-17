import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { SessionContext } from '../auth.types';

/**
 * Откуда пришёл вход — записывается в refresh_tokens как контекст сессии.
 *
 * Названо SessionInfo, а не Session: @nestjs/common уже экспортирует декоратор
 * Session() для express-session, и совпадение имён с ним и с типом SessionContext
 * было бы путающим при импорте в одном файле.
 */
export const SessionInfo = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionContext => {
    const request = context.switchToHttp().getRequest<Request>();

    return {
      userAgent: request.get('user-agent') ?? null,
      ip: request.ip ?? null,
    };
  },
);
