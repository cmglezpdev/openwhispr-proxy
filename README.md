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

Once the container is up, the only thing left is pointing OpenWhispr at it. There is nothing to configure on the proxy side — no `.env`, no server-side API key. The Vercel AI Gateway key travels in each request and is forwarded unchanged.

You need two things at hand:

- **Endpoint** — the base URL where the proxy is reachable, e.g. `http://localhost:8080` (use the host port you mapped; `8080` is the compose default).
- **API key** — your [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key.

OpenWhispr calls two separate services, and **both** must be pointed at the proxy.

### 1. Speech to Text (transcription)

In OpenWhispr, open **Settings → Speech to Text**, choose the **Custom** provider and fill in:

| Field    | Value                                                  |
| -------- | ------------------------------------------------------ |
| Endpoint | `http://localhost:8080`                                |
| API Key  | your Vercel AI Gateway API key                         |
| Model    | a transcription model, e.g. `openai/whisper-1`         |

This is the audio-to-text step. OpenWhispr will hit `POST /audio/transcriptions` on the proxy, which forwards it to the AI Gateway.

> The model id is passed to the AI Gateway verbatim, so it **must** include the provider prefix (`openai/whisper-1`, not `whisper-1`).

### 2. Language Model (transcript cleanup)

This second model polishes what the transcription returned — punctuation, question marks, capitalization — so the final text reads clean.

In **Settings → Language Model**, again choose **Custom**:

| Field    | Value                                                        |
| -------- | ------------------------------------------------------------ |
| Endpoint | `http://localhost:8080`                                      |
| API Key  | your Vercel AI Gateway API key (the same one)                |
| Model    | any chat model in the Gateway catalog, e.g. `openai/gpt-4o-mini` |

This step hits `POST /v1/chat/completions` on the proxy.

Both steps use the **same endpoint and the same API key** — only the model differs.

### Checking available models

To see exactly which model ids the Gateway exposes for your key:

```bash
curl -H "Authorization: Bearer <AI_GATEWAY_API_KEY>" http://localhost:8080/models
```

### Notes

- If OpenWhispr runs on a different machine than the proxy, replace `localhost` with the host's IP or domain.
- If the proxy runs in Docker and OpenWhispr on the host, `http://localhost:<PORT>` works as long as you mapped the port (`-p 8080:80`).
- Every request through both steps is logged to `./data/usage.db` with its cost, so you can track spend per model.

## Run tests

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```
