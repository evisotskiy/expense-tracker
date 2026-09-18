'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { applyApiErrors } from '@/shared/lib/form/apply-api-errors';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { PasswordInput } from '@/shared/ui/password-input';

import { loginSchema, type LoginFormData, type LoginFormValues } from '../model/schema';

const FIELD_NAMES = ['email', 'password'] as const;

interface LoginFormProps {
  /** Форма не знает про навигацию и мутации — они живут в views. */
  onSubmit: (values: LoginFormData) => Promise<void>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const form = useForm<LoginFormValues, undefined, LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  async function handleSubmit(values: LoginFormData) {
    try {
      await onSubmit(values);
    } catch (error) {
      // 401 на входе намеренно не привязываем к полю — бэкенд не различает
      // «нет email» и «неверный пароль», подсветка выдала бы больше информации.
      const message = applyApiErrors(error, form.setError, FIELD_NAMES);
      if (message) {
        form.setError('root', { message });
      }
    }
  }

  const { isSubmitting, errors } = form.formState;

  return (
    <Form {...form}>
      {/* noValidate обязателен — иначе браузер покажет свой англоязычный
          пузырь поверх наших сообщений */}
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
                <PasswordInput
                  {...field}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  className="h-11"
                />
              </FormControl>
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
              Входим…
            </>
          ) : (
            'Войти'
          )}
        </Button>
      </form>
    </Form>
  );
}
