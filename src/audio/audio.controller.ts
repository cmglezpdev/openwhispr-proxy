import { requireApiKey } from '../common/http/authorization';
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
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 100 * 1024 * 1024,
        files: 1,
        fields: 16,
        fieldSize: 1024 * 1024,
        parts: 18,
      },
    }),
  )
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

    if (!model) {
      throw new BadRequestException('Model is required');
    }

    assertProviderModelFormat(model, 'openai/whisper-1');

    const apiKey = requireApiKey(authorization);

    this.logger.log(
      `Incoming transcription request: model=${model}, bytes=${file.size}`,
    );

    return this.audioService.transcribe(file.buffer, model, apiKey);
  }
}
