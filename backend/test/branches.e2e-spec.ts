import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';

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
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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

      for (const role of ['client', 'admin'] as const) {
        const { email, password } = account[role];
        const salt = randomBytes(16).toString('hex');
        const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
        await manager.query(
          'INSERT INTO users (company_id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
          [role === 'client' ? ownCompanyId : null, email, passwordHash, role],
        );
      }

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
          await manager.query(
            'DELETE FROM users WHERE email = ANY($1::text[])',
            [[account.client.email, account.admin.email]],
          );
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

  async function accessToken(role: keyof typeof account): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(account[role])
      .expect(200);
    expect(response.body.accessToken).toBeTruthy();
    return response.body.accessToken;
  }

  it('возвращает клиенту филиалы его компании в порядке возрастания id', async () => {
    const token = await accessToken('client');

    await request(app.getHttpServer())
      .get(`/api/companies/${fixture.ownCompanyId}/branches`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .expect(fixture.ownBranches);
  });

  it('возвращает администратору филиалы выбранной компании', async () => {
    const token = await accessToken('admin');

    await request(app.getHttpServer())
      .get(`/api/companies/${fixture.otherCompanyId}/branches`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .expect(fixture.otherBranches);
  });

  it('запрещает клиенту читать филиалы чужой компании', async () => {
    const token = await accessToken('client');

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
