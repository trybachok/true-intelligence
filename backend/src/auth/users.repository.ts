import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthUser } from './auth-user.js';

const userFields = 'id, email, role, company_id AS "companyId"';

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DataSource) {}

  async findUser(id: number): Promise<AuthUser | null> {
    const [user] = await this.database.query<AuthUser[]>(
      `SELECT ${userFields} FROM users WHERE id = $1`,
      [id],
    );
    return user ?? null;
  }

  async findCredentials(email: string) {
    const [row] = await this.database.query<
      (AuthUser & { passwordHash: string })[]
    >(
      `SELECT ${userFields}, password_hash AS "passwordHash" FROM users WHERE email = $1`,
      [email],
    );
    if (!row) return null;

    const { passwordHash, ...user } = row;
    return { user, passwordHash };
  }

  async replacePasswordHash(id: number, previous: string, next: string) {
    await this.database.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash = $3',
      [next, id, previous],
    );
  }
}
