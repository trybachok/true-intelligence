import {
  BadRequestException,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import type { Request } from 'express';
import Joi from 'joi';
import { rejectQueryParameters } from '../http/reject-query-parameters.js';
import { requireJson } from '../http/require-json.js';
import { AuthService } from './auth.service.js';

type LoginRequest = { email: string; password: string };

const loginSchema = Joi.object<LoginRequest>({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(254)
    .required(),
  password: Joi.string()
    .custom((password: string, helpers) =>
      Array.from(password).length <= 1024
        ? password
        : helpers.error('string.max', { limit: 1024 }),
    )
    .required(),
}).required();

@Public()
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(@Req() request: Request) {
    requireJson(request);

    const { error, value } = loginSchema.validate(request.body, {
      convert: false,
    });
    if (error) throw new BadRequestException();
    rejectQueryParameters(request);

    const result = await this.auth.login(value.email, value.password);
    if (!result) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль',
      });
    }
    return result;
  }
}
