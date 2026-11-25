import { hashPassword, verifyPassword } from './passwords.js';

describe('Проверка пароля bcrypt', () => {
  it('проверяет короткий пароль без нормализации', async () => {
    const password = '  пароль  ';
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$2b\$/);
    expect(await verifyPassword(password, hash)).toEqual({
      valid: true,
      legacy: false,
    });
    expect(await verifyPassword(password.trim(), hash)).toEqual({
      valid: false,
      legacy: false,
    });
  });

  it('проверяет весь пароль после 72 байт', async () => {
    const prefix = 'я'.repeat(36);
    const hash = await hashPassword(prefix + 'a');

    expect(await verifyPassword(prefix + 'a', hash)).toEqual({
      valid: true,
      legacy: false,
    });
    expect(await verifyPassword(prefix + 'b', hash)).toEqual({
      valid: false,
      legacy: false,
    });
  });
});
