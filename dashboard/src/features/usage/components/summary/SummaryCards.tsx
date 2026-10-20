import type { UsageSelectionProps } from '../types';
import { Select } from '../../../../shared/ui/Select';
import { useMemo, useState } from 'react';
import { summarize } from '../../domain/analytics';
import { compactActivity } from '../../domain/activity';
import {
  audioDuration,
  money,
  number,
  type AudioUnit,
} from '../../../../shared/format';
import { CardSparkline } from './CardSparkline';

export function SummaryCards({ requests, filters }: UsageSelectionProps) {
  const [audioUnit, setAudioUnit] = useState<AudioUnit>('auto');
  const summary = useMemo(() => summarize(requests), [requests]);
  const buckets = useMemo(
    () => compactActivity(requests, filters),
    [requests, filters],
  );
  const cards = [
    {
      title: 'Requests',
      value: number(summary.count),
      note: 'Transcription and text enhancement requests',
      values: buckets.map((bucket) => bucket.requests),
    },
    {
      title: 'Recorded spend',
      value: money(summary.cost, 2),
      note: `${summary.count - summary.missingCosts} of ${summary.count} with recorded cost · USD`,
      values: buckets.map((bucket) => bucket.cost),
    },
    {
      title: 'Audio processed',
      value:
        summary.minutes === null
          ? summary.audioCount
            ? 'No data'
            : 'Not applicable'
          : audioDuration(summary.minutes * 60, audioUnit),
      note: `${summary.audioCount - summary.missingDurations} of ${summary.audioCount} audio requests with duration`,
      values: buckets.map((bucket) => bucket.minutes),
    },
  ];
  return (
    <div
      className="my-4.5 grid grid-cols-3 gap-3 max-[800px]:grid-cols-1"
      aria-label="Selection summary"
    >
      {cards.map(({ title, value, note, values }) => (
        <article
          key={title}
          className="relative min-h-40 min-w-0 overflow-hidden rounded-[10px] border border-border bg-white p-4.5 shadow-card"
        >
          <CardSparkline values={values} />
          <div className="relative z-10">
            <div className="flex min-h-7 items-center justify-between gap-2 text-[12px] text-[#697787]">
              <span>{title}</span>
              {title === 'Audio processed' && (
                <Select
                  aria-label="Audio display unit"
                  size="small"
                  value={audioUnit}
                  onValueChange={setAudioUnit}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'minutes', label: 'Min' },
                    { value: 'hours', label: 'Hours' },
                  ]}
                />
              )}
            </div>
            <strong className="mt-2 mb-1 block text-[clamp(24px,2.6vw,34px)] leading-tight font-[650] tracking-[-0.7px] tabular-nums wrap-anywhere">
              {value}
            </strong>
            <p className="mt-2 text-[10px] text-muted">{note}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
