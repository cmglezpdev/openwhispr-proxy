import { Activity, CircleDollarSign, Clock3, Headphones } from 'lucide-react';
import { summarize } from '../../domain/analytics';
import type { UsageRequest } from '../../domain/types';
import { latency, money, number } from '../../../../shared/format';

export function SummaryCards({ requests }: { requests: UsageRequest[] }) {
  const summary = summarize(requests);
  const cards = [
    {
      title: 'Requests',
      value: number(summary.count),
      note: 'In the current selection',
      icon: Activity,
      color: 'teal',
    },
    {
      title: 'Recorded spend',
      value: money(summary.cost),
      note: `${summary.count - summary.missingCosts} of ${summary.count} with recorded cost · USD`,
      icon: CircleDollarSign,
      color: 'teal',
    },
    {
      title: 'Audio processed',
      value:
        summary.minutes === null
          ? summary.audioCount
            ? 'No data'
            : 'Not applicable'
          : `${number(summary.minutes)} min`,
      note: `${summary.audioCount - summary.missingDurations} of ${summary.audioCount} audio requests with duration`,
      icon: Headphones,
      color: 'blue',
    },
    {
      title: 'Median latency',
      value: latency(summary.medianLatency),
      note: `${summary.knownLatencies} of ${summary.count} with latency`,
      icon: Clock3,
      color: 'amber',
    },
  ];
  return (
    <div className="summary-grid" aria-label="Selection summary">
      {cards.map(({ title, value, note, icon: Icon, color }) => (
        <article key={title} className="summary-card">
          <div className="card-label">
            {title}
            <span className={`metric-icon ${color}`}>
              <Icon size={16} />
            </span>
          </div>
          <strong>{value}</strong>
          <p>{note}</p>
        </article>
      ))}
    </div>
  );
}
