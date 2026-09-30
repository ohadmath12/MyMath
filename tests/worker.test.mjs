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

test('allows the GitHub Pages form to post without a preflight', async function () {
  var request = new Request('https://form.example.test/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      'Origin': 'https://ohadmath12.github.io'
    },
    body: JSON.stringify({ turnstile_token: 'invalid' })
  });
  var response = await handleRequest(request, env(), async function () {
    return Response.json({ success: false });
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://ohadmath12.github.io');
});

test('does not grant CORS access to other origins', async function () {
  var request = new Request('https://form.example.test/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      'Origin': 'https://example.test'
    },
    body: JSON.stringify({ turnstile_token: 'invalid' })
  });
  var response = await handleRequest(request, env(), async function () {
    return Response.json({ success: false });
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
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

test('trial route uses trial challenge, trusted operation and allowlisted fields',async()=>{
 const calls=[];
 const response=await handleRequest(new Request('https://form.example.test/api/trial',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({turnstile_token:'token',client_submission_id:'12345678-1234-1234-1234-123456789012',student_first_name:'Test',operation:'import_registration',price:1,trial_conversion_receipt:'forged'})}),env({CRM_INTAKE_URL:'https://crm.example.test',CRM_INTAKE_SECRET:'test-secret'}),async(url,options)=>{calls.push([url,options]);return calls.length===1?Response.json({success:true,action:'trial',hostname:'form.example.test'}):Response.json({ok:true,request_id:'request-1'})});
 assert.equal(response.status,200);assert.equal(calls[1][0],'https://script.example.test/exec');const envelope=JSON.parse(calls[1][1].body);assert.equal(envelope.gateway_secret,'gateway-secret');const payload=envelope.payload;assert.equal(payload.operation,'trial_intake');assert.equal(payload.price,undefined);assert.equal(payload.trial_conversion_receipt,undefined);assert.deepEqual(await response.json(),{ok:true,requestId:'request-1'});
});
test('trial relay failure is generic and does not expose infrastructure',async()=>{
 let calls=0;const response=await handleRequest(new Request('https://form.example.test/api/trial',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({turnstile_token:'token'})}),env(),async()=>{calls++;return calls===1?Response.json({success:true,action:'trial',hostname:'form.example.test'}):Response.json({ok:false,error:'internal'}, {status:500})});assert.equal(response.status,502);assert.equal(calls,2);assert.doesNotMatch(await response.text(),/internal/);
});
test('null payload returns controlled error',async()=>{const response=await handleRequest(registrationRequest(null),env());assert.equal(response.status,400)});
