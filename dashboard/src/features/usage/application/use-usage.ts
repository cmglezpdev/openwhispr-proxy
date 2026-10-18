import { useEffect, useState } from 'react';
import type { UsageSnapshot } from '../domain/types';

export function useUsage(
  load: (signal: AbortSignal) => Promise<UsageSnapshot>,
) {
  const [snapshot, setSnapshot] = useState<UsageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then(setSnapshot)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load request history.',
          );
      });
    return () => controller.abort();
  }, [load]);
  return { snapshot, error };
}
