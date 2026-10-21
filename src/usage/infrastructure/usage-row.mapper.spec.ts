import { mapUsageRow } from './usage-row.mapper';
import type { UsageRow } from './usage-row.mapper';

const row: UsageRow = {
  key: 'enhancement:1',
  id: 1,
  kind: 'enhancement',
  createdAt: '2026-10-20T00:00:00Z',
  model: 'google/gemini-2.5-flash-lite',
  text: 'Hello.',
  costUsd: 0,
  generationId: null,
  latencyMs: 100,
  durationSeconds: null,
};

describe('usage row mapping', () => {
  it('preserves zero costs and nullable fields in the history contract', () => {
    expect(mapUsageRow(row)).toEqual(row);
  });
  it.each<UsageRow>([
    { ...row, kind: 'unsupported' },
    { ...row, costUsd: '0.002' },
    { ...row, id: '1' },
    { ...row, latencyMs: Infinity },
  ])('rejects rows that do not satisfy the history contract', (value) => {
    expect(() => mapUsageRow(value)).toThrow('Invalid usage history row');
  });
});
