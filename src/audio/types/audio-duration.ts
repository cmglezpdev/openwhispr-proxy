export type AudioFormat = 'wav' | 'webm' | 'ogg' | 'mp4' | 'mp3' | null;

export interface EbmlValue {
  value: number;
  length: number;
}

export interface AudioBlockTiming {
  timestamp: number;
  durationMs: number;
}
