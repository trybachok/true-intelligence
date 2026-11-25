import { parseAnalyticsQuery } from './analytics-query.js';

describe('Параметры аналитики', () => {
  const period = { from: '2024-02-29', to: '2024-03-01' };

  it('принимает високосный день и десятичные идентификаторы', () => {
    expect(
      parseAnalyticsQuery({
        ...period,
        companyId: '0001',
        branchId: '2147483647',
      }),
    ).toEqual({ ...period, companyId: 1, branchId: 2147483647 });
  });

  it.each([
    { from: '2025-02-29' },
    { from: '0000-01-01' },
    { from: '2024-2-29' },
    { to: '2024-02-28' },
    { to: undefined },
    { branchId: '2147483648' },
    { branchId: '1e2' },
    { branchId: ' 1' },
    { branchId: '0' },
    { companyId: ['1', '2'] },
    { branchId: '' },
    { sort: 'desc' },
  ])('отклоняет запрос с некорректными полями %j', (fields) => {
    expect(() => parseAnalyticsQuery({ ...period, ...fields })).toThrow();
  });
});
