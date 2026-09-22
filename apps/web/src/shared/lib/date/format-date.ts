/**
 * «15 сент.» для строки ленты. timeZone: 'UTC' обязателен: дата хранится
 * UTC-полночью, и в локальном форматировании у пользователя в UTC−5 она
 * показалась бы предыдущим днём.
 */
export function formatTransactionDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}
