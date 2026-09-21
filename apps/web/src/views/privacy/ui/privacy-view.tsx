import Link from 'next/link';

export function PrivacyView() {
  return (
    <div className="min-h-dvh px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/register"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Назад
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Политика обработки персональных данных
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Действует с 21 сентября 2026 года.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-medium">1. Какие данные мы собираем</h2>
            <p>
              При регистрации мы получаем email и пароль (хранится только в виде хеша). При
              использовании Сервиса вы дополнительно вносите записи о расходах, категориях и
              бюджетах.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium">2. Цели обработки</h2>
            <p>
              Данные используются для авторизации, работы функций учёта расходов и восстановления
              доступа к учётной записи. Мы не используем их для рекламы и не продаём третьим лицам.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium">3. Хранение и защита</h2>
            <p>
              Пароли хранятся в виде хешей, доступ к базе данных ограничен. Сессия подтверждается
              access- и refresh-токенами; refresh-токен передаётся только в защищённой httpOnly
              cookie.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium">4. Передача третьим лицам</h2>
            <p>
              Мы не передаём персональные данные третьим лицам, кроме случаев, предусмотренных
              законом.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium">5. Ваши права</h2>
            <p>
              Вы можете запросить удаление учётной записи и связанных с ней данных в любой момент,
              обратившись в поддержку.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium">6. Связанный документ</h2>
            <p>
              Условия использования Сервиса описаны в{' '}
              <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
                пользовательском соглашении
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
