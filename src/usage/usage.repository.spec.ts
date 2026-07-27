import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { UsageRepository } from './usage.repository';

/**
 * Integration test: runs against a real SQLite file, no mocks.
 * Each test gets its own temp directory so runs stay isolated.
 */
describe('UsageRepository', () => {
  let tempDir: string;
  let dbPath: string;
  let repository: UsageRepository | null;

  /** Releases the SQLite handle so the file can be inspected or reopened. */
  const closeRepository = (): void => {
    repository?.onModuleDestroy();
    repository = null;
  };

  const openRepository = (): UsageRepository => {
    closeRepository();
    repository = new UsageRepository();
    return repository;
  };

  /** Opens a second, read-only-ish handle to assert on what was persisted. */
  const inspect = <T>(assert: (db: DatabaseSync) => T): T => {
    closeRepository();
    const db = new DatabaseSync(dbPath);
    try {
      return assert(db);
    } finally {
      db.close();
    }
  };

  const columnsOf = (db: DatabaseSync, table: string): string[] =>
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((row) => (row as { name: string }).name);

  const schemaVersionOf = (db: DatabaseSync): number =>
    (db.prepare('PRAGMA user_version').get() as { user_version: number })
      .user_version;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'openwhispr-usage-'));
    // Nested on purpose: the repository must create missing directories.
    dbPath = join(tempDir, 'nested', 'usage.db');
    process.env.USAGE_DB_PATH = dbPath;
    repository = null;
    openRepository();
  });

  afterEach(() => {
    closeRepository();
    delete process.env.USAGE_DB_PATH;
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('migrations', () => {
    it('creates the schema at the latest version on a fresh database', () => {
      const { version, tables } = inspect((db) => ({
        version: schemaVersionOf(db),
        tables: db
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
          .all()
          .map((row) => (row as { name: string }).name),
      }));

      expect(version).toBe(2);
      expect(tables).toEqual(
        expect.arrayContaining(['transcriptions', 'enhanced_transcriptions']),
      );
    });

    it('adds latency_ms to both usage tables', () => {
      const columns = inspect((db) => ({
        transcriptions: columnsOf(db, 'transcriptions'),
        enhanced: columnsOf(db, 'enhanced_transcriptions'),
      }));

      expect(columns.transcriptions).toContain('latency_ms');
      expect(columns.enhanced).toContain('latency_ms');
    });

    it('is a no-op when the database is already up to date', () => {
      closeRepository();

      expect(() => openRepository()).not.toThrow();
      expect(inspect(schemaVersionOf)).toBe(2);
    });

    it('upgrades a database left at an older schema version', () => {
      inspect((db) => {
        db.exec('DROP TABLE transcriptions');
        db.exec('DROP TABLE enhanced_transcriptions');
        db.exec('PRAGMA user_version = 0');
      });

      openRepository().saveTranscription({
        model: 'whisper-1',
        text: 'migrated',
        durationSeconds: 1,
        latencyMs: 10,
        costUsd: '0.001',
        generationId: 'gen_1',
      });

      const { version, rowCount } = inspect((db) => ({
        version: schemaVersionOf(db),
        rowCount: db.prepare('SELECT * FROM transcriptions').all().length,
      }));

      expect(version).toBe(2);
      expect(rowCount).toBe(1);
    });
  });

  describe('saveTranscription', () => {
    it('stores every field of the record', () => {
      repository!.saveTranscription({
        model: 'whisper-1',
        text: 'hello world',
        durationSeconds: 12.5,
        latencyMs: 840,
        costUsd: '0.0004',
        generationId: 'gen_123',
      });

      const row = inspect(
        (db) =>
          db.prepare('SELECT * FROM transcriptions').get() as Record<
            string,
            unknown
          >,
      );

      expect(row).toEqual(
        expect.objectContaining({
          model: 'whisper-1',
          text: 'hello world',
          duration_seconds: 12.5,
          latency_ms: 840,
          cost_usd: 0.0004,
          generation_id: 'gen_123',
        }),
      );
      expect(row.created_at).toEqual(expect.any(String));
    });

    it('accepts null cost, duration and generation id', () => {
      expect(() =>
        repository!.saveTranscription({
          model: 'whisper-1',
          text: 'hello world',
          durationSeconds: null,
          latencyMs: null,
          costUsd: null,
          generationId: null,
        }),
      ).not.toThrow();
    });

    it('appends rows instead of replacing them', () => {
      for (const text of ['first', 'second', 'third']) {
        repository!.saveTranscription({
          model: 'whisper-1',
          text,
          durationSeconds: 1,
          latencyMs: 1,
          costUsd: '0.001',
          generationId: 'gen',
        });
      }

      const rows = inspect((db) =>
        db
          .prepare('SELECT text FROM transcriptions ORDER BY id')
          .all()
          .map((row) => (row as { text: string }).text),
      );

      expect(rows).toEqual(['first', 'second', 'third']);
    });
  });

  describe('saveEnhancedTranscription', () => {
    it('stores the record in its own table', () => {
      repository!.saveEnhancedTranscription({
        model: 'openai/gpt-4o-mini',
        text: 'fix this text',
        latencyMs: 420,
        costUsd: '0.002',
        generationId: 'gen_456',
      });

      const { row, transcriptionCount } = inspect((db) => ({
        row: db
          .prepare('SELECT * FROM enhanced_transcriptions')
          .get() as Record<string, unknown>,
        transcriptionCount: (
          db.prepare('SELECT COUNT(*) AS total FROM transcriptions').get() as {
            total: number;
          }
        ).total,
      }));

      expect(row).toEqual(
        expect.objectContaining({
          model: 'openai/gpt-4o-mini',
          text: 'fix this text',
          latency_ms: 420,
          cost_usd: 0.002,
          generation_id: 'gen_456',
        }),
      );
      expect(transcriptionCount).toBe(0);
    });

    it('accepts null cost and generation id', () => {
      expect(() =>
        repository!.saveEnhancedTranscription({
          model: 'openai/gpt-4o-mini',
          text: 'fix this text',
          latencyMs: null,
          costUsd: null,
          generationId: null,
        }),
      ).not.toThrow();
    });
  });
});
