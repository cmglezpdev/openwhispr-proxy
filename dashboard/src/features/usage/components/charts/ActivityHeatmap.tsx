import type { UsageSelectionProps } from '../types';
import { Select } from '../../../../shared/ui/Select';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dailyActivity } from '../../domain/activity';
import { localDate } from '../../domain/dates';
import type { Metric } from '../../domain/types';
import { audioDuration, money, number } from '../../../../shared/format';

const colors = [
  'bg-[#edf1f3]',
  'bg-[#d4ece3]',
  'bg-[#91ceba]',
  'bg-[#46a68c]',
  'bg-[#137d70]',
];
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ActivityHeatmap({ requests, filters }: UsageSelectionProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const [calendarWidth, setCalendarWidth] = useState(0);
  useEffect(() => {
    const element = calendarRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setCalendarWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [metric, setMetric] = useState<Metric>('requests');
  const [selected, setSelected] = useState<string | null>(null);
  const days = useMemo(
    () => dailyActivity(requests, filters),
    [requests, filters],
  );
  const values = days.map((day) =>
    metric === 'requests'
      ? day.requests
      : metric === 'cost'
        ? day.cost
        : day.minutes,
  );
  const maximum = Math.max(0, ...values.map((value) => value ?? 0));
  const offset = days.length ? (localDate(days[0].date).getDay() + 6) % 7 : 0;
  const dataWeeks = Math.ceil((days.length + offset) / 7);
  // Fill available space with earlier, out-of-range weeks. Keep the last day
  // in the rightmost column without changing its weekday or the selected range.
  const weeks = Math.max(dataWeeks, Math.ceil((calendarWidth - 46) / 36), 1);
  const leadingWeeks = weeks - dataWeeks;
  const lastDate = days.at(-1)?.date;
  useLayoutEffect(() => {
    const element = calendarRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [calendarWidth, weeks, lastDate]);
  const months = new Map<number, string>();
  days.forEach((day, index) => {
    const date = localDate(day.date);
    if (index === 0 || date.getDate() === 1) {
      months.set(
        leadingWeeks + Math.floor((index + offset) / 7),
        new Intl.DateTimeFormat('en-US', {
          month: 'short',
          year: '2-digit',
        }).format(date),
      );
    }
  });
  // A partial first month may occupy just one column. Leave room for labels.
  const monthLabels = Array.from(months).filter(
    ([week], index, labels) =>
      index === labels.length - 1 || labels[index + 1][0] - week >= 3,
  );
  const describe = (index: number) => {
    const day = days[index];
    const value = values[index];
    const missing =
      metric === 'cost'
        ? day.missingCosts
        : metric === 'minutes'
          ? day.missingDurations
          : 0;
    const formatted =
      value === null
        ? 'No data'
        : metric === 'cost'
          ? money(value)
          : metric === 'minutes'
            ? audioDuration(value * 60)
            : `${number(value)} requests`;
    const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(
      localDate(day.date),
    );
    return `${date}: ${formatted}${missing ? ` · ${missing} ${metric === 'cost' ? 'requests without cost' : 'audio requests without duration'}` : ''}`;
  };
  const selectedIndex = days.findIndex((day) => day.date === selected);
  const missing = days.reduce(
    (sum, day) =>
      sum +
      (metric === 'cost'
        ? day.missingCosts
        : metric === 'minutes'
          ? day.missingDurations
          : 0),
    0,
  );
  return (
    <article
      className="mt-4.5 min-w-0 rounded-[11px] border border-border bg-white p-4.5 shadow-card"
      aria-label="Daily usage heatmap"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-[650] tracking-[1.5px] text-muted">
            DAILY ACTIVITY
          </p>
          <h3 className="mt-1">Your usage, day by day</h3>
        </div>
        <Select
          aria-label="Heatmap metric"
          size="compact"
          value={metric}
          onValueChange={setMetric}
          options={[
            { value: 'requests', label: 'Requests' },
            { value: 'minutes', label: 'Audio processed' },
            { value: 'cost', label: 'Recorded spend' },
          ]}
        />
      </div>
      <div
        ref={calendarRef}
        className="overflow-x-auto pb-2"
        tabIndex={0}
        role="region"
        aria-label="Daily calendar, scroll for more dates"
      >
        {days.length ? (
          <div
            className="grid gap-1 p-1.5"
            style={{
              gridTemplateColumns: `30px repeat(${weeks}, minmax(16px, 1fr))`,
              minWidth: 46 + weeks * 20,
            }}
          >
            {monthLabels.map(([week, label]) => (
              <span
                key={week}
                className="h-5 whitespace-nowrap text-[9px] text-muted"
                style={{ gridColumn: week + 2, gridRow: 1 }}
              >
                {label}
              </span>
            ))}
            {weekdays.map((label, index) => (
              <span
                key={label}
                className="flex items-center text-[9px] text-muted"
                style={{ gridColumn: 1, gridRow: index + 2 }}
              >
                {label}
              </span>
            ))}
            {Array.from({ length: leadingWeeks * 7 + offset }, (_, index) => (
              <span
                key={`outside-${index}`}
                aria-hidden="true"
                className="aspect-square w-full rounded-sm border border-border/40 bg-page/50"
                style={{
                  gridColumn: Math.floor(index / 7) + 2,
                  gridRow: (index % 7) + 2,
                }}
              />
            ))}
            {days.map((day, index) => {
              const value = values[index];
              const level =
                value === null || value === 0
                  ? 0
                  : Math.min(4, Math.ceil((value / maximum) * 4));
              const description = describe(index);
              return (
                <button
                  key={day.date}
                  type="button"
                  title={description}
                  aria-label={description}
                  aria-pressed={selected === day.date}
                  onMouseEnter={() => setSelected(day.date)}
                  onFocus={() => setSelected(day.date)}
                  onClick={() => setSelected(day.date)}
                  className={`aspect-square w-full rounded-sm border ${value === null ? 'border-dashed border-muted bg-white' : `border-transparent ${colors[level]}`} hover:ring-2 hover:ring-teal/40 aria-pressed:ring-2 aria-pressed:ring-teal/60`}
                  style={{
                    gridColumn:
                      leadingWeeks + Math.floor((index + offset) / 7) + 2,
                    gridRow: ((index + offset) % 7) + 2,
                  }}
                />
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-[12px] text-muted">
            No requests in this selection.
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
        <span>
          {days.length
            ? `${days[0].date} to ${days[days.length - 1].date} · `
            : ''}
          Browser time zone · One square per day
        </span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          {colors.map((color) => (
            <span key={color} className={`size-3 rounded-[3px] ${color}`} />
          ))}
          <span>More</span>
          <span className="ml-2 size-3 rounded-[3px] border border-dashed border-muted" />
          <span>No data</span>
          <span className="ml-2 size-3 rounded-[3px] border border-border/40 bg-page/50" />
          <span>Outside selection</span>
        </div>
      </div>
      <p className="mt-2 min-h-4 text-[10px] text-muted" aria-live="polite">
        {selectedIndex >= 0
          ? describe(selectedIndex)
          : 'Hover, focus or tap a day to see its usage.'}
      </p>
      {missing > 0 && (
        <p className="mt-1 text-[10px] text-muted">
          {missing}{' '}
          {metric === 'cost'
            ? 'requests without recorded cost'
            : 'audio requests without duration'}
          . Colors show known usage only.
        </p>
      )}
    </article>
  );
}
