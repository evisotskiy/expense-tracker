export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  score: PasswordStrengthScore;
  label: string;
  hint: string | null;
}

// Без zxcvbn — это ~800 КБ словарей в бандл ради подсказки.
// Кортеж (не string[]) — иначе noUncheckedIndexedAccess даёт string | undefined.
const LEVELS = ['Очень слабый', 'Слабый', 'Средний', 'Хороший', 'Надёжный'] as const;

const BLACKLIST = new Set(['password', 'qwerty', '12345678', 'пароль', 'admin']);

function isRepeatedChar(value: string): boolean {
  return value.split('').every((char) => char === value[0]);
}

/** Чистая функция — без сети и без побочных эффектов, чтобы её можно было анонсировать в aria-live. */
export function getPasswordStrength(password: string): PasswordStrength | null {
  if (password.length === 0) {
    return null;
  }

  const hasMinLength = password.length >= 8;
  const hasLongLength = password.length >= 12;
  const hasUpper = /[A-ZА-ЯЁ]/.test(password);
  const hasLower = /[a-zа-яё]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^\dA-Za-zА-Яа-яЁё]/.test(password);
  const hasBothCases = hasUpper && hasLower;

  let points = 0;
  if (hasMinLength) points += 1;
  if (hasLongLength) points += 1;
  if (hasBothCases) points += 1;
  if (hasDigit) points += 1;
  if (hasSpecial) points += 1;

  let score = Math.min(points, 4) as PasswordStrengthScore;

  // Базовое требование passwordSchema (длина ≥ 8) не выполнено — врать зелёным нельзя.
  if (!hasMinLength) {
    score = 0;
  }

  // Повтор одного символа или короткий чёрный список — предсказуемые пароли,
  // даже если формально набирают очки за длину/регистр/цифры.
  if (isRepeatedChar(password) || BLACKLIST.has(password.toLowerCase())) {
    score = Math.min(score, 1) as PasswordStrengthScore;
  }

  let hint: string | null;
  if (!hasMinLength) {
    hint = 'Используйте минимум 8 символов';
  } else if (!hasUpper) {
    hint = 'Добавьте заглавную букву';
  } else if (!hasLower) {
    hint = 'Добавьте строчную букву';
  } else if (!hasDigit) {
    hint = 'Добавьте цифру';
  } else if (!hasSpecial) {
    hint = 'Добавьте спецсимвол';
  } else if (!hasLongLength) {
    hint = 'Используйте пароль длиннее 12 символов';
  } else {
    hint = null;
  }

  return { score, label: LEVELS[score], hint };
}
