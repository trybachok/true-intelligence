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
import { rejectQueryParameters } from '../http/reject-query-parameters.js';
import { rejectRequestBody } from '../http/reject-request-body.js';
import { resourceIdSchema } from '../http/resource-id.schema.js';
import { CompaniesService } from './companies.service.js';

function rejectUnexpectedInput(request: Request) {
  rejectRequestBody(request);
  rejectQueryParameters(request);
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
    const { error, value: id } = resourceIdSchema
      .required()
      .validate(companyId, { convert: false });
    if (error) throw new BadRequestException();

    return this.companies.listBranches(user, id);
  }
}
