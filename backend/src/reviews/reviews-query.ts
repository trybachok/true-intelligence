import { BadRequestException } from '@nestjs/common';
import Joi from 'joi';
import {
  decimalIntegerSchema,
  resourceIdSchema,
} from '../http/resource-id.schema.js';

export type ReviewStatus = 'pending' | 'processed';

export type ReviewsQuery = {
  rating?: number;
  status?: ReviewStatus;
  beforeId?: number;
  limit: number;
};

const reviewsQuerySchema = Joi.object<ReviewsQuery>({
  rating: decimalIntegerSchema(5),
  status: Joi.string().valid('pending', 'processed'),
  beforeId: resourceIdSchema,
  limit: decimalIntegerSchema(100).default(20),
}).required();

export function parseReviewsQuery(query: unknown): ReviewsQuery {
  const { error, value } = reviewsQuerySchema.validate(query, {
    convert: false,
  });
  if (error) throw new BadRequestException();
  return value;
}
