export type OperationKind = 'transcription' | 'enhancement';

/** Shared, framework-independent contract consumed by the local dashboard. */
export interface UsageRequest {
  key: string;
  id: number;
  kind: OperationKind;
  createdAt: string;
  model: string | null;
  text: string | null;
  costUsd: number | null;
  generationId: string | null;
  latencyMs: number | null;
  durationSeconds: number | null;
}

export interface UsageSnapshot {
  loadedAt: string;
  requests: UsageRequest[];
}

export abstract class UsageHistory {
  abstract listRequests(): UsageRequest[];
}
