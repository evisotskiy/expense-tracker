'use client';

import { useSession } from '@/entities/session';
import { AppHeader } from '@/widgets/app-header';

export function DashboardView() {
  const { data: user } = useSession();

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Панель</h1>
        <p className="mt-2 text-muted-foreground">Вы вошли как {user?.email}</p>
      </main>
    </div>
  );
}
