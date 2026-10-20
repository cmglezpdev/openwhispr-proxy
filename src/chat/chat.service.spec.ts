import { Test } from '@nestjs/testing';
import { AiProvider } from '../ai/application/ai-provider';
import { UsageRecorder } from '../usage/domain/usage-recorder';
import type { GenerationResult } from '../ai/application/generation-result';
import type { ChatMessage } from './types/chat-completion';
import { ChatService } from './chat.service';

const messages: ChatMessage[] = [{ role: 'user', content: 'fix this text' }];
const completion: GenerationResult = {
  text: 'Fix this text.',
  responseBody: { choices: [{ message: { content: 'Fix this text.' } }] },
  costUsd: '0.002',
  generationId: 'gen_chat',
};

describe('ChatService', () => {
  const completeChat = jest.fn<
    ReturnType<AiProvider['completeChat']>,
    Parameters<AiProvider['completeChat']>
  >();
  const saveEnhancedTranscription = jest.fn<
    ReturnType<UsageRecorder['saveEnhancedTranscription']>,
    Parameters<UsageRecorder['saveEnhancedTranscription']>
  >();
  let service: ChatService;

  beforeEach(async () => {
    completeChat.mockReset().mockResolvedValue(completion);
    saveEnhancedTranscription.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: AiProvider, useValue: { completeChat } },
        { provide: UsageRecorder, useValue: { saveEnhancedTranscription } },
      ],
    }).compile();
    service = moduleRef.get(ChatService);
  });

  it('records a completed cleanup and returns the same response body', async () => {
    const body = await service.generateCompletion(
      'google/gemini-2.5-flash-lite',
      messages,
      'key',
      { reasoningEffort: 'low' },
    );
    expect(completeChat).toHaveBeenCalledWith({
      model: 'google/gemini-2.5-flash-lite',
      messages,
      apiKey: 'key',
      options: { reasoningEffort: 'low' },
    });
    expect(body).toBe(completion.responseBody);
    expect(saveEnhancedTranscription).toHaveBeenCalledWith({
      model: 'google/gemini-2.5-flash-lite',
      text: completion.text,
      costUsd: '0.002',
      generationId: 'gen_chat',
      latencyMs: expect.any(Number) as unknown,
    });
    expect(
      saveEnhancedTranscription.mock.calls[0][0].latencyMs,
    ).toBeGreaterThanOrEqual(0);
  });

  it('does not persist usage when generation fails', async () => {
    completeChat.mockRejectedValue(new Error('gateway down'));
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
