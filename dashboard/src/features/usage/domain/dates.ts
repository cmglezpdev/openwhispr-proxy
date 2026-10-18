import type { Granularity, UsageFilters } from './types';

export function dateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function nextDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

export function startOfPeriod(date: Date, granularity: Granularity): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (granularity === 'week')
    result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  if (granularity === 'month') result.setDate(1);
  if (granularity === 'year') result.setMonth(0, 1);
  return result;
}

export function nextPeriod(date: Date, granularity: Granularity): Date {
  const result = new Date(date);
  if (granularity === 'day') result.setDate(result.getDate() + 1);
  if (granularity === 'week') result.setDate(result.getDate() + 7);
  if (granularity === 'month') result.setMonth(result.getMonth() + 1);
  if (granularity === 'year') result.setFullYear(result.getFullYear() + 1);
  return result;
}

export type DatePreset = 'all' | 'today' | '7' | '30' | '90' | 'month';

export function datePreset(
  preset: DatePreset,
  now = new Date(),
): Pick<UsageFilters, 'from' | 'to'> {
  if (preset === 'all') return { from: '', to: '' };
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'month') from.setDate(1);
  else if (preset !== 'today')
    from.setDate(from.getDate() - Number(preset) + 1);
  return { from: dateInput(from), to: dateInput(now) };
}
