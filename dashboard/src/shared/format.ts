export const number = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
export const money = (value: number | null) =>
  value === null
    ? 'No data'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(value);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
export const duration = (seconds: number | null) =>
  seconds === null ? 'No data' : `${number(seconds)} s`;
export const latency = (ms: number | null) =>
  ms === null
    ? 'No data'
    : ms >= 1000
      ? `${number(ms / 1000)} s`
      : `${number(ms)} ms`;
