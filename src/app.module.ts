import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { static as serveStatic } from 'express';
import { resolve } from 'node:path';
import { AiProvider } from './ai/application/ai-provider';
import { VercelAiProvider } from './ai/infrastructure/vercel-ai.provider';
import { UsageRecorder } from './usage/domain/usage-recorder';
import { AudioController } from './audio/audio.controller';
import { UsageRepository } from './usage/usage.repository';
import { AudioService } from './audio/audio.service';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { EnvService } from './config/env.service';
import { ModelsController } from './model/models.controller';
import { DashboardController } from './dashboard/http/dashboard.controller';
import { UsageHistory } from './usage/domain/usage-request';
import { GetUsageHistory } from './usage/application/get-usage-history';

@Module({
  imports: [],
  controllers: [
    AudioController,
    ModelsController,
    ChatController,
    DashboardController,
  ],
  providers: [
    { provide: AiProvider, useClass: VercelAiProvider },
    { provide: UsageRecorder, useExisting: UsageRepository },
    AudioService,
    ChatService,
    EnvService,
    UsageRepository,
    GetUsageHistory,
    { provide: UsageHistory, useExisting: UsageRepository },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        serveStatic(resolve(process.cwd(), 'dashboard/dist'), {
          index: false,
          redirect: false,
        }),
      )
      .forRoutes('dashboard');
  }
}
