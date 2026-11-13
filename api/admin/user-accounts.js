import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const roles = new Map([
  ['hr', 'hr_admin'],
  ['employee', 'employee'],
  ['supervisor', 'supervisor'],
  ['gm', 'general_manager'],
  ['accounting', 'accounting_finance'],
]);
const adminRoles = ['hr', 'hr_admin', 'admin', 'gm', 'general_manager'];
const publicAccountFields = 'user_id,full_name,email,role,employee_id,applicant_id,outlet,is_active,created_at';

const clean = (value) => typeof value === 'string' ? value.trim() : '';
const emailKey = (value) => clean(value).toLowerCase();
const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

async function sendWelcomeEmail({ env, fetcher, name, email, password, authUserId }) {
  const key = clean(env.RESEND_API_KEY);
  if (!key) return null;

  const template = await readFile(new URL('../../resources/views/emails/account-welcome.html', import.meta.url), 'utf8');
  const values = { name, email, password };
  const escapeHtml = (value) => value.replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const html = template.replace(/\[\[(name|email|password)\]\]/g, (_, field) => escapeHtml(values[field]));
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `account-welcome/${authUserId}`,
    },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      from: `${clean(env.RESEND_FROM_NAME) || 'Buenaventura HRIS'} <${clean(env.RESEND_FROM_ADDRESS) || 'no-reply@buenaventura-hris.me'}>`,
      to: [email],
      subject: 'Welcome to Buenaventura Estate',
      html,
      text: `Hi ${name},\n\nYour HRIS account is ready.\nSign-in email: ${email}\nTemporary password: ${password}\n\nSign in: https://app-dev-repository.vercel.app/login\nChange your temporary password after signing in. If you weren’t expecting this email, contact HR.`,
    }),
  });
  if (!response.ok) return null;
  const id = (await response.json())?.id;
  return typeof id === 'string' && id ? id : null;
}

export function createUserAccountsHandler({ env = process.env, clientFactory = createClient, fetcher = fetch } = {}) {
  return async (request, response) => {
    const send = (status, payload) => {
      response.status(status).setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      return response.end(JSON.stringify(payload));
    };
    if (request.method !== 'POST') return send(405, { message: 'Method not allowed.' });

    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '')?.[1];
    if (!token) return send(401, { message: 'Your admin session has expired. Please sign in again.' });
    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return send(503, { message: 'Account creation is not configured on this server.' });

    try {
      const admin = clientFactory(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const verified = await admin.auth.getUser(token);
      const actor = verified.data?.user;
      if (verified.error || !actor?.id || !actor.email) {
        return send(401, { message: 'Your admin session has expired. Please sign in again.' });
      }

      const activeAccounts = () => admin.from('user_accounts').select('role,email').eq('is_active', true);
      const actorProfile = unwrap(await activeAccounts().eq('auth_user_id', actor.id).maybeSingle())
        ?? unwrap(await activeAccounts().eq('email', emailKey(actor.email)).is('auth_user_id', null).maybeSingle());
      if (emailKey(actorProfile?.email) !== emailKey(actor.email) || !adminRoles.includes(actorProfile?.role)) {
        return send(403, { message: 'Only active HR/Admin or General Manager accounts can create users.' });
      }

      let body;
      try {
        body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      } catch {
        return send(400, { message: 'Invalid request body.' });
      }
      const name = clean(body?.name);
      const email = emailKey(body?.email);
      const password = typeof body?.password === 'string' ? body.password : '';
      const role = roles.get(body?.role);
      const employeeId = role === 'employee' ? clean(body?.employee_id) : '';
      const outlet = clean(body?.outlet);
      if (!name || name.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        || email.length > 160 || password.length < 8 || password.length > 120 || !role
        || outlet.length > 160 || (role === 'employee' && (!employeeId || employeeId.length > 40))) {
        return send(422, { message: 'Enter a valid name, email, role, and password of at least 8 characters. Employee accounts require an employee ID.' });
      }

      const duplicate = unwrap(await admin.from('user_accounts').select('user_id').eq('email', email).maybeSingle());
      if (duplicate) return send(409, { message: 'An HRIS account profile with this email already exists.' });

      let employee = null;
      if (employeeId) {
        employee = unwrap(await admin.from('employees').select('employee_id,email,applicant_id').eq('employee_id', employeeId).maybeSingle());
        if (employee && (emailKey(employee.email) !== email || employee.applicant_id
          || unwrap(await admin.from('user_accounts').select('user_id').eq('employee_id', employeeId).limit(1).maybeSingle()))) {
          return send(409, { message: 'This employee ID is already in use. Reopen Create Account to get a new ID.' });
        }
      }

      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        ...(role === 'employee' && { app_metadata: { hris_temporary_password: true } }),
        user_metadata: { full_name: name, role, employee_id: employeeId || null },
      });
      if (created.error) {
        if (created.error.code === 'email_exists' || created.error.code === 'user_already_exists') {
          return send(409, { message: 'A login already exists for this email. Review the existing login before retrying.' });
        }
        return send(422, { message: created.error.message || 'The login could not be created.' });
      }
      const authUserId = created.data?.user?.id;
      if (!authUserId) return send(502, { message: 'The authentication service did not return an account ID.' });

      let profile;
      try {
        if (employeeId && !employee) {
          const [firstName, ...lastName] = name.split(/\s+/);
          unwrap(await admin.from('employees').insert({
            employee_id: employeeId,
            first_name: firstName,
            last_name: lastName.join(' ') || firstName,
            email,
            outlet: outlet || null,
            status: 'Active',
            hire_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
          }));
        }
        profile = unwrap(await admin.from('user_accounts').insert({
          user_id: `USR-${new Date().getFullYear()}-${randomBytes(8).toString('hex').toUpperCase()}`,
          auth_user_id: authUserId,
          employee_id: employeeId || null,
          full_name: name,
          email,
          password: null,
          role,
          outlet: outlet || null,
          is_active: true,
        }).select(publicAccountFields).single());
        if (!profile?.user_id) throw new Error('Account profile was not returned after creation.');
      } catch (error) {
        // The insert can succeed even if its response is lost. Check before removing the new login.
        profile = unwrap(await admin.from('user_accounts').select(publicAccountFields).eq('auth_user_id', authUserId).maybeSingle());
        if (!profile) {
          const cleanup = await admin.auth.admin.deleteUser(authUserId);
          if (cleanup.error) console.warn('Could not roll back an incomplete staff login.');
          if (error.code === '23505') return send(409, { message: 'The employee ID or email is already in use. Refresh User Accounts before retrying.' });
          throw error;
        }
      }

      const welcomeEmailId = await sendWelcomeEmail({ env, fetcher, name, email, password, authUserId })
        .catch(() => null);
      return send(201, {
        message: 'Account created.',
        user: profile,
        welcome_email_sent: welcomeEmailId !== null,
        welcome_email_id: welcomeEmailId,
      });
    } catch {
      return send(502, { message: 'The account could not be saved. Refresh User Accounts before retrying.' });
    }
  };
}

export default createUserAccountsHandler();
