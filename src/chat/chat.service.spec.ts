import { Test } from '@nestjs/testing';
import { generateText as sdkGenerateText } from 'ai';
import { UsageRepository } from 'src/usage/usage.repository';
import { ChatMessage, ChatService } from './chat.service';

// `ai` is mocked globally in test/jest-setup.ts
const generateText = sdkGenerateText as unknown as jest.Mock;

const messages: ChatMessage[] = [
  { role: 'system', content: 'You are a transcription cleaner.' },
  { role: 'user', content: 'fix   this  text' },
];

const stepWithMetadata = (cost: string, generationId: string) => ({
  providerMetadata: { gateway: { cost, generationId } },
});

type Step = ReturnType<typeof stepWithMetadata> | Record<string, never>;

const gatewayResult = (
  steps: Step[] = [stepWithMetadata('0.001', 'gen_1')],
) => ({
  text: 'fix this text',
  steps,
});

describe('ChatService', () => {
  let service: ChatService;
  let saveEnhancedTranscription: jest.Mock;
  const originalApiKey = process.env.AI_GATEWAY_API_KEY;

  beforeEach(async () => {
    generateText.mockReset().mockResolvedValue(gatewayResult());
    saveEnhancedTranscription = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: UsageRepository, useValue: { saveEnhancedTranscription } },
      ],
    }).compile();

    service = moduleRef.get(ChatService);
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.AI_GATEWAY_API_KEY;
    } else {
      process.env.AI_GATEWAY_API_KEY = originalApiKey;
    }
  });

  it('exposes the caller api key to the gateway sdk', async () => {
    await service.generateCompletion('openai/gpt-4o-mini', messages, 'secret');

    expect(process.env.AI_GATEWAY_API_KEY).toBe('secret');
  });

  it('omits providerOptions entirely when no gateway option is supplied', async () => {
    await service.generateCompletion('openai/gpt-4o-mini', messages, 'secret');

    expect(generateText).toHaveBeenCalledWith({
      model: 'openai/gpt-4o-mini',
      messages,
      allowSystemInMessages: true,
    });
  });

  it('maps the supplied options into gateway providerOptions', async () => {
    await service.generateCompletion('openai/gpt-4o-mini', messages, 'secret', {
      maxCompletionTokens: 256,
      reasoningEffort: 'low',
      chatTemplateKwargs: { thinking: false },
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          gateway: {
            maxCompletionTokens: 256,
            reasoningEffort: 'low',
            chat_template_kwargs: { thinking: false },
          },
        },
      }),
    );
  });

  it('only forwards the options that were explicitly provided', async () => {
    await service.generateCompletion('openai/gpt-4o-mini', messages, 'secret', {
      reasoningEffort: 'high',
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: { gateway: { reasoningEffort: 'high' } },
      }),
    );
  });

  it('persists the usage taken from the last step', async () => {
    generateText.mockResolvedValue(
      gatewayResult([
        stepWithMetadata('0.001', 'gen_1'),
        stepWithMetadata('0.007', 'gen_2'),
      ]),
    );

    await service.generateCompletion('openai/gpt-4o-mini', messages, 'secret');

    expect(saveEnhancedTranscription).toHaveBeenCalledWith({
      model: 'openai/gpt-4o-mini',
      text: 'fix this text',
      latencyMs: expect.any(Number) as unknown,
      costUsd: '0.007',
      generationId: 'gen_2',
    });
  });

  it.each<[string, Step[]]>([
    ['no steps', []],
    ['a step without gateway metadata', [{}]],
  ])('persists null usage when the response has %s', async (_label, steps) => {
    generateText.mockResolvedValue(gatewayResult(steps));

    await service.generateCompletion('openai/gpt-4o-mini', messages, 'secret');

    expect(saveEnhancedTranscription).toHaveBeenCalledWith(
      expect.objectContaining({ costUsd: null, generationId: null }),
    );
  });

  it('returns the untouched gateway result', async () => {
    const result = await service.generateCompletion(
      'openai/gpt-4o-mini',
      messages,
      'secret',
    );

    expect(result).toEqual(gatewayResult());
  });

  it('does not persist anything when the gateway call fails', async () => {
    generateText.mockRejectedValue(new Error('gateway down'));

    await expect(
      service.generateCompletion('openai/gpt-4o-mini', messages, 'secret'),
    ).rejects.toThrow('gateway down');

    expect(saveEnhancedTranscription).not.toHaveBeenCalled();
  });
});
