import { Injectable } from '@nestjs/common';
import { AiProvider } from '../ai/application/ai-provider';
import { UsageRecorder } from '../usage/domain/usage-recorder';
import type {
  ChatCompletionOptions,
  ChatMessage,
} from './types/chat-completion';

@Injectable()
export class ChatService {
  constructor(
    private readonly provider: AiProvider,
    private readonly usage: UsageRecorder,
  ) {}

  async generateCompletion(
    model: string,
    messages: ChatMessage[],
    apiKey: string,
    options: ChatCompletionOptions = {},
  ): Promise<unknown> {
    const startedAt = performance.now();
    const result = await this.provider.completeChat({
      model,
      messages,
      apiKey,
      options,
    });
    this.usage.saveEnhancedTranscription({
      model,
      text: result.text,
      costUsd: result.costUsd,
      generationId: result.generationId,
      latencyMs: Math.round(performance.now() - startedAt),
    });
    return result.responseBody;
  }
}
