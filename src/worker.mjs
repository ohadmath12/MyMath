import { marathonRequest } from './marathon.mjs';
const MAX_REQUEST_CHARS = 2100000;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const PUBLIC_ERROR = 'לא הצלחנו לשמור את ההרשמה. נסו שוב בעוד מספר רגעים.';
const GITHUB_PAGES_ORIGIN = 'https://ohadmath12.github.io';

function allowedCorsOrigin(request) {
  var origin = request.headers.get('Origin') || '';
  return origin === GITHUB_PAGES_ORIGIN ? origin : '';
}

function json(body, status, request) {
  var headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  var origin = request && allowedCorsOrigin(request);
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: headers
  });
}

function expectedHostnames(env) {
  return String(env.TURNSTILE_EXPECTED_HOSTNAMES || '')
    .split(',')
    .map(function (value) { return value.trim().toLowerCase(); })
    .filter(Boolean);
}

async function validateTurnstile(token, submissionId, request, env, fetchImpl, action = 'registration') {
  var body = {
    secret: env.TURNSTILE_SECRET,
    response: token,
    remoteip: request.headers.get('CF-Connecting-IP') || undefined
  };
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(submissionId || '')) {
    body.idempotency_key = submissionId;
  }

  var response = await fetchImpl(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) return false;

  var result = await response.json();
  var allowedHosts = expectedHostnames(env);
  return result.success === true &&
    result.action === action &&
    allowedHosts.indexOf(String(result.hostname || '').toLowerCase()) !== -1;
}

export async function handleRequest(request, env, fetchImpl) {
  fetchImpl = fetchImpl || fetch;
  var url = new URL(request.url);

  if (url.pathname === '/config.js') {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    return new Response(
      'window.MYTHEMATIX_CONFIG=' + JSON.stringify({ turnstileSiteKey: env.TURNSTILE_SITE_KEY }) + ';',
      {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  }

  if (url.pathname === '/api/marathons' || url.pathname === '/api/marathon') return marathonRequest(request, env, fetchImpl, { json, validateTurnstile, publicError: PUBLIC_ERROR });

  const isTrial = url.pathname === '/api/trial';
  const isPublicLead = url.pathname === '/api/lead-public';
  const isLead = url.pathname === '/api/lead' || isPublicLead;
  if (url.pathname !== '/api/register' && !isTrial && !isLead) return env.ASSETS.fetch(request);
  if (request.method === 'OPTIONS') {
    var corsOrigin = allowedCorsOrigin(request);
    if (!corsOrigin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      }
    });
  }
  if (request.method !== 'POST') return json({ ok: false, error: PUBLIC_ERROR }, 405, request);

  var contentType = request.headers.get('Content-Type') || '';
  if (contentType.indexOf('application/json') !== 0 && contentType.indexOf('text/plain') !== 0) {
    return json({ ok: false, error: PUBLIC_ERROR }, 415, request);
  }

  var contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_REQUEST_CHARS) return json({ ok: false, error: PUBLIC_ERROR }, 413, request);

  var ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  var rate = await env.REGISTRATION_RATE_LIMITER.limit({ key: 'registration:' + ip });
  if (!rate.success) return json({ ok: false, error: 'נשלחו יותר מדי בקשות. נסו שוב בעוד דקה.' }, 429, request);

  var raw = await request.text();
  if (!raw || raw.length > MAX_REQUEST_CHARS) return json({ ok: false, error: PUBLIC_ERROR }, 413, request);

  var payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    return json({ ok: false, error: PUBLIC_ERROR }, 400, request);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({ ok: false, error: PUBLIC_ERROR }, 400, request);
  if ((isTrial || isLead) && raw.length > 8192) return json({ ok: false, error: PUBLIC_ERROR }, 413, request);
  var token = String(payload.turnstile_token || '');
  if (!token || token.length > 2048) return json({ ok: false, error: PUBLIC_ERROR }, 400, request);

  var verified;
  try {
    verified = await validateTurnstile(token, payload.client_submission_id, request, env, fetchImpl, isLead ? 'lead' : isTrial ? 'trial' : 'registration');
  } catch (error) {
    return json({ ok: false, error: PUBLIC_ERROR }, 502, request);
  }
  if (!verified) return json({ ok: false, error: PUBLIC_ERROR }, 403, request);

  delete payload.turnstile_token;
  // Public callers cannot select privileged operations or forge an import receipt.
  delete payload.operation;
  delete payload.trial_conversion_receipt;
  delete payload.lead_conversion_receipt;
  if (isLead) {
    if (payload.honeypot) return json({ok:true},200,request);
    const details = Object.fromEntries(['parent_name','parent_phone','lead_token','client_submission_id','student_first_name','student_last_name','class_name','school_name','main_need','availability','referral_source','parent_email'].map(key => [key,payload[key]]));
    try {
      const response = await fetchImpl(env.APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({gateway_secret:env.APPS_SCRIPT_SHARED_SECRET,payload:{...details,operation:isPublicLead?'public_lead_intake':'lead_details'}}),redirect:'follow'});
      const result = await response.json();
      if(!response.ok || !result.ok) throw new Error('intake_failed');
      return json({ok:true},200,request);
    } catch { return json({ok:false,error:PUBLIC_ERROR},502,request); }
  }
  if (isTrial) {
    if (payload.honeypot) return json({ok:true,requestId:crypto.randomUUID()},200,request);
    const trialPayload = Object.fromEntries(['client_submission_id','student_first_name','student_last_name','class_name','school_name','parent_name','parent_phone'].map(key => [key,payload[key]]));
    try {
      const trialResponse = await fetchImpl(env.APPS_SCRIPT_URL, {method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({gateway_secret:env.APPS_SCRIPT_SHARED_SECRET,payload:{...trialPayload,operation:'trial_intake'}}),redirect:'follow'});
      const trialResult = await trialResponse.json();
      if (!trialResponse.ok || !trialResult.ok || typeof trialResult.request_id !== 'string') throw new Error('intake_failed');
      return json({ok:true,requestId:trialResult.request_id},200,request);
    } catch { return json({ok:false,error:PUBLIC_ERROR},502,request); }
  }
  var upstream;
  try {
    upstream = await fetchImpl(env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ gateway_secret: env.APPS_SCRIPT_SHARED_SECRET, payload: payload }),
      redirect: 'follow'
    });
  } catch (error) {
    return json({ ok: false, error: PUBLIC_ERROR }, 502, request);
  }

  if (!upstream.ok) return json({ ok: false, error: PUBLIC_ERROR }, 502, request);
  var result;
  try {
    result = await upstream.json();
  } catch (error) {
    return json({ ok: false, error: PUBLIC_ERROR }, 502, request);
  }

  if (!result || result.ok !== true || typeof result.registrationId !== 'string') {
    return json({ ok: false, error: PUBLIC_ERROR }, 502, request);
  }
  return json({ ok: true, registrationId: result.registrationId }, 200, request);
}

export default {
  fetch: function (request, env) {
    return handleRequest(request, env);
  }
};
