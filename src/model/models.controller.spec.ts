import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AiProvider } from '../ai/application/ai-provider';
import { ModelsController } from './models.controller';

const catalog = {
  models: [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' }],
};

describe('ModelsController', () => {
  let controller: ModelsController;
  let getAvailableModels: jest.Mock;

  beforeEach(async () => {
    getAvailableModels = jest.fn().mockResolvedValue(catalog);

    const moduleRef = await Test.createTestingModule({
      controllers: [ModelsController],
      providers: [
        { provide: AiProvider, useValue: { listModels: getAvailableModels } },
      ],
    }).compile();

    controller = moduleRef.get(ModelsController);
  });

  it('builds a gateway with the caller api key and returns its catalog', async () => {
    const result = await controller.getModels('Bearer secret-key');

    expect(getAvailableModels).toHaveBeenCalledWith('secret-key');
    expect(result).toEqual(catalog);
  });

  it('rejects a request without an authorization header', async () => {
    await expect(controller.getModels(undefined)).rejects.toThrow(
      new BadRequestException('API key is required'),
    );

    expect(getAvailableModels).not.toHaveBeenCalled();
  });

  it('rejects an authorization header holding an empty bearer token', async () => {
    await expect(controller.getModels('Bearer ')).rejects.toThrow(
      new BadRequestException('API key is required'),
    );
  });

  it('propagates gateway failures instead of swallowing them', async () => {
    getAvailableModels.mockRejectedValue(new Error('unauthorized'));

    await expect(controller.getModels('Bearer bad-key')).rejects.toThrow(
      'unauthorized',
    );
  });
});
