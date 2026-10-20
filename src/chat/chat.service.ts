import { BadGatewayException, Injectable } from '@nestjs/common';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import type { JsonObject } from '../common/types/json-value';
import { UsageRepository } from '../usage/usage.repository';
import { isRecord, readChatUsage } from '../ai/infrastructure/gateway-metadata';
import type {
  ChatMessage,
  ChatCompletionOptions,
} from './types/chat-completion';

@Injectable()
export class ChatService {
  constructor(private readonly usageRepo: UsageRepository) {}

  async generateCompletion(
    model: string,
    messages: ChatMessage[],
    apiKey: string,
    options: ChatCompletionOptions = {},
  ): Promise<unknown> {
    const startedAt = performance.now();
    const gateway = createOpenAICompatible({
      name: 'gateway',
      apiKey,
      baseURL: 'https://ai-gateway.vercel.sh/v1',
    });
    const gatewayOptions: JsonObject = {};
    if (options.maxCompletionTokens !== undefined)
      gatewayOptions.max_completion_tokens = options.maxCompletionTokens;
    if (options.reasoningEffort !== undefined)
      gatewayOptions.reasoningEffort = options.reasoningEffort;
    if (options.chatTemplateKwargs !== undefined)
      gatewayOptions.chat_template_kwargs = options.chatTemplateKwargs;

    const result = await generateText({
      model: gateway(model),
      messages,
      allowSystemInMessages: true,
      include: { responseBody: true },
      ...(Object.keys(gatewayOptions).length > 0 && {
        providerOptions: { gateway: gatewayOptions },
      }),
    });
    const responseBody = result.finalStep.response.body;
    if (!isRecord(responseBody)) {
      throw new BadGatewayException('Gateway response body is missing');
    }
    this.usageRepo.saveEnhancedTranscription({
      model,
      text: result.text,
      ...readChatUsage(responseBody),
      latencyMs: Math.round(performance.now() - startedAt),
    });
    return responseBody;
  }
}
