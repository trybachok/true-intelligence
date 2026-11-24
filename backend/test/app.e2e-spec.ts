import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  const query = vi.fn();

  beforeEach(async () => {
    query.mockReset();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue({ query })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('returns 200 when PostgreSQL accepts a query', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);

    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns 503 when PostgreSQL is unavailable', async () => {
    query.mockRejectedValue(new Error('Internal database error'));

    await request(app.getHttpServer()).get('/api/health').expect(503, {
      statusCode: 503,
      message: 'PostgreSQL недоступен',
      error: 'Service Unavailable',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
