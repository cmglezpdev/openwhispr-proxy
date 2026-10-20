import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Post,
} from '@nestjs/common';
import { JSONValue } from 'ai';
import { assertProviderModelFormat } from 'src/common/provider-model.validator';
import { ChatMessage, ChatService } from './chat.service';

interface ChatCompletionsBody {
  model?: string;
  messages?: ChatMessage[];
  max_completion_tokens?: number;
  reasoning_effort?: string;
  chat_template_kwargs?: Record<string, JSONValue>;
}

@Controller('v1/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post('completions')
  async completions(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ChatCompletionsBody,
  ) {
    const model = body.model;
    const messages = body.messages;
    const apiKey = authorization?.replace(/^Bearer\s+/i, '');

    if (!model) {
      throw new BadRequestException('Model is required');
    }

    assertProviderModelFormat(model, 'openai/gpt-4o-mini');

    if (!apiKey) {
      throw new BadRequestException('API key is required');
    }

    if (!messages || messages.length === 0) {
      throw new BadRequestException('Messages are required');
    }

    this.logger.log(
      `Incoming chat completion request: model=${model}, messages=${messages.length}`,
    );

    const result = await this.chatService.generateCompletion(
      model,
      messages,
      apiKey,
      {
        maxCompletionTokens: body.max_completion_tokens,
        reasoningEffort: body.reasoning_effort,
        chatTemplateKwargs: body.chat_template_kwargs,
      },
    );

    // OpenWhispr reads the OpenAI wire format, not the AI SDK result object.
    const finishReason = {
      stop: 'stop',
      length: 'length',
      'content-filter': 'content_filter',
      'tool-calls': 'tool_calls',
      error: null,
      other: null,
    }[result.finishReason];

    return {
      id: result.finalStep.response?.id ?? `chatcmpl-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(
        (result.finalStep.response?.timestamp?.getTime() ?? Date.now()) / 1000,
      ),
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: result.text },
          finish_reason: finishReason ?? null,
        },
      ],
      ...(result.usage && {
        usage: {
          prompt_tokens: result.usage.inputTokens,
          completion_tokens: result.usage.outputTokens,
          total_tokens: result.usage.totalTokens,
        },
      }),
    };
  }
}
