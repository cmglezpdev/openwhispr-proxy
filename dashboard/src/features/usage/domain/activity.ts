import { summarize, timeline, type TimelineBucket } from './analytics';
import { dateInput, localDate, nextDay } from './dates';
import type { UsageFilters, UsageRequest } from './types';

/** Daily values share Trend's aggregation and unknown-value semantics. */
export function dailyActivity(requests: UsageRequest[], filters: UsageFilters) {
  if (requests.length) return timeline(requests, filters, 'day');
  if (!filters.from || !filters.to) return [];
  const buckets: TimelineBucket[] = [];
  for (
    let day = localDate(filters.from);
    day <= localDate(filters.to);
    day = nextDay(day)
  ) {
    const date = dateInput(day);
    buckets.push({
      date,
      end: date,
      requests: 0,
      cost: 0,
      minutes: 0,
      missingCosts: 0,
      missingDurations: 0,
    });
  }
  return buckets;
}

function compactPeriods(requests: UsageRequest[], filters: UsageFilters) {
  const days = dailyActivity(requests, filters);
  if (!days.length) return [];
  const start = localDate(days[0].date);
  const until = nextDay(localDate(days[days.length - 1].date));
  const boundaries: Date[] = [start];
  if (days.length === 1) {
    // Elapsed hours preserve both repeated fall-back hours and 23-hour days.
    for (
      let time = start.getTime() + 3_600_000;
      time < until.getTime();
      time += 3_600_000
    ) {
      boundaries.push(new Date(time));
    }
  } else {
    const step = Math.ceil(days.length / 30);
    for (let index = step; index < days.length; index += step) {
      boundaries.push(localDate(days[index].date));
    }
  }
  boundaries.push(until);
  const groups: UsageRequest[][] = Array.from(
    { length: boundaries.length - 1 },
    () => [],
  );
  for (const row of requests) {
    const time = new Date(row.createdAt).getTime();
    const index = boundaries.findIndex(
      (date, i) =>
        i < groups.length &&
        time >= date.getTime() &&
        time < boundaries[i + 1].getTime(),
    );
    if (index >= 0) groups[index].push(row);
  }
  return groups.map((rows, index) => ({
    date: boundaries[index].toISOString(),
    end: new Date(boundaries[index + 1].getTime() - 1).toISOString(),
    rows,
  }));
}

/** Sum calendar intervals, never sample away requests to shorten a sparkline. */
export function compactActivity(
  requests: UsageRequest[],
  filters: UsageFilters,
) {
  return compactPeriods(requests, filters).map(
    ({ rows, date, end }): TimelineBucket => {
      const summary = summarize(rows);
      return {
        date,
        end,
        requests: summary.count,
        cost: rows.length ? summary.cost : 0,
        minutes: summary.audioCount ? summary.minutes : 0,
        missingCosts: summary.missingCosts,
        missingDurations: summary.missingDurations,
      };
    },
  );
}

export function compactSpeakingActivity(
  requests: UsageRequest[],
  filters: UsageFilters,
) {
  return compactPeriods(requests, filters).map(({ rows, date, end }) => {
    const summary = speakingSummary(rows);
    return {
      date,
      end,
      words: summary.audioCount ? summary.words : 0,
      wordsPerMinute: summary.wordsPerMinute,
    };
  });
}

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });

export function speakingSummary(requests: UsageRequest[]) {
  const audio = requests.filter((row) => row.kind === 'transcription');
  let words = 0;
  let eligibleWords = 0;
  let eligibleSeconds = 0;
  let withText = 0;
  let measured = 0;
  for (const row of audio) {
    let count = 0;
    for (const part of wordSegmenter.segment(row.text ?? '')) {
      if (part.isWordLike) count++;
    }
    if (!count) continue;
    withText++;
    words += count;
    if (
      row.durationSeconds !== null &&
      row.durationSeconds > 0 &&
      Number.isFinite(row.durationSeconds)
    ) {
      measured++;
      eligibleWords += count;
      eligibleSeconds += row.durationSeconds;
    }
  }
  return {
    words: withText ? words : null,
    wordsPerMinute: eligibleSeconds
      ? eligibleWords / (eligibleSeconds / 60)
      : null,
    audioCount: audio.length,
    withText,
    measured,
  };
}

function dailyStreaks(requests: UsageRequest[], now: Date) {
  const today = dateInput(now);
  const days = Array.from(
    new Set(
      requests
        .filter((row) => row.kind === 'transcription')
        .map((row) => dateInput(new Date(row.createdAt)))
        .filter((date) => date <= today),
    ),
  ).sort();
  if (!days.length) return [];
  const active = new Set(days);
  const result: { date: string; current: number; longest: number }[] = [];
  let longest = 0;
  let run = 0;
  let previous: string | undefined;
  for (
    let day = localDate(days[0]);
    dateInput(day) <= today;
    day = nextDay(day)
  ) {
    const date = dateInput(day);
    const yesterday = dateInput(
      new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1),
    );
    if (active.has(date)) {
      run = previous === yesterday ? run + 1 : 1;
      longest = Math.max(longest, run);
      previous = date;
    }
    result.push({
      date,
      current: previous === date ? run : 0,
      longest,
    });
  }
  return result;
}

/** Streaks always receive the full history, independent of view filters. */
export function activityStreaks(requests: UsageRequest[], now = new Date()) {
  const last = dailyStreaks(requests, now).at(-1);
  return { current: last?.current ?? 0, longest: last?.longest ?? 0 };
}

export function streakActivity(requests: UsageRequest[], now = new Date()) {
  const days = dailyStreaks(requests, now);
  const step = Math.ceil(days.length / 30);
  // Streaks are state at period end, not quantities that can be summed.
  return days.filter(
    (_, index) => (index + 1) % step === 0 || index === days.length - 1,
  );
}
