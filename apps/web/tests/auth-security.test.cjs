const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  vm.runInNewContext(compiled.outputText, { exports, require: name => name === 'server-only' ? {} : dependencies[name] || require(name),
    process: { env: { APP_ORIGIN: 'http://localhost:3000', BACKEND_API_URL: 'http://127.0.0.1:8000/api/v1', SUPABASE_URL: 'https://project.supabase.co' } },
    URL, Request, Headers, Response, AbortSignal, Buffer, Uint8Array, RangeError, ...globals });
  return exports;
}
const policy = load('lib/server/policy.ts');

test('proxy has a narrow route/method allowlist', () => {
  for (const [method, parts] of [
    ['POST', ['payments', 'x', 'mock-confirm']], ['POST', ['auth', 'register']],
    ['GET', ['docs']], ['GET', ['..', 'auth']], ['GET', ['shops%2f..']],
    ['GET', ['shops', 'x?admin=true']], ['POST', ['jobs', 'verify-token']],
    ['DELETE', ['auth', 'me']], ['GET', ['http:', 'evil.example']],
  ]) assert.equal(policy.allowedRoute(method, parts), false);
  assert.equal(policy.allowedRoute('GET', ['customer', 'documents']), true);
  assert.equal(policy.allowedRoute('POST', ['customer', 'documents']), true);
  assert.equal(policy.allowedRoute('POST', ['jobs', 'stage']), true);
  assert.equal(policy.allowedRoute('PATCH', ['shops', 'shop-123']), true);
  assert.equal(policy.allowedRoute('PATCH', ['customer', 'alias']), true);
});

