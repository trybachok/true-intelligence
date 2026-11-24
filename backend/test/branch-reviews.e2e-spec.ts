import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';

type ReviewFixture = {
  id: number;
  branchId: number;
  publishedAt: Date;
  rating: number;
  body: string;
  status: string;
  companyId: number;
};

describe('GET /api/branches/{branchId}/reviews', () => {
  const roles = ['client', 'admin'] as const;
  const accounts = {
    client: {
      email: `branch-reviews-client-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
    },
    admin: {
      email: `branch-reviews-admin-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
    },
  };

  let app: INestApplication;
  let database: DataSource;
  let ownReview: ReviewFixture;
  let foreignReview: ReviewFixture;
  let accountsCreated = false;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();

    database = app.get<DataSource>(DataSource);

    async function demoReview(
      companyName: string,
      branchName: string,
    ): Promise<ReviewFixture> {
      const [review] = await database.query<ReviewFixture[]>(
        `SELECT r.id, r.branch_id AS "branchId", r.published_at AS "publishedAt",
           r.rating, r.body, r.status, b.company_id AS "companyId"
         FROM reviews r
         JOIN branches b ON b.id = r.branch_id
         JOIN companies c ON c.id = b.company_id
         WHERE c.name = $1 AND b.name = $2`,
        [companyName, branchName],
      );
      return review;
    }

    ownReview = await demoReview('Вымышленная компания Север', 'Центральный');
    foreignReview = await demoReview('Вымышленная компания Юг', 'Южный');

    await database.transaction(async (manager) => {
      for (const role of roles) {
        const { email, password } = accounts[role];
        const salt = randomBytes(16).toString('hex');
        const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
        await manager.query(
          'INSERT INTO users (company_id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
          [
            role === 'client' ? ownReview.companyId : null,
            email,
            passwordHash,
            role,
          ],
        );
      }
    });
    accountsCreated = true;
  });

  afterAll(async () => {
    try {
      if (accountsCreated) {
        await database.query(
          'DELETE FROM users WHERE email = ANY($1::text[])',
          [[accounts.client.email, accounts.admin.email]],
        );
      }
    } finally {
      await app?.close();
    }
  });

  async function accessToken(role: keyof typeof accounts): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(accounts[role])
      .expect(200);
    expect(login.body.accessToken).toBeTruthy();
    return login.body.accessToken;
  }

  function reviews(branchId: number) {
    return request(app.getHttpServer()).get(
      `/api/branches/${branchId}/reviews`,
    );
  }

  function expectedPage(review: ReviewFixture) {
    const timestamp = review.publishedAt.toISOString().slice(0, 19);
    return {
      items: [
        {
          id: review.id,
          branchId: review.branchId,
          publishedAt: expect.stringMatching(
            new RegExp(`^${timestamp}(?:\\\\.0+)?(?:Z|\\\\+00:00)$`),
          ),
          rating: review.rating,
          body: review.body,
          status: review.status,
        },
      ],
      nextBeforeId: null,
    };
  }

  it('возвращает клиенту отзывы только выбранного филиала его компании', async () => {
    const token = await accessToken('client');
    const response = await reviews(ownReview.branchId)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(response.body).toEqual(expectedPage(ownReview));
  });

  it('применяет фильтры и возвращает пустую страницу для отзыва другого филиала той же компании', async () => {
    const token = await accessToken('client');

    await reviews(ownReview.branchId)
      .set('Authorization', `Bearer ${token}`)
      .query({ rating: 4, status: 'pending' })
      .expect(200, { items: [], nextBeforeId: null });
  });

  it('возвращает администратору отзывы выбранного филиала другой компании', async () => {
    const token = await accessToken('admin');
    const response = await reviews(foreignReview.branchId)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual(expectedPage(foreignReview));
  });

  it('возвращает 403 для запроса отзывов филиала чужой компании', async () => {
    const token = await accessToken('client');

    await reviews(foreignReview.branchId)
      .set('Authorization', `Bearer ${token}`)
      .expect(403, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Доступ запрещён',
      });
  });

  it('возвращает 400 для неизвестного статуса отзыва', async () => {
    const token = await accessToken('client');
    const response = await reviews(ownReview.branchId)
      .set('Authorization', `Bearer ${token}`)
      .query({ status: 'archived' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Проверьте параметры запроса',
    });
  });

  it('возвращает 404 для отсутствующего филиала', async () => {
    const token = await accessToken('admin');

    await reviews(2147483647)
      .set('Authorization', `Bearer ${token}`)
      .expect(404, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Компания или филиал не найдены',
      });
  });

  it('возвращает 401 для запроса без токена', async () => {
    await reviews(ownReview.branchId)
      .expect(401)
      .expect('WWW-Authenticate', /^Bearer(?:[ \t]|$)/i)
      .expect({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Требуется вход в систему',
      });
  });
});
