import type { ModelCatalog } from '../../src/model/types/model-catalog';

export interface SdkProviderOptions {
  apiKey: string;
  name?: string;
  baseURL?: string;
}

export interface SdkModel {
  modelId: string;
  apiKey: string;
}

export interface SdkChatCall {
  model: SdkModel;
}

export interface SdkTranscriptionCall {
  model: SdkModel;
  audio: Buffer;
}

export interface SdkResponse {
  body?: unknown;
}

export interface SdkStep {
  response: SdkResponse;
}

export interface SdkChatResult {
  text: string;
  finalStep: SdkStep;
}

export interface SdkTranscriptionResult {
  text: string;
  durationInSeconds?: number;
  providerMetadata?: unknown;
}

export interface SdkGatewayClient {
  (modelId: string): SdkModel;
  transcriptionModel(modelId: string): SdkModel;
  getAvailableModels(): Promise<ModelCatalog>;
}

export type SdkChatClient = (modelId: string) => SdkModel;
