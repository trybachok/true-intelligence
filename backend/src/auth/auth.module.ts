import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { ApiErrorFilter } from './api-error.filter.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CompanyAccessPolicy } from './company-access.policy.js';
import { JwtAuthProvider } from './jwt-auth.provider.js';
import { UsersRepository } from './users.repository.js';

@Module({
  imports: [
    AuthenticationModule.forRootAsync({
      useFactory: () => {
        const key = process.env.JWT_SECRET;
        if (!key || Buffer.byteLength(key) < 32) {
          throw new Error('JWT_SECRET must be at least 32 bytes');
        }
        return {
          accessToken: { key, ttl: '15m', issuer: 'true-intelligence' },
          refreshToken: false as const,
        };
      },
    }),
    AuthorizationModule.forRoot(),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    JwtAuthProvider,
    CompanyAccessPolicy,
    { provide: APP_FILTER, useClass: ApiErrorFilter },
  ],
})
export class AuthModule {}
