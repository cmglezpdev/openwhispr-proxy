import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Post,
} from '@nestjs/common';
import { assertProviderModelFormat } from 'src/common/provider-model.validator';
import { ChatService } from './chat.service';
import type { ChatCompletionsBody } from './http/chat-completions.body';

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

    if (!model) {
      throw new BadRequestException('Model is required');
    }

    assertProviderModelFormat(model, 'openai/gpt-4o-mini');

    const apiKey = authorization?.replace(/^Bearer\s+/i, '');
    if (!apiKey) throw new BadRequestException('API key is required');

    if (!messages || messages.length === 0) {
      throw new BadRequestException('Messages are required');
    }

    this.logger.log(
      `Incoming chat completion request: model=${model}, messages=${messages.length}`,
    );

    return this.chatService.generateCompletion(model, messages, apiKey, {
      maxCompletionTokens: body.max_completion_tokens,
      reasoningEffort: body.reasoning_effort,
      chatTemplateKwargs: body.chat_template_kwargs,
    });
  }
}
