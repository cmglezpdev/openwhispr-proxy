import type { UsageSnapshot } from '../domain/types';

export async function loadUsage(signal: AbortSignal): Promise<UsageSnapshot> {
  const response = await fetch('/dashboard/api/requests', {
    signal,
    cache: 'no-store',
  });
  if (!response.ok)
    throw new Error(`Could not load request history. HTTP ${response.status}.`);
  return response.json() as Promise<UsageSnapshot>;
}
