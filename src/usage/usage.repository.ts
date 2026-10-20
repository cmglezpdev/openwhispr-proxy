import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EnvService } from 'src/config/env.service';
import { UsageHistory } from './domain/usage-request';
import type { UsageRequest } from './domain/usage-request';

import type {
  TranscriptionRecord,
  EnhancedTranscriptionRecord,
} from './domain/usage-record';
import { UsageRecorder } from './domain/usage-recorder';

/**
 * Ordered schema migrations. Index === target `PRAGMA user_version`.
 * Append new migrations at the end; never edit or reorder existing ones.
 */
const MIGRATIONS: string[] = [
  // 0 -> 1: initial tables
  `
    CREATE TABLE IF NOT EXISTS transcriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      model TEXT NOT NULL,
      duration_seconds REAL,
      text TEXT NOT NULL,
      cost_usd REAL,
      generation_id TEXT
    );
    CREATE TABLE IF NOT EXISTS enhanced_transcriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      model TEXT NOT NULL,
      text TEXT NOT NULL,
      cost_usd REAL,
      generation_id TEXT
    );
  `,
  // 1 -> 2: track how long the AI call took, in milliseconds
  `
    ALTER TABLE transcriptions ADD COLUMN latency_ms INTEGER;
    ALTER TABLE enhanced_transcriptions ADD COLUMN latency_ms INTEGER;
  `,
];

@Injectable()
export class UsageRepository
  extends UsageHistory
  implements UsageRecorder, OnModuleDestroy
{
  private readonly logger = new Logger(UsageRepository.name);
  private readonly db: DatabaseSync;

  constructor(env: EnvService) {
    super();
    const dbPath = env.usageDbPath;

    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    this.runMigrations();
  }

  /**
   * Applies every migration newer than the database's current `user_version`.
   * Runs on every boot and is a no-op once the schema is up to date.
   */
  private runMigrations(): void {
    const { user_version: currentVersion } = this.db
      .prepare('PRAGMA user_version')
      .get() as { user_version: number };

    if (currentVersion >= MIGRATIONS.length) return;

    for (let version = currentVersion; version < MIGRATIONS.length; version++) {
      this.db.exec('BEGIN');
      try {
        this.db.exec(MIGRATIONS[version]);
        this.db.exec(`PRAGMA user_version = ${version + 1}`);
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
      this.logger.log(`Applied schema migration ${version} -> ${version + 1}`);
    }
  }

  saveTranscription(record: TranscriptionRecord): void {
    this.db
      .prepare(
        `INSERT INTO transcriptions
          (model, duration_seconds, text, latency_ms, cost_usd, generation_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.model,
        record.durationSeconds,
        record.text,
        record.latencyMs,
        record.costUsd,
        record.generationId,
      );
  }

  saveEnhancedTranscription(record: EnhancedTranscriptionRecord): void {
    this.db
      .prepare(
        `INSERT INTO enhanced_transcriptions
          (model, text, latency_ms, cost_usd, generation_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        record.model,
        record.text,
        record.latencyMs,
        record.costUsd,
        record.generationId,
      );
  }

  listRequests(): UsageRequest[] {
    // A single statement gives both tables the same SQLite read snapshot.
    return this.db
      .prepare(
        `
      SELECT 'transcription:' || id AS key, id, 'transcription' AS kind,
        strftime('%Y-%m-%dT%H:%M:%SZ', created_at) AS createdAt,
        model, text, cost_usd AS costUsd, generation_id AS generationId,
        latency_ms AS latencyMs, duration_seconds AS durationSeconds
      FROM transcriptions
      UNION ALL
      SELECT 'enhancement:' || id, id, 'enhancement',
        strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
        model, text, cost_usd, generation_id, latency_ms, NULL
      FROM enhanced_transcriptions
      ORDER BY createdAt DESC, key DESC
    `,
      )
      .all() as unknown as UsageRequest[];
  }

  onModuleDestroy(): void {
    this.db.close();
    this.logger.log('Usage database closed');
  }
}
