import { BadRequestException } from '@nestjs/common';
import Joi from 'joi';
import {
  reportDateSchema,
  validateReportPeriod,
} from '../http/report-period.schema.js';
import { resourceIdSchema } from '../http/resource-id.schema.js';

export type AnalyticsQuery = {
  from: string;
  to: string;
  companyId?: number;
  branchId?: number;
};

const querySchema = Joi.object<AnalyticsQuery>({
  from: reportDateSchema.required(),
  to: reportDateSchema.required(),
  companyId: resourceIdSchema,
  branchId: resourceIdSchema,
})
  .custom(validateReportPeriod<AnalyticsQuery>)
  .required();

export function parseAnalyticsQuery(query: unknown): AnalyticsQuery {
  const { error, value } = querySchema.validate(query, { convert: false });
  if (error) throw new BadRequestException();
  return value;
}
