import { describe, expect, it } from 'vitest';
import {
  activityStreaks,
  compactSpeakingActivity,
  compactActivity,
  dailyActivity,
  speakingSummary,
  streakActivity,
} from './activity';
import { dateInput, localDate, nextDay } from './dates';
import { emptyFilters } from './filters';
import type { UsageRequest } from './types';

const row = (overrides: Partial<UsageRequest> = {}): UsageRequest => ({
  key: 'transcription:1',
  id: 1,
  kind: 'transcription',
  createdAt: new Date(2026, 9, 1, 12).toISOString(),
  model: 'test',
  text: 'Hola mundo',
  costUsd: 0.01,
  generationId: null,
  latencyMs: null,
  durationSeconds: 60,
  ...overrides,
});
const at = (day: string) => row({ createdAt: localDate(day).toISOString() });

describe('compact activity and daily heatmap', () => {
  it('preserves all metric totals with at most 30 points across long ranges', () => {
    const rows: UsageRequest[] = [];
    let day = localDate('2025-01-01');
    for (let index = 0; index < 500; index++) {
      rows.push(
        row({
          createdAt: day.toISOString(),
          costUsd: index / 100,
          durationSeconds: index,
        }),
      );
      day = nextDay(day);
    }
    const buckets = compactActivity(rows, emptyFilters());
    expect(buckets.length).toBeLessThanOrEqual(30);
    expect(buckets.reduce((sum, bucket) => sum + bucket.requests, 0)).toBe(500);
    expect(
      buckets.reduce((sum, bucket) => sum + (bucket.cost ?? 0), 0),
    ).toBeCloseTo(1247.5);
    expect(
      buckets.reduce((sum, bucket) => sum + (bucket.minutes ?? 0), 0),
    ).toBeCloseTo(124750 / 60);
    expect(dailyActivity(rows, emptyFilters())).toHaveLength(500);
  });

  it('uses hourly buckets for one day, including its first and last instants', () => {
    const start = localDate('2026-10-01');
    const end = nextDay(start);
    const rows = [
      row({ createdAt: start.toISOString() }),
      row({ createdAt: new Date(end.getTime() - 1).toISOString() }),
    ];
    const buckets = compactActivity(rows, {
      ...emptyFilters(),
      from: '2026-10-01',
      to: '2026-10-01',
    });
    expect(buckets).toHaveLength((end.getTime() - start.getTime()) / 3_600_000);
    expect(buckets[0].requests).toBe(1);
    expect(buckets[buckets.length - 1].requests).toBe(1);
    expect(buckets.reduce((sum, bucket) => sum + bucket.requests, 0)).toBe(2);
  });

  it('retains unknown costs and audio durations while filling empty periods', () => {
    const rows = [row({ costUsd: null, durationSeconds: null })];
    const filters = { ...emptyFilters(), from: '2026-10-01', to: '2026-10-03' };
    const daily = dailyActivity(rows, filters);
    expect(daily.map((day) => day.cost)).toEqual([null, 0, 0]);
    expect(daily.map((day) => day.minutes)).toEqual([null, 0, 0]);
    expect(compactActivity(rows, filters)[0]).toMatchObject({
      cost: null,
      minutes: null,
      missingCosts: 1,
      missingDurations: 1,
    });
    expect(dailyActivity([], filters).map((day) => day.requests)).toEqual([
      0, 0, 0,
    ]);
    expect(dailyActivity([], emptyFilters())).toEqual([]);
    expect(
      dailyActivity([], { ...filters, from: filters.to, to: filters.from }),
    ).toEqual([]);
  });

  it('groups DST transition dates without losing or duplicating requests', () => {
    for (const date of ['2026-03-08', '2026-11-01']) {
      const start = localDate(date);
      const end = nextDay(start);
      const rows: UsageRequest[] = [];
      for (let time = start.getTime(); time < end.getTime(); time += 3_600_000)
        rows.push(row({ createdAt: new Date(time).toISOString() }));
      const buckets = compactActivity(rows, {
        ...emptyFilters(),
        from: date,
        to: date,
      });
      expect(buckets).toHaveLength(rows.length);
      expect(buckets.every((bucket) => bucket.requests === 1)).toBe(true);
    }
  });
});

