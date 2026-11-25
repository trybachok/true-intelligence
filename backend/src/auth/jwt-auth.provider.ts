import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import { resourceIdSchema } from '../http/resource-id.schema.js';
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
    const { error, value: id } = resourceIdSchema
      .required()
      .validate(sub, { convert: false });
    if (error || String(id) !== sub) return null;

    return this.users.findUser(id);
  }
}
