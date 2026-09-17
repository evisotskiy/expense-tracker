import { hash, verify } from 'argon2';

import { ARGON2_OPTIONS } from './auth.service';

/**
 * Один настоящий round-trip без мока argon2: доказывает, что ARGON2_OPTIONS —
 * валидный объект опций (type: argon2id, а не строка), и что hash/verify
 * действительно принимают друг друга. Остальные спеки мокают argon2 целиком —
 * это единственное место, где реальный нативный модуль зовётся по-настоящему.
 */
describe('ARGON2_OPTIONS (реальный argon2, без мока)', () => {
  it('hash + verify успешно проходят по кругу', async () => {
    const digest = await hash('Passw0rd', ARGON2_OPTIONS);

    await expect(verify(digest, 'Passw0rd')).resolves.toBe(true);
    await expect(verify(digest, 'другой-пароль')).resolves.toBe(false);
  });

  it('использует argon2id (type === 2)', () => {
    expect(ARGON2_OPTIONS.type).toBe(2);
  });
});
