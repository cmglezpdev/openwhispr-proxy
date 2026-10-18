import { localDate, nextDay } from './dates';
import type { NumberFilter, UsageFilters, UsageRequest } from './types';

export function emptyFilters(): UsageFilters {
  const range = (): NumberFilter => ({ operator: 'between', min: '', max: '' });
  return {
    from: '',
    to: '',
    kind: 'all',
    models: [],
    query: '',
    identifier: '',
    costAvailability: 'all',
    cost: range(),
    duration: range(),
    latency: range(),
  };
}

export function filterErrors(filters: UsageFilters): string[] {
  const errors: string[] = [];
  if (filters.from && filters.to && filters.from > filters.to)
    errors.push('The start date must be on or before the end date.');
  for (const [label, range] of [
    ['Cost', filters.cost],
    ['Duration', filters.duration],
    ['Latency', filters.latency],
  ] as const) {
    const values =
      range.operator === 'between' ? [range.min, range.max] : [range.min];
    if (
      values.some(
        (value) =>
          value !== '' &&
          (!Number.isFinite(Number(value)) || Number(value) < 0),
      )
    )
      errors.push(`${label}: use positive numbers or zero.`);
    if (
      range.operator === 'between' &&
      range.min !== '' &&
      range.max !== '' &&
      Number(range.min) > Number(range.max)
    )
      errors.push(`${label}: the minimum exceeds the maximum.`);
  }
  return errors;
}

function matchesNumber(value: number | null, filter: NumberFilter): boolean {
  const { operator, min, max } = filter;
  if (min === '' && (operator !== 'between' || max === '')) return true;
  if (value === null) return false;
  if (operator === 'gt') return value > Number(min);
  if (operator === 'lt') return value < Number(min);
  return (
    (min === '' || value >= Number(min)) && (max === '' || value <= Number(max))
  );
}

export function filterRequests(
  requests: UsageRequest[],
  filters: UsageFilters,
): UsageRequest[] {
  if (filterErrors(filters).length) return [];
  const from = filters.from ? localDate(filters.from).getTime() : -Infinity;
  const to = filters.to ? nextDay(localDate(filters.to)).getTime() : Infinity;
  const query = filters.query.trim().toLocaleLowerCase();
  const identifier = filters.identifier.trim();
  return requests.filter((row) => {
    const timestamp = new Date(row.createdAt).getTime();
    return (
      timestamp >= from &&
      timestamp < to &&
      (filters.kind === 'all' || row.kind === filters.kind) &&
      (!filters.models.length || filters.models.includes(row.model ?? '')) &&
      (!query || (row.text ?? '').toLocaleLowerCase().includes(query)) &&
      (!identifier ||
        [row.key, String(row.id), row.generationId].includes(identifier)) &&
      (filters.costAvailability === 'all' ||
        (filters.costAvailability === 'known'
          ? row.costUsd !== null
          : row.costUsd === null)) &&
      matchesNumber(row.costUsd, filters.cost) &&
      matchesNumber(row.durationSeconds, filters.duration) &&
      matchesNumber(row.latencyMs, filters.latency)
    );
  });
}

export function activeFilterLabels(filters: UsageFilters): string[] {
  const labels: string[] = [];
  if (filters.from || filters.to)
    labels.push(`${filters.from || 'Start'} → ${filters.to || 'Today'}`);
  if (filters.kind !== 'all')
    labels.push(
      filters.kind === 'transcription' ? 'Transcription' : 'Text enhancement',
    );
  if (filters.models.length) labels.push(`${filters.models.length} model(s)`);
  if (filters.query.trim()) labels.push(`Text: ${filters.query.trim()}`);
  if (filters.identifier.trim())
    labels.push(`ID: ${filters.identifier.trim()}`);
  if (filters.costAvailability !== 'all')
    labels.push(
      filters.costAvailability === 'known' ? 'With cost' : 'Without cost',
    );
  for (const [label, range] of [
    ['USD', filters.cost],
    ['Audio, s', filters.duration],
    ['Latency, ms', filters.latency],
  ] as const) {
    if (range.operator === 'between' && (range.min || range.max))
      labels.push(`${label}: ${range.min || '0'} to ${range.max || '∞'}`);
    if (range.operator !== 'between' && range.min)
      labels.push(
        `${label} ${range.operator === 'gt' ? '>' : '<'} ${range.min}`,
      );
  }
  return labels;
}
