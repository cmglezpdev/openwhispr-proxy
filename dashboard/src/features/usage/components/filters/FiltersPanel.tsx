import { FormField } from '../../../../shared/ui/FormField';
import { Button } from '../../../../shared/ui/Button';
import { useId } from 'react';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import {
  activeFilterLabels,
  emptyFilters,
  filterErrors,
} from '../../domain/filters';
import { datePreset } from '../../domain/dates';
import type { DatePreset } from '../../domain/dates';
import type { UsageFilters } from '../../domain/types';
import { NumberRange } from './NumberRange';

interface Props {
  label: string;
  filters: UsageFilters;
  models: string[];
  count: number;
  total: number;
  onChange: (filters: UsageFilters) => void;
}

const presets: [DatePreset, string][] = [
  ['all', 'All time'],
  ['today', 'Today'],
  ['7', '7 days'],
  ['30', '30 days'],
  ['90', '90 days'],
  ['month', 'This month'],
];

export function FiltersPanel({
  label,
  filters,
  models,
  count,
  total,
  onChange,
}: Props) {
  const id = useId();
  const update = <K extends keyof UsageFilters>(
    key: K,
    value: UsageFilters[K],
  ) => onChange({ ...filters, [key]: value });
  const active = activeFilterLabels(filters);
  const errors = filterErrors(filters);
  return (
    <section
      className="rounded-[11px] border border-border bg-white px-4.5 pt-4 shadow-card max-[540px]:px-3.25"
      aria-label={label}
    >
      <div className="mb-3.5 flex justify-between gap-2.5 text-[11px] max-[540px]:flex-col max-[540px]:items-start max-[540px]:gap-1.25 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-1.75 [&_h2]:text-[12px] [&_h2]:tracking-normal">
        <h2>
          <SlidersHorizontal size={15} />
          {label}
        </h2>
        <span className="text-muted">
          {count.toLocaleString('en-US')} of {total.toLocaleString('en-US')}{' '}
          requests
        </span>
      </div>
      <div className="grid grid-cols-[minmax(190px,1.8fr)_repeat(3,minmax(115px,1fr))] items-end gap-3.25 max-[1150px]:grid-cols-3 max-[540px]:grid-cols-2 max-[540px]:gap-2.5">
        <label className="flex items-center gap-1.75 rounded-[7px] border border-border pl-2.5 text-muted focus-within:outline-2 focus-within:outline-teal max-[1150px]:col-span-full [&_input]:w-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:pl-0 [&_input]:text-[12px] [&_input]:outline-none">
          <Search size={17} />
          <input
            aria-label={`${label}: search text`}
            placeholder="Search results…"
            value={filters.query}
            onChange={(event) => update('query', event.target.value)}
          />
        </label>
        <FormField>
          From
          <input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => update('from', event.target.value)}
          />
        </FormField>
        <FormField>
          To
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => update('to', event.target.value)}
          />
        </FormField>
        <FormField>
          Operation
          <select
            value={filters.kind}
            onChange={(event) =>
              update('kind', event.target.value as UsageFilters['kind'])
            }
          >
            <option value="all">All</option>
            <option value="transcription">Transcription</option>
            <option value="enhancement">Text enhancement</option>
          </select>
        </FormField>
      </div>
      <div className="flex items-center justify-between gap-2.5 py-3.25 max-[540px]:flex-wrap">
        <div
          className="flex flex-wrap gap-1 max-[540px]:gap-0"
          aria-label="Quick date ranges"
        >
          {presets.map(([value, title]) => (
            <button
              key={value}
              className={`rounded-[5px] border px-2.25 py-0.75 text-[11px] hover:text-teal max-[540px]:px-1.75 ${
                filters.from === datePreset(value).from &&
                filters.to === datePreset(value).to
                  ? 'border-[#d6e9e2] bg-teal-light text-teal'
                  : 'border-transparent bg-transparent text-muted'
              }`}
              onClick={() => onChange({ ...filters, ...datePreset(value) })}
            >
              {title}
            </button>
          ))}
        </div>
        <Button variant="text" onClick={() => onChange(emptyFilters())}>
          <RotateCcw size={13} />
          Clear filters
        </Button>
      </div>
      <details className="group border-t border-border [&_summary]:flex [&_summary]:list-none [&_summary]:items-center [&_summary]:gap-1.75 [&_summary]:py-2.5 [&_summary]:text-[11px] [&_summary::-webkit-details-marker]:hidden [&_summary]:after:ml-auto [&_summary]:after:text-[16px] [&_summary]:after:text-muted [&_summary]:after:content-['+'] [&[open]_summary]:after:content-['−'] [&_summary>span]:ml-1.25 [&_summary>span]:text-[10px] max-[800px]:[&_summary>span]:hidden">
        <summary>
          <SlidersHorizontal size={14} />
          Advanced filters{' '}
          <span className="text-muted">
            Model, cost, duration and identifiers
          </span>
        </summary>
        <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-4.5 border-t border-border pt-3.75 pb-4.5 max-[800px]:grid-cols-2 max-[540px]:grid-cols-1">
          <fieldset className="[&_legend_span]:block [&_legend_span]:text-[10px] [&_legend_span]:font-normal">
            <legend>
              Models <span className="text-muted">Select one or more</span>
            </legend>
            <div className="flex max-h-36.25 flex-col gap-1.75 overflow-auto [&_label]:flex [&_label]:items-center [&_label]:gap-1.5 [&_label]:text-[11px] [&_label]:wrap-anywhere">
              {models.map((model) => (
                <label key={model}>
                  <input
                    type="checkbox"
                    checked={filters.models.includes(model)}
                    onChange={(event) =>
                      update(
                        'models',
                        event.target.checked
                          ? [...filters.models, model]
                          : filters.models.filter((item) => item !== model),
                      )
                    }
                  />
                  {model || 'Unknown model'}
                </label>
              ))}
              {!models.length && (
                <span className="text-muted">No models yet.</span>
              )}
            </div>
          </fieldset>
          <div>
            <NumberRange
              label="Cost, USD"
              value={filters.cost}
              onChange={(value) => update('cost', value)}
            />
            <FormField className="mt-3" htmlFor={`${id}-cost`}>
              Cost availability
              <select
                id={`${id}-cost`}
                value={filters.costAvailability}
                onChange={(event) =>
                  update(
                    'costAvailability',
                    event.target.value as UsageFilters['costAvailability'],
                  )
                }
              >
                <option value="all">All</option>
                <option value="known">With recorded cost</option>
                <option value="unknown">Without recorded cost</option>
              </select>
            </FormField>
          </div>
          <div>
            <NumberRange
              label="Audio duration, s"
              value={filters.duration}
              onChange={(value) => update('duration', value)}
            />
            <p className="mt-1.5 mb-3.25 text-[10px] font-normal text-muted">
              Filtering by duration excludes text enhancements and audio without
              a recorded duration.
            </p>
            <NumberRange
              label="Latency, ms"
              value={filters.latency}
              onChange={(value) => update('latency', value)}
            />
          </div>
          <FormField className="col-span-full max-w-112.5">
            Exact identifier
            <input
              placeholder="ID, row key or generation_id"
              value={filters.identifier}
              onChange={(event) => update('identifier', event.target.value)}
            />
            <span className="mt-1.5 mb-3.25 text-[10px] font-normal text-muted">
              A numeric ID may match multiple tables. Use the full row key to
              select a single row.
            </span>
          </FormField>
        </div>
      </details>
      {!!active.length && (
        <div
          className="flex flex-wrap gap-1.5 pb-3.25"
          aria-label="Active filters"
        >
          {active.map((item) => (
            <span
              className="inline-flex rounded-[5px] bg-teal-light px-1.75 py-0.75 text-[10px] text-teal wrap-anywhere"
              key={item}
            >
              {item}
            </span>
          ))}
        </div>
      )}
      {!!errors.length && (
        <div className="pb-3 text-[12px] text-rose" role="alert">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </section>
  );
}
