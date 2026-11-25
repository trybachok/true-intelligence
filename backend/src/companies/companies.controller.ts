import { Controller, Get, Param, Req } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { rejectUnexpectedInput } from '../http/reject-unexpected-input.js';
import { parseResourceId } from '../http/resource-id.schema.js';
import { CompaniesService } from './companies.service.js';

@Can.Anyone()
@Controller('api/companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Req() request: Request) {
    rejectUnexpectedInput(request);
    return this.companies.list(user);
  }

  @Get(':companyId/branches')
  listBranches(
    @CurrentUser() user: AuthUser,
    @Param('companyId') companyId: string,
    @Req() request: Request,
  ) {
    rejectUnexpectedInput(request);
    return this.companies.listBranches(user, parseResourceId(companyId));
  }
}
