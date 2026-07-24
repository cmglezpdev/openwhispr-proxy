import { Module } from '@nestjs/common';
import { AudioController } from './audio/audio.controller';
import { UsageRepository } from './usage/usage.repository';
import { AudioService } from './audio/audio.service';

@Module({
  imports: [],
  controllers: [AudioController],
  providers: [AudioService, UsageRepository],
})
export class AppModule {}
