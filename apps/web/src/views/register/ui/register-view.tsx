'use client';

import { RegisterForm, useRegister } from '@/features/register-form';
import { AuthLayout } from '@/widgets/auth-layout';

export function RegisterView() {
  const registerMutation = useRegister();

  return (
    <AuthLayout
      title="Регистрация"
      footer={{ text: 'Уже есть аккаунт?', linkText: 'Войти', href: '/login' }}
    >
      <RegisterForm
        onSubmit={async (values) => {
          await registerMutation.mutateAsync(values);
        }}
      />
    </AuthLayout>
  );
}
