import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/worker.mjs';

function env(overrides) {
  return Object.assign({
    TURNSTILE_SITE_KEY: 'site-key',
    TURNSTILE_SECRET: 'turnstile-secret',
    TURNSTILE_EXPECTED_HOSTNAMES: 'form.example.test',
    APPS_SCRIPT_URL: 'https://script.example.test/exec',
    APPS_SCRIPT_SHARED_SECRET: 'gateway-secret',
    REGISTRATION_RATE_LIMITER: { limit: async function () { return { success: true }; } },
    ASSETS: { fetch: async function () { return new Response('asset'); } }
  }, overrides || {});
}

function registrationRequest(body) {
  return new Request('https://form.example.test/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.10'
    },
    body: JSON.stringify(body)
  });
}

test('serves public Turnstile configuration without caching', async function () {
  var response = await handleRequest(new Request('https://form.example.test/config.js'), env());
  assert.equal(response.status, 200);
  assert.match(await response.text(), /site-key/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('rejects malformed JSON generically', async function () {
  var request = new Request('https://form.example.test/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad'
  });
  var response = await handleRequest(request, env());
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), /JSON|position|Unexpected/i);
});

test('rate limits before external verification', async function () {
  var calls = 0;
  var limitedEnv = env({
    REGISTRATION_RATE_LIMITER: { limit: async function () { return { success: false }; } }
  });
  var response = await handleRequest(registrationRequest({ turnstile_token: 'token' }), limitedEnv, async function () {
    calls += 1;
    return new Response('{}');
  });
  assert.equal(response.status, 429);
  assert.equal(calls, 0);
});

test('requires successful Turnstile action and hostname', async function () {
  var response = await handleRequest(
    registrationRequest({ turnstile_token: 'token', client_submission_id: '12345678-1234-1234-1234-123456789012' }),
    env(),
    async function () {
      return Response.json({ success: true, action: 'other', hostname: 'form.example.test' });
    }
  );
  assert.equal(response.status, 403);
});

test('forwards only verified payload with gateway secret', async function () {
  var calls = [];
  var fetchMock = async function (url, options) {
    calls.push({ url: url, options: options });
    if (url.includes('siteverify')) {
      return Response.json({ success: true, action: 'registration', hostname: 'form.example.test' });
    }
    return Response.json({ ok: true, registrationId: 'registration-1' });
  };
  var response = await handleRequest(
    registrationRequest({
      turnstile_token: 'token',
      client_submission_id: '12345678-1234-1234-1234-123456789012',
      student_first_name: 'בדיקה'
    }),
    env(),
    fetchMock
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).registrationId, 'registration-1');
  var envelope = JSON.parse(calls[1].options.body);
  assert.equal(envelope.gateway_secret, 'gateway-secret');
  assert.equal(envelope.payload.student_first_name, 'בדיקה');
  assert.equal(Object.hasOwn(envelope.payload, 'turnstile_token'), false);
});
