import { requireApiKey } from '../common/http/authorization';
import { Controller, Get, Headers } from '@nestjs/common';
import { AiProvider } from '../ai/application/ai-provider';
import type { ModelCatalog } from './types/model-catalog';

@Controller('models')
export class ModelsController {
  constructor(private readonly provider: AiProvider) {}

  @Get()
  async getModels(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<ModelCatalog> {
    const apiKey = requireApiKey(authorization);

    return this.provider.listModels(apiKey);
  }
}
