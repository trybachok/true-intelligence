import {
  type ArgumentsHost,
  Catch,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';

const errors = {
  400: { code: 'VALIDATION_ERROR', message: 'Проверьте параметры запроса' },
  401: { code: 'UNAUTHENTICATED', message: 'Требуется вход в систему' },
  403: { code: 'FORBIDDEN', message: 'Доступ запрещён' },
  415: {
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'Требуется тело в формате JSON',
  },
  500: { code: 'INTERNAL_ERROR', message: 'Не удалось выполнить запрос' },
} as const;

@Catch()
@Injectable()
export class ApiErrorFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  constructor(@Inject(HttpAdapterHost) adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const error = errors[statusCode as keyof typeof errors];
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();

    if (!error || response.headersSent) {
      super.catch(exception, host);
      return;
    }

    const request = http.getRequest<Request>();
    const details =
      exception instanceof HttpException ? exception.getResponse() : null;
    const body =
      typeof details === 'object' && details !== null && 'code' in details
        ? details
        : error;

    if (statusCode === 401 && !response.hasHeader('WWW-Authenticate')) {
      response.setHeader('WWW-Authenticate', 'Bearer');
    }
    if (statusCode === 500) {
      this.logger.error(
        `Ошибка обработки запроса ${request.method} ${request.route?.path ?? '/api'}`,
      );
    }
    response.status(statusCode).json({ ...body, statusCode });
  }
}
