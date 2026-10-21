import type { ChatCompletionRequest } from '../../chat/types/chat-completion';
import type { ModelCatalog } from '../../model/types/model-catalog';
import type {
  GenerationResult,
  TranscriptionResult,
} from './generation-result';

export abstract class AiProvider {
  abstract completeChat(
    request: ChatCompletionRequest,
  ): Promise<GenerationResult>;
  abstract transcribeAudio(
    audio: Buffer,
    model: string,
    apiKey: string,
  ): Promise<TranscriptionResult>;
  abstract listModels(apiKey: string): Promise<ModelCatalog>;
}
