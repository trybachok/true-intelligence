import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  deleteTestAccounts,
  httpTestModule,
  insertTestAccounts,
  loginAs,
} from './http-test-support.js';

type Review = {
  id: number;
  branchId: number;
  publishedAt: Date;
  rating: number;
  status: 'pending' | 'processed';
  body: string;
};

describe('GET /api/companies/{companyId}/reviews', () => {
  const accounts = {
    client: {
      email: `company-reviews-client-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
    },
    admin: {
      email: `company-reviews-admin-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
    },
  };

  let app: INestApplication;
  let database: DataSource;
  let fixture: {
    ownCompanyId: number;
    otherCompanyId: number;
    branchIds: number[];
    matchingReviews: Review[];
    foreignReview: Review;
  };

  beforeAll(async () => {
    const module = await httpTestModule().compile();
    app = module.createNestApplication();
    await app.init();

    database = app.get<DataSource>(DataSource);
    fixture = await database.transaction(async (manager) => {
      async function companyId(name: string): Promise<number> {
        const [row] = await manager.query<{ id: number }[]>(
          'INSERT INTO companies (name) VALUES ($1) RETURNING id',
          [name],
        );
        return row.id;
      }

      async function branchId(company: number, name: string): Promise<number> {
        const [row] = await manager.query<{ id: number }[]>(
          'INSERT INTO branches (company_id, name) VALUES ($1, $2) RETURNING id',
          [company, name],
        );
        return row.id;
      }

      const ownCompanyId = await companyId(
        'Компания клиента для теста отзывов',
      );
      const otherCompanyId = await companyId(
        'Чужая компания для теста отзывов',
      );
      const firstBranchId = await branchId(ownCompanyId, 'Первый филиал');
      const secondBranchId = await branchId(ownCompanyId, 'Второй филиал');
      const otherBranchId = await branchId(otherCompanyId, 'Чужой филиал');

      await insertTestAccounts(manager, accounts, ownCompanyId);

      const branchIds = [firstBranchId, secondBranchId, otherBranchId];
      const reviews = await manager.query<Review[]>(
        `WITH inserted AS (
          INSERT INTO reviews (branch_id, published_at, rating, body, status) VALUES
            ($1, '2025-01-15T10:00:00Z', 5, 'Подходит в первом филиале', 'pending'),
            ($1, '2025-01-16T10:00:00Z', 5, 'Другой статус', 'processed'),
            ($2, '2025-01-17T10:00:00Z', 4, 'Другая оценка', 'pending'),
            ($2, '2025-01-18T10:00:00Z', 5, 'Подходит во втором филиале', 'pending'),
            ($3, '2025-01-19T10:00:00Z', 5, 'Подходит, но в чужом филиале', 'pending')
          RETURNING id, branch_id, published_at, rating, body, status
        )
        SELECT id, branch_id AS "branchId", published_at AS "publishedAt", rating, body, status
        FROM inserted ORDER BY id DESC`,
        branchIds,
      );
      const [foreignReview] = reviews.filter(
        (review) => review.branchId === otherBranchId,
      );
      const matchingReviews = reviews.filter(
        (review) =>
          review.branchId !== otherBranchId &&
          review.rating === 5 &&
          review.status === 'pending',
      );
      return {
        ownCompanyId,
        otherCompanyId,
        branchIds,
        matchingReviews,
        foreignReview,
      };
    });
  });

  afterAll(async () => {
    try {
      if (fixture) {
        await database.transaction(async (manager) => {
          await manager.query(
            'DELETE FROM reviews WHERE branch_id = ANY($1::integer[])',
            [fixture.branchIds],
          );
          await deleteTestAccounts(manager, accounts);
          await manager.query(
            'DELETE FROM branches WHERE id = ANY($1::integer[])',
            [fixture.branchIds],
          );
          await manager.query(
            'DELETE FROM companies WHERE id = ANY($1::integer[])',
            [[fixture.ownCompanyId, fixture.otherCompanyId]],
          );
        });
      }
    } finally {
      await app?.close();
    }
  });

  function reviews(companyId: number) {
    return request(app.getHttpServer()).get(
      `/api/companies/${companyId}/reviews`,
    );
  }

  function expectedReview({ publishedAt, ...review }: Review) {
    return { ...review, publishedAt: publishedAt.toISOString() };
  }

  it('фильтрует отзывы по рейтингу и статусу и выдаёт страницы по всем филиалам компании', async () => {
    const token = await loginAs(app, accounts.client);
    const filters = { rating: 5, status: 'pending', limit: 1 };
    const [first, second] = fixture.matchingReviews;

    const firstPage = await reviews(fixture.ownCompanyId)
      .set('Authorization', `Bearer ${token}`)
      .query(filters)
      .expect(200)
      .expect('Content-Type', /application\/json/);
    expect(firstPage.body).toEqual({
      items: [expectedReview(first)],
      nextBeforeId: first.id,
    });

    const secondPage = await reviews(fixture.ownCompanyId)
      .set('Authorization', `Bearer ${token}`)
      .query({ ...filters, beforeId: firstPage.body.nextBeforeId })
      .expect(200);
    expect(secondPage.body).toEqual({
      items: [expectedReview(second)],
      nextBeforeId: null,
    });
  });

  it('возвращает администратору отзывы выбранной компании', async () => {
    const token = await loginAs(app, accounts.admin);
    const response = await reviews(fixture.otherCompanyId)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body).toEqual({
      items: [expectedReview(fixture.foreignReview)],
      nextBeforeId: null,
    });
  });

  it('возвращает пустую страницу, если фильтр не нашёл отзывы', async () => {
    const token = await loginAs(app, accounts.client);
    await reviews(fixture.ownCompanyId)
      .set('Authorization', `Bearer ${token}`)
      .query({ rating: 1 })
      .expect(200, { items: [], nextBeforeId: null });
  });

  it('возвращает 403 для запроса отзывов чужой компании', async () => {
    const token = await loginAs(app, accounts.client);
    await reviews(fixture.otherCompanyId)
      .set('Authorization', `Bearer ${token}`)
      .expect(403, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Доступ запрещён',
      });
  });

  it('возвращает 400 для оценки вне допустимого диапазона', async () => {
    const token = await loginAs(app, accounts.client);
    const response = await reviews(fixture.ownCompanyId)
      .set('Authorization', `Bearer ${token}`)
      .query({ rating: 6 })
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Проверьте параметры запроса',
    });
  });

  it('отклоняет повторные и неизвестные параметры и тело GET-запроса', async () => {
    const token = await loginAs(app, accounts.client);
    for (const query of ['limit=2&limit=3', 'sort=asc', 'beforeId=']) {
      await reviews(fixture.ownCompanyId)
        .auth(token, { type: 'bearer' })
        .query(query)
        .expect(400);
    }
    await reviews(fixture.ownCompanyId)
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(400);
  });

  it('возвращает 404 для отсутствующей компании', async () => {
    const token = await loginAs(app, accounts.admin);
    await reviews(2147483647)
      .set('Authorization', `Bearer ${token}`)
      .expect(404, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Компания или филиал не найдены',
      });
  });

  it('возвращает 401 для запроса без токена', async () => {
    await reviews(fixture.ownCompanyId)
      .expect(401)
      .expect('WWW-Authenticate', /^Bearer(?:[ \t]|$)/i)
      .expect({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Требуется вход в систему',
      });
  });
});