test('CSRF policy rejects missing, hostile and same-site sibling origins', () => {
  const request = (headers) => new Request('http://localhost:3000/auth/google', { method: 'POST', headers });
  assert.equal(policy.sameOrigin(request({})), false);
  assert.equal(policy.sameOrigin(request({ origin: 'https://evil.example' })), false);
  assert.equal(policy.sameOrigin(request({ origin: 'http://localhost:3000', 'sec-fetch-site': 'same-site' })), false);
  assert.equal(policy.sameOrigin(request({ origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' })), true);
});

test('origins and backend destinations reject insecure or credential-bearing URLs', () => {
  for (const origin of ['http://public.example', 'https://user:secret@app.example', 'https://app.example/redirect']) {
    const p = load('lib/server/policy.ts', {}, { process: { env: { APP_ORIGIN: origin } } });
    assert.throws(() => p.appOrigin());
  }
  assert.equal(policy.backendBase(), 'http://127.0.0.1:8000/api/v1');
});

test('production requires explicit HTTPS configuration and ignores forged loopback Host', () => {
  const configured = (env) => load('lib/server/policy.ts', {}, { process: { env: { NODE_ENV: 'production', ...env } } });
  assert.throws(() => configured({}).appOrigin());
  assert.throws(() => configured({}).backendBase());
  assert.throws(() => configured({ APP_ORIGIN: 'http://localhost:3000' }).appOrigin());
  assert.throws(() => configured({ BACKEND_API_URL: 'http://127.0.0.1:8000/api/v1' }).backendBase());
  const p = configured({ APP_ORIGIN: 'https://app.example', BACKEND_API_URL: 'https://api.example/api/v1' });
  assert.equal(p.sameOrigin(new Request('https://app.example/api/backend', {
    method: 'POST', headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
  })), false);
  assert.equal(p.sameOrigin(new Request('https://app.example', { headers: { referer: 'not a URL' } })), false);
  assert.equal(p.sameOrigin(new Request('https://app.example', { headers: { origin: 'https://app.example' } })), true);
});

// Real Next request/response objects; Supabase is mocked only at its external boundary.
const { NextRequest } = require('next/server');
const request = (url, options = {}) => new NextRequest('http://localhost:3000' + url, options);
function auth(overrides = {}) {
  return {
    authClient: () => ({ client: { auth: overrides }, finish: response => {
      response.headers.set('cache-control', 'private, no-store');
      response.cookies.set('test-session', 'opaque', { httpOnly: true, sameSite: 'lax', path: '/' });
      return response;
    } }),
    verifiedSession: async () => ({ access_token: 'never-expose-to-browser', user: { id: 'id' } }),
  };
}

test('Google initiation uses fixed callback and PKCE server client', async () => {
  let calls = 0;
  const route = load('app/auth/google/route.ts', {
    '@/lib/server/policy': policy,
    '@/lib/server/supabase': auth({ signInWithOAuth: async input => {
      calls++;
      assert.equal(input.provider, 'google');
      assert.equal(input.options.redirectTo, 'http://localhost:3000/auth/callback');
      return { data: { url: 'https://project.supabase.co/auth/v1/authorize' }, error: null };
    } }),
  });
  assert.equal((await route.POST(request('/auth/google', { method: 'POST' }))).status, 403);
  assert.equal(calls, 0);
  const response = await route.POST(request('/auth/google', { method: 'POST', headers: { origin: 'http://localhost:3000' } }));
  assert.equal(response.status, 303);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.equal(calls, 1);
});

test('callback failure cannot redirect to an attacker or claim success', async () => {
  const route = load('app/auth/callback/route.ts', {
    '@/lib/server/policy': policy,
    '@/lib/server/supabase': auth({ exchangeCodeForSession: async () => ({ error: new Error('invalid') }) }),
  });
  const response = await route.GET(request('/auth/callback?code=bad&next=https://evil.example'));
  assert.equal(response.headers.get('location'), 'http://localhost:3000/account?auth_error=failed');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('session response contains a safe profile, never tokens', async () => {
  const route = load('app/api/auth/session/route.ts', {
    '@/lib/server/policy': policy, '@/lib/server/supabase': auth(),
  }, { fetch: async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer never-expose-to-browser');
    return Response.json({ id: 'uuid', username: 'a@example.com', role: 'customer', shop_id: null });
  } });
  const response = await route.GET(request('/api/auth/session'));
  const body = await response.text();
  assert.ok(body.includes('a@example.com'));
  assert.ok(!body.includes('access_token'));
  assert.ok(!body.includes('never-expose-to-browser'));
});

test('proxy blocks mock/desktop routes and cross-origin mutations before forwarding', async () => {
  let calls = 0;
  const route = load('app/api/backend/[...path]/route.ts', {
    '@/lib/server/policy': policy, '@/lib/server/supabase': auth(),
  }, { fetch: async () => { calls++; return Response.json({}); } });
  const context = path => ({ params: Promise.resolve({ path }) });
  assert.equal((await route.POST(request('/api/backend/jobs/stage', { method: 'POST', headers: { origin: 'https://evil.example' } }), context(['jobs', 'stage']))).status, 403);
  assert.equal((await route.POST(request('/api/backend/payments/x/mock-confirm', { method: 'POST' }), context(['payments', 'x', 'mock-confirm']))).status, 404);
  assert.equal(calls, 0);
});

test('proxy strips inbound credentials and only forwards verified customer tokens', async () => {
  const route = load('app/api/backend/[...path]/route.ts', {
    '@/lib/server/policy': policy, '@/lib/server/supabase': auth(),
  }, { fetch: async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8000/api/v1/customer/documents');
    assert.equal(options.headers.get('authorization'), 'Bearer never-expose-to-browser');
    assert.equal(options.headers.get('cookie'), null);
    assert.equal(options.headers.get('x-forwarded-host'), null);
    assert.equal(options.redirect, 'manual');
    return Response.json([]);
  } });
  const response = await route.GET(request('/api/backend/customer/documents', { headers: { authorization: 'Bearer forged.jwt.value', cookie: 'secret=value', 'x-forwarded-host': 'evil.example' } }), { params: Promise.resolve({ path: ['customer', 'documents'] }) });
  assert.equal(response.status, 200);
});

test('logout rejects cross-site requests and reports provider failures', async () => {
  const route = load('app/api/auth/logout/route.ts', {
    '@/lib/server/policy': policy, '@/lib/server/supabase': auth({ signOut: async () => ({ error: new Error('unavailable') }) }),
  });
  assert.equal((await route.POST(request('/api/auth/logout', { method: 'POST' }))).status, 403);
  assert.equal((await route.POST(request('/api/auth/logout', { method: 'POST', headers: { origin: 'http://localhost:3000' } }))).status, 503);
});

test('real cookie adapter forces HttpOnly, HTTPS Secure and no-store on refresh', () => {
  let config;
  const helper = load('lib/server/supabase.ts', {
    'server-only': {}, './policy': { appOrigin: () => 'https://app.example' },
    '@supabase/ssr': { createServerClient: (_url, _key, options) => { config = options; return {}; } },
  }, { process: { env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' } } });
  const auth = helper.authClient(request('/api/auth/session'));
  config.cookies.setAll([{ name: 'sb-session', value: 'secret-token', options: { httpOnly: false, secure: false } }], { Pragma: 'no-cache' });
  const { NextResponse } = require('next/server');
  const response = auth.finish(NextResponse.json({ ok: true }));
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=lax/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('pragma'), 'no-cache');
});

test('unverified session data is never used as an identity', async () => {
  const helper = load('lib/server/supabase.ts', { 'server-only': {}, './policy': policy });
  let reads = 0;
  const result = await helper.verifiedSession({ auth: {
    getUser: async () => ({ error: { status: 401 }, data: { user: null } }),
    getSession: async () => { reads++; return { data: { session: { access_token: 'forged' } } }; },
  } });
  assert.equal(result, null);
  assert.equal(reads, 0);
});

test('end-user auth rejects secret and legacy service-role keys', () => {
  const legacy = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  for (const key of ['sb_secret_private', legacy('service_role')]) {
    const helper = load('lib/server/supabase.ts', {
      './policy': { appOrigin: () => 'https://app.example' },
      '@supabase/ssr': { createServerClient: () => { throw new Error('Should never be called'); } },
    }, { process: { env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: key } } });
    assert.throws(() => helper.authClient(request('/api/auth/session')), /publishable or legacy anon key/);
  }
});
