import { z } from 'zod';

import { currencySchema, idSchema } from './common';

export const passwordSchema = z
  .string()
  .min(8, 'Пароль должен быть не короче 8 символов')
  .max(72, 'Пароль не должен превышать 72 символа') // ограничение argon2/bcrypt по длине входа
  .regex(/[a-z]/, 'Добавьте строчную букву')
  .regex(/[A-Z]/, 'Добавьте заглавную букву')
  .regex(/\d/, 'Добавьте цифру');

export const emailSchema = z.email('Некорректный email').max(254).toLowerCase().trim();

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
  baseCurrency: currencySchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  // на входе пароль не валидируем по сложности: правила могли поменяться после регистрации
  password: z.string().min(1, 'Введите пароль'),
});

export const authUserSchema = z.object({
  id: idSchema,
  email: z.email(),
  name: z.string().nullable(),
  baseCurrency: currencySchema,
});

/** Refresh-токен ходит в httpOnly cookie, поэтому в теле ответа только access. */
export const authResponseSchema = z.object({
  user: authUserSchema,
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
