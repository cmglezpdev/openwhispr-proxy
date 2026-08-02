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

/** Builds a minimal valid WAV with a known duration (seconds). */
const buildWav = (seconds: number): Express.Multer.File => {
  const sampleRate = 8000;
  const channels = 1;
  const bitsPerSample = 16;
  const dataSize =
    Math.floor(seconds * sampleRate) * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return {
    fieldname: 'file',
    originalname: 'sample.wav',
    mimetype: 'audio/wav',
    size: buffer.length,
    buffer,
  } as Express.Multer.File;
};

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

  it('uses the file duration when the gateway omits it', async () => {
    transcribe.mockResolvedValue(
      gatewayResult({ durationInSeconds: undefined }),
    );

    await service.transcribe(buildWav(2), 'openai/gpt-4o-mini-transcribe', 'k');

    expect(saveTranscription).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 2 }),
    );
  });

  it('persists null duration when the file cannot be parsed', async () => {
    transcribe.mockResolvedValue(
      gatewayResult({ durationInSeconds: undefined }),
    );

    await service.transcribe(buildFile(), 'openai/gpt-4o-mini-transcribe', 'k');

    expect(saveTranscription).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: null }),
    );
  });

  it('does not persist anything when the gateway call fails', async () => {
    transcribe.mockRejectedValue(new Error('gateway down'));

    await expect(
      service.transcribe(buildFile(), 'openai/whisper-1', 'secret-key'),
    ).rejects.toThrow('gateway down');

    expect(saveTranscription).not.toHaveBeenCalled();
  });
});
