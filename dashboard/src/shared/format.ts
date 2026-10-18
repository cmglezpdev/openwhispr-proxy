export const number = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
export const compactWords = (value: number) =>
  value < 1000 ? number(value) : `${number(Math.floor(value / 1000))}K`;
export const money = (value: number | null, maximumFractionDigits = 6) =>
  value === null
    ? 'No data'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits,
      }).format(value);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
export const duration = (seconds: number | null) =>
  seconds === null ? 'No data' : `${number(seconds)} s`;

export type AudioUnit = 'auto' | 'minutes' | 'hours';

export function audioDuration(
  seconds: number | null,
  unit: AudioUnit = 'auto',
) {
  if (seconds === null) return 'No data';
  if (unit === 'minutes') return `${number(seconds / 60)} min`;
  if (unit === 'hours') return `${number(seconds / 3600)} h`;
  // Round before choosing units so 59.9 seconds cannot become "60 s".
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole} s`;
  if (whole < 3600) {
    const remainder = whole % 60;
    return `${Math.floor(whole / 60)} min${remainder ? ` ${remainder} s` : ''}`;
  }
  const minutes = Math.round(seconds / 60);
  const remainder = minutes % 60;
  return `${Math.floor(minutes / 60)} h${remainder ? ` ${remainder} min` : ''}`;
}
export const latency = (ms: number | null) =>
  ms === null
    ? 'No data'
    : ms >= 1000
      ? `${number(ms / 1000)} s`
      : `${number(ms)} ms`;
