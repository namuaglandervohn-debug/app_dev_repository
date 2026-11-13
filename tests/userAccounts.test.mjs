import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createUserAccountsHandler } from '../api/admin/user-accounts.js';

function fixture({ role = 'hr_admin', failProfile = false, loseProfileResponse = false, mailStatus = 200 } = {}) {
  const calls = [];
  let savedProfile = null;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetch = async (input, init) => {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path: url.pathname, method, body, idempotencyKey: new Headers(init.headers).get('Idempotency-Key') });
    if (url.origin === 'https://api.resend.com' && url.pathname === '/emails') {
      return json(mailStatus === 200 ? { id: 'test-message' } : { message: 'Unavailable' }, mailStatus);
    }
    if (url.pathname === '/auth/v1/user') return json({ id: 'admin-auth', email: 'admin@example.test' });
    if (url.pathname === '/auth/v1/admin/users') return json({ id: employeeAuthId }, 201);
    if (url.pathname === `/auth/v1/admin/users/${employeeAuthId}` && method === 'DELETE') return json({});
    if (url.pathname === '/rest/v1/employees') return method === 'POST' ? new Response(null, { status: 201 }) : json([]);
    if (url.pathname === '/rest/v1/user_accounts') {
      if (method === 'POST') {
        if (failProfile) return json({ code: '23503', message: 'Account profile could not be linked.' }, 400);
        savedProfile = { ...body };
        return loseProfileResponse ? json({ message: 'Response unavailable.' }, 502) : json(savedProfile, 201);
      }
      const authId = url.searchParams.get('auth_user_id');
      if (authId === 'eq.admin-auth') return json([{ role, email: 'admin@example.test' }]);
      if (authId === `eq.${employeeAuthId}` && savedProfile) return json([savedProfile]);
      return json([]);
    }
    throw new Error('Unexpected request: ' + url.pathname);
  };
  const handler = createUserAccountsHandler({
    env: { SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'test-key', RESEND_API_KEY: 'test-mail-key' },
    fetcher: fetch,
    clientFactory: (url, key, options) => createClient(url, key, { ...options, global: { fetch } }),
  });
  const response = {
    status(code) { this.code = code; return this; },
    setHeader() { return this; },
    end(value) { this.body = JSON.parse(value); },
  };
  const run = () => handler({
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: { name: 'Test Employee', email: 'employee@example.test', password: 'Example<&>123', role: 'employee', employee_id: 'EMP001' },
  }, response);
  return { run, calls, response };
}

const employeeAuthId = 'd2a80000-0000-4000-8000-000000000001';

test('creates the employee record before inserting the linked account', async () => {
  const { run, calls, response } = fixture();
  await run();
  assert.equal(response.code, 201);
  assert.equal(response.body.user.employee_id, 'EMP001');
  assert.equal(response.body.welcome_email_sent, true);
  assert.equal(response.body.welcome_email_id, 'test-message');
  assert.deepEqual(calls.filter(call => call.method === 'POST').map(call => call.path),
    ['/auth/v1/admin/users', '/rest/v1/employees', '/rest/v1/user_accounts', '/emails']);
  assert.equal(calls.find(call => call.path === '/rest/v1/user_accounts' && call.method === 'POST').body.password, null);
  const mail = calls.at(-1).body;
  assert.equal(calls.at(-1).idempotencyKey, `account-welcome/${employeeAuthId}`);
  assert.deepEqual(mail.to, ['employee@example.test']);
  assert.equal(mail.subject, 'Welcome to Buenaventura Estate');
  assert.match(mail.html, /Example&lt;&amp;&gt;123/);
  assert.match(mail.text, /Example<&>123/);
  assert.doesNotMatch(JSON.stringify(response.body), /Example<&>123/);
});

test('rejects non-admins before creating a login', async () => {
  const { run, calls, response } = fixture({ role: 'employee' });
  await run();
  assert.equal(response.code, 403);
  assert.ok(calls.every(call => call.method === 'GET'));
});

test('removes only the newly created login when the profile insert fails', async () => {
  const { run, calls, response } = fixture({ failProfile: true });
  await run();
  assert.equal(response.code, 502);
  assert.deepEqual(calls.filter(call => call.method === 'DELETE').map(call => call.path), [`/auth/v1/admin/users/${employeeAuthId}`]);
  assert.ok(calls.every(call => call.path !== '/emails'));
});

test('keeps the account active when the mail provider fails', async () => {
  const { run, calls, response } = fixture({ mailStatus: 503 });
  await run();
  assert.equal(response.code, 201);
  assert.equal(response.body.welcome_email_sent, false);
  assert.equal(response.body.welcome_email_id, null);
  assert.ok(calls.every(call => call.method !== 'DELETE'));
});

test('keeps a linked account when the insert succeeded and the response was lost', async () => {
  const { run, calls, response } = fixture({ loseProfileResponse: true });
  await run();
  assert.equal(response.code, 201);
  assert.equal(response.body.user.employee_id, 'EMP001');
  assert.ok(calls.every(call => call.method !== 'DELETE'));
});
