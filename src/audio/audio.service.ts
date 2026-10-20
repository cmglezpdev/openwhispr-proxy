import { Injectable } from '@nestjs/common';
import { AiProvider } from '../ai/application/ai-provider';
import { UsageRecorder } from '../usage/domain/usage-recorder';
import { getAudioDurationSeconds } from './audio-duration';

@Injectable()
export class AudioService {
  constructor(
    private readonly provider: AiProvider,
    private readonly usage: UsageRecorder,
  ) {}

  async transcribe(
    audio: Buffer,
    model: string,
    apiKey: string,
  ): Promise<unknown> {
    const startedAt = performance.now();
    const result = await this.provider.transcribeAudio(audio, model, apiKey);
    const durationSeconds =
      result.durationInSeconds !== undefined && result.durationInSeconds > 0
        ? result.durationInSeconds
        : getAudioDurationSeconds(audio);
    this.usage.saveTranscription({
      model,
      text: result.text,
      durationSeconds,
      costUsd: result.costUsd,
      generationId: result.generationId,
      latencyMs: Math.round(performance.now() - startedAt),
    });
    return result.responseBody;
  }
}
