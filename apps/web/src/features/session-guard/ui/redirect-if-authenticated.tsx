'use client';

import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, type ReactNode } from 'react';

import { useSession } from '@/entities/session';
import { safeNextPath } from '@/shared/lib/navigation/safe-next-path';

import { SessionSplash } from './session-splash';

function RedirectIfAuthenticatedInner({ children }: { children: ReactNode }) {
  const { data: user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isLoading = user === undefined;
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    if (isAuthenticated) {
      // typedRoutes не выводит Route для шаблонных строк с query — каст не убирать.
      const target = safeNextPath(searchParams.get('next')) ?? '/dashboard';
      router.replace(target as Route);
    }
  }, [isAuthenticated, router, searchParams]);

  if (isLoading || isAuthenticated) {
    return <SessionSplash />;
  }

  return children;
}

/**
 * useSearchParams() в Next 16 требует обёртки <Suspense> в статически
 * рендерящейся ветке — оборачиваем здесь, чтобы вызывающий код (страница
 * /login) не должен был помнить об этом сам.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<SessionSplash />}>
      <RedirectIfAuthenticatedInner>{children}</RedirectIfAuthenticatedInner>
    </Suspense>
  );
}
