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
  ): Promise<any> {
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

    const promptSummary = messages
      .map((message) => {
        const preview = message.content?.slice(0, 100) ?? '';
        return `${message.role}: ${preview}`;
      })
      .join(' | ');

    this.logger.log(
      `Incoming chat completion request: model=${model}, messages=${messages.length} [${promptSummary}]`,
    );

    return this.chatService.generateCompletion(model, messages, apiKey, {
      maxCompletionTokens: body.max_completion_tokens,
      reasoningEffort: body.reasoning_effort,
      chatTemplateKwargs: body.chat_template_kwargs,
    });
  }
}
