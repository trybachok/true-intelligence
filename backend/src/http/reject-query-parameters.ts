import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import Joi from 'joi';

const emptyQuerySchema = Joi.object({}).required();

export function rejectQueryParameters(request: Pick<Request, 'query'>) {
  const { error } = emptyQuerySchema.validate(request.query, {
    convert: false,
  });
  if (error) throw new BadRequestException();
}
