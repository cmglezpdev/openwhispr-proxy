# Usage dashboard

A single-page React application for exploring the proxy's saved transcription and transcript cleanup history. It has a searchable request table, usage summaries, trend and model charts, a daily activity calendar, word counts, speaking rate and transcription streaks.

The production build is static HTML, CSS and JavaScript served by the Nest backend at `/dashboard`. The browser reads history from `/dashboard/api/requests` and handles filtering and analytics locally.

## Run locally

Requires Node.js 24 or later and pnpm 11. Run these commands from the repository root:

```bash
pnpm install
cp .env.example .env
```

Start the backend:

```bash
pnpm start:dev
```

In a second terminal, start the frontend:

```bash
pnpm dev:dashboard
```

Open the frontend URL printed in the terminal at `/dashboard/`. Its API proxy connects to the backend on `PORT`, defaulting to `8080`, and reads the root `.env`. Both processes must use the same backend port.

To run the compiled application instead:

```bash
pnpm build
pnpm start:prod
```

Open `http://localhost:8080/dashboard`, adjusting the port if configured. The backend serves the compiled files from `dashboard/dist`; production does not need a separate frontend server. Docker setup is covered in the [main README](../README.md#getting-started).

## Code organization

Paths below are relative to `dashboard/`.

| Path                                 | Responsibility                                                   |
| ------------------------------------ | ---------------------------------------------------------------- |
| `index.html`, `src/main.tsx`         | HTML entry point and React startup.                              |
| `src/App.tsx`                        | Page layout and composition of data loading, filters and views.  |
| `src/features/usage/domain/`         | Filtering, date ranges, aggregation and metric calculations.     |
| `src/features/usage/application/`    | Loading state and linked or independent table and chart filters. |
| `src/features/usage/infrastructure/` | HTTP adapter for the history endpoint.                           |
| `src/features/usage/components/`     | Filters, summary cards, charts, request table and detail view.   |
| `src/shared/`                        | Formatting helpers and reusable UI controls.                     |
| `src/index.css`                      | Theme tokens and global styles.                                  |

The API types are shared with the backend through type-only imports from [`src/usage/domain/usage-request.ts`](../src/usage/domain/usage-request.ts).

## Code and styling conventions

Keep metric calculations and filtering in the domain layer, independent of React and HTTP. Hooks manage loading and selection state; components render the results. Keep new code with the feature it belongs to and reserve `shared/` for controls and helpers used across views.

Use Tailwind utilities for component layout and visual states. Define shared colors and other theme tokens in `src/index.css`. Reuse the controls in `src/shared/ui/` for buttons, selects and labeled fields. Chart configuration owns series, axes and chart colors.

## Data behavior

- History loads once when the page opens. Reload the page to fetch new records.
- Filters apply across fields together; selecting several models matches any of those models. Table and chart filters start linked. Relinking uses the table's current filters.
- Sorting and pagination do not change chart totals. Charts use all rows matching their own filters.
- Missing costs and durations stay unknown. Totals use available values and report coverage; a missing value is not treated as zero.
- Date ranges and chart periods use the browser's time zone, with weeks starting on Monday.
- Word counts and speaking rate use transcriptions. Speaking rate divides eligible words by their total audio duration, including silence.
- Current and longest streaks use the full transcription history, independently of filters. The current streak must include today.

The API reads completed operations from the existing usage tables. The dashboard does not display failed requests or token metrics.

## Checks

Run from the repository root:

```bash
pnpm test:dashboard
pnpm lint:dashboard
pnpm --dir dashboard build
```

Tests sit alongside the domain, application and formatting code. They cover filtering, missing values, calendar boundaries, metric calculations and shared selection state. Backend HTTP tests in `test/` cover the history endpoint and compiled frontend delivery; run them with `pnpm test:e2e`.
