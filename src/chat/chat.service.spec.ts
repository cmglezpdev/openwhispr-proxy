import { Test } from '@nestjs/testing';
import { generateText } from '../../test/support/sdk-mocks';
import { UsageRepository } from '../usage/usage.repository';
import { ChatService } from './chat.service';
import type { ChatMessage } from './types/chat-completion';

const messages: ChatMessage[] = [{ role: 'user', content: 'hello' }];
const responseBody = {
  choices: [
    {
      message: {
        content: 'Hello.',
        provider_metadata: {
          gateway: { cost: '0.002', generationId: 'gen_chat' },
        },
      },
    },
  ],
  provider_extension: 'preserved',
};

describe('ChatService', () => {
  let service: ChatService;
  const saveEnhancedTranscription = jest.fn();
  beforeEach(async () => {
    generateText
      .mockReset()
      .mockResolvedValue({
        text: 'Hello.',
        finalStep: { response: { body: responseBody } },
      });
    saveEnhancedTranscription.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: UsageRepository, useValue: { saveEnhancedTranscription } },
      ],
    }).compile();
    service = moduleRef.get(ChatService);
  });
  it('returns the original cleanup response and records its usage', async () => {
    expect(
      await service.generateCompletion(
        'google/gemini-2.5-flash-lite',
        messages,
        'key',
      ),
    ).toBe(responseBody);
    expect(saveEnhancedTranscription).toHaveBeenCalledWith({
      model: 'google/gemini-2.5-flash-lite',
      text: 'Hello.',
      costUsd: '0.002',
      generationId: 'gen_chat',
      latencyMs: expect.any(Number) as unknown,
    });
    expect(generateText).toHaveBeenCalledWith({
      model: { modelId: 'google/gemini-2.5-flash-lite', apiKey: 'key' },
      messages,
      allowSystemInMessages: true,
      include: { responseBody: true },
    });
  });
  it('forwards the supplied cleanup options through the compatible provider', async () => {
    await service.generateCompletion(
      'google/gemini-2.5-flash-lite',
      messages,
      'key',
      {
        maxCompletionTokens: 256,
        reasoningEffort: 'low',
        chatTemplateKwargs: { thinking: false },
      },
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          gateway: {
            max_completion_tokens: 256,
            reasoningEffort: 'low',
            chat_template_kwargs: { thinking: false },
          },
        },
      }),
    );
  });
  it('does not persist a result when the original response body is absent', async () => {
    generateText.mockResolvedValue({
      text: 'Hello.',
      finalStep: { response: {} },
    });
    await expect(
      service.generateCompletion(
        'google/gemini-2.5-flash-lite',
        messages,
        'key',
      ),
    ).rejects.toThrow('Gateway response body is missing');
    expect(saveEnhancedTranscription).not.toHaveBeenCalled();
  });
  it('does not persist usage when the gateway fails', async () => {
    generateText.mockRejectedValue(new Error('gateway down'));
    await expect(
      service.generateCompletion(
        'google/gemini-2.5-flash-lite',
        messages,
        'key',
      ),
    ).rejects.toThrow('gateway down');
    expect(saveEnhancedTranscription).not.toHaveBeenCalled();
  });
});
