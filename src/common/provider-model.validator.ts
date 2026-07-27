import { BadRequestException } from '@nestjs/common';

const PROVIDER_MODEL_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export function assertProviderModelFormat(
  model: string,
  example: string,
): void {
  if (!PROVIDER_MODEL_PATTERN.test(model)) {
    throw new BadRequestException(
      `Model must be in <provider>/<model> format (e.g. ${example})`,
    );
  }
}
