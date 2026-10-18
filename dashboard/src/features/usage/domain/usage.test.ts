import { describe, expect, it } from 'vitest';
import { comparison, summarize, timeline, timelineSeries } from './analytics';
import { dateInput, datePreset, localDate, startOfPeriod } from './dates';
import { emptyFilters, filterErrors, filterRequests } from './filters';
import type { UsageRequest } from './types';

function row(overrides: Partial<UsageRequest> = {}): UsageRequest {
  return {
    key: 'transcription:1',
    id: 1,
    kind: 'transcription',
    createdAt: '2026-10-01T12:00:00Z',
    model: 'openai/whisper-1',
    text: 'Complete result',
    costUsd: 0.01,
    generationId: 'gen_1',
    latencyMs: 400,
    durationSeconds: 60,
    ...overrides,
  };
}

describe('selection and analytics', () => {
  it('combines fields with AND and selected models with OR', () => {
    const filters = {
      ...emptyFilters(),
      from: '2026-10-01',
      to: '2026-10-02',
      models: ['model/a', 'model/b'],
      cost: { operator: 'gt' as const, min: '0.02', max: '' },
    };
    const rows = [
      row({ model: 'model/a', costUsd: 0.03 }),
      row({ key: 'transcription:2', model: 'model/b', costUsd: 0.04 }),
      row({ model: 'model/c', costUsd: 0.06 }),
      row({ model: 'model/a', costUsd: 0.02 }),
      row({ model: 'model/b', costUsd: null }),
    ];
    expect(filterRequests(rows, filters)).toEqual(rows.slice(0, 2));
    expect(summarize(filterRequests(rows, filters))).toMatchObject({
      count: 2,
      cost: 0.07,
    });
  });

  it('filters result text and unknown costs', () => {
    const matching = row({ text: 'Meeting TRANSCRIPT', costUsd: null });
    expect(
      filterRequests([row(), matching], {
        ...emptyFilters(),
        query: 'transcript',
        costAvailability: 'unknown',
      }),
    ).toEqual([matching]);
  });

  it('matches identifiers exactly and excludes unknown or inapplicable durations', () => {
    const rows = [
      row(),
      row({ key: 'enhancement:1', kind: 'enhancement', durationSeconds: null }),
      row({ id: 10, key: 'transcription:10', durationSeconds: null }),
    ];
    expect(
      filterRequests(rows, { ...emptyFilters(), identifier: '1' }),
    ).toHaveLength(2);
    expect(
      filterRequests(rows, {
        ...emptyFilters(),
        identifier: 'transcription:1',
      }),
    ).toEqual([rows[0]]);
    expect(
      filterRequests(rows, {
        ...emptyFilters(),
        duration: { operator: 'between', min: '0', max: '60' },
      }),
    ).toEqual([rows[0]]);
  });

  it('rejects contradictory and negative ranges without silently returning unfiltered data', () => {
    const filters = {
      ...emptyFilters(),
      from: '2026-10-03',
      to: '2026-10-01',
      cost: { operator: 'between' as const, min: '4', max: '2' },
    };
    expect(filterErrors(filters)).toHaveLength(2);
    expect(filterRequests([row()], filters)).toEqual([]);
    expect(
      filterErrors({
        ...emptyFilters(),
        latency: { operator: 'gt', min: '-1', max: '' },
      }),
    ).toHaveLength(1);
  });

  it('distinguishes genuine zero cost from unknown cost and excludes unknown values from medians', () => {
    const rows = [
      row({ costUsd: 0, latencyMs: 100 }),
      row({ costUsd: null, latencyMs: 300 }),
      row({
        kind: 'enhancement',
        durationSeconds: null,
        costUsd: null,
        latencyMs: null,
      }),
    ];
    expect(summarize(rows)).toMatchObject({
      count: 3,
      cost: 0,
      missingCosts: 2,
      minutes: 2,
      audioCount: 2,
      medianLatency: 200,
      knownLatencies: 2,
    });
    expect(
      summarize([row({ costUsd: null, durationSeconds: null })]),
    ).toMatchObject({ cost: null, minutes: null });
    expect(summarize([])).toMatchObject({
      count: 0,
      cost: null,
      minutes: null,
      medianLatency: null,
    });
  });

  it('fills empty calendar periods but retains null for periods with only unknown costs', () => {
    const rows = [
      row({ createdAt: localDate('2026-10-01').toISOString(), costUsd: null }),
      row({ createdAt: localDate('2026-10-03').toISOString(), costUsd: 0.05 }),
    ];
    const result = timeline(
      rows,
      { ...emptyFilters(), from: '2026-10-01', to: '2026-10-04' },
      'day',
    );
    expect(result.map((bucket) => bucket.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(result.map((bucket) => bucket.cost)).toEqual([null, 0, 0.05, 0]);
    expect(result.map((bucket) => bucket.requests)).toEqual([1, 0, 1, 0]);
  });

  it('groups weeks Monday to Sunday across a year boundary', () => {
    expect(dateInput(startOfPeriod(localDate('2027-01-03'), 'week'))).toBe(
      '2026-12-28',
    );
    const rows = [
      row({ createdAt: localDate('2027-01-03').toISOString() }),
      row({ createdAt: localDate('2027-01-04').toISOString() }),
    ];
    const result = timeline(rows, emptyFilters(), 'week');
    expect(
      result.map((bucket) => [bucket.date, bucket.end, bucket.requests]),
    ).toEqual([
      ['2026-12-28', '2027-01-03', 1],
      ['2027-01-04', '2027-01-10', 1],
    ]);
  });

  it('steps through calendar days around daylight-saving changes', () => {
    const rows = [
      row({ createdAt: localDate('2026-03-07').toISOString() }),
      row({ createdAt: localDate('2026-03-09').toISOString() }),
    ];
    expect(
      timeline(rows, emptyFilters(), 'day').map((bucket) => bucket.date),
    ).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
  });

  it('fills missing months and years without moving the period boundaries', () => {
    const months = [
      row({ createdAt: localDate('2026-01-31').toISOString() }),
      row({ createdAt: localDate('2026-03-01').toISOString() }),
    ];
    expect(
      timeline(months, emptyFilters(), 'month').map((bucket) => [
        bucket.date,
        bucket.requests,
      ]),
    ).toEqual([
      ['2026-01-01', 1],
      ['2026-02-01', 0],
      ['2026-03-01', 1],
    ]);
    const years = [
      row({ createdAt: localDate('2025-12-31').toISOString() }),
      row({ createdAt: localDate('2027-01-01').toISOString() }),
    ];
    expect(
      timeline(years, emptyFilters(), 'year').map((bucket) => [
        bucket.date,
        bucket.requests,
      ]),
    ).toEqual([
      ['2025-01-01', 1],
      ['2026-01-01', 0],
      ['2027-01-01', 1],
    ]);
  });

  it('accumulates only known costs and counts every stored request', () => {
    const rows = [
      row({ costUsd: 0.02, createdAt: localDate('2026-10-01').toISOString() }),
      row({
        costUsd: null,
        createdAt: localDate('2026-10-02').toISOString(),
      }),
      row({ costUsd: 0.03, createdAt: localDate('2026-10-03').toISOString() }),
    ];
    const buckets = timeline(rows, emptyFilters(), 'day');
    expect(
      timelineSeries(buckets, 'cost', true).map((point) => point.value),
    ).toEqual([0.02, 0.05]);
    const counts = timelineSeries(buckets, 'requests', false);
    expect(counts.map((point) => point.value)).toEqual([1, 1, 1]);
    expect(counts.every((point) => point.series === 'Requests')).toBe(true);
    expect(counts.reduce((total, point) => total + point.value, 0)).toBe(3);
  });

  it('filters a complete local day using UTC timestamps', () => {
    const before = new Date(2026, 9, 1, 0, 0, 0, -1);
    const first = new Date(2026, 9, 1);
    const last = new Date(2026, 9, 2, 0, 0, 0, -1);
    const after = new Date(2026, 9, 2);
    const rows = [before, first, last, after].map((date) =>
      row({ createdAt: date.toISOString() }),
    );
    expect(
      filterRequests(rows, {
        ...emptyFilters(),
        from: '2026-10-01',
        to: '2026-10-01',
      }),
    ).toEqual(rows.slice(1, 3));
  });

  it('uses calendar days for quick ranges', () => {
    expect(datePreset('7', new Date(2026, 9, 17, 22))).toEqual({
      from: '2026-10-11',
      to: '2026-10-17',
    });
    expect(datePreset('month', new Date(2026, 9, 17))).toEqual({
      from: '2026-10-01',
      to: '2026-10-17',
    });
  });

  it('keeps unknown-only groups distinct from zero-cost groups in comparisons', () => {
    expect(
      comparison(
        [row({ model: 'a', costUsd: null }), row({ model: 'b', costUsd: 0 })],
        'model',
        'cost',
      ),
    ).toEqual([
      { label: 'b', value: 0, missing: 0 },
      { label: 'a', value: null, missing: 1 },
    ]);
  });
});
