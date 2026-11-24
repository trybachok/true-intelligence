import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';

describe('GET /api/analytics', () => {
  const period = { from: '2025-01-15', to: '2025-01-17' };
  const roles = ['client', 'admin'] as const;
  const accounts = {
    client: {
      email: `analytics-client-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
    },
    admin: {
      email: `analytics-admin-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
    },
  };

  let app: INestApplication;
  let database: DataSource;
  let fixture: {
    ownCompanyId: number;
    otherCompanyId: number;
    firstBranchId: number;
    secondBranchId: number;
    otherBranchId: number;
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
        'Компания клиента для теста аналитики',
      );
      const otherCompanyId = await companyId(
        'Чужая компания для теста аналитики',
      );
      const firstBranchId = await branchId(ownCompanyId, 'Первый филиал');
      const secondBranchId = await branchId(ownCompanyId, 'Второй филиал');
      const otherBranchId = await branchId(otherCompanyId, 'Чужой филиал');

      for (const role of roles) {
        const { email, password } = accounts[role];
        const salt = randomBytes(16).toString('hex');
        const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
        await manager.query(
          'INSERT INTO users (company_id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
          [role === 'client' ? ownCompanyId : null, email, passwordHash, role],
        );
      }

      await manager.query(
        `INSERT INTO daily_metrics (branch_id, metric_date, card_views, website_clicks, calls, route_requests)
         VALUES ($1, '2025-01-14', 400, 40, 40, 40),
           ($1, '2025-01-15', 10, 1, 2, 3),
           ($1, '2025-01-17', 20, 2, 3, 4),
           ($2, '2025-01-15', 30, 3, 4, 5),
           ($3, '2025-01-16', 90, 9, 8, 7),
           ($1, '2025-01-18', 500, 50, 50, 50)`,
        [firstBranchId, secondBranchId, otherBranchId],
      );
      await manager.query(
        `INSERT INTO reviews (branch_id, published_at, rating, body, status)
         VALUES ($1, '2025-01-14T23:59:59Z', 1, 'До периода', 'pending'),
           ($1, '2025-01-15T00:00:00Z', 5, 'Начало периода', 'pending'),
           ($1, '2025-01-17T23:59:59Z', 5, 'Конец периода', 'processed'),
           ($1, '2025-01-18T00:00:00Z', 1, 'После периода', 'processed'),
           ($2, '2025-01-16T12:00:00Z', 1, 'Отзыв чужой компании', 'pending')`,
        [firstBranchId, otherBranchId],
      );
      await manager.query(
        `INSERT INTO reviews (branch_id, published_at, rating, body, status)
         SELECT $1, TIMESTAMPTZ '2025-01-16T10:00:00Z' + n * INTERVAL '1 minute',
           4, 'Отзыв второго филиала', 'processed'
         FROM generate_series(1, 8) AS n`,
        [secondBranchId],
      );

      return {
        ownCompanyId,
        otherCompanyId,
        firstBranchId,
        secondBranchId,
        otherBranchId,
      };
    });
  });

  afterAll(async () => {
    try {
      if (fixture) {
        const branchIds = [
          fixture.firstBranchId,
          fixture.secondBranchId,
          fixture.otherBranchId,
        ];
        await database.transaction(async (manager) => {
          await manager.query(
            'DELETE FROM reviews WHERE branch_id = ANY($1::integer[])',
            [branchIds],
          );
          await manager.query(
            'DELETE FROM daily_metrics WHERE branch_id = ANY($1::integer[])',
            [branchIds],
          );
          await manager.query(
            'DELETE FROM users WHERE email = ANY($1::text[])',
            [[accounts.client.email, accounts.admin.email]],
          );
          await manager.query(
            'DELETE FROM branches WHERE id = ANY($1::integer[])',
            [branchIds],
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

  async function accessToken(role: keyof typeof accounts): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(accounts[role])
      .expect(200);
    expect(login.body.accessToken).toBeTruthy();
    return login.body.accessToken;
  }

  function analytics(token: string) {
    return request(app.getHttpServer())
      .get('/api/analytics')
      .set('Authorization', `Bearer ${token}`);
  }

  it('считает сводку клиента только по его филиалам и учитывает границы периода UTC', async () => {
    await analytics(await accessToken('client'))
      .query(period)
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .expect({
        totals: {
          cardViews: 60,
          websiteClicks: 6,
          calls: 9,
          routeRequests: 12,
          averageRating: 4.2,
          reviewCount: 10,
        },
        dailyCardViews: [
          { date: '2025-01-15', cardViews: 40 },
          { date: '2025-01-16', cardViews: 0 },
          { date: '2025-01-17', cardViews: 20 },
        ],
      });
  });

  it('считает сводку администратора по обеим компаниям', async () => {
    await analytics(await accessToken('admin'))
      .query(period)
      .expect(200)
      .expect({
        totals: {
          cardViews: 150,
          websiteClicks: 15,
          calls: 17,
          routeRequests: 19,
          averageRating: 3.91,
          reviewCount: 11,
        },
        dailyCardViews: [
          { date: '2025-01-15', cardViews: 40 },
          { date: '2025-01-16', cardViews: 90 },
          { date: '2025-01-17', cardViews: 20 },
        ],
      });
  });

  it('ограничивает аналитику выбранным филиалом', async () => {
    await analytics(await accessToken('client'))
      .query({
        ...period,
        companyId: fixture.ownCompanyId,
        branchId: fixture.firstBranchId,
      })
      .expect(200)
      .expect({
        totals: {
          cardViews: 30,
          websiteClicks: 3,
          calls: 5,
          routeRequests: 7,
          averageRating: 5,
          reviewCount: 2,
        },
        dailyCardViews: [
          { date: '2025-01-15', cardViews: 10 },
          { date: '2025-01-16', cardViews: 0 },
          { date: '2025-01-17', cardViews: 20 },
        ],
      });
  });

  it('возвращает нулевые счётчики и null для рейтинга за период без данных', async () => {
    await analytics(await accessToken('client'))
      .query({ from: '2025-01-19', to: '2025-01-19' })
      .expect(200)
      .expect({
        totals: {
          cardViews: 0,
          websiteClicks: 0,
          calls: 0,
          routeRequests: 0,
          averageRating: null,
          reviewCount: 0,
        },
        dailyCardViews: [{ date: '2025-01-19', cardViews: 0 }],
      });
  });

  it('возвращает 403 для чужого филиала', async () => {
    await analytics(await accessToken('client'))
      .query({ ...period, branchId: fixture.otherBranchId })
      .expect(403, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Доступ запрещён',
      });
  });

  it('возвращает 400 для периода с обратным порядком дат', async () => {
    const response = await analytics(await accessToken('client'))
      .query({ from: period.to, to: period.from })
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Проверьте параметры запроса',
    });
  });

  it('возвращает 400, если указанный филиал принадлежит другой доступной компании', async () => {
    const response = await analytics(await accessToken('admin'))
      .query({
        ...period,
        companyId: fixture.ownCompanyId,
        branchId: fixture.otherBranchId,
      })
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Проверьте параметры запроса',
    });
  });

  it('возвращает 401 для запроса без токена', async () => {
    await request(app.getHttpServer())
      .get('/api/analytics')
      .query(period)
      .expect(401)
      .expect('WWW-Authenticate', /^Bearer(?:[ \t]|$)/i)
      .expect({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Требуется вход в систему',
      });
  });
});
