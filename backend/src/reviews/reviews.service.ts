import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { CompaniesService } from '../companies/companies.service.js';
import type { ReviewsQuery, ReviewStatus } from './reviews-query.js';

type Review = {
  id: number;
  branchId: number;
  publishedAt: Date;
  rating: number;
  body: string;
  status: ReviewStatus;
};

@Injectable()
export class ReviewsService {
  constructor(
    private readonly database: DataSource,
    private readonly companies: CompaniesService,
  ) {}

  async listCompanyReviews(
    user: AuthUser,
    companyId: number,
    query: ReviewsQuery,
  ) {
    await this.companies.requireReadableCompany(user, companyId);
    return this.listReviews({ companyId }, query);
  }

  async listBranchReviews(
    user: AuthUser,
    branchId: number,
    query: ReviewsQuery,
  ) {
    const { companyId } = await this.companies.requireReadableBranch(
      user,
      branchId,
    );
    return this.listReviews({ companyId, branchId }, query);
  }

  private async listReviews(
    { companyId, branchId }: { companyId: number; branchId?: number },
    { rating, status, beforeId, limit }: ReviewsQuery,
  ) {
    const params: (number | string)[] = [companyId, limit + 1];
    const filters = ['b.company_id = $1'];
    if (branchId !== undefined)
      filters.push(`r.branch_id = $${params.push(branchId)}`);
    if (rating !== undefined)
      filters.push(`r.rating = $${params.push(rating)}`);
    if (status !== undefined)
      filters.push(`r.status = $${params.push(status)}`);
    if (beforeId !== undefined)
      filters.push(`r.id < $${params.push(beforeId)}`);

    const rows = await this.database.query<Review[]>(
      `SELECT r.id, r.branch_id AS "branchId", r.published_at AS "publishedAt",
         r.rating, r.body, r.status
       FROM reviews r
       JOIN branches b ON b.id = r.branch_id
       WHERE ${filters.join(' AND ')}
       ORDER BY r.id DESC
       LIMIT $2`,
      params,
    );

    const items = rows.slice(0, limit);
    const nextBeforeId = rows.length > limit ? items[limit - 1].id : null;
    return { items, nextBeforeId };
  }
}
