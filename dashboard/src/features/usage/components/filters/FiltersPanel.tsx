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
    <section className="filter-panel" aria-label={label}>
      <div className="filter-heading">
        <h2>
          <SlidersHorizontal size={15} />
          {label}
        </h2>
        <span className="muted">
          {count.toLocaleString('en-US')} of {total.toLocaleString('en-US')}{' '}
          requests
        </span>
      </div>
      <div className="filters-primary">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label={`${label}: search text`}
            placeholder="Search results…"
            value={filters.query}
            onChange={(event) => update('query', event.target.value)}
          />
        </label>
        <label className="field">
          From
          <input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => update('from', event.target.value)}
          />
        </label>
        <label className="field">
          To
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => update('to', event.target.value)}
          />
        </label>
        <label className="field">
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
        </label>
      </div>
      <div className="filter-bottom">
        <div className="presets" aria-label="Quick date ranges">
          {presets.map(([value, title]) => (
            <button
              key={value}
              className={
                filters.from === datePreset(value).from &&
                filters.to === datePreset(value).to
                  ? 'active'
                  : ''
              }
              onClick={() => onChange({ ...filters, ...datePreset(value) })}
            >
              {title}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          onClick={() => onChange(emptyFilters())}
        >
          <RotateCcw size={13} />
          Clear filters
        </button>
      </div>
      <details className="advanced-filters">
        <summary>
          <SlidersHorizontal size={14} />
          Advanced filters{' '}
          <span className="muted">Model, cost, duration and identifiers</span>
        </summary>
        <div className="advanced-grid">
          <fieldset className="models-filter">
            <legend>
              Models <span className="muted">Select one or more</span>
            </legend>
            <div className="model-list">
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
              {!models.length && <span className="muted">No models yet.</span>}
            </div>
          </fieldset>
          <div>
            <NumberRange
              label="Cost, USD"
              value={filters.cost}
              onChange={(value) => update('cost', value)}
            />
            <label className="field compact-field" htmlFor={`${id}-cost`}>
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
            </label>
          </div>
          <div>
            <NumberRange
              label="Audio duration, s"
              value={filters.duration}
              onChange={(value) => update('duration', value)}
            />
            <p className="field-note">
              Filtering by duration excludes text enhancements and audio without
              a recorded duration.
            </p>
            <NumberRange
              label="Latency, ms"
              value={filters.latency}
              onChange={(value) => update('latency', value)}
            />
          </div>
          <label className="field">
            Exact identifier
            <input
              placeholder="ID, row key or generation_id"
              value={filters.identifier}
              onChange={(event) => update('identifier', event.target.value)}
            />
            <span className="field-note">
              A numeric ID may match multiple tables. Use the full row key to
              select a single row.
            </span>
          </label>
        </div>
      </details>
      {!!active.length && (
        <div className="filter-chips" aria-label="Active filters">
          {active.map((item) => (
            <span className="chip" key={item}>
              {item}
            </span>
          ))}
        </div>
      )}
      {!!errors.length && (
        <div className="filter-errors" role="alert">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </section>
  );
}
