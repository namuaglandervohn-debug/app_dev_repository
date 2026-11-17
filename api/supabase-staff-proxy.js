import { createClient } from '@supabase/supabase-js';

const STAFF_ROLES = new Set(['hr', 'hr_admin', 'admin', 'general_manager', 'gm', 'supervisor']);

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function setCors(request, response) {
  const origin = clean(request.headers.origin);
  if (origin === 'https://app-dev-repository.vercel.app' || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, prefer, range, x-client-info');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS');
  }
}

function send(response, status, body) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function safePath(value) {
  const path = clean(value);
  return /^\/(?:rest\/v1)\/[A-Za-z0-9_/-]+(?:\?[^\s]*)?$/.test(path) ? path : '';
}

export default async function supabaseStaffProxy(request, response) {
  setCors(request, response);
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  const path = safePath(request.query?.path);
  const url = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '')?.[1];

  if (!path || !url || !serviceKey || !bearer) {
    return send(response, 400, { message: 'The requested data route is unavailable.' });
  }

  try {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const verified = await admin.auth.getUser(bearer);
    const actor = verified.data?.user;
    if (verified.error || !actor?.id || !actor.email) {
      return send(response, 401, { message: 'Your session has expired. Please sign in again.' });
    }

    const { data: linkedAccount, error: accountError } = await admin
      .from('user_accounts')
      .select('role,email,is_active')
      .eq('auth_user_id', actor.id)
      .maybeSingle();
    if (accountError) throw accountError;
    let account = linkedAccount;
    if (!account) {
      const { data: legacyAccount, error: legacyAccountError } = await admin
        .from('user_accounts')
        .select('role,email,is_active')
        .eq('email', actor.email)
        .maybeSingle();
      if (legacyAccountError) throw legacyAccountError;
      account = legacyAccount;
    }

    const staffAccess = Boolean(account?.is_active)
      && clean(account?.email).toLowerCase() === clean(actor.email).toLowerCase()
      && STAFF_ROLES.has(clean(account?.role).toLowerCase());

    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value !== 'string' || ['host', 'authorization', 'apikey', 'content-length'].includes(name.toLowerCase())) continue;
      headers.set(name, value);
    }
    headers.set('apikey', staffAccess ? serviceKey : clean(request.headers.apikey));
    headers.set('Authorization', `Bearer ${staffAccess ? serviceKey : bearer}`);

    const method = request.method || 'GET';
    const body = ['GET', 'HEAD'].includes(method) ? undefined
      : typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});
    const upstream = await fetch(`${url}${path}`, { method, headers, body });
    const text = await upstream.text();
    response.status(upstream.status);
    setCors(request, response);
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.end(text);
  } catch {
    return send(response, 502, { message: 'The staff data service is temporarily unavailable.' });
  }
}
