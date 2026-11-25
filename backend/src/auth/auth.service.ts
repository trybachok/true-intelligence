import { Injectable } from '@nestjs/common';
import { TokenService } from '@nestjs/authentication';
import { hashPassword, verifyPassword } from './passwords.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: TokenService,
  ) {}

  async login(email: string, password: string) {
    const account = await this.users.findCredentials(email.toLowerCase());
    const passwordCheck = await verifyPassword(password, account?.passwordHash);
    if (!account || !passwordCheck.valid) return null;

    const { user, passwordHash } = account;
    if (passwordCheck.legacy) {
      await this.users.replacePasswordHash(
        user.id,
        passwordHash,
        await hashPassword(password),
      );
    }

    const { accessToken, expiresIn } = await this.tokens.issue(
      String(user.id),
      {
        method: 'password',
      },
    );
    return { accessToken, tokenType: 'Bearer' as const, expiresIn, user };
  }
}
