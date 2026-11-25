import { BadRequestException } from '@nestjs/common';
import Joi from 'joi';
import { resourceIdSchema } from '../http/resource-id.schema.js';

export type AnalyticsQuery = {
  from: string;
  to: string;
  companyId?: number;
  branchId?: number;
};

const date = Joi.string()
  .pattern(/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  .custom((value: string, helpers) => {
    const parsed = new Date(value + 'T00:00:00Z');
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      return helpers.error('date.format');
    }
    return value;
  })
  .required();

const querySchema = Joi.object<AnalyticsQuery>({
  from: date,
  to: date,
  companyId: resourceIdSchema,
  branchId: resourceIdSchema,
}).required();

export function parseAnalyticsQuery(query: unknown): AnalyticsQuery {
  const { error, value } = querySchema.validate(query, { convert: false });
  if (error || value.from > value.to) throw new BadRequestException();
  return value;
}
