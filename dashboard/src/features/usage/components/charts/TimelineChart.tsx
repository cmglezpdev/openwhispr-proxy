import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { barY, defineChart, lineY } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import { timeline, timelineSeries } from '../../domain/analytics';
import { localDate } from '../../domain/dates';
import type {
  Granularity,
  Metric,
  UsageFilters,
  UsageRequest,
} from '../../domain/types';
import { money, number } from '../../../../shared/format';

const metricNames: Record<Metric, string> = {
  requests: 'Requests',
  cost: 'Recorded spend, USD',
  minutes: 'Audio, minutes',
};
const periodNames: Record<Granularity, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

export function TimelineChart({
  requests,
  filters,
}: {
  requests: UsageRequest[];
  filters: UsageFilters;
}) {
  const [metric, setMetric] = useState<Metric>('requests');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [cumulative, setCumulative] = useState(false);
  const buckets = useMemo(
    () => timeline(requests, filters, granularity),
    [requests, filters, granularity],
  );
  const data = useMemo(
    () => timelineSeries(buckets, metric, cumulative),
    [buckets, metric, cumulative],
  );
  const asLine = cumulative && metric === 'cost';
  const chart = useMemo(
    () =>
      defineChart({
        marks: asLine
          ? [
              lineY(data, {
                x: 'period',
                y: 'value',
                color: 'series',
                strokeWidth: 2.5,
              }),
            ]
          : [barY(data, { x: 'period', y: 'value', color: 'series' })],
        scales: {
          x: {
            scale: asLine
              ? () => scalePoint<string>().padding(0.3)
              : () => scaleBand<string>().padding(0.28),
            domain: buckets.map((bucket) => bucket.date),
            axis: {
              ticks: {
                count: 8,
                format: (value) =>
                  granularity === 'year'
                    ? value.slice(0, 4)
                    : new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        ...(granularity === 'month'
                          ? { year: '2-digit' }
                          : { day: 'numeric' }),
                      }).format(localDate(value)),
              },
            },
          },
          y: {
            scale: scaleLinear,
            domain: [
              0,
              metric === 'requests'
                ? buckets.reduce(
                    (maximum, bucket) => Math.max(maximum, bucket.requests),
                    1,
                  )
                : data.reduce(
                    (maximum, row) => Math.max(maximum, row.value),
                    1e-6,
                  ),
            ],
            nice: true,
            grid: true,
            axis: {
              ticks: {
                count:
                  metric === 'requests'
                    ? Math.min(
                        5,
                        buckets.reduce(
                          (maximum, bucket) =>
                            Math.max(maximum, bucket.requests),
                          1,
                        ),
                      )
                    : 5,
                format: (value) =>
                  metric === 'requests' && !Number.isInteger(value)
                    ? ''
                    : metric === 'cost'
                      ? money(value)
                      : number(value),
              },
            },
          },
        },
        margin: {
          left: metric === 'cost' ? 88 : 48,
          right: 20,
          top: 16,
          bottom: 34,
        },
        color: {
          domain: ['Requests', 'Recorded spend', 'Audio'],
          range: ['#168779', '#168779', '#7298ca'],
        },
        tooltip: {
          use: tooltip,
          format: (point) => {
            const row = point.datum;
            return `${row.period} → ${row.end}\n${row.series}: ${metric === 'cost' ? money(row.value) : number(row.value)}${metric === 'minutes' ? ' min' : ''}\n${row.missingCosts} without cost · ${row.missingDurations} audio requests without duration`;
          },
        },
      }),
    [data, buckets, granularity, metric, asLine],
  );
  const missing = buckets.reduce(
    (sum, bucket) =>
      sum +
      (metric === 'cost'
        ? bucket.missingCosts
        : metric === 'minutes'
          ? bucket.missingDurations
          : 0),
    0,
  );
  return (
    <article className="chart-card timeline-card">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">TREND</span>
          <h3>Activity over time</h3>
        </div>
        <div className="chart-controls">
          <label className="sr-only" htmlFor="timeline-metric">
            Timeline metric
          </label>
          <select
            id="timeline-metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
          >
            {Object.entries(metricNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="timeline-period">
            Group by
          </label>
          <select
            id="timeline-period"
            value={granularity}
            onChange={(event) =>
              setGranularity(event.target.value as Granularity)
            }
          >
            {Object.entries(periodNames).map(([value, label]) => (
              <option key={value} value={value}>
                By {label.toLocaleLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="chart-subheading">
        {metric === 'requests' ? (
          <span className="muted">Total requests in each period.</span>
        ) : (
          <span className="muted">
            {metric === 'cost'
              ? 'Recorded costs only. Amounts in USD.'
              : 'Only transcriptions with a recorded duration.'}
          </span>
        )}
        {metric === 'cost' && (
          <label className="inline-checkbox">
            <input
              type="checkbox"
              checked={cumulative}
              onChange={(event) => setCumulative(event.target.checked)}
            />
            Cumulative
          </label>
        )}
      </div>
      {data.length ? (
        <Chart
          definition={chart}
          height={275}
          ariaLabel={`${metricNames[metric]} by ${periodNames[granularity].toLowerCase()}`}
        />
      ) : (
        <div className="chart-empty">
          <BarChart3 size={28} />
          <p>
            {requests.length
              ? 'No values available for this metric.'
              : 'No requests in this selection.'}
          </p>
        </div>
      )}
      <div className="chart-footnote">
        {granularity === 'week' ? 'Weeks run from Monday to Sunday. ' : ''}
        {missing > 0
          ? `${missing} ${metric === 'cost' ? 'requests without cost' : 'audio requests without duration'}. Periods without known values have no bar.`
          : 'Periods without requests are shown as zero.'}
      </div>
    </article>
  );
}
