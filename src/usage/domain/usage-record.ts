export interface UsageMetadata {
  costUsd: string | null;
  generationId: string | null;
}

export interface EnhancedTranscriptionRecord extends UsageMetadata {
  model: string;
  text: string;
  latencyMs: number | null;
}

export interface TranscriptionRecord extends EnhancedTranscriptionRecord {
  durationSeconds: number | null;
}
