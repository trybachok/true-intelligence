import { Controller, Get, Param, Req } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { rejectRequestBody } from '../http/reject-request-body.js';
import { parseResourceId } from '../http/resource-id.schema.js';
import { parseReviewsQuery } from './reviews-query.js';
import { ReviewsService } from './reviews.service.js';

@Controller('api/companies')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get(':companyId/reviews')
  @Can.Anyone()
  listCompanyReviews(
    @CurrentUser() user: AuthUser,
    @Param('companyId') companyId: string,
    @Req() request: Request,
  ) {
    rejectRequestBody(request);
    return this.reviews.listCompanyReviews(
      user,
      parseResourceId(companyId),
      parseReviewsQuery(request.query),
    );
  }
}
