import type { JsonObject } from '../../common/types/json-value';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ChatCompletionOptions {
  maxCompletionTokens?: number;
  reasoningEffort?: string;
  chatTemplateKwargs?: JsonObject;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  apiKey: string;
  options: ChatCompletionOptions;
}
