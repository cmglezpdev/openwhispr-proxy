import type { UsageRequest, UsageFilters } from '../domain/types';

export interface UsageRequestsProps {
  requests: UsageRequest[];
}

export interface UsageSelectionProps extends UsageRequestsProps {
  filters: UsageFilters;
}

export interface SpeakingStatsProps extends UsageSelectionProps {
  history: UsageRequest[];
}

export interface RequestDetailProps {
  request: UsageRequest;
  onClose: () => void;
}

export interface CardSparklineProps {
  values: (number | null)[];
}

export interface SparklinePoint {
  x: number;
  y: number;
}
