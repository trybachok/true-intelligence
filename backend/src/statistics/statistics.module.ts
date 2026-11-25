import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module.js';
import { StatisticsAccessPolicy } from './statistics-access.policy.js';
import { StatisticsController } from './statistics.controller.js';
import { StatisticsService } from './statistics.service.js';
import {
  SimulatedStatisticsSource,
  STATISTICS_SOURCE,
} from './statistics-source.js';

@Module({
  imports: [CompaniesModule],
  controllers: [StatisticsController],
  providers: [
    StatisticsAccessPolicy,
    StatisticsService,
    { provide: STATISTICS_SOURCE, useClass: SimulatedStatisticsSource },
  ],
})
export class StatisticsModule {}
