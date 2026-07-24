import { BadRequestException, Controller, Get, Headers } from '@nestjs/common';
import { createGateway, type GatewayLanguageModelEntry } from '@ai-sdk/gateway';

@Controller('models')
export class ModelsController {
  @Get()
  async getModels(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<{ models: GatewayLanguageModelEntry[] }> {
    const apiKey = authorization?.replace(/^Bearer\s+/i, '');

    if (!apiKey) {
      throw new BadRequestException('API key is required');
    }

    return createGateway({ apiKey }).getAvailableModels();
  }
}
