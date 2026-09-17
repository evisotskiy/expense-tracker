import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { Env } from '../../../config/env.schema';
import type { JwtPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  // @Inject: ConfigService используется здесь только как тип параметра —
  // подробности в common/guards/jwt-auth.guard.ts.
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super({
      // access-токен фронтенд хранит в памяти и шлёт в заголовке;
      // в cookie лежит только refresh — так XSS не даёт долгоживущего доступа
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /** Возвращённое значение Passport кладёт в request.user. */
  validate(payload: JwtPayload): JwtPayload {
    return { sub: payload.sub, email: payload.email };
  }
}
