const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: name => dependencies[name] || require(name),
    process: {
      env: {
        APP_ORIGIN: 'http://localhost:3000',
        BACKEND_API_URL: 'http://127.0.0.1:8000/api/v1',
        SUPABASE_URL: 'https://project.supabase.co',
      },
    },
    URL,
    Request,
    Headers,
    Response,
    AbortSignal,
    Buffer,
    Uint8Array,
  });
  return exports;
}

const policy = load('lib/server/policy.ts');

function mockAuthClient(authOverrides = {}) {
  return {
    authClient: () => ({
      client: { auth: authOverrides },
      finish: response => {
        response.headers.set('cache-control', 'private, no-store');
        response.cookies.set('sb-access-token', 'token-123', { httpOnly: true });
        return response;
      },
    }),
  };
}

test('login endpoint rejects invalid origin (CSRF protection)', async () => {
  const loginRoute = load('app/api/auth/login/route.ts', {
    '@/lib/server/policy': policy,
    '@/lib/server/supabase': mockAuthClient(),
  });

  const req = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { origin: 'http://evil.com', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
  });

  const res = await loginRoute.POST(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.detail, 'Invalid request origin');
});

test('login endpoint validates email and password presence', async () => {
  const loginRoute = load('app/api/auth/login/route.ts', {
    '@/lib/server/policy': policy,
    '@/lib/server/supabase': mockAuthClient(),
  });

  const req = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: '', password: '' }),
  });

  const res = await loginRoute.POST(req);
  assert.equal(res.status, 400);
});

test('login endpoint handles disabled email provider with informative message', async () => {
  const loginRoute = load('app/api/auth/login/route.ts', {
    '@/lib/server/policy': policy,
    '@/lib/server/supabase': mockAuthClient({
      signInWithPassword: async () => ({
        data: { user: null },
        error: { code: 'email_provider_disabled', message: 'Email logins are disabled', status: 422 },
      }),
    }),
  });

  const req = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'user@example.com', password: 'secretpassword' }),
  });

  const res = await loginRoute.POST(req);
  assert.equal(res.status, 422);
  const data = await res.json();
  assert.match(data.detail, /Email logins are disabled in Supabase/);
});

test('login endpoint succeeds with valid credentials', async () => {
  const loginRoute = load('app/api/auth/login/route.ts', {
    '@/lib/server/policy': policy,
    '@/lib/server/supabase': mockAuthClient({
      signInWithPassword: async () => ({
        data: { user: { id: 'usr-123', email: 'user@example.com' } },
        error: null,
      }),
    }),
  });

  const req = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'user@example.com', password: 'secretpassword' }),
  });

  const res = await loginRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.session.user.id, 'usr-123');
  assert.equal(data.session.user.username, 'user@example.com');
});

test('signup endpoint validates password length', async () => {
  const signupRoute = load('app/api/auth/signup/route.ts', {
    '@/lib/server/policy': policy,
    '@/lib/server/supabase': mockAuthClient(),
  });

  const req = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'user@example.com', password: '123' }),
  });

  const res = await signupRoute.POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.detail, /Password must be at least 6 characters/);
});

test('signup endpoint succeeds with new account creation', async () => {
  const signupRoute = load('app/api/auth/signup/route.ts', {
    '@/lib/server/policy': policy,
    '@/lib/server/supabase': mockAuthClient({
      signUp: async () => ({
        data: {
          user: { id: 'usr-456', email: 'new@example.com' },
          session: { access_token: 'tok-xyz' },
        },
        error: null,
      }),
    }),
  });

  const req = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'new@example.com', password: 'securepassword123' }),
  });

  const res = await signupRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.session.user.id, 'usr-456');
  assert.equal(data.session.user.alias, 'new@ex');
});
