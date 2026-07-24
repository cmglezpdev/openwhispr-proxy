import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface TranscriptionRecord {
  model: string;
  text: string;
  durationSeconds: number | null;
  costUsd: string | null;
  generationId: string | null;
}

export interface EnhancedTranscriptionRecord {
  model: string;
  text: string;
  costUsd: string | null;
  generationId: string | null;
}

@Injectable()
export class UsageRepository implements OnModuleDestroy {
  private readonly logger = new Logger(UsageRepository.name);
  private readonly db: DatabaseSync;

  constructor() {
    const dataDir = join(process.cwd(), 'data');
    mkdirSync(dataDir, { recursive: true });

    this.db = new DatabaseSync(join(dataDir, 'usage.db'));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        model TEXT NOT NULL,
        duration_seconds REAL,
        text TEXT NOT NULL,
        cost_usd REAL,
        generation_id TEXT
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS enhanced_transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        model TEXT NOT NULL,
        text TEXT NOT NULL,
        cost_usd REAL,
        generation_id TEXT
      );
    `);
  }

  saveTranscription(record: TranscriptionRecord): void {
    this.db
      .prepare(
        `INSERT INTO transcriptions
          (model, duration_seconds, text, cost_usd, generation_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        record.model,
        record.durationSeconds,
        record.text,
        record.costUsd,
        record.generationId,
      );
  }

  saveEnhancedTranscription(record: EnhancedTranscriptionRecord): void {
    this.db
      .prepare(
        `INSERT INTO enhanced_transcriptions
          (model, text, cost_usd, generation_id)
         VALUES (?, ?, ?, ?)`,
      )
      .run(record.model, record.text, record.costUsd, record.generationId);
  }

  onModuleDestroy(): void {
    this.db.close();
    this.logger.log('Usage database closed');
  }
}
