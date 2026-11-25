import { Injectable } from '@nestjs/common';
import type { DailyMetric, ImportRequest } from './statistics-validation.js';

export const STATISTICS_SOURCE = 'STATISTICS_SOURCE';

export interface StatisticsSource {
  fetchMetrics(input: ImportRequest): Promise<unknown>;
}

const demoFrom = '2026-10-26';
const demoTo = '2026-11-24';

@Injectable()
export class SimulatedStatisticsSource implements StatisticsSource {
  async fetchMetrics({
    branchId,
    from,
    to,
  }: ImportRequest): Promise<DailyMetric[]> {
    const start = from > demoFrom ? from : demoFrom;
    const end = to < demoTo ? to : demoTo;
    if (start > end) return [];

    const metrics: DailyMetric[] = [];
    const day = new Date(start + 'T00:00:00Z');
    const lastDay = new Date(end + 'T00:00:00Z');
    while (day <= lastDay) {
      const offset = (branchId % 31) + day.getUTCDate();
      metrics.push({
        branchId,
        date: day.toISOString().slice(0, 10),
        cardViews: 100 + offset,
        websiteClicks: 15 + (offset % 10),
        calls: offset % 8,
        routeRequests: 5 + (offset % 12),
      });
      day.setUTCDate(day.getUTCDate() + 1);
    }
    return metrics;
  }
}
