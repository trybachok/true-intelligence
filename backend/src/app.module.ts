import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

const { ObserveModule, ObserveInstrument } = createObserveModule();
const appKey = process.env.OBSERVE_APP_KEY;
const appSecret = process.env.OBSERVE_APP_SECRET;
const observe =
  appKey && appSecret
    ? ObserveModule.forRoot({
        appKey,
        appSecret,
        runtimeMetrics: !process.versions?.['webcontainer'],
        serviceId: 'nest-typescript-starter',
      })
    : undefined;

export const observeInstrument = observe ? ObserveInstrument : undefined;

@Module({
  imports: observe ? [observe] : [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
