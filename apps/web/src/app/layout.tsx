import type { Metadata, Viewport } from 'next';

import { AppProviders } from '@/app/_providers/app-providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Трекер расходов',
  description: 'Учёт личных расходов, категорий и бюджетов',
};

// viewportFit: 'cover' обязателен, иначе env(safe-area-inset-*) везде равны нулю
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
