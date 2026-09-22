'use client';

import { useSession } from '@/entities/session';
import { UserMenu, useLogout } from '@/features/user-menu';

export function AppHeader() {
  const { data: user } = useSession();
  const logoutMutation = useLogout();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <span className="font-semibold tracking-tight">Трекер расходов</span>
      {user && <UserMenu email={user.email} onLogout={() => logoutMutation.mutateAsync()} />}
    </header>
  );
}
