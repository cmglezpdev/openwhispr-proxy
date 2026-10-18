import { useMemo, useState } from 'react';
import {
  compactSpeakingActivity,
  speakingSummary,
  streakActivity,
} from '../../domain/activity';
import type { UsageFilters, UsageRequest } from '../../domain/types';
import { compactWords, number } from '../../../../shared/format';
import { CardSparkline } from './CardSparkline';

export function SpeakingStats({
  requests,
  history,
  filters,
}: {
  requests: UsageRequest[];
  history: UsageRequest[];
  filters: UsageFilters;
}) {
  const speech = useMemo(() => speakingSummary(requests), [requests]);
  const speechSeries = useMemo(
    () => compactSpeakingActivity(requests, filters),
    [requests, filters],
  );
  // History is a reload-only snapshot; use its render session's calendar date.
  const [now] = useState(() => new Date());
  const streakSeries = useMemo(
    () => streakActivity(history, now),
    [history, now],
  );
  const streaks = streakSeries.at(-1) ?? { current: 0, longest: 0 };
  const cards = [
    {
      label: 'Words spoken',
      value: speech.words === null ? 'No data' : compactWords(speech.words),
      exact:
        speech.words === null ? undefined : `${number(speech.words)} words`,
      note: `${speech.withText} of ${speech.audioCount} transcriptions with words · Current selection`,
      values: speechSeries.map((point) => point.words),
    },
    {
      label: 'Words per minute',
      value:
        speech.wordsPerMinute === null
          ? 'No data'
          : number(speech.wordsPerMinute),
      note: `${speech.measured} of ${speech.audioCount} transcriptions with words and duration · Includes silence`,
      values: speechSeries.map((point) => point.wordsPerMinute),
    },
    {
      label: 'Current streak',
      value: `${number(streaks.current)} ${streaks.current === 1 ? 'day' : 'days'}`,
      note: 'All history · Consecutive days through today',
      values: streakSeries.map((point) => point.current),
    },
    {
      label: 'Longest streak',
      value: `${number(streaks.longest)} ${streaks.longest === 1 ? 'day' : 'days'}`,
      note: 'All history · Consecutive transcription days',
      values: streakSeries.map((point) => point.longest),
    },
  ];
  return (
    <section className="my-4.5" aria-label="Speaking statistics">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3>Speaking activity</h3>
        <p className="text-[10px] text-muted">
          Transcriptions only · Days in your browser’s time zone
        </p>
      </div>
      <div className="grid grid-cols-4 gap-3 max-[1150px]:grid-cols-2 max-[540px]:grid-cols-1">
        {cards.map(({ label, value, note, values, exact }) => (
          <article
            key={label}
            className="relative min-h-37 min-w-0 overflow-hidden rounded-[10px] border border-border bg-white p-4 shadow-card"
          >
            <CardSparkline values={values} />
            <div className="relative z-10">
              <p className="text-[11px] text-muted">{label}</p>
              <strong
                title={exact}
                aria-label={exact}
                className="my-1.5 block text-[25px] font-[650] tracking-[-0.6px] tabular-nums"
              >
                {value}
              </strong>
              <p className="text-[10px] text-muted">{note}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
