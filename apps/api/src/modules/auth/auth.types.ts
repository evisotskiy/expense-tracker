/** Полезная нагрузка access-токена. */
export interface JwtPayload {
  /** id пользователя (стандартное поле JWT). */
  sub: string;
  email: string;
}

/** Полезная нагрузка refresh-токена: добавляет идентификатор записи в refresh_tokens. */
export interface RefreshTokenPayload extends JwtPayload {
  tokenId: string;
}

export const REFRESH_TOKEN_COOKIE = 'refresh_token';
