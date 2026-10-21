import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createGateway, generateText, transcribe } from './support/sdk-mocks';
import { AppModule } from '../src/app.module';
import type { UsageSnapshot } from '../src/usage/domain/usage-request';

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

/**
 * End-to-end tests: the real Nest app, the real HTTP layer and a real SQLite
 * database. Only the outbound AI Gateway calls are stubbed, so no network
 * traffic and no spend happen during the suite.
 */
describe('openwhispr-proxy (e2e)', () => {
  let app: INestApplication<App>;
  let tempDir: string;
  let dbPath: string;

  const countRows = (table: string): number => {
    const db = new DatabaseSync(dbPath);
    try {
      const total = db
        .prepare(`SELECT COUNT(*) AS total FROM ${table}`)
        .get()?.total;
      if (typeof total !== 'number') throw new Error('Missing row count');
      return total;
    } finally {
      db.close();
    }
  };

  const lastRow = (table: string): Record<string, unknown> => {
    const db = new DatabaseSync(dbPath);
    try {
      const row = db
        .prepare(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 1`)
        .get();
      if (!row) throw new Error('Missing usage record');
      return row;
    } finally {
      db.close();
    }
  };

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'openwhispr-e2e-'));
    dbPath = join(tempDir, 'usage.db');
    process.env.USAGE_DB_PATH = dbPath;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.USAGE_DB_PATH;
    rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    transcribe.mockReset().mockResolvedValue({
      text: 'hello world',
      durationInSeconds: 12.5,
      providerMetadata: {
        gateway: { cost: '0.0004', generationId: 'gen_audio' },
      },
    });

    generateText.mockReset().mockResolvedValue({
      text: 'Hello world.',
      finalStep: {
        response: {
          body: {
            id: 'gen_chat',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Hello world.',
                  provider_metadata: {
                    gateway: { cost: '0.002', generationId: 'gen_chat' },
                  },
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 4,
              total_tokens: 14,
            },
            gateway_extension: { preserved: true },
          },
        },
      },
    });

    createGateway.mockReset().mockImplementation(({ apiKey }) =>
      Object.assign((modelId: string) => ({ modelId, apiKey }), {
        transcriptionModel: (modelId: string) => ({ modelId, apiKey }),
        getAvailableModels: jest.fn().mockResolvedValue({
          models: [{ id: 'openai/gpt-4o-mini' }],
        }),
      }),
    );
  });

  describe('POST /audio/transcriptions', () => {
    const post = () =>
      request(app.getHttpServer())
        .post('/audio/transcriptions')
        .set('authorization', 'Bearer secret-key');

    it('returns the transcription and records the usage', async () => {
      const before = countRows('transcriptions');

      const response = await post()
        .field('model', 'openai/whisper-1')
        .attach('file', Buffer.from('fake audio'), 'sample.wav')
        .expect(201);

      expect(response.body).toMatchObject({ text: 'hello world' });
      expect(countRows('transcriptions')).toBe(before + 1);
      expect(lastRow('transcriptions')).toMatchObject({
        model: 'openai/whisper-1',
        text: 'hello world',
        duration_seconds: 12.5,
        cost_usd: 0.0004,
        generation_id: 'gen_audio',
      });
    });

    it('forwards the uploaded bytes to the gateway', async () => {
      await post()
        .field('model', 'openai/whisper-1')
        .attach('file', Buffer.from('fake audio'), 'sample.wav')
        .expect(201);

      const [{ audio }] = transcribe.mock.calls[0];
      expect(audio.toString()).toBe('fake audio');
    });

    it('rejects files larger than 100 MiB before calling the gateway', async () => {
      const before = countRows('transcriptions');
      await post()
        .field('model', 'openai/whisper-1')
        .attach('file', Buffer.alloc(100 * 1024 * 1024 + 1), 'large.wav')
        .expect(413);

      expect(transcribe).not.toHaveBeenCalled();
      expect(countRows('transcriptions')).toBe(before);
    });

    it('rejects extra files before calling the gateway', async () => {
      await post()
        .field('model', 'openai/whisper-1')
        .attach('file', Buffer.from('audio'), 'first.wav')
        .attach('file', Buffer.from('audio'), 'second.wav')
        .expect(400);

      expect(transcribe).not.toHaveBeenCalled();
    });

    it('accepts additional text fields and a different file field name', async () => {
      await post()
        .field('model', 'openai/whisper-1')
        .field('language', 'es')
        .field('prompt', 'Some context')
        .attach('audio', Buffer.from('audio'), 'sample.webm')
        .expect(201);

      expect(transcribe).toHaveBeenCalledTimes(1);
    });

    it('rejects too many text fields before calling the gateway', async () => {
      const submission = post().field('model', 'openai/whisper-1');
      for (let i = 0; i < 16; i++) submission.field(`extra${i}`, 'value');
      await submission
        .attach('file', Buffer.from('audio'), 'sample.wav')
        .expect(400);

      expect(transcribe).not.toHaveBeenCalled();
    });

    it('rejects oversized text fields before calling the gateway', async () => {
      await post()
        .field('model', 'openai/whisper-1')
        .field('prompt', 'a'.repeat(1024 * 1024 + 1))
        .attach('file', Buffer.from('audio'), 'sample.wav')
        .expect(400);

      expect(transcribe).not.toHaveBeenCalled();
    });

    it('falls back to the file duration when the gateway omits it', async () => {
      transcribe.mockResolvedValue({
        text: 'hello world',
        durationInSeconds: undefined,
        providerMetadata: {
          gateway: { cost: '0.0004', generationId: 'gen_audio' },
        },
      });

      await post()
        .field('model', 'openai/gpt-4o-mini-transcribe')
        .attach('file', buildWav(2), 'sample.wav')
        .expect(201);

      expect(lastRow('transcriptions')).toMatchObject({
        model: 'openai/gpt-4o-mini-transcribe',
        duration_seconds: 2,
      });
    });

    it('rejects a request with no file', async () => {
      const response = await post().field('model', 'whisper-1').expect(400);

      expect(response.body).toMatchObject({
        message: 'No audio file provided',
      });
      expect(transcribe).not.toHaveBeenCalled();
    });

    it('rejects a request with no model', async () => {
      const response = await post()
        .attach('file', Buffer.from('fake audio'), 'sample.wav')
        .expect(400);

      expect(response.body).toMatchObject({ message: 'Model is required' });
      expect(transcribe).not.toHaveBeenCalled();
    });

    it('rejects a model without the <provider>/<model> format', async () => {
      const response = await post()
        .field('model', 'whisper-1')
        .attach('file', Buffer.from('fake audio'), 'sample.wav')
        .expect(400);

      expect(response.body).toMatchObject({
        message:
          'Model must be in <provider>/<model> format (e.g. openai/whisper-1)',
      });
      expect(transcribe).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated request', async () => {
      const response = await request(app.getHttpServer())
        .post('/audio/transcriptions')
        .field('model', 'openai/whisper-1')
        .attach('file', Buffer.from('fake audio'), 'sample.wav')
        .expect(400);

      expect(response.body).toMatchObject({ message: 'API key is required' });
      expect(transcribe).not.toHaveBeenCalled();
    });

    it('surfaces a gateway failure as a 500 without recording usage', async () => {
      transcribe.mockRejectedValue(new Error('gateway down'));
      const before = countRows('transcriptions');

      await post()
        .field('model', 'openai/whisper-1')
        .attach('file', Buffer.from('fake audio'), 'sample.wav')
        .expect(500);

      expect(countRows('transcriptions')).toBe(before);
    });
  });

  describe('POST /v1/chat/completions', () => {
    const messages = [
      { role: 'system', content: 'Clean up the transcription.' },
      { role: 'user', content: 'hello   world' },
    ];

    const post = () =>
      request(app.getHttpServer())
        .post('/v1/chat/completions')
        .set('authorization', 'Bearer secret-key');

    it('returns the completion and records the usage', async () => {
      const before = countRows('enhanced_transcriptions');

      const response = await post()
        .send({ model: 'openai/gpt-4o-mini', messages })
        .expect(201);

      expect(response.body).toMatchObject({
        choices: [{ message: { content: 'Hello world.' } }],
      });
      const sdkCall = generateText.mock.results[0];
      if (sdkCall.type !== 'return')
        throw new Error('Generation did not return');
      const sdkResult = await sdkCall.value;
      expect(response.body).toEqual(sdkResult.finalStep.response.body);
      expect(countRows('enhanced_transcriptions')).toBe(before + 1);
      expect(lastRow('enhanced_transcriptions')).toMatchObject({
        model: 'openai/gpt-4o-mini',
        text: 'Hello world.',
        cost_usd: 0.002,
        generation_id: 'gen_chat',
      });
    });

    it('maps the OpenAI-style options into gateway provider options', async () => {
      await post()
        .send({
          model: 'openai/gpt-4o-mini',
          messages,
          max_completion_tokens: 256,
          reasoning_effort: 'low',
        })
        .expect(201);

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          providerOptions: {
            gateway: { max_completion_tokens: 256, reasoningEffort: 'low' },
          },
        }),
      );
    });

    it.each([
      ['a missing model', { messages }, 'Model is required'],
      [
        'missing messages',
        { model: 'openai/gpt-4o-mini' },
        'Messages are required',
      ],
      [
        'an empty message list',
        { model: 'openai/gpt-4o-mini', messages: [] },
        'Messages are required',
      ],
    ])('rejects a request with %s', async (_label, body, message) => {
      const response = await post().send(body).expect(400);

      expect(response.body).toMatchObject({ message: message });
      expect(generateText).not.toHaveBeenCalled();
    });

    it('rejects a model without the <provider>/<model> format', async () => {
      const response = await post()
        .send({ model: 'gpt-4o-mini', messages })
        .expect(400);

      expect(response.body).toMatchObject({
        message:
          'Model must be in <provider>/<model> format (e.g. openai/gpt-4o-mini)',
      });
      expect(generateText).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated request', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/chat/completions')
        .send({ model: 'openai/gpt-4o-mini', messages })
        .expect(400);

      expect(response.body).toMatchObject({ message: 'API key is required' });
      expect(generateText).not.toHaveBeenCalled();
    });

    it('surfaces a gateway failure as a 500 without recording usage', async () => {
      generateText.mockRejectedValue(new Error('gateway down'));
      const before = countRows('enhanced_transcriptions');

      await post().send({ model: 'openai/gpt-4o-mini', messages }).expect(500);

      expect(countRows('enhanced_transcriptions')).toBe(before);
    });
  });

  describe('GET /models', () => {
    it('returns the gateway catalog', async () => {
      const response = await request(app.getHttpServer())
        .get('/models')
        .set('authorization', 'Bearer secret-key')
        .expect(200);

      expect(createGateway).toHaveBeenCalledWith({ apiKey: 'secret-key' });
      expect(response.body).toEqual({ models: [{ id: 'openai/gpt-4o-mini' }] });
    });

    it('rejects an unauthenticated request', async () => {
      const response = await request(app.getHttpServer())
        .get('/models')
        .expect(400);

      expect(response.body).toMatchObject({ message: 'API key is required' });
      expect(createGateway).not.toHaveBeenCalled();
    });
  });

  it('returns 404 for an unknown route', async () => {
    await request(app.getHttpServer()).get('/nope').expect(404);
  });
  describe('dashboard history', () => {
    it('returns the persisted history and leaves it unchanged after invalid requests', async () => {
      const history = async (): Promise<UsageSnapshot> => {
        const response = await request(app.getHttpServer())
          .get('/dashboard/api/requests')
          .expect(200)
          .expect('Cache-Control', 'no-store');
        return response.body as UsageSnapshot;
      };
      const before = await history();
      await request(app.getHttpServer())
        .post('/v1/chat/completions')
        .send({ messages: [] })
        .expect(400);
      await request(app.getHttpServer())
        .post('/audio/transcriptions')
        .field('model', 'openai/whisper-1')
        .expect(400);
      const after = await history();
      expect(after.requests).toEqual(before.requests);
      expect(typeof after.loadedAt).toBe('string');
      expect(after.requests.length).toBe(
        countRows('transcriptions') + countRows('enhanced_transcriptions'),
      );
      for (const row of after.requests) {
        expect(Object.keys(row).sort()).toEqual(
          [
            'key',
            'id',
            'kind',
            'createdAt',
            'model',
            'text',
            'costUsd',
            'generationId',
            'latencyMs',
            'durationSeconds',
          ].sort(),
        );
      }
    });
    it('serves the Vite HTML and its compiled assets from the existing server', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .expect(200)
        .expect('Content-Type', /html/);
      const asset = response.text.match(
        /src="(\/dashboard\/assets\/[^"]+\.js)"/,
      );
      expect(asset).not.toBeNull();
      await request(app.getHttpServer())
        .get(asset![1])
        .expect(200)
        .expect('Content-Type', /javascript/);
    });
  });
});
