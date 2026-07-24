import { Module } from '@nestjs/common';
import { AudioController } from './audio/audio.controller';
import { UsageRepository } from './usage/usage.repository';
import { AudioService } from './audio/audio.service';
import { ModelsController } from './model/models.controller';

@Module({
  imports: [],
  controllers: [AudioController, ModelsController],
  providers: [AudioService, UsageRepository],
})
export class AppModule {}