describe('speaking metrics', () => {
  it('counts transcription words only and computes WPM as a ratio of eligible totals', () => {
    const rows = [
      row({ text: 'Hola, mundo!', durationSeconds: 1 }),
      row({
        text: 'uno dos tres cuatro cinco seis ocho nueve',
        durationSeconds: 59,
      }),
      row({ text: 'texto sin duración', durationSeconds: null }),
      row({ text: 'texto sin tiempo', durationSeconds: 0 }),
      row({ text: '   ... ', durationSeconds: 60 }),
      row({
        kind: 'enhancement',
        text: 'texto mejorado duplicado',
        durationSeconds: null,
      }),
    ];
    expect(speakingSummary(rows)).toEqual({
      words: 16,
      wordsPerMinute: 10,
      withText: 4,
      measured: 2,
      audioCount: 5,
    });
  });

  it('handles absent text and duration without inventing zeros or infinite rates', () => {
    expect(speakingSummary([])).toMatchObject({
      words: null,
      wordsPerMinute: null,
      measured: 0,
    });
    expect(
      speakingSummary([
        row({ text: null }),
        row({ text: 'hola', durationSeconds: null }),
      ]),
    ).toMatchObject({
      words: 1,
      wordsPerMinute: null,
      measured: 0,
      withText: 1,
    });
  });
});

describe('all-history streaks', () => {
  it('deduplicates local transcription days and ignores enhancement-only days', () => {
    const rows = [
      at('2026-09-29'),
      at('2026-09-30'),
      at('2026-10-01'),
      at('2026-10-01'),
      at('2026-10-03'),
      row({ ...at('2026-10-04'), kind: 'enhancement' }),
    ];
    expect(activityStreaks(rows, localDate('2026-10-04'))).toEqual({
      current: 0,
      longest: 3,
    });
    expect(activityStreaks(rows, localDate('2026-10-05'))).toEqual({
      current: 0,
      longest: 3,
    });
    expect(activityStreaks([], localDate('2026-10-04'))).toEqual({
      current: 0,
      longest: 0,
    });
  });

  it('requires a streak ending today across DST calendar boundaries', () => {
    const rows = ['2026-03-07', '2026-03-08', '2026-03-09'].map(at);
    expect(activityStreaks(rows, localDate('2026-03-09'))).toEqual({
      current: 3,
      longest: 3,
    });
    expect(activityStreaks(rows, localDate('2026-03-10'))).toEqual({
      current: 0,
      longest: 3,
    });
    expect(dateInput(new Date(2026, 2, 9, 23, 59))).toBe('2026-03-09');
  });
});

describe('speaking card sparklines', () => {
  it('plots words and weighted speaking rates for the same time intervals', () => {
    const filters = { ...emptyFilters(), from: '2026-10-01', to: '2026-10-03' };
    const rows = [
      row({ text: 'uno dos', durationSeconds: 1 }),
      row({
        text: 'uno dos tres cuatro cinco seis ocho nueve',
        durationSeconds: 59,
      }),
      row({ ...at('2026-10-02'), text: null, durationSeconds: 60 }),
      row({
        ...at('2026-10-03'),
        kind: 'enhancement',
        text: 'no contar estas palabras',
        durationSeconds: null,
      }),
    ];
    expect(
      compactSpeakingActivity(rows, filters).map(
        ({ words, wordsPerMinute }) => ({ words, wordsPerMinute }),
      ),
    ).toEqual([
      { words: 10, wordsPerMinute: 10 },
      { words: null, wordsPerMinute: null },
      { words: 0, wordsPerMinute: null },
    ]);
    expect(
      compactSpeakingActivity([], filters).every(
        (point) => point.words === 0 && point.wordsPerMinute === null,
      ),
    ).toBe(true);
  });

  it('keeps all words and recomputes rates when several days share a point', () => {
    const rows = Array.from({ length: 90 }, (_, index) =>
      row({
        createdAt: new Date(2026, 0, index + 1).toISOString(),
        durationSeconds: index % 2 ? 30 : 90,
      }),
    );
    const points = compactSpeakingActivity(rows, emptyFilters());
    expect(points).toHaveLength(30);
    expect(points.reduce((sum, point) => sum + (point.words ?? 0), 0)).toBe(
      180,
    );
    expect(points[0].wordsPerMinute).toBeCloseTo(6 / (210 / 60));
  });

  it('plots actual streak growth, idle-day resets and historical records', () => {
    const rows = ['2026-10-01', '2026-10-02', '2026-10-04'].map(at);
    const points = streakActivity(rows, localDate('2026-10-06'));
    expect(points.map((point) => [point.current, point.longest])).toEqual([
      [1, 1],
      [2, 2],
      [0, 2],
      [1, 2],
      [0, 2],
      [0, 2],
    ]);
    expect(points.at(-1)).toMatchObject(
      activityStreaks(rows, localDate('2026-10-06')),
    );
    expect(streakActivity([], localDate('2026-10-06'))).toEqual([]);
  });

  it('keeps end-of-period streak states and the final real value in long histories', () => {
    const rows = Array.from({ length: 90 }, (_, index) =>
      row({ createdAt: new Date(2026, 0, index + 1).toISOString() }),
    );
    const now = new Date(2026, 0, 90);
    const points = streakActivity(rows, now);
    expect(points).toHaveLength(30);
    expect(points[0]).toMatchObject({ current: 3, longest: 3 });
    expect(points.at(-1)).toMatchObject({ current: 90, longest: 90 });
  });
});
