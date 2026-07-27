# openwhispr-proxy

OpenAI-compatible proxy that sits between [OpenWhispr](https://github.com/openwhispr) and [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). It exposes the routes OpenWhispr already expects (`/audio/transcriptions`, `/v1/chat/completions`, `/models`), forwards each request to the AI Gateway using the API key sent in the `Authorization` header, and logs usage (model, cost, generation id) to a local SQLite database so you can track spend.

## Endpoints

| Method | Path                     | Purpose                                                      |
| ------ | ------------------------ | -------------------------------------------------------------- |
| POST   | `/audio/transcriptions`  | Proxies audio transcription requests (Whisper-style)           |
| POST   | `/v1/chat/completions`   | Proxies chat completion requests (transcript cleanup, etc.)    |
| GET    | `/models`                | Returns the live model catalog from the AI Gateway             |

All routes expect a standard `Authorization: Bearer <AI_GATEWAY_API_KEY>` header — the proxy has no server-side API key configuration; each request carries its own.

> **Concurrency note:** the API key from the incoming request is currently applied via a shared `process.env.AI_GATEWAY_API_KEY` assignment before each Gateway call. Under concurrent requests using *different* keys, this can race. Fine for single-user/local use; worth knowing if you expose this to multiple simultaneous clients. This is unrelated to app configuration below — it's a per-request value, not a static setting, so it's not something you set in `.env`.

## Configuration

The app reads its configuration from environment variables via a typed `EnvService` (`src/config/env.service.ts`) — nothing reads `process.env` directly outside of it. Copy the template and adjust as needed:

```bash
cp .env.example .env
```

| Variable         | Required | Default                       | Purpose                                  |
| ---------------- | -------- | ------------------------------ | ----------------------------------------- |
| `PORT`           | No       | `8080`                        | Port the HTTP server listens on           |
| `USAGE_DB_PATH`  | No       | `<project-root>/data/usage.db` | Absolute path to the SQLite usage database |

`.env` is loaded automatically on startup (via `dotenv`) — Node does not do this on its own.

## Running locally (no Docker)

Requires Node 22+ and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm build
pnpm start:prod
```

The server listens on the port from `PORT` (`8080` by default — no elevated privileges required). For local development:

```bash
pnpm start:dev
```

## Running with Docker

### Quick build & run (custom port)

```bash
docker build -t openwhispr-proxy .
docker run -d \
  --name openwhispr-proxy \
  -e PORT=8080 \
  -p 8080:8080 \
  -v "$(pwd)/data:/app/data" \
  openwhispr-proxy
```

- `-e PORT=8080` sets the port the app listens on **inside** the container.
- `-p 8080:8080` maps that same port to your host — change the host-side number (left of the colon) to use a different port on your machine; keep the container-side number (right of the colon) matching `PORT`.
- `-v "$(pwd)/data:/app/data"` mounts a local `./data` folder into the container so the SQLite usage database survives container restarts/rebuilds. **Without this volume, all usage history is lost every time the container is recreated.**

### With docker-compose (recommended)

A `docker-compose.yml` is included with `PORT` and the volume already wired up. It reads `PORT` (and `USAGE_DB_PATH`, if set) from your `.env`:

```bash
cp .env.example .env   # if you haven't already
docker compose up -d --build
```

- `PORT` (optional, defaults to `8080`) controls both the host-side port and the port the app listens on inside the container — one variable, both sides stay in sync.
- Data persists in `./data/usage.db` on the host, bind-mounted into the container.

To stop it:

```bash
docker compose down
```

The volume is a bind mount to `./data`, so `docker compose down` does **not** delete your usage data — only removing the `./data` folder yourself would.

## Usage / cost tracking

Every request to `/audio/transcriptions` and `/v1/chat/completions` is logged to a SQLite database at `./data/usage.db` (created automatically on first run), with two tables:

- `transcriptions` — `model`, `duration_seconds`, `text`, `latency_ms`, `cost_usd`, `generation_id`, `created_at`
- `enhanced_transcriptions` — `model`, `text`, `latency_ms`, `cost_usd`, `generation_id`, `created_at`

There is currently no HTTP endpoint to query this — check it directly with the `sqlite3` CLI:

```bash
sqlite3 data/usage.db "SELECT model, COUNT(*), SUM(cost_usd) FROM transcriptions GROUP BY model;"
sqlite3 data/usage.db "SELECT model, COUNT(*), SUM(cost_usd) FROM enhanced_transcriptions GROUP BY model;"
```

## Configuring OpenWhispr

Once the container is up, the only thing left is pointing OpenWhispr at it. The proxy's own `.env` only controls `PORT` and `USAGE_DB_PATH` (see [Configuration](#configuration)) — there is no server-side API key to set up. The Vercel AI Gateway key travels in each request and is forwarded unchanged.

You need two things at hand:

- **Endpoint** — the base URL where the proxy is reachable, e.g. `http://localhost:8080` (use the host port you mapped; `8080` is the compose default).
- **API key** — your [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key.

OpenWhispr calls two separate services, and **both** must be pointed at the proxy.

### 1. Speech to Text (transcription)

In OpenWhispr, open **Settings → Speech to Text**, choose the **Custom** provider and fill in:

| Field    | Value                                                     |
| -------- | --------------------------------------------------------- |
| Endpoint | `http://localhost:8080`                                   |
| API Key  | your Vercel AI Gateway API key                            |
| Model    | a transcription model, e.g. `openai/gpt-4o-mini-transcribe` |

This is the audio-to-text step. OpenWhispr will hit `POST /audio/transcriptions` on the proxy, which forwards it to the AI Gateway.

> The model id is passed to the AI Gateway verbatim, so it **must** include the provider prefix (`openai/gpt-4o-mini-transcribe`, not `gpt-4o-mini-transcribe`).

### 2. Language Model (transcript cleanup)

This second model polishes what the transcription returned — punctuation, question marks, capitalization — so the final text reads clean.

In **Settings → Language Model**, again choose **Custom**:

| Field    | Value                                                                |
| -------- | -------------------------------------------------------------------- |
| Endpoint | `http://localhost:8080`                                              |
| API Key  | your Vercel AI Gateway API key (the same one)                        |
| Model    | a fast, non-reasoning chat model, e.g. `google/gemini-2.5-flash-lite` |

This step hits `POST /v1/chat/completions` on the proxy.

Both steps use the **same endpoint and the same API key** — only the model differs.

## Recommended models

### Transcription

`openai/whisper-1` is the legacy model and the usual suspect when transcripts contain words that were never spoken. Whisper was trained on subtitled video, so on silence or low-energy audio it fills the gap with phrases from its training data instead of returning nothing ([OpenWhispr #462](https://github.com/OpenWhispr/openwhispr/issues/462), [openai/whisper #679](https://github.com/openai/whisper/discussions/679)).

| Model                            | Price (OpenAI list)     | Notes                                             |
| -------------------------------- | ----------------------- | ------------------------------------------------- |
| `openai/gpt-4o-mini-transcribe`  | $0.003/min              | Good default — lower WER than Whisper, few hallucinations |
| `openai/gpt-4o-transcribe`       | $0.006/min              | Heavy accents or noisy audio; best accuracy       |


### Transcript cleanup

Cleanup is a trivial task: add punctuation, fix casing. It does not benefit from a reasoning model — it only pays for one.

| Model                            | Price (in/out per 1M)   | Notes                                            |
| -------------------------------- | ----------------------- | ------------------------------------------------ |
| `google/gemini-2.5-flash-lite`   | $0.10 / $0.40           | Good default — cheap, fast, no reasoning tokens  |

Gemini 2.5 Flash lite is a ultra fasy model, with low latency and it's enough to adding punctuation, fix casting, etc.

### Notes

- If OpenWhispr runs on a different machine than the proxy, replace `localhost` with the host's IP or domain.
- If the proxy runs in Docker and OpenWhispr on the host, `http://localhost:<PORT>` works as long as you mapped the port (`-p 8080:8080` or via `docker-compose.yml`'s `PORT` variable).
- Every request through both steps is logged to `./data/usage.db` with its cost, so you can track spend per model.

## Run tests

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```
