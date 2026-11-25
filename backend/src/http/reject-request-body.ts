import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

export function rejectRequestBody(request: Pick<Request, 'headers'>) {
  if (
    Number(request.headers['content-length']) > 0 ||
    request.headers['transfer-encoding']
  ) {
    throw new BadRequestException();
  }
}
