import { useMemo, useState } from 'react';
import { barX, defineChart } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { comparison } from '../../domain/analytics';
import type { Metric, UsageRequest } from '../../domain/types';
import { money, number } from '../../../../shared/format';

export function ComparisonChart({ requests }: { requests: UsageRequest[] }) {
  const [by, setBy] = useState<'model' | 'kind'>('model');
  const [metric, setMetric] = useState<Metric>('requests');
  const groups = useMemo(
    () => comparison(requests, by, metric),
    [requests, by, metric],
  );
  const data = useMemo(
    () =>
      groups.flatMap((row) =>
        row.value === null ? [] : [{ ...row, value: row.value }],
      ),
    [groups],
  );
  const chart = useMemo(
    () =>
      defineChart({
        marks: [barX(data, { x: 'value', y: 'label', fill: '#168779' })],
        scales: {
          x: {
            scale: scaleLinear,
            domain: [
              0,
              data.reduce(
                (maximum, row) => Math.max(maximum, row.value),
                metric === 'requests' ? 1 : 1e-6,
              ),
            ],
            nice: true,
            grid: true,
            axis: {
              ticks: {
                count: 4,
                format: (value) =>
                  metric === 'cost' ? money(value) : number(value),
              },
            },
          },
          y: {
            scale: () => scaleBand<string>().padding(0.45),
            domain: data.map((row) => row.label),
            axis: {
              ticks: {
                format: (value) =>
                  value.length > 22 ? `${value.slice(0, 20)}…` : value,
              },
            },
          },
        },
        margin: { left: 145, right: 25, top: 14, bottom: 35 },
        tooltip: {
          use: tooltip,
          format: (point) =>
            `${point.datum.label}\n${metric === 'cost' ? money(point.datum.value) : number(point.datum.value)}${metric === 'minutes' ? ' min' : metric === 'requests' ? ' requests' : ' USD'}\n${point.datum.missing} without data for this metric`,
        },
      }),
    [data, metric],
  );
  return (
    <article className="chart-card comparison-card">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">DISTRIBUTION</span>
          <h3>{by === 'model' ? 'Usage by model' : 'Usage by operation'}</h3>
        </div>
      </div>
      <div className="chart-controls comparison-controls">
        <label className="sr-only" htmlFor="comparison-by">
          Compare by
        </label>
        <select
          id="comparison-by"
          value={by}
          onChange={(event) => setBy(event.target.value as 'model' | 'kind')}
        >
          <option value="model">By model</option>
          <option value="kind">By operation</option>
        </select>
        <label className="sr-only" htmlFor="comparison-metric">
          Comparison metric
        </label>
        <select
          id="comparison-metric"
          value={metric}
          onChange={(event) => setMetric(event.target.value as Metric)}
        >
          <option value="requests">Requests</option>
          <option value="cost">Spend, USD</option>
          <option value="minutes">Audio, minutes</option>
        </select>
      </div>
      {data.length ? (
        <div className="comparison-scroll">
          <Chart
            definition={chart}
            height={Math.max(215, data.length * 42 + 45)}
            ariaLabel={`${metric === 'requests' ? 'Requests' : metric === 'cost' ? 'Spend' : 'Minutes'} by ${by === 'model' ? 'model' : 'operation'}`}
          />
        </div>
      ) : (
        <div className="chart-empty">
          <p>No values available to compare.</p>
        </div>
      )}
      <div className="chart-footnote">
        {groups.some((row) => row.value === null)
          ? 'Groups without known values are not shown.'
          : 'Comparison of the entire filtered selection.'}
      </div>
    </article>
  );
}
