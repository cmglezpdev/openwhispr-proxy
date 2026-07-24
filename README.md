# openwhispr-proxy

OpenAI-compatible proxy that sits between [OpenWhispr](https://github.com/openwhispr) and [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). It exposes the routes OpenWhispr already expects (`/audio/transcriptions`, `/v1/chat/completions`, `/models`), forwards each request to the AI Gateway using the API key sent in the `Authorization` header, and logs usage (model, cost, generation id) to a local SQLite database so you can track spend.

## Endpoints

| Method | Path                     | Purpose                                                      |
| ------ | ------------------------ | -------------------------------------------------------------- |
| POST   | `/audio/transcriptions`  | Proxies audio transcription requests (Whisper-style)           |
| POST   | `/v1/chat/completions`   | Proxies chat completion requests (transcript cleanup, etc.)    |
| GET    | `/models`                | Returns the live model catalog from the AI Gateway             |

All routes expect a standard `Authorization: Bearer <AI_GATEWAY_API_KEY>` header — the proxy has no server-side API key configuration; each request carries its own.

> **Concurrency note:** the API key from the incoming request is currently applied via a shared `process.env.AI_GATEWAY_API_KEY` assignment before each Gateway call. Under concurrent requests using *different* keys, this can race. Fine for single-user/local use; worth knowing if you expose this to multiple simultaneous clients.

## Running locally (no Docker)

Requires Node 22+ and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm build
pnpm start:prod
```

The server listens on port `80` (hardcoded in `src/main.ts`), so on macOS/Linux you'll need elevated privileges to bind it directly, or change that constant. For local development:

```bash
pnpm start:dev
```

## Running with Docker

### Quick build & run (custom port)

```bash
docker build -t openwhispr-proxy .
docker run -d \
  --name openwhispr-proxy \
  -p 8080:80 \
  -v "$(pwd)/data:/app/data" \
  openwhispr-proxy
```

- `-p 8080:80` maps your host port `8080` to the container's port `80` — change `8080` to whatever port you want on your machine; the container-side port always stays `80`.
- `-v "$(pwd)/data:/app/data"` mounts a local `./data` folder into the container so the SQLite usage database survives container restarts/rebuilds. **Without this volume, all usage history is lost every time the container is recreated.**

### With docker-compose (recommended)

A `docker-compose.yml` is included with the port and volume already wired up:

```bash
PORT=8080 docker compose up -d --build
```

- `PORT` (optional, defaults to `8080`) controls the host-side port.
- Data persists in `./data/usage.db` on the host, bind-mounted into the container.

To stop it:

```bash
docker compose down
```

The volume is a bind mount to `./data`, so `docker compose down` does **not** delete your usage data — only removing the `./data` folder yourself would.

## Usage / cost tracking

Every request to `/audio/transcriptions` and `/v1/chat/completions` is logged to a SQLite database at `./data/usage.db` (created automatically on first run), with two tables:

- `transcriptions` — `model`, `duration_seconds`, `text`, `cost_usd`, `generation_id`, `created_at`
- `enhanced_transcriptions` — `model`, `text`, `cost_usd`, `generation_id`, `created_at`

There is currently no HTTP endpoint to query this — check it directly with the `sqlite3` CLI:

```bash
sqlite3 data/usage.db "SELECT model, COUNT(*), SUM(cost_usd) FROM transcriptions GROUP BY model;"
sqlite3 data/usage.db "SELECT model, COUNT(*), SUM(cost_usd) FROM enhanced_transcriptions GROUP BY model;"
```

## Configuring OpenWhispr

Point OpenWhispr's custom API base URL at wherever this proxy is running (e.g. `http://localhost:8080`) and use your normal AI Gateway API key — the proxy forwards it through unchanged.

## Run tests

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```
