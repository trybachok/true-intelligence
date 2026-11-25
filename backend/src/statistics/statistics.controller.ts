import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { rejectQueryParameters } from '../http/reject-query-parameters.js';
import { requireJson } from '../http/require-json.js';
import { StatisticsAccessPolicy } from './statistics-access.policy.js';
import { StatisticsService } from './statistics.service.js';
import { parseImportRequest } from './statistics-validation.js';

@Controller('api/statistics')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Post('imports')
  @HttpCode(200)
  @Can(StatisticsAccessPolicy, 'import')
  import(@CurrentUser() user: AuthUser, @Req() request: Request) {
    requireJson(request);
    rejectQueryParameters(request);
    return this.statistics.import(user, parseImportRequest(request.body));
  }
}
