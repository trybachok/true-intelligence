import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import type { AuthUser } from './auth-user.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class JwtAuthProvider extends JwtBearerProvider<AuthUser> {
  constructor(
    private readonly users: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  validate({ sub }: JwtClaims) {
    if (!sub || !/^[1-9][0-9]*$/.test(sub)) return null;

    const id = Number(sub);
    return id <= 2147483647 ? this.users.findUser(id) : null;
  }
}
