# Local usage dashboard

React and TypeScript application generated with `pnpm create vite dashboard --template react-ts --no-interactive`. It uses Tailwind CSS 4 through the Vite plugin, TanStack Table 9, TanStack Charts and Lucide icons. Nest serves the production build under `/dashboard` in the proxy's existing Docker image.

## Development

Run `pnpm install` from the repository root. In separate terminals, start the backend with `pnpm start:dev` and the frontend with `pnpm dev:dashboard`. Open the Vite URL at `/dashboard/`. Vite proxies `/dashboard/api` to localhost using `PORT`, defaulting to 8080.

```bash
pnpm --dir dashboard build
pnpm test:dashboard
pnpm lint:dashboard
```

`pnpm build` at the root builds both applications. No frontend process runs in the production container.

## Organization

- `src/features/usage/domain` owns pure filtering, local calendar periods, aggregation and metric rules. It imports no React, charting or HTTP code.
- `src/features/usage/application` manages linked or independent selections and loading state. The HTTP loader is passed in by the application composition root.
- `src/features/usage/infrastructure` implements the one-time history fetch.
- `src/features/usage/components` contains filters, summaries, charts, the table and request details in separate folders.
- `src/shared` contains display formatting and reusable `Button`, `IconButton` and `FormField` components. `src/index.css` imports Tailwind, defines theme tokens and sets document and native-control defaults. Layout, responsive rules and visual states use Tailwind utilities in the components.
- `src/App.tsx` composes the data adapter, selection state and views.

The frontend imports the framework-independent usage contract from `../src/usage/domain/usage-request.ts` using type-only imports. Backend implementation code is not bundled into the browser.

## Styling

Use utility classes in JSX for component styles. Theme colors such as `text-muted`, `bg-teal-light` and `border-border` come from `@theme` in `src/index.css`. Keep conditional classes as complete strings so Tailwind can detect them. Use `Button` for default, primary and text actions, `IconButton` for actions with only an icon, and `FormField` for labeled filter controls.

The responsive layout retains the existing 1150px, 800px and 540px thresholds using `max-[…px]` variants. Charts still use TanStack chart configuration for marks, axes and series colors.

## Data rules

The API reads only the original transcription and text-enhancement tables. The dashboard does not add request logging or status tracking.

Filters are AND across fields and OR within selected models. Table and dashboard selections start linked. Unlinking copies the current filters; linking again adopts the table filters. Sorting and pagination never change chart aggregates.

Unknown costs and durations remain null. Genuine zero values remain zero. Empty time periods are filled with zero; periods containing only unknown metric values are not drawn as zero consumption. Comparisons exclude groups without known values for the selected metric. The UI reports metric coverage.

SQLite timestamps arrive as explicit UTC ISO strings. Date inputs, chart buckets and labels use local calendar time, including Monday-based weeks. The history reloads only when the page reloads. Tokens are outside the current persisted schema and are not displayed.

Domain tests cover combined filters, unknown values, time boundaries and shared selection behavior. HTTP integration checks live in the repository's `test/` directory and include static frontend delivery.

## Activity metrics

The three summary cards show requests, spend rounded to cents and audio duration with automatic, minute or hour units. Background sparklines use the same selection as Trend and sum at most 30 time intervals, using hourly buckets for a single day. Stored durations remain seconds; changing display units does not change the data.

The daily heatmap follows dashboard filters and switches between requests, audio and spend. Unknown-only values remain distinct from zero activity. Hover, keyboard focus or tap reveals each day's value and missing-data counts.

The four speaking cards sit immediately below the primary summary, before Trend, model distribution and the daily heatmap. Each has a background sparkline. Words spoken abbreviates thousands as whole K values, with the exact count in its title and accessible label. Word and rate sparklines follow dashboard filters, sum words and recompute weighted rates per interval, leaving unavailable rates as gaps.

Words and words per minute use transcription text only. Speaking rate divides eligible words by eligible audio minutes, including silence, rather than averaging individual recording rates. Both show coverage and follow dashboard filters. Current and longest streaks use all transcription history, independently of filters. The current streak must end today; a day without transcriptions breaks it. Calendar boundaries use the browser's time zone. Streak sparklines show actual end-of-period streak states and the historical record as it grew; they do not sum streak lengths.

The agreed scope and acceptance criteria are recorded in [DASHBOARD-METRICS-PLAN.md](../DASHBOARD-METRICS-PLAN.md).

The daily calendar fills available width with earlier out-of-selection cells and keeps the latest selected day in the rightmost week. All seven weekday labels remain visible. When the range needs horizontal scrolling, it opens at the latest dates.

All dropdowns use `src/shared/ui/Select.tsx`. Pass typed `value`, `options` and `onValueChange`; the component handles native selection events, option rendering, three sizes and the shared arrow inset. Keep filter and chart state in the owning feature.
