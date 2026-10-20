export interface TimelineBucket {
  date: string;
  end: string;
  requests: number;
  cost: number | null;
  minutes: number | null;
  missingCosts: number;
  missingDurations: number;
}

export interface TimelinePoint {
  period: string;
  end: string;
  missingCosts: number;
  missingDurations: number;
  value: number;
  series: string;
}

export interface DailyStreak {
  date: string;
  current: number;
  longest: number;
}
