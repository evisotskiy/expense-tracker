/**
 * Разбор строковых длительностей вида '15m', '30d', '900'.
 *
 * Секунды нужны в двух местах: AuthResponse.expiresIn и signOptions.expiresIn
 * при подписи JWT. @types/jsonwebtoken объявляет expiresIn как `number | ms.StringValue`,
 * где StringValue — шаблонный литеральный тип из пакета `ms`; обычная строка (то, что
 * возвращает ConfigService.get на JWT_ACCESS_TTL/JWT_REFRESH_TTL) туда не присваивается.
 * Пакета `ms` в apps/api нет — он попадает в lock-файл только транзитивно через
 * jsonwebtoken, и pnpm его не хойстит, — поэтому парсим сами: единиц всего четыре.
 */

const SECONDS_IN_UNIT = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
} as const;

type DurationUnit = keyof typeof SECONDS_IN_UNIT;

/** Число без суффикса или число + одна из единиц s/m/h/d. Дробей и составных значений нет. */
const DURATION_PATTERN = /^(\d+)([smhd])?$/;

function parseDuration(value: string): { amount: number; unit: DurationUnit | null } | null {
  const match = DURATION_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, amount, unit] = match;

  return { amount: Number(amount), unit: (unit as DurationUnit | undefined) ?? null };
}

/** Проверяет формат без вычисления значения — используется в env-схеме как .refine(). */
export function isDuration(value: string): boolean {
  return parseDuration(value) !== null;
}

/**
 * Переводит длительность в секунды.
 *
 * Бросает, а не возвращает NaN: неверный формат TTL должен ронять приложение на старте
 * (см. .refine(isDuration) в env.schema.ts), а не давать токен с истёкшим сразу expiresIn.
 */
export function parseDurationToSeconds(value: string): number {
  const parsed = parseDuration(value);

  if (!parsed) {
    throw new Error(`Некорректная длительность: "${value}". Ожидался формат вида 15m, 2h, 30d`);
  }

  const multiplier = parsed.unit ? SECONDS_IN_UNIT[parsed.unit] : 1;

  return parsed.amount * multiplier;
}
