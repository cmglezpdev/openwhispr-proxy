import type { TimelineBucket, TimelinePoint } from './analytics.types';
import {
  dateInput,
  localDate,
  nextDay,
  nextPeriod,
  startOfPeriod,
} from './dates';
import type { Granularity, Metric, UsageFilters, UsageRequest } from './types';

export function summarize(requests: UsageRequest[]) {
  const costs = requests.flatMap((row) =>
    row.costUsd === null ? [] : [row.costUsd],
  );
  const audio = requests.filter((row) => row.kind === 'transcription');
  const durations = audio.flatMap((row) =>
    row.durationSeconds === null ? [] : [row.durationSeconds],
  );
  const latency = requests
    .flatMap((row) => (row.latencyMs === null ? [] : [row.latencyMs]))
    .sort((a, b) => a - b);
  const middle = Math.floor(latency.length / 2);
  return {
    count: requests.length,
    cost: costs.length ? costs.reduce((sum, cost) => sum + cost, 0) : null,
    missingCosts: requests.length - costs.length,
    minutes: durations.length
      ? durations.reduce((sum, seconds) => sum + seconds, 0) / 60
      : null,
    missingDurations: audio.length - durations.length,
    audioCount: audio.length,
    medianLatency: latency.length
      ? latency.length % 2
        ? latency[middle]
        : (latency[middle - 1] + latency[middle]) / 2
      : null,
    knownLatencies: latency.length,
  };
}

export function timeline(
  requests: UsageRequest[],
  filters: UsageFilters,
  granularity: Granularity,
): TimelineBucket[] {
  if (!requests.length) return [];
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const row of requests) {
    const time = new Date(row.createdAt).getTime();
    minimum = Math.min(minimum, time);
    maximum = Math.max(maximum, time);
  }
  const from = filters.from ? localDate(filters.from) : new Date(minimum);
  const until = filters.to
    ? nextDay(localDate(filters.to))
    : nextDay(new Date(maximum));
  const groups = new Map<string, UsageRequest[]>();
  for (const row of requests) {
    const key = dateInput(startOfPeriod(new Date(row.createdAt), granularity));
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const buckets: TimelineBucket[] = [];
  for (
    let date = startOfPeriod(from, granularity);
    date < until;
    date = nextPeriod(date, granularity)
  ) {
    const key = dateInput(date);
    const rows = groups.get(key) ?? [];
    const summary = summarize(rows);
    buckets.push({
      date: key,
      end: dateInput(new Date(nextPeriod(date, granularity).getTime() - 1)),
      requests: summary.count,
      cost: rows.length ? summary.cost : 0,
      minutes: summary.audioCount ? summary.minutes : 0,
      missingCosts: summary.missingCosts,
      missingDurations: summary.missingDurations,
    });
  }
  return buckets;
}

export function comparison(
  requests: UsageRequest[],
  by: 'model' | 'kind',
  metric: Metric,
) {
  const groups = new Map<string, UsageRequest[]>();
  for (const row of requests) {
    const key =
      by === 'model'
        ? (row.model ?? 'Unknown model')
        : row.kind === 'transcription'
          ? 'Transcription'
          : 'Text enhancement';
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return Array.from(groups, ([label, rows]) => {
    const summary = summarize(rows);
    return {
      label,
      value:
        metric === 'requests'
          ? summary.count
          : metric === 'cost'
            ? summary.cost
            : summary.audioCount
              ? summary.minutes
              : null,
      missing:
        metric === 'cost'
          ? summary.missingCosts
          : metric === 'minutes'
            ? summary.missingDurations
            : 0,
    };
  }).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
}

export function timelineSeries(
  buckets: TimelineBucket[],
  metric: Metric,
  cumulative: boolean,
) {
  const rows: TimelinePoint[] = [];
  let total = 0;
  for (const bucket of buckets) {
    const base = {
      period: bucket.date,
      end: bucket.end,
      missingCosts: bucket.missingCosts,
      missingDurations: bucket.missingDurations,
    };
    if (metric === 'requests') {
      rows.push({ ...base, value: bucket.requests, series: 'Requests' });
      continue;
    }
    const value = metric === 'cost' ? bucket.cost : bucket.minutes;
    if (value === null) continue;
    total += value;
    rows.push({
      ...base,
      value: cumulative && metric === 'cost' ? total : value,
      series: metric === 'cost' ? 'Recorded spend' : 'Audio',
    });
  }
  return rows;
}
