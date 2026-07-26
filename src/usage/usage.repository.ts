import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface TranscriptionRecord {
  model: string;
  text: string;
  durationSeconds: number | null;
  latencyMs: number | null;
  costUsd: string | null;
  generationId: string | null;
}

export interface EnhancedTranscriptionRecord {
  model: string;
  text: string;
  latencyMs: number | null;
  costUsd: string | null;
  generationId: string | null;
}

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
export class UsageRepository implements OnModuleDestroy {
  private readonly logger = new Logger(UsageRepository.name);
  private readonly db: DatabaseSync;

  constructor() {
    const dataDir = join(process.cwd(), 'data');
    mkdirSync(dataDir, { recursive: true });

    this.db = new DatabaseSync(join(dataDir, 'usage.db'));
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

  onModuleDestroy(): void {
    this.db.close();
    this.logger.log('Usage database closed');
  }
}
