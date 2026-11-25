import { Controller, Get, Header, Req } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { rejectRequestBody } from '../http/reject-request-body.js';
import { parseAnalyticsQuery } from './analytics-query.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @Can.Anyone()
  @Header('Cache-Control', 'no-store')
  getReport(@CurrentUser() user: AuthUser, @Req() request: Request) {
    rejectRequestBody(request);
    return this.analytics.report(user, parseAnalyticsQuery(request.query));
  }
}
