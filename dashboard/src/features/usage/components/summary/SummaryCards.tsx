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
      color: 'bg-[#edf7f3] text-teal',
    },
    {
      title: 'Recorded spend',
      value: money(summary.cost),
      note: `${summary.count - summary.missingCosts} of ${summary.count} with recorded cost · USD`,
      icon: CircleDollarSign,
      color: 'bg-[#edf7f3] text-teal',
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
      color: 'bg-[#eef3fb] text-[#5d86ba]',
    },
    {
      title: 'Median latency',
      value: latency(summary.medianLatency),
      note: `${summary.knownLatencies} of ${summary.count} with latency`,
      icon: Clock3,
      color: 'bg-[#faf5eb] text-[#bd914e]',
    },
  ];
  return (
    <div
      className="my-4.5 grid grid-cols-4 gap-3 max-[1150px]:grid-cols-2 max-[540px]:gap-2.25"
      aria-label="Selection summary"
    >
      {cards.map(({ title, value, note, icon: Icon, color }) => (
        <article
          key={title}
          className="min-w-0 rounded-[10px] border border-border bg-white px-3.75 py-4 shadow-card max-[540px]:p-3.25"
        >
          <div className="flex items-center justify-between gap-1 text-[11px] text-[#697787]">
            {title}
            <span className={`flex rounded-[7px] p-1.25 ${color}`}>
              <Icon size={16} />
            </span>
          </div>
          <strong className="mt-1.75 mb-0.5 block text-[clamp(18px,1.9vw,27px)] leading-normal font-[650] tracking-[-0.7px] tabular-nums wrap-anywhere max-[1150px]:text-[27px] max-[540px]:text-[23px]">
            {value}
          </strong>
          <p className="text-[10px] text-muted">{note}</p>
        </article>
      ))}
    </div>
  );
}
