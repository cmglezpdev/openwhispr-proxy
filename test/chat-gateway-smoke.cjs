// Run after build: node test/chat-gateway-smoke.cjs http://127.0.0.1:4900/gateway
// The real AI SDK calls a local Postman simulation instead of Vercel.
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const expected = require('./fixtures/gateway-chat-completion.json');

async function main() {
  const simulationBase = new URL(process.argv[2]);
  assert.ok(['127.0.0.1', 'localhost'].includes(simulationBase.hostname));
  const tempDir = mkdtempSync(join(tmpdir(), 'cleanup-contract-'));
  const dbPath = join(tempDir, 'usage.db');
  const previousDbPath = process.env.USAGE_DB_PATH;
  process.env.USAGE_DB_PATH = dbPath;
  const nativeFetch = globalThis.fetch;
  let upstreamCalls = 0;
  // Only reroute the host/path; the SDK still serializes, sends, and parses HTTP.
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, 'https://ai-gateway.vercel.sh');
    upstreamCalls++;
    return nativeFetch(
      `${simulationBase.href.replace(/\/$/, '')}${url.pathname}`,
      init,
    );
  };
  let app;
  try {
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../dist/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const response = await nativeFetch(
      `${await app.getUrl()}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer simulation-only',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: expected.model,
          messages: [
            { role: 'system', content: 'Clean up the transcription.' },
            { role: 'user', content: 'hola esta es una prueba' },
          ],
          max_completion_tokens: 256,
          reasoning_effort: 'low',
          chat_template_kwargs: { thinking: false },
        }),
      },
    );
    const body = await response.json();
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.deepEqual(body, expected);
    assert.equal(upstreamCalls, 1);
    const db = new DatabaseSync(dbPath);
    try {
      const rows = db
        .prepare(
          'SELECT model, text, cost_usd, generation_id FROM enhanced_transcriptions',
        )
        .all();
      assert.equal(rows.length, 1);
      assert.deepEqual(
        { ...rows[0] },
        {
          model: expected.model,
          text: expected.choices[0].message.content,
          cost_usd: 0.002,
          generation_id: expected.generationId,
        },
      );
    } finally {
      db.close();
    }
    console.log(
      'PASS: real SDK HTTP request, untouched response, and SQLite text/cost/generation ID',
    );
  } finally {
    if (app) await app.close();
    globalThis.fetch = nativeFetch;
    if (previousDbPath === undefined) delete process.env.USAGE_DB_PATH;
    else process.env.USAGE_DB_PATH = previousDbPath;
    rmSync(tempDir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
