import { Module } from '@nestjs/common';
import { AudioController } from './audio/audio.controller';
import { UsageRepository } from './usage/usage.repository';
import { AudioService } from './audio/audio.service';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { ModelsController } from './model/models.controller';

@Module({
  imports: [],
  controllers: [AudioController, ModelsController, ChatController],
  providers: [AudioService, ChatService, UsageRepository],
})
export class AppModule {}
