import { BadRequestException } from '@nestjs/common';
import { assertProviderModelFormat } from './provider-model.validator';

describe('assertProviderModelFormat', () => {
  it.each([
    'openai/gpt-4o-mini',
    'openai/whisper-1',
    'anthropic/claude-3-opus',
    'a/b',
  ])('accepts %p', (model) => {
    expect(() =>
      assertProviderModelFormat(model, 'openai/gpt-4o-mini'),
    ).not.toThrow();
  });

  it.each([
    ['a model with no provider segment', 'gpt-4o-mini'],
    ['a model with an empty provider segment', '/gpt-4o-mini'],
    ['a model with an empty model segment', 'openai/'],
    ['a model with trailing whitespace instead of a provider', 'openai '],
    ['a model with two provider segments', 'openai/anthropic/gpt-4o-mini'],
    ['a model with a space inside a segment', 'openai/gpt 4o'],
    ['an empty string', ''],
  ])('rejects %s: %p', (_label, model) => {
    expect(() =>
      assertProviderModelFormat(model, 'openai/gpt-4o-mini'),
    ).toThrow(BadRequestException);
  });

  it('includes the given example in the rejection message', () => {
    expect(() =>
      assertProviderModelFormat('bad-model', 'anthropic/claude-3-opus'),
    ).toThrow(
      new BadRequestException(
        'Model must be in <provider>/<model> format (e.g. anthropic/claude-3-opus)',
      ),
    );
  });
});
