import type { SQLOutputValue } from 'node:sqlite';
import type { UsageRequest } from '../domain/usage-request';

export type UsageRow = Record<string, SQLOutputValue>;

function nullableText(value: SQLOutputValue): value is string | null {
  return value === null || typeof value === 'string';
}

function nullableNumber(value: SQLOutputValue): value is number | null {
  return (
    value === null || (typeof value === 'number' && Number.isFinite(value))
  );
}

export function mapUsageRow(row: UsageRow): UsageRequest {
  const {
    key,
    id,
    kind,
    createdAt,
    model,
    text,
    costUsd,
    generationId,
    latencyMs,
    durationSeconds,
  } = row;
  if (
    typeof key !== 'string' ||
    typeof id !== 'number' ||
    (kind !== 'transcription' && kind !== 'enhancement') ||
    typeof createdAt !== 'string' ||
    !nullableText(model) ||
    !nullableText(text) ||
    !nullableNumber(costUsd) ||
    !nullableText(generationId) ||
    !nullableNumber(latencyMs) ||
    !nullableNumber(durationSeconds)
  ) {
    throw new Error('Invalid usage history row');
  }
  return {
    key,
    id,
    kind,
    createdAt,
    model,
    text,
    costUsd,
    generationId,
    latencyMs,
    durationSeconds,
  };
}
