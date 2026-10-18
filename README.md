<p align="center">
  <img src="assets/banner.png" alt="OpenWhispr Proxy" />
</p>

# OpenWhispr Proxy

A local proxy that connects [OpenWhispr](https://github.com/OpenWhispr/openwhispr) to [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) for audio transcription and transcript cleanup. It records usage in SQLite and includes a dashboard to explore request history, model costs and speaking activity.

Built with TypeScript, NestJS and React. The backend serves the API and dashboard from a single process, with Docker Compose available for local deployment.

## Getting started

### Docker Compose

Clone the repository, then build and start the application:

```bash
git clone https://github.com/cmglezpdev/openwhispr-proxy.git
cd openwhispr-proxy
cp .env.example .env
docker compose up -d --build
```

The proxy is available at `http://localhost:8080`. Compose publishes the port on `127.0.0.1`, so access is limited to the Docker host. Open [the dashboard](http://localhost:8080/dashboard) to view usage, then [connect OpenWhispr](#connect-openwhispr) to start recording activity.

Usage data is stored in `./data/usage.db` on the host. The Compose bind mount preserves it when the container is recreated. To stop the application:

```bash
docker compose down
```

### Without Docker

Requires Node.js 24 or later and pnpm 11. From the repository root:

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm start:prod
```

`pnpm build` compiles both the backend and dashboard. The server uses port `8080` by default.

## Connect OpenWhispr

Configure both the transcription provider and the language model provider in OpenWhispr to use a custom endpoint:

| Setting  | Transcription                 | Transcript cleanup              |
| -------- | ----------------------------- | ------------------------------- |
| Endpoint | `http://localhost:8080`       | `http://localhost:8080`         |
| API key  | Your Vercel AI Gateway key    | The same Gateway key            |
| Model    | A Gateway transcription model | A Gateway text generation model |

Model IDs must include the provider prefix, such as `openai/gpt-4o-mini-transcribe`. Choose a model supported by the Gateway for each operation.

The client sends its Gateway key in the `Authorization: Bearer <key>` header on each request. The proxy creates a Gateway instance with that key for the request. No server-side API key configuration is needed. The included Compose setup expects OpenWhispr to run on the same machine.

## Dashboard

The dashboard at `/dashboard` lets you:

- Search and filter request history by date, operation, model, cost, audio duration and latency.
- Inspect individual requests, including their text and recorded usage.
- Track requests, spend and audio duration through summaries, trends, model comparisons and a daily activity calendar.
- View transcribed word counts, speaking rate and daily transcription streaks.

Table and chart filters start linked and can be adjusted independently. Sorting and pagination affect the table only. The page loads history when opened; reload it to include new requests.

Totals use recorded values and show data coverage when values are missing. Dates use the browser's time zone. See the [dashboard README](dashboard/README.md) for development instructions and metric rules.

![Usage dashboard with request summaries, speaking activity, charts, an activity calendar and request history](assets/dashboard.png)

## Configuration

The application loads `.env` from the repository root. Both settings are optional.

| Variable        | Default           | Purpose                                                                                                         |
| --------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `PORT`          | `8080`            | HTTP server port. Compose uses it for both the host and container ports.                                        |
| `USAGE_DB_PATH` | `./data/usage.db` | SQLite database path, relative to the working directory by default. Use an absolute path for a custom location. |

When using Compose, keep the database inside `/app/data` to use the included persistent mount. A different container directory needs its own volume mapping.

## API and storage

| Method | Path                      | Purpose                                                      |
| ------ | ------------------------- | ------------------------------------------------------------ |
| `POST` | `/audio/transcriptions`   | Transcribe an uploaded audio file using the requested model. |
| `POST` | `/v1/chat/completions`    | Generate text for transcript cleanup.                        |
| `GET`  | `/models`                 | Fetch the available Gateway model catalog.                   |
| `GET`  | `/dashboard`              | Serve the dashboard.                                         |
| `GET`  | `/dashboard/api/requests` | Read the saved transcription and cleanup history.            |

The three proxy endpoints require a Gateway key. Dashboard routes do not require authentication.

Audio uploads accept one file up to 100 MiB, plus at most 16 text fields of up to 1 MiB each. Oversized files return `413`; extra files or fields and oversized text fields return `400`. These limits apply before the Gateway call. Provider-specific audio limits still apply.

Completed transcription and cleanup calls are stored in the `transcriptions` and `enhanced_transcriptions` tables. Records include text, model, timestamp, latency, cost and Gateway generation ID when available. Transcriptions also include audio duration. Failed requests and dashboard reads do not create usage records.

Incoming-request summaries in the console contain metadata, without message text, API keys or uploaded filenames. Full result text remains in SQLite for inspection in the dashboard. Docker builds exclude local environment files, usage data and Git history from their context.

The database and its parent directory are created on startup. No separate database service is required.

## Development

Install dependencies and copy `.env.example` as described above. Run the backend and frontend in separate terminals from the repository root:

```bash
# Backend with automatic restart
pnpm start:dev
```

```bash
# Dashboard with live updates
pnpm dev:dashboard
```

Open the frontend URL printed in the terminal at `/dashboard/`. The development server forwards dashboard API requests to the backend using `PORT` from the environment or root `.env`.

| Directory                               | Responsibility                                           |
| --------------------------------------- | -------------------------------------------------------- |
| `src/audio/`, `src/chat/`, `src/model/` | Gateway request handling.                                |
| `src/usage/`                            | SQLite persistence and the shared usage contract.        |
| `src/dashboard/`                        | Dashboard HTTP endpoints.                                |
| `src/config/`                           | Backend configuration.                                   |
| `dashboard/`                            | Dashboard UI, browser-side analytics and frontend tests. |
| `test/`                                 | Backend HTTP integration tests and test setup.           |

### Checks

```bash
pnpm test:all
pnpm lint:dashboard
pnpm build
```

`pnpm test:all` runs backend unit tests, HTTP integration tests and dashboard tests. The HTTP suite builds the frontend and checks that Nest serves its HTML and assets. Jest tests mock Gateway calls and use temporary databases.

For individual suites, use `pnpm test`, `pnpm test:e2e` or `pnpm test:dashboard`.

### CI and releases

The server and dashboard are one application with one version and one GitHub
release. The root `package.json` defines the version. Release Please updates both
package files, `CHANGELOG.md` and `.release-please-manifest.json` in the same PR.
`pnpm check:version` checks that both package versions match.

## Local-use limits

The proxy is intended for a single user's local workflow. The dashboard exposes saved text and usage history without authentication. Compose restricts the published port to localhost. When running directly with Node, the server listens on all interfaces; use a host firewall or bind it to localhost before relying on local-only access. Changing the Docker port mapping or adding a tunnel can expose the history to other machines.
