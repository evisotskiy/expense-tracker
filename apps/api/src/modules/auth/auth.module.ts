import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { parseDurationToSeconds } from '../../common/utils/duration';
import type { Env } from '../../config/env.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    // Здесь регистрируется только access-токен. Refresh подписывается вручную
    // в AuthService другим секретом — иначе украденный access можно было бы
    // предъявить как refresh, и наоборот.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          // Числом, а не строкой: @types/jsonwebtoken принимает для expiresIn
          // number | ms.StringValue — обычный string (то, что отдаёт config.get)
          // в этот тип не проходит. Секунды одновременно идут в AuthResponse.expiresIn,
          // так что расхождения между заявленным и реальным TTL токена не будет.
          expiresIn: parseDurationToSeconds(config.get('JWT_ACCESS_TTL', { infer: true })),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokensRepository],
  exports: [AuthService],
})
export class AuthModule {}
