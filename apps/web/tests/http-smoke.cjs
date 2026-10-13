// HTTP checks only, not automated visual/browser testing. Always stops its own server.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const { once } = require('node:events');

(async () => {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: require('node:path').join(__dirname, '..'),
    env: { ...process.env, APP_ORIGIN: 'https://app.example', BACKEND_API_URL: 'https://api.example/api/v1',
      SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unit_test',
      NEXT_TELEMETRY_DISABLED: '1' },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.resume(); child.stderr.resume();
  const exited = once(child, 'exit');
  const base = 'http://127.0.0.1:' + port;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error('Smoke server exited before becoming ready');
      try { ready = (await fetch(base + '/api/auth/session', { signal: AbortSignal.timeout(1000) })).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'Production server must start');
    const session = await fetch(base + '/api/auth/session');
    assert.deepEqual(await session.json(), { session: null });
    assert.match(session.headers.get('cache-control'), /no-store/);
    assert.equal((await fetch(base + '/account')).status, 200);
    assert.equal((await fetch(base + '/auth/google', { method: 'POST' })).status, 403);
    const begin = await fetch(base + '/auth/google', { method: 'POST', headers: { Origin: 'https://app.example' }, redirect: 'manual' });
    assert.equal(begin.status, 303);
    const destination = new URL(begin.headers.get('location'));
    assert.equal(destination.protocol, 'https:');
    assert.equal(destination.searchParams.get('provider'), 'google');
    assert.equal(destination.searchParams.get('redirect_to'), 'https://app.example/auth/callback');
    assert.match(begin.headers.get('set-cookie'), /HttpOnly/);
    assert.ok(destination.searchParams.get('code_challenge'));
    const invalidCallback = await fetch(base + '/auth/callback?next=https://evil.example', { redirect: 'manual' });
    assert.equal(invalidCallback.headers.get('location'), 'https://app.example/account?auth_error=failed');
    assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(base + '/api/backend/payments/x/mock-confirm', { method: 'POST' })).status, 404);
    console.log('Production HTTP smoke checks passed; no Google account or live database was modified.');
  } finally {
    if (child.exitCode === null) child.kill();
    await exited;
    console.log('Smoke server stopped.');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
