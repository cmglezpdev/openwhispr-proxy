import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createGateway as sdkCreateGateway } from '@ai-sdk/gateway';
import {
  generateText as sdkGenerateText,
  transcribe as sdkTranscribe,
} from 'ai';
import { AppModule } from '../src/app.module';

/** Shape of the Nest error payload asserted by the failure-path tests. */
interface ErrorBody {
  message: string;
}

// `ai` and `@ai-sdk/gateway` are mocked globally in test/jest-setup.ts
const transcribe = sdkTranscribe as unknown as jest.Mock;
const generateText = sdkGenerateText as unknown as jest.Mock;
const createGateway = sdkCreateGateway as unknown as jest.Mock;

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
      return (
        db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as {
          total: number;
        }
      ).total;
    } finally {
      db.close();
    }
  };

  const lastRow = (table: string): Record<string, unknown> => {
    const db = new DatabaseSync(dbPath);
    try {
      return db
        .prepare(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 1`)
        .get() as Record<string, unknown>;
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
      steps: [
        {
          providerMetadata: {
            gateway: { cost: '0.002', generationId: 'gen_chat' },
          },
        },
      ],
    });

    createGateway.mockReset().mockReturnValue({
      getAvailableModels: jest
        .fn()
        .mockResolvedValue({ models: [{ id: 'openai/gpt-4o-mini' }] }),
    });
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

      const [{ audio }] = transcribe.mock.calls[0] as [{ audio: Buffer }];
      expect(audio.toString()).toBe('fake audio');
    });

    it('rejects a request with no file', async () => {
      const response = await post().field('model', 'whisper-1').expect(400);

      expect((response.body as ErrorBody).message).toBe(
        'No audio file provided',
      );
      expect(transcribe).not.toHaveBeenCalled();
    });

    it('rejects a request with no model', async () => {
      const response = await post()
        .attach('file', Buffer.from('fake audio'), 'sample.wav')
        .expect(400);

      expect((response.body as ErrorBody).message).toBe('Model is required');
      expect(transcribe).not.toHaveBeenCalled();
    });

    it('rejects a model without the <provider>/<model> format', async () => {
      const response = await post()
        .field('model', 'whisper-1')
        .attach('file', Buffer.from('fake audio'), 'sample.wav')
        .expect(400);

      expect((response.body as ErrorBody).message).toBe(
        'Model must be in <provider>/<model> format (e.g. openai/whisper-1)',
      );
      expect(transcribe).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated request', async () => {
      const response = await request(app.getHttpServer())
        .post('/audio/transcriptions')
        .field('model', 'openai/whisper-1')
        .attach('file', Buffer.from('fake audio'), 'sample.wav')
        .expect(400);

      expect((response.body as ErrorBody).message).toBe('API key is required');
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

      expect(response.body).toMatchObject({ text: 'Hello world.' });
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
            gateway: { maxCompletionTokens: 256, reasoningEffort: 'low' },
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

      expect((response.body as ErrorBody).message).toBe(message);
      expect(generateText).not.toHaveBeenCalled();
    });

    it('rejects a model without the <provider>/<model> format', async () => {
      const response = await post()
        .send({ model: 'gpt-4o-mini', messages })
        .expect(400);

      expect((response.body as ErrorBody).message).toBe(
        'Model must be in <provider>/<model> format (e.g. openai/gpt-4o-mini)',
      );
      expect(generateText).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated request', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/chat/completions')
        .send({ model: 'openai/gpt-4o-mini', messages })
        .expect(400);

      expect((response.body as ErrorBody).message).toBe('API key is required');
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

      expect((response.body as ErrorBody).message).toBe('API key is required');
      expect(createGateway).not.toHaveBeenCalled();
    });
  });

  it('returns 404 for an unknown route', async () => {
    await request(app.getHttpServer()).get('/nope').expect(404);
  });
});
