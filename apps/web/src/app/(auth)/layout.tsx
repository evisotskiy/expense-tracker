import type { ReactNode } from 'react';

import { RedirectIfAuthenticated } from '@/features/session-guard';

export default function AuthGuardLayout({ children }: { children: ReactNode }) {
  return <RedirectIfAuthenticated>{children}</RedirectIfAuthenticated>;
}
