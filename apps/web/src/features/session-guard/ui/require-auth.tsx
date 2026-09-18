'use client';

import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useSession } from '@/entities/session';

import { SessionSplash } from './session-splash';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isLoading = user === undefined;
  const isAnonymous = user === null;

  useEffect(() => {
    if (isAnonymous) {
      // typedRoutes не выводит Route для шаблонных строк с query — каст не убирать.
      router.replace(`/login?next=${encodeURIComponent(pathname)}` as Route);
    }
  }, [isAnonymous, pathname, router]);

  // Дети не монтируются при loading/anonymous — иначе их queryFn стартуют
  // без токена и устроят лавину 401 ещё до редиректа.
  if (isLoading || isAnonymous) {
    return <SessionSplash />;
  }

  return children;
}
