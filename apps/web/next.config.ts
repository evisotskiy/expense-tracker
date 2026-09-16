import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Общие пакеты монорепо собираются в CommonJS и подключаются как обычные зависимости,
  // но transpilePackages нужен, чтобы Next применял к ним свои трансформации
  // (tree-shaking, разделение server/client) наравне с кодом приложения.
  transpilePackages: ['@expense-tracker/shared'],

  // типобезопасные ссылки: <Link href="/expenses"> проверяется компилятором
  typedRoutes: true,
};

export default nextConfig;
