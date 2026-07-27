import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createGateway as sdkCreateGateway } from '@ai-sdk/gateway';
import { ModelsController } from './models.controller';

// `@ai-sdk/gateway` is mocked globally in test/jest-setup.ts
const createGateway = sdkCreateGateway as unknown as jest.Mock;

const catalog = {
  models: [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' }],
};

describe('ModelsController', () => {
  let controller: ModelsController;
  let getAvailableModels: jest.Mock;

  beforeEach(async () => {
    getAvailableModels = jest.fn().mockResolvedValue(catalog);
    createGateway.mockReset().mockReturnValue({ getAvailableModels });

    const moduleRef = await Test.createTestingModule({
      controllers: [ModelsController],
    }).compile();

    controller = moduleRef.get(ModelsController);
  });

  it('builds a gateway with the caller api key and returns its catalog', async () => {
    const result = await controller.getModels('Bearer secret-key');

    expect(createGateway).toHaveBeenCalledWith({ apiKey: 'secret-key' });
    expect(result).toEqual(catalog);
  });

  it('rejects a request without an authorization header', async () => {
    await expect(controller.getModels(undefined)).rejects.toThrow(
      new BadRequestException('API key is required'),
    );

    expect(createGateway).not.toHaveBeenCalled();
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
