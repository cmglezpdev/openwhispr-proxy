import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { assertProviderModelFormat as sdkAssertProviderModelFormat } from 'src/common/provider-model.validator';
import { ChatController } from './chat.controller';
import { ChatMessage, ChatService } from './chat.service';

jest.mock('src/common/provider-model.validator', () => ({
  assertProviderModelFormat: jest.fn(),
}));

const assertProviderModelFormat =
  sdkAssertProviderModelFormat as unknown as jest.Mock;

const messages: ChatMessage[] = [
  { role: 'system', content: 'You are a transcription cleaner.' },
  { role: 'user', content: 'fix   this  text' },
];

describe('ChatController', () => {
  let controller: ChatController;
  let generateCompletion: jest.Mock;

  beforeEach(async () => {
    generateCompletion = jest.fn().mockResolvedValue({ text: 'fix this text' });
    assertProviderModelFormat.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: { generateCompletion } }],
    }).compile();

    controller = moduleRef.get(ChatController);
  });

  it('delegates to the service and returns its result', async () => {
    const result: unknown = await controller.completions('Bearer secret-key', {
      model: 'openai/gpt-4o-mini',
      messages,
    });

    expect(generateCompletion).toHaveBeenCalledWith(
      'openai/gpt-4o-mini',
      messages,
      'secret-key',
      {
        maxCompletionTokens: undefined,
        reasoningEffort: undefined,
        chatTemplateKwargs: undefined,
      },
    );
    expect(result).toEqual({ text: 'fix this text' });
  });

  it('forwards the OpenAI-style snake_case options as camelCase', async () => {
    await controller.completions('Bearer secret-key', {
      model: 'openai/gpt-4o-mini',
      messages,
      max_completion_tokens: 256,
      reasoning_effort: 'low',
      chat_template_kwargs: { thinking: false },
    });

    expect(generateCompletion).toHaveBeenCalledWith(
      'openai/gpt-4o-mini',
      messages,
      'secret-key',
      {
        maxCompletionTokens: 256,
        reasoningEffort: 'low',
        chatTemplateKwargs: { thinking: false },
      },
    );
  });

  it('rejects a request without a model', async () => {
    await expect(
      controller.completions('Bearer secret-key', { messages }),
    ).rejects.toThrow(new BadRequestException('Model is required'));

    expect(generateCompletion).not.toHaveBeenCalled();
  });

  it('validates the model format via the shared validator', async () => {
    await controller.completions('Bearer secret-key', {
      model: 'openai/gpt-4o-mini',
      messages,
    });

    expect(assertProviderModelFormat).toHaveBeenCalledWith(
      'openai/gpt-4o-mini',
      'openai/gpt-4o-mini',
    );
  });

  it('propagates a rejection from the model format validator', async () => {
    assertProviderModelFormat.mockImplementationOnce(() => {
      throw new BadRequestException('bad format');
    });

    await expect(
      controller.completions('Bearer secret-key', {
        model: 'openai/gpt-4o-mini',
        messages,
      }),
    ).rejects.toThrow(new BadRequestException('bad format'));

    expect(generateCompletion).not.toHaveBeenCalled();
  });

  it('rejects a request without an api key', async () => {
    await expect(
      controller.completions(undefined, {
        model: 'openai/gpt-4o-mini',
        messages,
      }),
    ).rejects.toThrow(new BadRequestException('API key is required'));

    expect(generateCompletion).not.toHaveBeenCalled();
  });

  it.each([[undefined], [[]]])(
    'rejects a request with messages=%p',
    async (value) => {
      await expect(
        controller.completions('Bearer secret-key', {
          model: 'openai/gpt-4o-mini',
          messages: value,
        }),
      ).rejects.toThrow(new BadRequestException('Messages are required'));

      expect(generateCompletion).not.toHaveBeenCalled();
    },
  );

  it('does not crash while logging a message with missing content', async () => {
    const brokenMessages = [{ role: 'user' }] as unknown as ChatMessage[];

    await expect(
      controller.completions('Bearer secret-key', {
        model: 'openai/gpt-4o-mini',
        messages: brokenMessages,
      }),
    ).resolves.toBeDefined();
  });
});
