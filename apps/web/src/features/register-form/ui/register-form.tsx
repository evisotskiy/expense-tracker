'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';

import { applyApiErrors } from '@/shared/lib/form/apply-api-errors';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { PasswordInput } from '@/shared/ui/password-input';

import {
  registerFormSchema,
  type RegisterFormData,
  type RegisterFormValues,
  type RegisterPayload,
} from '../model/schema';
import { PasswordStrengthMeter } from './password-strength-meter';

const FIELD_NAMES = ['email', 'password', 'confirmPassword'] as const;

interface RegisterFormProps {
  /** Форма не знает про навигацию и мутации — они живут в views. */
  onSubmit: (values: RegisterPayload) => Promise<void>;
}

export function RegisterForm({ onSubmit }: RegisterFormProps) {
  const form = useForm<RegisterFormValues, undefined, RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', agreedToTerms: false },
    mode: 'onTouched',
  });

  const password = useWatch({ control: form.control, name: 'password' });

  async function handleSubmit(values: RegisterFormData) {
    try {
      // Явный литерал, а не деструктуризация с confirmPassword: _ — так
      // видно на первый взгляд, что реально уходит на сервер.
      await onSubmit({ email: values.email, password: values.password });
    } catch (error) {
      const message = applyApiErrors(error, form.setError, FIELD_NAMES);
      if (message) {
        form.setError('root', { message });
      }
    }
  }

  const { isSubmitting, errors } = form.formState;

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
        {errors.root?.message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-11"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" className="h-11" />
              </FormControl>
              <FormDescription>
                <PasswordStrengthMeter password={password ?? ''} />
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Повторите пароль</FormLabel>
              <FormControl>
                <PasswordInput
                  {...field}
                  autoComplete="new-password"
                  enterKeyHint="go"
                  className="h-11"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="agreedToTerms"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-row items-start gap-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                </FormControl>
                {/* Базовый Label — flex-строка под иконку+текст, тут нужен обычный
                    переносящийся текст, поэтому display переопределён на block. */}
                <FormLabel className="block text-sm leading-snug font-normal">
                  Согласен с{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    пользовательским соглашением
                  </Link>{' '}
                  и{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    политикой обработки данных
                  </Link>
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Регистрируем…
            </>
          ) : (
            'Зарегистрироваться'
          )}
        </Button>
      </form>
    </Form>
  );
}
