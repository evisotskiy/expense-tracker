import type { ReactNode } from 'react';

import { RequireAuth } from '@/features/session-guard';

export default function ProtectedGuardLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
