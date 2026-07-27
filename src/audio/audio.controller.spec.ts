import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { assertProviderModelFormat as sdkAssertProviderModelFormat } from 'src/common/provider-model.validator';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';

jest.mock('src/common/provider-model.validator', () => ({
  assertProviderModelFormat: jest.fn(),
}));

const assertProviderModelFormat =
  sdkAssertProviderModelFormat as unknown as jest.Mock;

const buildFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'sample.wav',
    encoding: '7bit',
    mimetype: 'audio/wav',
    size: 4,
    buffer: Buffer.from('fake'),
    ...overrides,
  }) as Express.Multer.File;

describe('AudioController', () => {
  let controller: AudioController;
  let transcribe: jest.Mock;

  beforeEach(async () => {
    transcribe = jest.fn().mockResolvedValue({ text: 'hello world' });
    assertProviderModelFormat.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [AudioController],
      providers: [{ provide: AudioService, useValue: { transcribe } }],
    }).compile();

    controller = moduleRef.get(AudioController);
  });

  it('delegates to the service and returns its result', async () => {
    const file = buildFile();

    const result: unknown = await controller.transcribe(
      'Bearer secret-key',
      { model: 'openai/whisper-1' },
      [file],
    );

    expect(transcribe).toHaveBeenCalledWith(
      file,
      'openai/whisper-1',
      'secret-key',
    );
    expect(result).toEqual({ text: 'hello world' });
  });

  it('uses only the first uploaded file', async () => {
    const first = buildFile({ originalname: 'first.wav' });
    const second = buildFile({ originalname: 'second.wav' });

    await controller.transcribe(
      'Bearer secret-key',
      { model: 'openai/whisper-1' },
      [first, second],
    );

    expect(transcribe).toHaveBeenCalledWith(
      first,
      expect.anything(),
      expect.anything(),
    );
  });

  it.each([
    ['bearer secret-key', 'secret-key'],
    ['Bearer   secret-key', 'secret-key'],
    ['secret-key', 'secret-key'],
  ])('extracts the api key from %p', async (header, expectedKey) => {
    await controller.transcribe(header, { model: 'openai/whisper-1' }, [
      buildFile(),
    ]);

    expect(transcribe).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expectedKey,
    );
  });

  it('rejects a request without files', async () => {
    await expect(
      controller.transcribe(
        'Bearer secret-key',
        { model: 'openai/whisper-1' },
        [],
      ),
    ).rejects.toThrow(new BadRequestException('No audio file provided'));

    expect(transcribe).not.toHaveBeenCalled();
  });

  it('rejects a request without a model', async () => {
    await expect(
      controller.transcribe('Bearer secret-key', {}, [buildFile()]),
    ).rejects.toThrow(new BadRequestException('Model is required'));

    expect(transcribe).not.toHaveBeenCalled();
  });

  it('validates the model format via the shared validator', async () => {
    await controller.transcribe(
      'Bearer secret-key',
      { model: 'openai/whisper-1' },
      [buildFile()],
    );

    expect(assertProviderModelFormat).toHaveBeenCalledWith(
      'openai/whisper-1',
      'openai/whisper-1',
    );
  });

  it('propagates a rejection from the model format validator', async () => {
    assertProviderModelFormat.mockImplementationOnce(() => {
      throw new BadRequestException('bad format');
    });

    await expect(
      controller.transcribe(
        'Bearer secret-key',
        { model: 'openai/whisper-1' },
        [buildFile()],
      ),
    ).rejects.toThrow(new BadRequestException('bad format'));

    expect(transcribe).not.toHaveBeenCalled();
  });

  it('rejects a request without an authorization header', async () => {
    await expect(
      controller.transcribe(undefined, { model: 'openai/whisper-1' }, [
        buildFile(),
      ]),
    ).rejects.toThrow(new BadRequestException('API key is required'));

    expect(transcribe).not.toHaveBeenCalled();
  });

  it('rejects an authorization header holding an empty bearer token', async () => {
    await expect(
      controller.transcribe('Bearer ', { model: 'openai/whisper-1' }, [
        buildFile(),
      ]),
    ).rejects.toThrow(new BadRequestException('API key is required'));
  });
});
