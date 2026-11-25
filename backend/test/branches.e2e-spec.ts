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

type Branch = { id: number; companyId: number; name: string };

describe('GET /api/companies/{companyId}/branches', () => {
  const account = {
    client: {
      email: `branches-client-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
    },
    admin: {
      email: `branches-admin-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
    },
  };

  let app: INestApplication;
  let database: DataSource;
  let fixture: {
    ownCompanyId: number;
    otherCompanyId: number;
    ownBranches: Branch[];
    otherBranches: Branch[];
  };

  beforeAll(async () => {
    const module = await httpTestModule().compile();
    app = module.createNestApplication();
    await app.init();

    database = app.get<DataSource>(DataSource);
    fixture = await database.transaction(async (manager) => {
      const companyId = async (name: string) => {
        const [company] = await manager.query<{ id: number }[]>(
          'INSERT INTO companies (name) VALUES ($1) RETURNING id',
          [name],
        );
        return company.id;
      };
      const ownCompanyId = await companyId(
        'Компания клиента для теста филиалов',
      );
      const otherCompanyId = await companyId(
        'Чужая компания для теста филиалов',
      );
      const branches = await manager.query<Branch[]>(
        `WITH inserted AS (
          INSERT INTO branches (company_id, name) VALUES ($1, 'Первый филиал'),
            ($2, 'Филиал другой компании'), ($1, 'Второй филиал')
          RETURNING id, company_id, name
        )
        SELECT id, company_id AS "companyId", name FROM inserted ORDER BY id`,
        [ownCompanyId, otherCompanyId],
      );

      await insertTestAccounts(manager, account, ownCompanyId);

      return {
        ownCompanyId,
        otherCompanyId,
        ownBranches: branches.filter(
          (branch) => branch.companyId === ownCompanyId,
        ),
        otherBranches: branches.filter(
          (branch) => branch.companyId === otherCompanyId,
        ),
      };
    });
  });

  afterAll(async () => {
    try {
      if (fixture) {
        const companyIds = [fixture.ownCompanyId, fixture.otherCompanyId];
        await database.transaction(async (manager) => {
          await deleteTestAccounts(manager, account);
          await manager.query(
            'DELETE FROM branches WHERE company_id = ANY($1::integer[])',
            [companyIds],
          );
          await manager.query(
            'DELETE FROM companies WHERE id = ANY($1::integer[])',
            [companyIds],
          );
        });
      }
    } finally {
      await app?.close();
    }
  });

  it('возвращает клиенту филиалы его компании в порядке возрастания id', async () => {
    const token = await loginAs(app, account.client);

    await request(app.getHttpServer())
      .get(`/api/companies/${fixture.ownCompanyId}/branches`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .expect(fixture.ownBranches);
  });

  it('возвращает администратору филиалы выбранной компании', async () => {
    const token = await loginAs(app, account.admin);

    await request(app.getHttpServer())
      .get(`/api/companies/${fixture.otherCompanyId}/branches`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .expect(fixture.otherBranches);
  });

  it('запрещает клиенту читать филиалы чужой компании', async () => {
    const token = await loginAs(app, account.client);

    await request(app.getHttpServer())
      .get(`/api/companies/${fixture.otherCompanyId}/branches`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect('Content-Type', /application\/json/)
      .expect({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Доступ запрещён',
      });
  });

  it('учитывает смену компании после выдачи токена', async () => {
    const token = await loginAs(app, account.client);
    await database.query('UPDATE users SET company_id = $1 WHERE email = $2', [
      fixture.otherCompanyId,
      account.client.email,
    ]);
    try {
      await request(app.getHttpServer())
        .get(`/api/companies/${fixture.ownCompanyId}/branches`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/companies/${fixture.otherCompanyId}/branches`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200, fixture.otherBranches);
    } finally {
      await database.query(
        'UPDATE users SET company_id = $1 WHERE email = $2',
        [fixture.ownCompanyId, account.client.email],
      );
    }
  });

  it('возвращает 404 для отсутствующей компании', async () => {
    const token = await loginAs(app, account.client);

    await request(app.getHttpServer())
      .get('/api/companies/2147483647/branches')
      .set('Authorization', `Bearer ${token}`)
      .expect(404, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Компания или филиал не найдены',
      });
  });

  it('возвращает ошибку аутентификации для запроса без токена', async () => {
    await request(app.getHttpServer())
      .get(`/api/companies/${fixture.ownCompanyId}/branches`)
      .expect(401)
      .expect('Content-Type', /application\/json/)
      .expect('WWW-Authenticate', /^Bearer(?:[ \t]|$)/i)
      .expect({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Требуется вход в систему',
      });
  });
});
