import { Test } from '@nestjs/testing';
import { transcribe as sdkTranscribe } from 'ai';
import { UsageRepository } from 'src/usage/usage.repository';
import { AudioService } from './audio.service';

// `ai` is mocked globally in test/jest-setup.ts
const transcribe = sdkTranscribe as unknown as jest.Mock;

const buildFile = (): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'sample.wav',
    mimetype: 'audio/wav',
    size: 4,
    buffer: Buffer.from('fake'),
  }) as Express.Multer.File;

const gatewayResult = (overrides: Record<string, unknown> = {}) => ({
  text: 'hello world',
  durationInSeconds: 12.5,
  providerMetadata: {
    gateway: { cost: '0.0004', generationId: 'gen_123' },
  },
  ...overrides,
});

describe('AudioService', () => {
  let service: AudioService;
  let saveTranscription: jest.Mock;
  const originalApiKey = process.env.AI_GATEWAY_API_KEY;

  beforeEach(async () => {
    transcribe.mockReset().mockResolvedValue(gatewayResult());
    saveTranscription = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AudioService,
        { provide: UsageRepository, useValue: { saveTranscription } },
      ],
    }).compile();

    service = moduleRef.get(AudioService);
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.AI_GATEWAY_API_KEY;
    } else {
      process.env.AI_GATEWAY_API_KEY = originalApiKey;
    }
  });

  it('calls the gateway with the model and the raw audio buffer', async () => {
    const file = buildFile();

    await service.transcribe(file, 'openai/whisper-1', 'secret-key');

    expect(transcribe).toHaveBeenCalledWith({
      model: 'openai/whisper-1',
      audio: file.buffer,
    });
  });

  it('exposes the caller api key to the gateway sdk', async () => {
    await service.transcribe(buildFile(), 'openai/whisper-1', 'secret-key');

    expect(process.env.AI_GATEWAY_API_KEY).toBe('secret-key');
  });

  it('returns the untouched gateway result', async () => {
    const result: unknown = await service.transcribe(
      buildFile(),
      'openai/whisper-1',
      'secret-key',
    );

    expect(result).toEqual(gatewayResult());
  });

  it('persists cost, duration and latency for the transcription', async () => {
    await service.transcribe(buildFile(), 'openai/whisper-1', 'secret-key');

    expect(saveTranscription).toHaveBeenCalledTimes(1);
    expect(saveTranscription).toHaveBeenCalledWith({
      model: 'openai/whisper-1',
      text: 'hello world',
      durationSeconds: 12.5,
      latencyMs: expect.any(Number) as unknown,
      costUsd: '0.0004',
      generationId: 'gen_123',
    });

    const [record] = saveTranscription.mock.calls[0] as [{ latencyMs: number }];
    expect(record.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('does not persist anything when the gateway call fails', async () => {
    transcribe.mockRejectedValue(new Error('gateway down'));

    await expect(
      service.transcribe(buildFile(), 'openai/whisper-1', 'secret-key'),
    ).rejects.toThrow('gateway down');

    expect(saveTranscription).not.toHaveBeenCalled();
  });
});
