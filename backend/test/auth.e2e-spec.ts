import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';

describe('POST /api/auth/login', () => {
  const email = `login-${randomUUID()}@example.test`;
  const password = randomBytes(24).toString('hex');
  let app: INestApplication;
  let database: DataSource;
  let companyId: number | undefined;
  let userId: number;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();

    database = app.get(DataSource);
    const salt = randomBytes(16).toString('hex');
    const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
    const [company] = await database.query<{ id: number }[]>(
      'INSERT INTO companies (name) VALUES ($1) RETURNING id',
      ['Login test company'],
    );
    companyId = company.id;
    const [user] = await database.query<{ id: number }[]>(
      `INSERT INTO users (company_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'client') RETURNING id`,
      [companyId, email, passwordHash],
    );
    userId = user.id;
  });

  afterAll(async () => {
    try {
      if (companyId !== undefined) {
        await database.query(
          'DELETE FROM users WHERE email = $1 AND company_id = $2',
          [email, companyId],
        );
        await database.query('DELETE FROM companies WHERE id = $1', [
          companyId,
        ]);
      }
    } finally {
      await app?.close();
    }
  });

  it('возвращает Bearer-токен и профиль клиента при верных учётных данных', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: expect.any(Number),
      user: { id: userId, email, role: 'client', companyId },
    });
    expect(response.body.accessToken.length).toBeGreaterThan(0);
    expect(Number.isInteger(response.body.expiresIn)).toBe(true);
    expect(response.body.expiresIn).toBeGreaterThan(0);
  });

  it('возвращает одинаковую ошибку при неверном пароле и неизвестном email', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: `${password}-incorrect` });
    const unknownEmail = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `unknown-${randomUUID()}@example.test`, password });

    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['www-authenticate']).toMatch(
        /^Bearer(?:[ \t]|$)/i,
      );
      expect(response.body).toEqual({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль',
      });
    }
  });
});
