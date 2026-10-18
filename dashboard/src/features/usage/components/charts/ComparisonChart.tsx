import { Select } from '../../../../shared/ui/Select';
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
    <article className="min-w-0 rounded-[11px] border border-border bg-white px-4.5 pt-4.75 pb-3 shadow-card max-[540px]:px-2.5 max-[540px]:pt-3.75 max-[540px]:pb-2.5">
      <div className="flex items-center justify-between gap-3 max-[1150px]:flex-wrap [&_h3]:mt-1.25 [&_h3]:text-[14px]">
        <div>
          <span className="flex items-center gap-1.75 text-[10px] font-[650] tracking-[1.5px] text-muted">
            DISTRIBUTION
          </span>
          <h3>{by === 'model' ? 'Usage by model' : 'Usage by operation'}</h3>
        </div>
      </div>
      <div className="flex gap-1.75 max-[1150px]:flex-wrap mt-3.5">
        <label className="sr-only" htmlFor="comparison-by">
          Compare by
        </label>
        <Select
          id="comparison-by"
          value={by}
          onValueChange={setBy}
          size="compact"
          options={[
            { value: 'model', label: 'By model' },
            { value: 'kind', label: 'By operation' },
          ]}
        />
        <label className="sr-only" htmlFor="comparison-metric">
          Comparison metric
        </label>
        <Select
          id="comparison-metric"
          value={metric}
          onValueChange={setMetric}
          size="compact"
          options={[
            { value: 'requests', label: 'Requests' },
            { value: 'cost', label: 'Spend, USD' },
            { value: 'minutes', label: 'Audio, minutes' },
          ]}
        />
      </div>
      {data.length ? (
        <div className="max-h-67.75 overflow-y-auto max-[800px]:max-h-75">
          <Chart
            definition={chart}
            height={Math.max(215, data.length * 42 + 45)}
            ariaLabel={`${metric === 'requests' ? 'Requests' : metric === 'cost' ? 'Spend' : 'Minutes'} by ${by === 'model' ? 'model' : 'operation'}`}
          />
        </div>
      ) : (
        <div className="flex h-68.75 flex-col items-center justify-center gap-2.5 text-center text-[12px] text-muted">
          <p>No values available to compare.</p>
        </div>
      )}
      <div className="mt-1.25 border-t border-[#f0f3f5] pt-2.25 text-[10px] text-muted">
        {groups.some((row) => row.value === null)
          ? 'Groups without known values are not shown.'
          : 'Comparison of the entire filtered selection.'}
      </div>
    </article>
  );
}
