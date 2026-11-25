import {
  BadGatewayException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { CompaniesService } from '../companies/companies.service.js';
import {
  STATISTICS_SOURCE,
  type StatisticsSource,
} from './statistics-source.js';
import {
  type ImportRequest,
  validateMetrics,
} from './statistics-validation.js';

const sourceTimeoutMs = 2_000;

function upstreamError() {
  return new BadGatewayException({
    statusCode: 502,
    code: 'UPSTREAM_ERROR',
    message: 'Не удалось получить статистику',
  });
}

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    private readonly database: DataSource,
    private readonly companies: CompaniesService,
    @Inject(STATISTICS_SOURCE) private readonly source: StatisticsSource,
  ) {}

  async import(user: AuthUser, input: ImportRequest) {
    await this.companies.requireReadableBranch(user, input.branchId);
    const data = await this.fetchMetrics(input);
    const metrics = validateMetrics(data, input);
    if (!metrics) {
      this.logger.warn('Источник вернул некорректную статистику');
      throw upstreamError();
    }
    if (metrics.length === 0) return { processedDays: 0 };

    await this.database.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO daily_metrics (branch_id, metric_date, card_views, website_clicks, calls, route_requests)
         SELECT "branchId", date, "cardViews", "websiteClicks", calls, "routeRequests"
         FROM jsonb_to_recordset($1::jsonb) AS metric(
           "branchId" integer, date date, "cardViews" integer, "websiteClicks" integer,
           calls integer, "routeRequests" integer
         )
         ORDER BY date
         ON CONFLICT (branch_id, metric_date) DO UPDATE SET
           card_views = EXCLUDED.card_views,
           website_clicks = EXCLUDED.website_clicks,
           calls = EXCLUDED.calls,
           route_requests = EXCLUDED.route_requests`,
        [JSON.stringify(metrics)],
      );
    });

    return { processedDays: metrics.length };
  }

  private async fetchMetrics(input: ImportRequest): Promise<unknown> {
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new DOMException('Source timeout', 'TimeoutError')),
        sourceTimeoutMs,
      );
    });
    try {
      return await Promise.race([this.source.fetchMetrics(input), deadline]);
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        this.logger.warn('Истекло время ожидания источника статистики');
        throw new GatewayTimeoutException({
          statusCode: 504,
          code: 'UPSTREAM_TIMEOUT',
          message: 'Источник статистики не ответил вовремя',
        });
      }
      this.logger.warn('Ошибка получения статистики из источника');
      throw upstreamError();
    } finally {
      clearTimeout(timer);
    }
  }
}
