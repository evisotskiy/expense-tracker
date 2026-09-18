import { describe, expect, it } from 'vitest';

import { getPasswordStrength } from './password-strength';

describe('getPasswordStrength', () => {
  it('возвращает null для пустой строки', () => {
    expect(getPasswordStrength('')).toBeNull();
  });

  it('короче 8 символов — всегда 0', () => {
    expect(getPasswordStrength('abc')?.score).toBe(0);
  });

  it('ровно 8 символов без цифр/регистра/спецсимволов — "Слабый" с подсказкой про заглавную', () => {
    const result = getPasswordStrength('abcdefgh');
    expect(result?.score).toBe(1);
    expect(result?.label).toBe('Слабый');
    expect(result?.hint).toContain('заглавную');
  });

  it('длинный разнообразный пароль — "Надёжный" без подсказки', () => {
    const result = getPasswordStrength('Abcdefghij12!');
    expect(result?.score).toBe(4);
    expect(result?.label).toBe('Надёжный');
    expect(result?.hint).toBeNull();
  });

  it('пароль из чёрного списка не поднимается выше "Слабый"', () => {
    expect(getPasswordStrength('password')?.score).toBeLessThanOrEqual(1);
    expect(getPasswordStrength('12345678')?.score).toBeLessThanOrEqual(1);
  });

  it('повтор одного символа не поднимается выше "Слабый"', () => {
    expect(getPasswordStrength('aaaaaaaaaaaa')?.score).toBeLessThanOrEqual(1);
  });

  it('граница ровно 8 символов даёт балл за минимальную длину', () => {
    expect(getPasswordStrength('Ab1!efgh')?.score).toBeGreaterThanOrEqual(1);
  });

  it('граница ровно 12 символов даёт балл за длинный пароль', () => {
    const short = getPasswordStrength('abcdefgh1jk'); // 11 символов, без обоих регистров и спецсимвола
    const long = getPasswordStrength('abcdefgh1jkl'); // 12 символов
    expect(long!.score).toBeGreaterThan(short!.score);
  });
});
