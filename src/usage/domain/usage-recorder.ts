import type {
  EnhancedTranscriptionRecord,
  TranscriptionRecord,
} from './usage-record';

export abstract class UsageRecorder {
  abstract saveTranscription(record: TranscriptionRecord): void;
  abstract saveEnhancedTranscription(record: EnhancedTranscriptionRecord): void;
}
