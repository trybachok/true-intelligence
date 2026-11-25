import { BadRequestException } from '@nestjs/common';
import Joi from 'joi';
import {
  reportDateSchema,
  validateReportPeriod,
} from '../http/report-period.schema.js';
import { maxPostgresInteger } from '../http/resource-id.schema.js';

export type ImportRequest = { branchId: number; from: string; to: string };

export type DailyMetric = {
  branchId: number;
  date: string;
  cardViews: number;
  websiteClicks: number;
  calls: number;
  routeRequests: number;
};

const branchId = Joi.number()
  .integer()
  .min(1)
  .max(maxPostgresInteger)
  .required();
const counter = Joi.number()
  .integer()
  .min(0)
  .max(maxPostgresInteger)
  .required();

const importRequestSchema = Joi.object<ImportRequest>({
  branchId,
  from: reportDateSchema.required(),
  to: reportDateSchema.required(),
})
  .custom(validateReportPeriod<ImportRequest>)
  .required();

const sourceMetricsSchema = Joi.array<DailyMetric[]>()
  .items(
    Joi.object<DailyMetric>({
      branchId,
      date: reportDateSchema.required(),
      cardViews: counter,
      websiteClicks: counter,
      calls: counter,
      routeRequests: counter,
    }),
  )
  .unique('date')
  .required();

export function parseImportRequest(body: unknown): ImportRequest {
  const { error, value } = importRequestSchema.validate(body, {
    convert: false,
  });
  if (error) throw new BadRequestException();
  return value;
}

export function validateMetrics(
  data: unknown,
  { branchId, from, to }: ImportRequest,
) {
  const { error, value } = sourceMetricsSchema.validate(data, {
    convert: false,
  });
  if (
    error ||
    value.some(
      (metric) =>
        metric.branchId !== branchId || metric.date < from || metric.date > to,
    )
  ) {
    return null;
  }
  return value;
}
