'use client';

import { useSession } from '@/entities/session';
import { LogoutButton, useLogout } from '@/features/logout-button';

export function AppHeader() {
  const { data: user } = useSession();
  const logoutMutation = useLogout();

  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <span className="text-sm text-muted-foreground">{user?.email}</span>
      <LogoutButton onLogout={() => logoutMutation.mutateAsync()} />
    </header>
  );
}
