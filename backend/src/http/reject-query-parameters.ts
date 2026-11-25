import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

export function rejectQueryParameters(request: Request) {
  if (Object.keys(request.query).length) throw new BadRequestException();
}
