import { readChatUsage, readGatewayMetadata } from './gateway-metadata';

describe('gateway usage metadata', () => {
  it('reads nested chat metadata and preserves free generations', () => {
    expect(
      readChatUsage({
        choices: [
          {
            message: {
              provider_metadata: {
                gateway: { cost: '0', generationId: 'gen_nested' },
              },
            },
          },
        ],
        usage: { cost: 9 },
        generationId: 'gen_top',
      }),
    ).toEqual({ costUsd: '0', generationId: 'gen_nested' });
  });
  it('falls back to top-level usage', () => {
    expect(
      readChatUsage({ usage: { cost: 0.002 }, generationId: 'gen_top' }),
    ).toEqual({ costUsd: '0.002', generationId: 'gen_top' });
  });
  it.each([
    undefined,
    null,
    [],
    { gateway: { cost: [], generationId: 3 } },
    { gateway: { cost: 'invalid', generationId: '' } },
    { gateway: { cost: -1 } },
  ])('does not trust malformed SDK metadata: %p', (value) => {
    expect(readGatewayMetadata(value)).toEqual({
      costUsd: null,
      generationId: null,
    });
  });
  it.each([undefined, [], { choices: [null] }, { usage: { cost: 'NaN' } }])(
    'tolerates absent or malformed chat metadata: %p',
    (value) => {
      expect(readChatUsage(value)).toEqual({
        costUsd: null,
        generationId: null,
      });
    },
  );
});
