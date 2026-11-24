import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';

describe('GET /api/companies', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('возвращает клиенту только его компанию', async () => {
    const database = app.get<DataSource>(DataSource);
    const { email, password, passwordHash } = createLoginCredentials();
    const ownCompanyName = 'Компания клиента для HTTP-теста';
    const otherCompanyName = 'Чужая компания для HTTP-теста';

    const [company, otherCompany] = await database.query<
      { id: number; name: string }[]
    >('INSERT INTO companies (name) VALUES ($1), ($2) RETURNING id, name', [
      ownCompanyName,
      otherCompanyName,
    ]);

    try {
      await database.query(
        `INSERT INTO users (company_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'client')`,
        [company.id, email, passwordHash],
      );

      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      expect(login.body.accessToken).toBeTruthy();

      await request(app.getHttpServer())
        .get('/api/companies')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect([company]);
    } finally {
      await database.query(
        'DELETE FROM users WHERE email = $1 AND company_id = $2',
        [email, company.id],
      );
      await database.query(
        'DELETE FROM companies WHERE id = ANY($1::integer[])',
        [[company.id, otherCompany.id]],
      );
    }
  });

  it('возвращает администратору все компании в порядке возрастания id', async () => {
    const database = app.get<DataSource>(DataSource);
    const { email, password, passwordHash } = createLoginCredentials();
    const companies = await database.query<{ id: number; name: string }[]>(
      'SELECT id, name FROM companies ORDER BY id',
    );
    expect(companies.length).toBeGreaterThanOrEqual(2);

    await database.query(
      `INSERT INTO users (company_id, email, password_hash, role)
       VALUES (NULL, $1, $2, 'admin')`,
      [email, passwordHash],
    );

    try {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      expect(login.body.accessToken).toBeTruthy();

      await request(app.getHttpServer())
        .get('/api/companies')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect(companies);
    } finally {
      await database.query('DELETE FROM users WHERE email = $1 AND role = $2', [
        email,
        'admin',
      ]);
    }
  });

  it('возвращает ошибку аутентификации для запроса без токена', async () => {
    await request(app.getHttpServer())
      .get('/api/companies')
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

function createLoginCredentials() {
  const email = `companies-${randomUUID()}@example.test`;
  const password = randomBytes(24).toString('hex');
  const salt = randomBytes(16).toString('hex');
  const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  return { email, password, passwordHash };
}
