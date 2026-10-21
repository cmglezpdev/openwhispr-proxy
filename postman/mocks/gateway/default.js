// Shape documented by Vercel's Chat Completions API and vercel/ai#9164.
// Local contract mock. No credentials or real upstream requests.
const http = require('node:http');
const assert = require('node:assert/strict');
const response = require('../../../test/fixtures/gateway-chat-completion.json');

http
  .createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res
        .writeHead(501)
        .end(JSON.stringify({ error: { message: 'Endpoint not modeled' } }));
      return;
    }
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(data);
        assert.equal(req.headers.authorization, 'Bearer simulation-only');
        assert.equal(body.model, response.model);
        assert.equal(body.max_completion_tokens, 256);
        assert.equal(body.reasoning_effort, 'low');
        assert.deepEqual(body.chat_template_kwargs, { thinking: false });
        assert.equal(body.messages[0].role, 'system');
        assert.equal(body.messages[1].content, 'hola esta es una prueba');
        assert.equal(body.maxCompletionTokens, undefined);
        res.end(JSON.stringify(response));
      } catch (error) {
        res
          .writeHead(400)
          .end(JSON.stringify({ error: { message: error.message } }));
      }
    });
  })
  .listen(process.env.PORT);
