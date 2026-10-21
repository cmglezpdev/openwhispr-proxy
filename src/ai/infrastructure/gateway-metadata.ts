import type { UsageMetadata } from '../../usage/domain/usage-record';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function cost(value: unknown): string | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? String(value) : null;
}

function generationId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function readGatewayMetadata(value: unknown): UsageMetadata {
  const gateway = record(record(value)?.gateway);
  return {
    costUsd: cost(gateway?.cost),
    generationId: generationId(gateway?.generationId),
  };
}

export function readChatUsage(value: unknown): UsageMetadata {
  const body = record(value);
  const choices = body?.choices;
  const firstChoice = Array.isArray(choices) ? record(choices[0]) : undefined;
  const message = record(firstChoice?.message);
  const metadata = readGatewayMetadata(message?.provider_metadata);
  const usage = record(body?.usage);
  return {
    costUsd: metadata.costUsd ?? cost(usage?.cost),
    generationId: metadata.generationId ?? generationId(body?.generationId),
  };
}
