import {
  parseImportRequest,
  validateMetrics,
} from './statistics-validation.js';

const input = { branchId: 1, from: '2024-02-29', to: '2024-03-01' };
const metric = {
  branchId: 1,
  date: input.from,
  cardViews: 0,
  websiteClicks: 0,
  calls: 0,
  routeRequests: 0,
};

describe('Валидация импорта статистики', () => {
  it('принимает корректный период и идентификатор', () => {
    expect(parseImportRequest(input)).toEqual(input);
  });

  it.each([
    { branchId: '1' },
    { from: '2025-02-29' },
    { to: '2024-02-28' },
    { to: '2024-03-01T00:00:00Z' },
    { companyId: 1 },
  ])('отклоняет неверное тело запроса %j', (fields) => {
    expect(() => parseImportRequest({ ...input, ...fields })).toThrow(
      'Bad Request',
    );
  });

  it('принимает нулевые значения и пустой ответ', () => {
    expect(validateMetrics([metric], input)).toEqual([metric]);
    expect(validateMetrics([], input)).toEqual([]);
  });

  it.each([
    [[metric, metric]],
    [[{ ...metric, branchId: 2 }]],
    [[{ ...metric, date: '2024-02-28' }]],
    [[{ ...metric, calls: '0' }]],
    [[{ ...metric, calls: 2_147_483_648 }]],
    [[{ ...metric, cardViews: 0.1 }]],
    [null],
  ])('отклоняет недопустимый ответ источника %j', (rows) => {
    expect(validateMetrics(rows, input)).toBeNull();
  });
});
