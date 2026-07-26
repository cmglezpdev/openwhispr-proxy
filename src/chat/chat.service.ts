import { Injectable } from '@nestjs/common';
import { generateText, JSONValue } from 'ai';
import { UsageRepository } from 'src/usage/usage.repository';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ChatCompletionOptions {
  maxCompletionTokens?: number;
  reasoningEffort?: string;
  chatTemplateKwargs?: Record<string, JSONValue>;
}

@Injectable()
export class ChatService {
  constructor(private readonly usageRepo: UsageRepository) {}

  async generateCompletion(
    model: string,
    messages: ChatMessage[],
    apiKey: string,
    options: ChatCompletionOptions = {},
  ): Promise<Awaited<ReturnType<typeof generateText>>> {
    process.env.AI_GATEWAY_API_KEY = apiKey;
    const { maxCompletionTokens, reasoningEffort, chatTemplateKwargs } =
      options;

    const gatewayOptions: Record<string, JSONValue> = {};
    if (maxCompletionTokens !== undefined) {
      gatewayOptions.maxCompletionTokens = maxCompletionTokens;
    }
    if (reasoningEffort !== undefined) {
      gatewayOptions.reasoningEffort = reasoningEffort;
    }
    if (chatTemplateKwargs !== undefined) {
      gatewayOptions.chat_template_kwargs = chatTemplateKwargs;
    }

    const startedAt = performance.now();
    const result = await generateText({
      model,
      messages,
      allowSystemInMessages: true,
      ...(Object.keys(gatewayOptions).length > 0 && {
        providerOptions: { gateway: gatewayOptions },
      }),
    });
    const latencyMs = Math.round(performance.now() - startedAt);

    const { text, steps } = result;
    const finalStep = steps.at(-1);
    const costUsd =
      (finalStep?.providerMetadata?.gateway?.cost as string) ?? null;
    const generationId =
      (finalStep?.providerMetadata?.gateway?.generationId as string) ?? null;

    this.usageRepo.saveEnhancedTranscription({
      model,
      text,
      latencyMs,
      costUsd,
      generationId,
    });

    return result;
  }
}
