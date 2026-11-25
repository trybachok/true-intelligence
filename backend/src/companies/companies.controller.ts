import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Req,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { CompaniesService } from './companies.service.js';

function rejectUnexpectedInput(request: Request) {
  if (
    Object.keys(request.query).length ||
    Number(request.headers['content-length']) > 0 ||
    request.headers['transfer-encoding']
  ) {
    throw new BadRequestException();
  }
}

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
    const id = Number(companyId);
    if (!/^[0-9]+$/.test(companyId) || id < 1 || id > 2147483647) {
      throw new BadRequestException();
    }

    return this.companies.listBranches(user, id);
  }
}
