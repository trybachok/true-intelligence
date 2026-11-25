import type { Request } from 'express';
import { rejectQueryParameters } from './reject-query-parameters.js';
import { rejectRequestBody } from './reject-request-body.js';

export function rejectUnexpectedInput(
  request: Pick<Request, 'headers' | 'query'>,
) {
  rejectRequestBody(request);
  rejectQueryParameters(request);
}
