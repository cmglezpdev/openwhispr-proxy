import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { assertProviderModelFormat } from 'src/common/provider-model.validator';
import { AudioService } from './audio.service';

@Controller('audio')
export class AudioController {
  private readonly logger = new Logger(AudioController.name);

  constructor(private readonly audioService: AudioService) {}

  @Post('transcriptions')
  @UseInterceptors(AnyFilesInterceptor())
  async transcribe(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Record<string, string>,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const file = files?.[0];
    if (!file) {
      throw new BadRequestException('No audio file provided');
    }

    const model = body.model;
    const apiKey = authorization?.replace(/^Bearer\s+/i, '');

    if (!model) {
      throw new BadRequestException('Model is required');
    }

    assertProviderModelFormat(model, 'openai/whisper-1');

    if (!apiKey) {
      throw new BadRequestException('API key is required');
    }

    this.logger.log(
      `Incoming transcription request: model=${model}, file=${file.originalname}`,
    );

    return this.audioService.transcribe(file, model, apiKey);
  }
}
