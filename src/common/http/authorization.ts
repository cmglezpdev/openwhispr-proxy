import { BadRequestException } from '@nestjs/common';

export function requireApiKey(authorization: string | undefined): string {
  const apiKey = authorization?.replace(/^Bearer\s+/i, '');
  if (!apiKey) throw new BadRequestException('API key is required');
  return apiKey;
}
