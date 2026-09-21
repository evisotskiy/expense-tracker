import Link from 'next/link';

export function TermsView() {
  return (
    <div className="min-h-dvh px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/register"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Назад
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Пользовательское соглашение</h1>
        <p className="mt-1 text-sm text-muted-foreground">Действует с 21 сентября 2026 года.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-medium">1. Предмет соглашения</h2>
            <p>
              Настоящее соглашение регулирует условия использования сервиса «Трекер расходов» (далее
              — Сервис): регистрацию учётной записи, ведение личного учёта расходов, категорий и
              бюджетов.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium">2. Регистрация и учётная запись</h2>
            <p>
              Для использования Сервиса необходимо создать учётную запись, указав email и пароль. Вы
              обязаны хранить пароль в тайне и несёте ответственность за все действия, совершённые
              под вашей учётной записью.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium">3. Данные, которые вы вносите</h2>
            <p>
              Записи о расходах, категориях и бюджетах, которые вы создаёте в Сервисе, — ваши личные
              данные. Сервис не проверяет их достоверность и не несёт ответственности за решения,
              принятые на их основе.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium">4. Ограничение ответственности</h2>
            <p>
              Сервис предоставляется «как есть». Мы стремимся к бесперебойной работе, но не
              гарантируем отсутствие сбоев и не несём ответственности за косвенные убытки, возникшие
              из-за недоступности Сервиса.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium">5. Изменение условий</h2>
            <p>
              Мы можем обновлять это соглашение. О существенных изменениях сообщим по email,
              указанному при регистрации.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium">6. Обработка персональных данных</h2>
            <p>
              Условия обработки персональных данных описаны отдельно —{' '}
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                в политике обработки данных
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
