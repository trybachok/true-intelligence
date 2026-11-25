import { randomBytes, scryptSync } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { EntityManager } from 'typeorm';
import { AppModule } from '../src/app.module.js';

type Credentials = { email: string; password: string };
type TestAccounts = Record<'client' | 'admin', Credentials>;

export function httpTestModule() {
  return Test.createTestingModule({ imports: [AppModule] });
}

export function hashTestPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export async function insertTestAccounts(
  manager: EntityManager,
  accounts: TestAccounts,
  companyId: number,
): Promise<void> {
  for (const role of ['client', 'admin'] as const) {
    const { email, password } = accounts[role];
    await manager.query(
      'INSERT INTO users (company_id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [
        role === 'client' ? companyId : null,
        email,
        hashTestPassword(password),
        role,
      ],
    );
  }
}

export async function deleteTestAccounts(
  manager: EntityManager,
  accounts: TestAccounts,
): Promise<void> {
  await manager.query('DELETE FROM users WHERE email = ANY($1::text[])', [
    [accounts.client.email, accounts.admin.email],
  ]);
}

export async function loginAs(
  app: INestApplication,
  credentials: Credentials,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send(credentials)
    .expect(200);
  expect(response.body.accessToken).toBeTruthy();
  return response.body.accessToken;
}
