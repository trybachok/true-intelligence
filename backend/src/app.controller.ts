import { Public } from '@nestjs/authentication';
import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { rejectUnexpectedInput } from './http/reject-unexpected-input.js';
import { AppService } from './app.service.js';

@Public()
@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(@Req() request: Pick<Request, 'headers' | 'query'>): string {
    rejectUnexpectedInput(request);
    return this.appService.getHello();
  }

  @Get('health')
  checkHealth(
    @Req() request: Pick<Request, 'headers' | 'query'>,
  ): Promise<{ status: 'ok' }> {
    rejectUnexpectedInput(request);
    return this.appService.checkDatabase();
  }
}
