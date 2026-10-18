import { useId } from 'react';

/** Decorative view of real aggregates; null intervals remain visible gaps. */
export function CardSparkline({ values }: { values: (number | null)[] }) {
  const id = useId();
  if (!values.some((value) => value !== null)) return null;
  const maximum = Math.max(...values.map((value) => value ?? 0), 1e-9);
  const segments: { x: number; y: number }[][] = [];
  let segment: { x: number; y: number }[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else {
      segment.push({
        x: values.length === 1 ? 200 : (index / (values.length - 1)) * 400,
        y: 96 - (value / maximum) * 82,
      });
    }
  });
  if (segment.length) segments.push(segment);
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-25 w-full"
      viewBox="0 0 400 100"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#168779" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#168779" stopOpacity="0.025" />
        </linearGradient>
      </defs>
      {segments.map((points, index) => {
        const line = points
          .map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`)
          .join(' ');
        return (
          <g key={index}>
            {points.length === 1 && (
              <circle
                cx={points[0].x}
                cy={points[0].y}
                r="2"
                fill="#168779"
                fillOpacity="0.35"
              />
            )}
            <path
              d={`${line} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`}
              fill={`url(#${id})`}
            />
            <path
              d={line}
              fill="none"
              stroke="#168779"
              strokeOpacity="0.26"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}
