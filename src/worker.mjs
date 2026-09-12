const MAX_REQUEST_CHARS = 2100000;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const PUBLIC_ERROR = 'לא הצלחנו לשמור את ההרשמה. נסו שוב בעוד מספר רגעים.';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function expectedHostnames(env) {
  return String(env.TURNSTILE_EXPECTED_HOSTNAMES || '')
    .split(',')
    .map(function (value) { return value.trim().toLowerCase(); })
    .filter(Boolean);
}

async function validateTurnstile(token, submissionId, request, env, fetchImpl) {
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
    result.action === 'registration' &&
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

  if (url.pathname !== '/api/register') return env.ASSETS.fetch(request);
  if (request.method !== 'POST') return json({ ok: false, error: PUBLIC_ERROR }, 405);

  var contentType = request.headers.get('Content-Type') || '';
  if (contentType.indexOf('application/json') !== 0) {
    return json({ ok: false, error: PUBLIC_ERROR }, 415);
  }

  var contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_REQUEST_CHARS) return json({ ok: false, error: PUBLIC_ERROR }, 413);

  var ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  var rate = await env.REGISTRATION_RATE_LIMITER.limit({ key: 'registration:' + ip });
  if (!rate.success) return json({ ok: false, error: 'נשלחו יותר מדי בקשות. נסו שוב בעוד דקה.' }, 429);

  var raw = await request.text();
  if (!raw || raw.length > MAX_REQUEST_CHARS) return json({ ok: false, error: PUBLIC_ERROR }, 413);

  var payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    return json({ ok: false, error: PUBLIC_ERROR }, 400);
  }

  var token = String(payload.turnstile_token || '');
  if (!token || token.length > 2048) return json({ ok: false, error: PUBLIC_ERROR }, 400);

  var verified;
  try {
    verified = await validateTurnstile(token, payload.client_submission_id, request, env, fetchImpl);
  } catch (error) {
    return json({ ok: false, error: PUBLIC_ERROR }, 502);
  }
  if (!verified) return json({ ok: false, error: PUBLIC_ERROR }, 403);

  delete payload.turnstile_token;
  var upstream;
  try {
    upstream = await fetchImpl(env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ gateway_secret: env.APPS_SCRIPT_SHARED_SECRET, payload: payload }),
      redirect: 'follow'
    });
  } catch (error) {
    return json({ ok: false, error: PUBLIC_ERROR }, 502);
  }

  if (!upstream.ok) return json({ ok: false, error: PUBLIC_ERROR }, 502);
  var result;
  try {
    result = await upstream.json();
  } catch (error) {
    return json({ ok: false, error: PUBLIC_ERROR }, 502);
  }

  if (!result || result.ok !== true || typeof result.registrationId !== 'string') {
    return json({ ok: false, error: PUBLIC_ERROR }, 502);
  }
  return json({ ok: true, registrationId: result.registrationId }, 200);
}

export default {
  fetch: function (request, env) {
    return handleRequest(request, env);
  }
};
