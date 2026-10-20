import type { JsonObject } from '../../common/types/json-value';
import type { ChatMessage } from '../types/chat-completion';

export interface ChatCompletionsBody {
  model?: string;
  messages?: ChatMessage[];
  max_completion_tokens?: number;
  reasoning_effort?: string;
  chat_template_kwargs?: JsonObject;
}
