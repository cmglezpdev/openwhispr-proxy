import { BadGatewayException, Injectable } from '@nestjs/common';
import { createGateway } from '@ai-sdk/gateway';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, transcribe } from 'ai';
import type { JsonObject } from '../../common/types/json-value';
import type { ChatCompletionRequest } from '../../chat/types/chat-completion';
import type { ModelCatalog } from '../../model/types/model-catalog';
import { AiProvider } from '../application/ai-provider';
import type {
  GenerationResult,
  TranscriptionResult,
} from '../application/generation-result';
import {
  isRecord,
  readChatUsage,
  readGatewayMetadata,
} from './gateway-metadata';

@Injectable()
export class VercelAiProvider extends AiProvider {
  async completeChat({
    model,
    messages,
    apiKey,
    options,
  }: ChatCompletionRequest): Promise<GenerationResult> {
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
    return { text: result.text, responseBody, ...readChatUsage(responseBody) };
  }

  async transcribeAudio(
    audio: Buffer,
    model: string,
    apiKey: string,
  ): Promise<TranscriptionResult> {
    const gateway = createGateway({ apiKey });
    const result = await transcribe({
      model: gateway.transcriptionModel(model),
      audio,
    });
    return {
      text: result.text,
      durationInSeconds: result.durationInSeconds,
      responseBody: result,
      ...readGatewayMetadata(result.providerMetadata),
    };
  }

  listModels(apiKey: string): Promise<ModelCatalog> {
    return createGateway({ apiKey }).getAvailableModels();
  }
}
