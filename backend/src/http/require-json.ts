import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { Request } from 'express';

export function requireJson(request: Request) {
  const mediaType = request
    .get('Content-Type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== undefined && mediaType !== 'application/json') {
    throw new UnsupportedMediaTypeException();
  }
}
