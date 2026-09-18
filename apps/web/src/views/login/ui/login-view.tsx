'use client';

import { LoginForm, useLogin } from '@/features/login-form';
import { AuthLayout } from '@/widgets/auth-layout';

export function LoginView() {
  const loginMutation = useLogin();

  return (
    <AuthLayout
      title="Вход"
      footer={{ text: 'Ещё нет аккаунта?', linkText: 'Зарегистрироваться', href: '/register' }}
    >
      <LoginForm
        onSubmit={async (values) => {
          await loginMutation.mutateAsync(values);
        }}
      />
    </AuthLayout>
  );
}
