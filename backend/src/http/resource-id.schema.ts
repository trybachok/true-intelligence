import { BadRequestException } from '@nestjs/common';
import Joi from 'joi';

export const maxPostgresInteger = 2_147_483_647;

export function decimalIntegerSchema(max: number) {
  return Joi.string<number>()
    .pattern(/^[0-9]+$/)
    .custom((value: string, helpers) => {
      const number = Number(value);
      if (number < 1) return helpers.error('number.min', { limit: 1 });
      if (number > max) return helpers.error('number.max', { limit: max });
      return number;
    });
}

export const resourceIdSchema = decimalIntegerSchema(maxPostgresInteger);

export function parseResourceId(value: unknown): number {
  const { error, value: id } = resourceIdSchema.required().validate(value, {
    convert: false,
  });
  if (error) throw new BadRequestException();
  return id;
}
