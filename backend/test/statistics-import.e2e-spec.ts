import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';
import {
  deleteTestAccounts,
  httpTestModule,
  insertTestAccounts,
  loginAs,
} from './http-test-support.js';

type ImportInput = { branchId: number; from: string; to: string };

type Metric = {
  branchId: number;
  date: string;
  cardViews: number;
  websiteClicks: number;
  calls: number;
  routeRequests: number;
};

describe('POST /api/statistics/imports', () => {
  const accounts = {
    client: {
      email: `statistics-client-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
    },
    admin: {
      email: `statistics-admin-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
    },
  };

  const upstreamError = {
    statusCode: 502,
    code: 'UPSTREAM_ERROR',
    message: 'Не удалось получить статистику',
  };
  const fetchMetrics = vi.fn<(input: ImportInput) => Promise<Metric[]>>();

  let app: INestApplication;
  let database: DataSource;
  let fixture: { companyId: number; branchId: number };

  beforeAll(async () => {
    const module = await httpTestModule()
      .overrideProvider('STATISTICS_SOURCE')
      .useValue({ fetchMetrics })
      .compile();
    app = module.createNestApplication();
    await app.init();

    database = app.get<DataSource>(DataSource);
    fixture = await database.transaction(async (manager) => {
      const [{ id: companyId }] = await manager.query<{ id: number }[]>(
        'INSERT INTO companies (name) VALUES ($1) RETURNING id',
        ['Компания для теста импорта'],
      );
      const [{ id: branchId }] = await manager.query<{ id: number }[]>(
        'INSERT INTO branches (company_id, name) VALUES ($1, $2) RETURNING id',
        [companyId, 'Филиал для теста импорта'],
      );

      await insertTestAccounts(manager, accounts, companyId);

      return { companyId, branchId };
    });
  });

  afterAll(async () => {
    try {
      if (fixture) {
        await database.transaction(async (manager) => {
          await manager.query(
            'DELETE FROM daily_metrics WHERE branch_id = $1',
            [fixture.branchId],
          );
          await deleteTestAccounts(manager, accounts);
          await manager.query('DELETE FROM branches WHERE id = $1', [
            fixture.branchId,
          ]);
          await manager.query('DELETE FROM companies WHERE id = $1', [
            fixture.companyId,
          ]);
        });
      }
    } finally {
      await app?.close();
    }
  });

  beforeEach(async () => {
    fetchMetrics.mockReset();
    await database.query('DELETE FROM daily_metrics WHERE branch_id = $1', [
      fixture.branchId,
    ]);
  });

  function savedMetrics() {
    return database.query<Metric[]>(
      `SELECT branch_id AS "branchId", metric_date::text AS date, card_views AS "cardViews",
         website_clicks AS "websiteClicks", calls, route_requests AS "routeRequests"
       FROM daily_metrics WHERE branch_id = $1 ORDER BY metric_date`,
      [fixture.branchId],
    );
  }

  function importInput(): ImportInput {
    return { branchId: fixture.branchId, from: '2025-01-15', to: '2025-01-16' };
  }

  function importStatistics(token: string) {
    return request(app.getHttpServer())
      .post('/api/statistics/imports')
      .set('Authorization', `Bearer ${token}`);
  }

  function sourceMetrics(): [Metric, Metric] {
    const { branchId, from, to } = importInput();
    return [
      {
        branchId,
        date: from,
        cardViews: 10,
        websiteClicks: 2,
        calls: 1,
        routeRequests: 3,
      },
      {
        branchId,
        date: to,
        cardViews: 20,
        websiteClicks: 3,
        calls: 2,
        routeRequests: 4,
      },
    ];
  }

  async function importMetrics(token: string, metrics: Metric[]): Promise<void> {
    fetchMetrics.mockResolvedValue(metrics);
    await importStatistics(token)
      .send(importInput())
      .expect(200, { processedDays: metrics.length });
  }

  async function expectDailyMetrics(token: string, metric: Metric): Promise<void> {
    const { branchId, date, cardViews, ...counters } = metric;
    await request(app.getHttpServer())
      .get('/api/analytics')
      .set('Authorization', `Bearer ${token}`)
      .query({ branchId, from: date, to: date })
      .expect(200, {
        totals: { cardViews, ...counters, averageRating: null, reviewCount: 0 },
        dailyCardViews: [{ date, cardViews }],
      });
  }

  it('сохраняет статистику за каждый импортированный день', async () => {
    const token = await loginAs(app, accounts.admin);
    const [first, second] = sourceMetrics();

    await importMetrics(token, [first, second]);

    expect(fetchMetrics.mock.calls).toEqual([[importInput()]]);
    await expectDailyMetrics(token, first);
    await expectDailyMetrics(token, second);
  });

  it('не удваивает счётчики при повторном импорте', async () => {
    const token = await loginAs(app, accounts.admin);
    const [first, second] = sourceMetrics();
    await importMetrics(token, [first, second]);

    await importMetrics(token, [first, second]);

    expect(fetchMetrics.mock.calls).toEqual([[importInput()], [importInput()]]);
    await expectDailyMetrics(token, first);
    await expectDailyMetrics(token, second);
  });

  it('заменяет показатели за день и сохраняет показатели пропущенного дня', async () => {
    const token = await loginAs(app, accounts.admin);
    const [first, second] = sourceMetrics();
    await importMetrics(token, [first, second]);
    const updated = { ...first, cardViews: 99 };

    await importMetrics(token, [updated]);

    await expectDailyMetrics(token, updated);
    await expectDailyMetrics(token, second);
  });

  it('возвращает 200 и ноль обработанных дней при пустом ответе источника', async () => {
    const token = await loginAs(app, accounts.admin);
    fetchMetrics.mockResolvedValue([]);

    await importStatistics(token)
      .send(importInput())
      .expect(200, { processedDays: 0 });
    expect(await savedMetrics()).toEqual([]);
  });

  it.each([
    'отрицательный счётчик',
    'повторная дата',
    'день вне периода',
    'чужой филиал',
  ] as const)(
    'возвращает 502 и сохраняет пустую таблицу для случая «%s»',
    async (scenario) => {
      const token = await loginAs(app, accounts.admin);
      const [first, second] = sourceMetrics();
      const invalid = {
        'отрицательный счётчик': { ...second, calls: -1 },
        'повторная дата': { ...second, date: first.date },
        'день вне периода': { ...second, date: '2025-01-17' },
        'чужой филиал': { ...second, branchId: 2147483647 },
      }[scenario];
      fetchMetrics.mockResolvedValue([first, invalid]);

      await importStatistics(token)
        .send(importInput())
        .expect(502, upstreamError);
      expect(await savedMetrics()).toEqual([]);
    },
  );

  it('возвращает 502 при ошибке источника', async () => {
    const token = await loginAs(app, accounts.admin);
    fetchMetrics.mockRejectedValue(new Error('Ошибка внешнего источника'));

    await importStatistics(token)
      .send(importInput())
      .expect(502, upstreamError);
    expect(await savedMetrics()).toEqual([]);
  });

  it('возвращает 504, если источник сообщает о тайм-ауте', async () => {
    const token = await loginAs(app, accounts.admin);
    fetchMetrics.mockRejectedValue(
      new DOMException('Тайм-аут источника', 'TimeoutError'),
    );

    await importStatistics(token).send(importInput()).expect(504, {
      statusCode: 504,
      code: 'UPSTREAM_TIMEOUT',
      message: 'Источник статистики не ответил вовремя',
    });
    expect(await savedMetrics()).toEqual([]);
  });

  it('возвращает 500 и откатывает изменения, если PostgreSQL отклоняет запись', async () => {
    const [first, second] = sourceMetrics();
    await database.query(
      `INSERT INTO daily_metrics (branch_id, metric_date, card_views, website_clicks, calls, route_requests)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        first.branchId,
        first.date,
        first.cardViews,
        first.websiteClicks,
        first.calls,
        first.routeRequests,
      ],
    );
    fetchMetrics.mockResolvedValue([{ ...first, cardViews: 99 }, second]);

    const trigger = `test_import_failure_${randomUUID().replaceAll('-', '')}`;
    await database.transaction(async (manager) => {
      await manager.query(`
        CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'Ошибка записи для теста импорта';
        END;
        $$;
      `);
      await manager.query(`
        CREATE TRIGGER ${trigger} BEFORE INSERT OR UPDATE ON daily_metrics
        FOR EACH ROW WHEN (NEW.branch_id = ${fixture.branchId} AND NEW.metric_date = DATE '2025-01-16')
        EXECUTE FUNCTION ${trigger}();
      `);
    });

    try {
      const token = await loginAs(app, accounts.admin);
      await importStatistics(token).send(importInput()).expect(500, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Не удалось выполнить запрос',
      });
      expect(await savedMetrics()).toEqual([first]);
    } finally {
      await database.transaction(async (manager) => {
        await manager.query(`DROP TRIGGER ${trigger} ON daily_metrics`);
        await manager.query(`DROP FUNCTION ${trigger}()`);
      });
    }
  });

  it('возвращает 403, если импорт запускает клиент', async () => {
    await importStatistics(await loginAs(app, accounts.client))
      .send(importInput())
      .expect(403, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Доступ запрещён',
      });
  });

  it('возвращает 400 для периода с обратным порядком дат', async () => {
    const { branchId, from, to } = importInput();
    const response = await importStatistics(await loginAs(app, accounts.admin))
      .send({ branchId, from: to, to: from })
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Проверьте параметры запроса',
    });
  });

  it('возвращает 404 для отсутствующего филиала', async () => {
    await importStatistics(await loginAs(app, accounts.admin))
      .send({ ...importInput(), branchId: 2147483647 })
      .expect(404, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Компания или филиал не найдены',
      });
  });

  it('возвращает 401 для запроса без токена', async () => {
    await request(app.getHttpServer())
      .post('/api/statistics/imports')
      .send(importInput())
      .expect(401)
      .expect('WWW-Authenticate', /^Bearer(?:[ \t]|$)/i)
      .expect({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Требуется вход в систему',
      });
  });
});
