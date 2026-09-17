import { UnauthorizedException } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { AuthController } from './auth.controller';
import { type AuthService } from './auth.service';
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_PATH } from './auth.types';

// Без jest.Mocked<Pick<Response, ...>>: у express.Response.cookie несколько
// перегрузок, и TS сужает тип аргументов mock.calls до одной из них, а не до
// формы реального вызова (name, value, options) — строгая типизация здесь мешает.
function fakeResponse(): { cookie: jest.Mock; clearCookie: jest.Mock } {
  return { cookie: jest.fn(), clearCookie: jest.fn() };
}

const session = { userAgent: 'jest', ip: '127.0.0.1' };

describe('AuthController', () => {
  let authService: { register: jest.Mock; login: jest.Mock; refresh: jest.Mock; logout: jest.Mock };
  let config: { get: jest.Mock };
  let controller: AuthController;
  let nodeEnv: string;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };
    nodeEnv = 'development';
    config = { get: jest.fn(() => nodeEnv) };

    controller = new AuthController(
      authService as unknown as AuthService,
      config as unknown as ConfigService<never, true>,
    );
  });

  it('login ставит refresh-cookie с httpOnly, правильным path и maxAge', async () => {
    authService.login.mockResolvedValue({
      response: { user: { id: 'u1', email: 'a@b.c', name: null, baseCurrency: 'RUB' }, accessToken: 'at', expiresIn: 900 },
      refreshToken: 'rt-raw',
      refreshTokenMaxAgeMs: 2_592_000_000,
    });
    const res = fakeResponse();

    const body = await controller.login({ email: 'a@b.c', password: 'x' }, session, res as unknown as Response);

    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'rt-raw',
      expect.objectContaining({ httpOnly: true, path: REFRESH_TOKEN_COOKIE_PATH, maxAge: 2_592_000_000 }),
    );
    expect(body).not.toHaveProperty('refreshToken');
  });

  it('register не публикует refreshToken в теле ответа', async () => {
    authService.register.mockResolvedValue({
      response: { user: { id: 'u1', email: 'a@b.c', name: null, baseCurrency: 'RUB' }, accessToken: 'at', expiresIn: 900 },
      refreshToken: 'rt-raw',
      refreshTokenMaxAgeMs: 2_592_000_000,
    });
    const res = fakeResponse();

    const body = await controller.register({ email: 'a@b.c', password: 'x' }, session, res as unknown as Response);

    expect(Object.keys(body)).toEqual(['user', 'accessToken', 'expiresIn']);
  });

  it('в production cookie ставится с secure:true и sameSite:"none"', async () => {
    nodeEnv = 'production';
    authService.login.mockResolvedValue({
      response: { user: { id: 'u1', email: 'a@b.c', name: null, baseCurrency: 'RUB' }, accessToken: 'at', expiresIn: 900 },
      refreshToken: 'rt-raw',
      refreshTokenMaxAgeMs: 1_000,
    });
    const res = fakeResponse();

    await controller.login({ email: 'a@b.c', password: 'x' }, session, res as unknown as Response);

    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'rt-raw',
      expect.objectContaining({ secure: true, sameSite: 'none' }),
    );
  });

  it('в development cookie ставится с secure:false и sameSite:"lax"', async () => {
    authService.login.mockResolvedValue({
      response: { user: { id: 'u1', email: 'a@b.c', name: null, baseCurrency: 'RUB' }, accessToken: 'at', expiresIn: 900 },
      refreshToken: 'rt-raw',
      refreshTokenMaxAgeMs: 1_000,
    });
    const res = fakeResponse();

    await controller.login({ email: 'a@b.c', password: 'x' }, session, res as unknown as Response);

    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'rt-raw',
      expect.objectContaining({ secure: false, sameSite: 'lax' }),
    );
  });

  it('logout очищает cookie с теми же path/sameSite/secure, что и set — иначе браузер её не удалит', async () => {
    authService.login.mockResolvedValue({
      response: { user: { id: 'u1', email: 'a@b.c', name: null, baseCurrency: 'RUB' }, accessToken: 'at', expiresIn: 900 },
      refreshToken: 'rt-raw',
      refreshTokenMaxAgeMs: 1_000,
    });
    const loginRes = fakeResponse();
    await controller.login({ email: 'a@b.c', password: 'x' }, session, loginRes as unknown as Response);
    const [, , setOptions] = loginRes.cookie.mock.calls[0] as [string, string, Record<string, unknown>];

    authService.logout.mockResolvedValue(undefined);
    const logoutRes = fakeResponse();
    await controller.logout('rt-raw', logoutRes as unknown as Response);

    const [, clearOptions] = logoutRes.clearCookie.mock.calls[0] as [string, Record<string, unknown>];
    expect(clearOptions.path).toBe(setOptions.path);
    expect(clearOptions.sameSite).toBe(setOptions.sameSite);
    expect(clearOptions.secure).toBe(setOptions.secure);
  });

  it('refresh без cookie бросает UnauthorizedException и не вызывает сервис', async () => {
    const res = fakeResponse();

    await expect(
      controller.refresh(undefined, session, res as unknown as Response),
    ).rejects.toThrow(UnauthorizedException);

    expect(authService.refresh).not.toHaveBeenCalled();
  });
});
