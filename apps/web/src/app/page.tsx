const NEXT_STEPS = [
  'Зафиксировать представление денежных сумм в schema.prisma',
  'Создать первую миграцию: pnpm db:migrate',
  'Реализовать регистрацию и вход в AuthService',
  'Добавить экран списка расходов и форму создания',
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Трекер расходов</h1>
        <p className="text-muted-foreground">
          Заготовка монорепозитория готова. Фронтенд на Next.js, API на Nest.js, база — Postgres
          через Prisma.
        </p>
      </header>

      <section className="rounded-[var(--radius)] border border-border p-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Что дальше
        </h2>
        <ol className="list-inside list-decimal space-y-1.5 text-sm">
          {NEXT_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <footer className="text-sm text-muted-foreground">
        API:{' '}
        <code className="rounded bg-muted px-1.5 py-0.5">
          {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}
        </code>
      </footer>
    </main>
  );
}
