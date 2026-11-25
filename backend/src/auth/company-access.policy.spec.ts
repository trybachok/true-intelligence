import { CompanyAccessPolicy } from './company-access.policy.js';

describe('CompanyAccessPolicy', () => {
  const policy = new CompanyAccessPolicy();

  it('разрешает администратору доступ к любой компании', () => {
    expect(
      policy.read(
        { id: 1, email: 'admin@example.test', role: 'admin', companyId: null },
        42,
      ),
    ).toBe(true);
  });

  it('разрешает клиенту доступ только к своей компании', () => {
    const client = {
      id: 2,
      email: 'client@example.test',
      role: 'client',
      companyId: 7,
    } as const;

    expect(policy.read(client, 7)).toBe(true);
    expect(policy.read(client, 42)).toBe(false);
  });

  it('отклоняет запрос без пользователя', () => {
    expect(policy.read(null, 7)).toBe(false);
  });
});
