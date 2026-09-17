import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse } from '@expense-tracker/shared';
import type { Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import type { Env } from '../../config/env.schema';
import { refreshCookieOptions } from './auth.cookies';
import { AuthService } from './auth.service';
import { type AuthResult, REFRESH_TOKEN_COOKIE, type SessionContext } from './auth.types';
import { RefreshToken } from './decorators/refresh-token.decorator';
import { SessionInfo } from './decorators/session-context.decorator';
import { type LoginDto, type RegisterDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  // @Inject: AuthService/ConfigService используются здесь только как типы параметров,
  // а это стирает класс из design:paramtypes при emitDecoratorMetadata — подробности
  // в common/guards/jwt-auth.guard.ts.
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  // Глобальный лимит (100/мин) слишком щедрый для подбора email/пароля — здесь уже.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Регистрация нового пользователя' })
  async register(
    @Body() dto: RegisterDto,
    @SessionInfo() session: SessionContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.register(dto, session);
    return this.respondWithTokens(res, result);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход по email и паролю' })
  async login(
    @Body() dto: LoginDto,
    @SessionInfo() session: SessionContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(dto, session);
    return this.respondWithTokens(res, result);
  }

  /**
   * @Public() здесь обязателен, а не послабление: refresh вызывают ровно тогда,
   * когда access-токен уже истёк, и глобальный JwtAuthGuard ответил бы на такой
   * запрос 401 — обновить сессию стало бы нечем. Аутентификацией служит сам
   * refresh-токен из httpOnly cookie.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновить пару токенов по refresh-cookie' })
  async refresh(
    @RefreshToken() token: string | undefined,
    @SessionInfo() session: SessionContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    if (!token) {
      throw new UnauthorizedException('Refresh-токен не передан');
    }

    const result = await this.authService.refresh(token, session);
    return this.respondWithTokens(res, result);
  }

  /** @Public() по той же причине, что и refresh, плюс идемпотентность: выйти можно и с протухшим access. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Выйти и отозвать refresh-токен' })
  async logout(
    @RefreshToken() token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(token);
    res.clearCookie(
      REFRESH_TOKEN_COOKIE,
      refreshCookieOptions(this.config.get('NODE_ENV', { infer: true })),
    );
  }

  /** Ставит refresh-cookie и возвращает наружу только тело ответа — сам токен в JSON не попадает. */
  private respondWithTokens(res: Response, result: AuthResult): AuthResponse {
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      refreshCookieOptions(
        this.config.get('NODE_ENV', { infer: true }),
        result.refreshTokenMaxAgeMs,
      ),
    );

    return result.response;
  }
}
