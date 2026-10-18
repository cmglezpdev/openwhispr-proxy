export type {
  OperationKind,
  UsageRequest,
  UsageSnapshot,
} from '../../../../../src/usage/domain/usage-request';

export type Granularity = 'day' | 'week' | 'month' | 'year';
export type Metric = 'requests' | 'cost' | 'minutes';
export interface NumberFilter {
  operator: 'between' | 'gt' | 'lt';
  min: string;
  max: string;
}
export interface UsageFilters {
  from: string;
  to: string;
  kind: 'all' | 'transcription' | 'enhancement';
  models: string[];
  query: string;
  identifier: string;
  costAvailability: 'all' | 'known' | 'unknown';
  cost: NumberFilter;
  duration: NumberFilter;
  latency: NumberFilter;
}
