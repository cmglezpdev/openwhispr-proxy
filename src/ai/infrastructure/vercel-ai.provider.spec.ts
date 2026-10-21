import {
  generateText,
  transcribe,
  createGateway,
  createOpenAICompatible,
} from '../../../test/support/sdk-mocks';
import type { ChatCompletionRequest } from '../../chat/types/chat-completion';
import { VercelAiProvider } from './vercel-ai.provider';

const request: ChatCompletionRequest = {
  model: 'google/gemini-2.5-flash-lite',
  messages: [{ role: 'user', content: 'hello' }],
  apiKey: 'key',
  options: {},
};
const responseBody = {
  choices: [{ message: { content: 'Hello.' } }],
  vendor_extension: 'preserved',
};

describe('VercelAiProvider', () => {
  const provider = new VercelAiProvider();
  beforeEach(() => {
    generateText.mockReset().mockResolvedValue({
      text: 'Hello.',
      finalStep: { response: { body: responseBody } },
    });
    transcribe.mockReset().mockResolvedValue({
      text: 'hello',
      durationInSeconds: 2,
      providerMetadata: {
        gateway: { cost: '0.001', generationId: 'gen_audio' },
      },
    });
    createOpenAICompatible.mockClear();
  });

  it('retains the original chat response using the compatible SDK provider', async () => {
    const result = await provider.completeChat(request);
    expect(result.responseBody).toBe(responseBody);
    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: 'gateway',
      apiKey: 'key',
      baseURL: 'https://ai-gateway.vercel.sh/v1',
    });
    expect(generateText).toHaveBeenCalledWith({
      model: { modelId: request.model, apiKey: 'key' },
      messages: request.messages,
      allowSystemInMessages: true,
      include: { responseBody: true },
    });
  });

  it('maps chat options at the SDK seam', async () => {
    await provider.completeChat({
      ...request,
      options: {
        maxCompletionTokens: 256,
        reasoningEffort: 'low',
        chatTemplateKwargs: { thinking: false },
      },
    });
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

  it('rejects a chat response whose original body was not retained', async () => {
    generateText.mockResolvedValue({
      text: 'Hello.',
      finalStep: { response: {} },
    });
    await expect(provider.completeChat(request)).rejects.toThrow(
      'Gateway response body is missing',
    );
  });

  it('creates independent providers for concurrent callers without mutating environment credentials', async () => {
    const previous = process.env.AI_GATEWAY_API_KEY;
    await Promise.all(
      ['key-a', 'key-b'].map((apiKey) =>
        provider.completeChat({ ...request, apiKey }),
      ),
    );
    expect(createOpenAICompatible.mock.calls.map((call) => call[0])).toEqual(
      ['key-a', 'key-b'].map((apiKey) => ({
        name: 'gateway',
        apiKey,
        baseURL: 'https://ai-gateway.vercel.sh/v1',
      })),
    );
    expect(process.env.AI_GATEWAY_API_KEY).toBe(previous);
  });

  it('transcribes raw bytes and normalizes usage while retaining the upstream body', async () => {
    const audio = Buffer.from('audio');
    const result = await provider.transcribeAudio(
      audio,
      'openai/whisper-1',
      'key',
    );
    expect(transcribe).toHaveBeenCalledWith({
      model: { modelId: 'openai/whisper-1', apiKey: 'key' },
      audio,
    });
    expect(result).toMatchObject({
      text: 'hello',
      durationInSeconds: 2,
      costUsd: '0.001',
      generationId: 'gen_audio',
    });
    expect(result.responseBody).toBe(await transcribe.mock.results[0].value);
  });

  it('uses the caller key when loading the model catalog', async () => {
    createGateway.mockImplementationOnce(({ apiKey }) => {
      const model = (modelId: string) => ({ modelId, apiKey });
      return Object.assign(model, {
        transcriptionModel: model,
        getAvailableModels: () => Promise.resolve({ models: [] }),
      });
    });
    await expect(provider.listModels('catalog-key')).resolves.toEqual({
      models: [],
    });
    expect(createGateway).toHaveBeenCalledWith({ apiKey: 'catalog-key' });
  });
});
