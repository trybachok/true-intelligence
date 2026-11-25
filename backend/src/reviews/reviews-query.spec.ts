import { parseReviewsQuery } from './reviews-query.js';

describe('Параметры списка отзывов', () => {
  it('использует лимит по умолчанию', () => {
    expect(parseReviewsQuery({})).toEqual({ limit: 20 });
  });

  it('преобразует десятичные строки в числа', () => {
    expect(
      parseReviewsQuery({
        rating: '05',
        status: 'pending',
        limit: '100',
        beforeId: '2147483647',
      }),
    ).toEqual({
      rating: 5,
      status: 'pending',
      limit: 100,
      beforeId: 2147483647,
    });
  });

  it.each([
    { rating: '6' },
    { rating: '1.0' },
    { rating: 5 },
    { limit: '0' },
    { limit: '101' },
    { limit: '1e1' },
    { limit: ' 20' },
    { beforeId: '2147483648' },
    { beforeId: '' },
    { status: ['pending', 'processed'] },
    { status: 'PENDING' },
    { sort: 'asc' },
  ])('отклоняет неверные параметры %j', (query) => {
    expect(() => parseReviewsQuery(query)).toThrow('Bad Request');
  });
});
