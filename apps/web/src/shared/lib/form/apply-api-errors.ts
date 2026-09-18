import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiRequestError } from '../../api/api-client';

/**
 * Раскладывает ApiRequestError.errors по полям формы через setError,
 * возвращает текст для общего алерта или null, если алерт не нужен.
 *
 * fieldNames — белый список: setError на несуществующее в форме поле молча
 * теряет сообщение, поэтому всё, что не входит в список (включая ключ '_',
 * которым сервер помечает ошибки уровня объекта), уходит в общий алерт.
 */
export function applyApiErrors<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  fieldNames: readonly string[],
): string | null {
  if (!(error instanceof ApiRequestError)) {
    return 'Не удалось выполнить запрос. Проверьте соединение и попробуйте снова.';
  }

  // Throttler отдаёт английский текст — подменяем своим.
  if (error.statusCode === 429) {
    return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  }

  if (error.errors) {
    let generalMessage: string | null = null;
    let focused = false;

    for (const [field, messages] of Object.entries(error.errors)) {
      const message = messages[0];
      if (!message) {
        continue;
      }

      if (field === '_' || !fieldNames.includes(field)) {
        generalMessage ??= message;
        continue;
      }

      // shouldFocus только на первом поле — иначе фокус прыгнет на последнее.
      setError(field as Path<TFieldValues>, { message }, { shouldFocus: !focused });
      focused = true;
    }

    return generalMessage;
  }

  // 409 (email уже зарегистрирован) приходит без errors — привязываем к email вручную.
  if (error.statusCode === 409 && fieldNames.includes('email')) {
    setError('email' as Path<TFieldValues>, { message: error.message }, { shouldFocus: true });
    return null;
  }

  // 401 на входе и всё прочее без errors — общий алерт, поле не подсвечиваем:
  // бэкенд намеренно не различает «нет email» и «неверный пароль».
  return error.message;
}
