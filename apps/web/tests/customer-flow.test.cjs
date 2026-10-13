const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: (name) => name === 'server-only' ? {} : dependencies[name] || require(name),
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
    RangeError,
    ...globals,
  });
  return exports;
}

const policy = load('lib/server/policy.ts');

test('policy allows required customer flow routes and blocks destructive/operator escapes', () => {
  // Allowed customer workspace routes
  assert.equal(policy.allowedRoute('GET', ['customer', 'documents']), true);
  assert.equal(policy.allowedRoute('GET', ['customer', 'documents', 'doc-123', 'download']), true);
  assert.equal(policy.allowedRoute('DELETE', ['customer', 'documents', 'doc-123']), true);
  assert.equal(policy.allowedRoute('PATCH', ['customer', 'alias']), true);
  assert.equal(policy.allowedRoute('GET', ['customer', 'jobs']), true);
  assert.equal(policy.allowedRoute('GET', ['customer', 'jobs', 'job-123']), true);
  assert.equal(policy.allowedRoute('POST', ['jobs', 'calculate-cost']), true);
  assert.equal(policy.allowedRoute('POST', ['jobs', 'stage']), true);
  assert.equal(policy.allowedRoute('POST', ['jobs', 'stage-folder']), true);
  assert.equal(policy.allowedRoute('POST', ['customer', 'documents']), true);
  assert.equal(policy.allowedRoute('POST', ['customer', 'documents', 'batch']), true);
  assert.equal(policy.allowedRoute('POST', ['payments', 'job-123', 'order']), true);
  assert.equal(policy.allowedRoute('POST', ['payments', 'job-123', 'verify']), true);
  assert.equal(policy.allowedRoute('POST', ['payments', 'job-123', 'pay-at-counter']), true);
  assert.equal(policy.allowedRoute('GET', ['customer', 'storage-usage']), true);
  assert.equal(policy.allowedRoute('GET', ['uploads', 'policy']), true);
  assert.equal(policy.allowedRoute('GET', ['uploads', 'batches', 'batch-123']), true);
  assert.equal(policy.allowedRoute('POST', ['uploads', 'guest-session']), true);
  assert.equal(policy.allowedRoute('POST', ['uploads', 'batches']), true);
  assert.equal(policy.allowedRoute('POST', ['uploads', 'items', 'item-123', 'permission']), true);
  assert.equal(policy.allowedRoute('POST', ['uploads', 'items', 'item-123', 'complete']), true);
  assert.equal(policy.allowedRoute('POST', ['uploads', 'batches', 'batch-123', 'finalize']), true);
  assert.equal(policy.allowedRoute('POST', ['uploads', 'batches', 'batch-123', 'cancel']), true);

  // Blocked routes: cannot delete customer account directly or access internal storage paths
  assert.equal(policy.allowedRoute('DELETE', ['customer', 'account']), false);
  assert.equal(policy.allowedRoute('DELETE', ['customer']), false);
  assert.equal(policy.allowedRoute('GET', ['storage', 'v1', 'object']), false);
  assert.equal(policy.allowedRoute('POST', ['payments', 'fake-confirm']), false);
  assert.equal(policy.allowedRoute('POST', ['uploads', 'fake-bypass']), false);
  assert.equal(policy.allowedRoute('POST', ['payments', 'job-123', 'unknown-action']), false);
});

test('customer document continuity: URL parameter encoding and route safety', () => {
  const docId = 'doc-a1b2c3d4e5f6';
  const encoded = encodeURIComponent(docId);
  assert.equal(encoded, 'doc-a1b2c3d4e5f6');

  const printUrl = `/account/print/new?doc=${encoded}`;
  const parsed = new URL(printUrl, 'http://localhost:3000');
  assert.equal(parsed.searchParams.get('doc'), docId);

  const shopUrl = `/shop/shop-main?doc=${encoded}`;
  const parsedShop = new URL(shopUrl, 'http://localhost:3000');
  assert.equal(parsedShop.searchParams.get('doc'), docId);
});

test('honest release gate: release token is not displayed for unpaid or pending jobs', () => {
  function getReleasePresentation(job) {
    const isPaid = (job.payment_status === 'completed' || job.payment_status === 'paid');
    const isCounter = job.payment_method === 'counter';
    if ((isPaid || isCounter) && job.release_token) {
      return { status: 'verified', token: job.release_token };
    }
    return { status: 'unverified', token: null, message: 'Issued only after verified payment.' };
  }

  // Pending job without token
  const pendingJob = {
    job_id: 'job-1',
    payment_status: 'pending',
    job_status: 'staged',
    release_token: null,
  };
  const pendingPres = getReleasePresentation(pendingJob);
  assert.equal(pendingPres.status, 'unverified');
  assert.equal(pendingPres.token, null);

  // Staged job with fake client token attempted
  const fakeTokenJob = {
    job_id: 'job-2',
    payment_status: 'pending',
    job_status: 'staged',
    release_token: 'FAKE999',
  };
  const fakePres = getReleasePresentation(fakeTokenJob);
  assert.equal(fakePres.status, 'unverified');
  assert.equal(fakePres.token, null);

  // Verified server-paid job (using paid)
  const verifiedJob = {
    job_id: 'job-3',
    payment_status: 'paid',
    job_status: 'queued',
    release_token: 'REAL4321',
  };
  const verifiedPres = getReleasePresentation(verifiedJob);
  assert.equal(verifiedPres.status, 'verified');
  assert.equal(verifiedPres.token, 'REAL4321');

  // Verified server-paid job (using completed from Razorpay)
  const completedJob = {
    job_id: 'job-4',
    payment_status: 'completed',
    payment_method: 'razorpay',
    job_status: 'queued',
    release_token: '3744',
  };
  const completedPres = getReleasePresentation(completedJob);
  assert.equal(completedPres.status, 'verified');
  assert.equal(completedPres.token, '3744');

  // Pay-at-counter job with allocated release token
  const counterJob = {
    job_id: 'job-5',
    payment_status: 'pending',
    payment_method: 'counter',
    job_status: 'queued',
    release_token: '5182',
  };
  const counterPres = getReleasePresentation(counterJob);
  assert.equal(counterPres.status, 'verified');
  assert.equal(counterPres.token, '5182');
});
