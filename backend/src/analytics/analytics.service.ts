import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { CompaniesService } from '../companies/companies.service.js';
import type { AnalyticsQuery } from './analytics-query.js';

type ReportRow = {
  cardViews: string;
  websiteClicks: string;
  calls: string;
  routeRequests: string;
  averageRating: number | null;
  reviewCount: string;
  dailyCardViews: { date: string; cardViews: string }[];
};

function count(value: string) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error('Analytics count is outside the safe integer range');
  }
  return result;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly database: DataSource,
    private readonly companies: CompaniesService,
  ) {}

  async report(
    user: AuthUser,
    { from, to, companyId, branchId }: AnalyticsQuery,
  ) {
    if (companyId !== undefined)
      await this.companies.requireReadableCompany(user, companyId);
    if (branchId !== undefined) {
      const branch = await this.companies.requireReadableBranch(user, branchId);
      if (companyId !== undefined && branch.companyId !== companyId) {
        throw new BadRequestException();
      }
    }

    const companyScope = user.role === 'client' ? user.companyId : companyId;
    const params: (number | string)[] = [from, to];
    const predicates: string[] = [];
    if (companyScope !== undefined) {
      predicates.push(`b.company_id = $${params.push(companyScope)}`);
    }
    if (branchId !== undefined) {
      predicates.push(`b.id = $${params.push(branchId)}`);
    }
    const scope = predicates.length ? `WHERE ${predicates.join(' AND ')}` : '';

    const [row] = await this.database.query<ReportRow[]>(
      `WITH scoped_branches AS NOT MATERIALIZED (
         SELECT b.id FROM branches b ${scope}
       ), daily_metrics_summary AS (
         SELECT m.metric_date, SUM(m.card_views) AS card_views,
           SUM(m.website_clicks) AS website_clicks, SUM(m.calls) AS calls,
           SUM(m.route_requests) AS route_requests
         FROM daily_metrics m JOIN scoped_branches b ON b.id = m.branch_id
         WHERE m.metric_date BETWEEN $1::date AND $2::date
         GROUP BY m.metric_date
       ), review_summary AS (
         SELECT ROUND(AVG(r.rating), 2)::double precision AS average_rating,
           COUNT(*)::text AS review_count
         FROM reviews r JOIN scoped_branches b ON b.id = r.branch_id
         WHERE r.published_at >= ($1::date::timestamp AT TIME ZONE 'UTC')
           AND r.published_at < (($2::date + 1)::timestamp AT TIME ZONE 'UTC')
       )
       SELECT COALESCE(SUM(m.card_views), 0)::text AS "cardViews",
         COALESCE(SUM(m.website_clicks), 0)::text AS "websiteClicks",
         COALESCE(SUM(m.calls), 0)::text AS "calls",
         COALESCE(SUM(m.route_requests), 0)::text AS "routeRequests",
         (SELECT average_rating FROM review_summary) AS "averageRating",
         (SELECT review_count FROM review_summary) AS "reviewCount",
         JSON_AGG(JSON_BUILD_OBJECT(
           'date', TO_CHAR($1::date + day_offset, 'YYYY-MM-DD'),
           'cardViews', COALESCE(m.card_views, 0)::text
         ) ORDER BY day_offset) AS "dailyCardViews"
       FROM GENERATE_SERIES(0, $2::date - $1::date) AS days(day_offset)
       LEFT JOIN daily_metrics_summary m ON m.metric_date = $1::date + day_offset`,
      params,
    );

    return {
      totals: {
        cardViews: count(row.cardViews),
        websiteClicks: count(row.websiteClicks),
        calls: count(row.calls),
        routeRequests: count(row.routeRequests),
        averageRating: row.averageRating,
        reviewCount: count(row.reviewCount),
      },
      dailyCardViews: row.dailyCardViews.map(({ date, cardViews }) => ({
        date,
        cardViews: count(cardViews),
      })),
    };
  }
}
