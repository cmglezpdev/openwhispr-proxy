# Local usage dashboard

React and TypeScript application generated with `pnpm create vite dashboard --template react-ts --no-interactive`. It uses TanStack Table 9, TanStack Charts and Lucide icons. Nest serves the production build under `/dashboard` in the proxy's existing Docker image.

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
- `src/shared` contains display formatting. `src/styles` contains shared visual tokens and page layout.
- `src/App.tsx` composes the data adapter, selection state and views.

The frontend imports the framework-independent usage contract from `../src/usage/domain/usage-request.ts` using type-only imports. Backend implementation code is not bundled into the browser.

## Data rules

The API reads only the original transcription and text-enhancement tables. The dashboard does not add request logging or status tracking.

Filters are AND across fields and OR within selected models. Table and dashboard selections start linked. Unlinking copies the current filters; linking again adopts the table filters. Sorting and pagination never change chart aggregates.

Unknown costs and durations remain null. Genuine zero values remain zero. Empty time periods are filled with zero; periods containing only unknown metric values are not drawn as zero consumption. Comparisons exclude groups without known values for the selected metric. The UI reports metric coverage.

SQLite timestamps arrive as explicit UTC ISO strings. Date inputs, chart buckets and labels use local calendar time, including Monday-based weeks. The history reloads only when the page reloads. Tokens are outside the current persisted schema and are not displayed.

Domain tests cover combined filters, unknown values, time boundaries and shared selection behavior. HTTP integration checks live in the repository's `test/` directory and include static frontend delivery.
