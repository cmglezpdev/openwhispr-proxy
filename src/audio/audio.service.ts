import { Injectable } from '@nestjs/common';
import { createGateway } from '@ai-sdk/gateway';
import { transcribe } from 'ai';
import { UsageRepository } from 'src/usage/usage.repository';
import { getAudioDurationSeconds } from './audio-duration';

@Injectable()
export class AudioService {
  constructor(private readonly transcriptionsRepo: UsageRepository) {}

  async transcribe(file: Express.Multer.File, model: string, apiKey: string) {
    const gateway = createGateway({ apiKey });
    const startedAt = performance.now();

    const result = await transcribe({
      model: gateway.transcriptionModel(model),
      audio: file.buffer,
    });
    const latencyMs = Math.round(performance.now() - startedAt);

    const { text, durationInSeconds, providerMetadata } = result;
    const costUsd = (providerMetadata?.gateway?.cost as string) ?? null;
    const generationId =
      (providerMetadata?.gateway?.generationId as string) ?? null;
    const durationSeconds =
      Number(durationInSeconds) > 0
        ? Number(durationInSeconds)
        : getAudioDurationSeconds(file.buffer);

    this.transcriptionsRepo.saveTranscription({
      model,
      text,
      durationSeconds,
      latencyMs,
      costUsd,
      generationId,
    });

    return result;
  }
}
