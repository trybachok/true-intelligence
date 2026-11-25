import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [CompaniesModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
