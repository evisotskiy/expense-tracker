import { registerSchema } from '@expense-tracker/shared';
import { z } from 'zod';

// name и baseCurrency не спрашиваем: оба optional, валюту сервер подставит,
// имя — задача профиля, а не регистрации.
export const registerFormSchema = registerSchema
  .pick({ email: true, password: true })
  .extend({
    confirmPassword: z.string().min(1, 'Повторите пароль'),
    // Согласие — чисто форменное поле, на сервер не уходит (см. RegisterPayload).
    agreedToTerms: z
      .boolean()
      .refine((value) => value === true, { message: 'Нужно принять условия, чтобы продолжить' }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Пароли не совпадают',
    // Без path ошибка сядет на форму целиком, а не на поле подтверждения.
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.input<typeof registerFormSchema>;
export type RegisterFormData = z.output<typeof registerFormSchema>;

/** То, что реально уходит на сервер — без confirmPassword. */
export type RegisterPayload = Pick<RegisterFormData, 'email' | 'password'>;
