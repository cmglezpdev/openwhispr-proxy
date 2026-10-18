import { Injectable } from '@nestjs/common';
import { UsageHistory } from '../domain/usage-request';
import type { UsageSnapshot } from '../domain/usage-request';

@Injectable()
export class GetUsageHistory {
  constructor(private readonly history: UsageHistory) {}

  execute(): UsageSnapshot {
    return {
      loadedAt: new Date().toISOString(),
      requests: this.history.listRequests(),
    };
  }
}
