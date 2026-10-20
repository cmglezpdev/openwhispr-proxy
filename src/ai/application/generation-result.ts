import type { UsageMetadata } from '../../usage/domain/usage-record';

/** The upstream body is opaque to the application and passed through unchanged. */
export interface GenerationResult extends UsageMetadata {
  text: string;
  responseBody: unknown;
}

export interface TranscriptionResult extends GenerationResult {
  durationInSeconds: number | undefined;
}
