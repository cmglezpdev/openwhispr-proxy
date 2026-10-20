import { Test } from '@nestjs/testing';
import { AiProvider } from '../ai/application/ai-provider';
import { UsageRecorder } from '../usage/domain/usage-recorder';
import type { TranscriptionResult } from '../ai/application/generation-result';
import { AudioService } from './audio.service';

const transcribe = jest.fn<
  ReturnType<AiProvider['transcribeAudio']>,
  Parameters<AiProvider['transcribeAudio']>
>();

const buildFile = () => Buffer.from('fake');

/** Builds a minimal valid WAV with a known duration (seconds). */
const buildWav = (seconds: number): Buffer => {
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
  return buffer;
};

const responseBody = { text: 'hello world' };
const gatewayResult = (
  overrides: Partial<TranscriptionResult> = {},
): TranscriptionResult => ({
  text: 'hello world',
  durationInSeconds: 12.5,
  costUsd: '0.0004',
  generationId: 'gen_123',
  responseBody,
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
        { provide: UsageRecorder, useValue: { saveTranscription } },
        { provide: AiProvider, useValue: { transcribeAudio: transcribe } },
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

  it('returns the untouched gateway result', async () => {
    const result: unknown = await service.transcribe(
      buildFile(),
      'openai/whisper-1',
      'secret-key',
    );

    expect(result).toBe(responseBody);
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
