import { Injectable } from '@nestjs/common';
import { transcribe } from 'ai';
import { UsageRepository } from 'src/usage/usage.repository';

@Injectable()
export class AudioService {
  constructor(private readonly transcriptionsRepo: UsageRepository) {}

  async transcribe(file: Express.Multer.File, model: string, apiKey: string) {
    process.env.AI_GATEWAY_API_KEY = apiKey;
    const startedAt = performance.now();

    const result = await transcribe({
      model,
      audio: file.buffer,
    });
    const latencyMs = Math.round(performance.now() - startedAt);

    const { text, durationInSeconds, providerMetadata } = result;
    const costUsd = providerMetadata.gateway.cost as string;
    const generationId = providerMetadata.gateway.generationId as string;
    const durationSeconds = Number(durationInSeconds);

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
