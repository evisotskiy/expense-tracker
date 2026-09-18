import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
  footer: {
    text: string;
    linkText: string;
    href: Route;
  };
}

/**
 * Центрированная карточка с safe-area-паддингами. На широких экранах — тот
 * же макет; двухколоночный промо-блок сознательно не делаем.
 */
export function AuthLayout({ title, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Card className="w-full max-w-sm sm:max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <p className="text-center text-sm text-muted-foreground">
            {footer.text}{' '}
            <Link
              href={footer.href}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {footer.linkText}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
