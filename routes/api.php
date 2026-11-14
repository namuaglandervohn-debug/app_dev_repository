<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;

/*
| Laravel API routes — use these when moving logic off Supabase.
| All routes are prefixed with /api automatically.
|
| Example:
| Route::get('/health', fn () => response()->json(['ok' => true]));
*/

Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'app' => config('app.name'),
]));

function validateRecipientEmailAddress(string $email, string $field = 'email'): string
{
    $normalizedEmail = strtolower(trim($email));

    if (! filter_var($normalizedEmail, FILTER_VALIDATE_EMAIL)) {
        throw ValidationException::withMessages([
            $field => "Email doesn't exist. Please enter another valid email address.",
        ]);
    }

    return $normalizedEmail;
}

function resendFailurePayload(mixed $responseBody, int $status, string $fallbackMessage): array
{
    $resendMessage = null;
    $resendError = null;

    if (is_array($responseBody)) {
        $resendMessage = $responseBody['message'] ?? null;
        $resendError = $responseBody['error'] ?? $responseBody['name'] ?? null;
    } elseif (is_string($responseBody) && trim($responseBody) !== '') {
        $resendMessage = trim($responseBody);
    }

    $detail = $resendMessage ?: $resendError;

    return [
        'message' => $detail ? "{$fallbackMessage} Resend said: {$detail}" : $fallbackMessage,
        'resend_status' => $status,
        'resend_message' => $resendMessage,
        'resend_error' => $resendError,
    ];
}

function supabaseBaseUrl(): string
{
    $url = rtrim((string) config('services.supabase.url'), '/');

    if (! $url) {
        throw ValidationException::withMessages([
            'supabase' => 'SUPABASE_URL or VITE_SUPABASE_URL is not configured.',
        ]);
    }

    return $url;
}

function supabaseAnonKey(): string
{
    $key = (string) config('services.supabase.anon_key');

    if (! $key) {
        throw ValidationException::withMessages([
            'supabase' => 'SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY is not configured.',
        ]);
    }

    return $key;
}

function supabaseServiceRoleKey(): string
{
    $key = (string) config('services.supabase.service_role_key');

    if (! $key) {
        throw ValidationException::withMessages([
            'supabase' => 'SUPABASE_SERVICE_ROLE_KEY is not configured on the Laravel server.',
        ]);
    }

    return $key;
}

function supabaseRest(string $method, string $path, array $payload = null, array $query = []): array
{
    $request = Http::withHeaders([
        'apikey' => supabaseServiceRoleKey(),
        'Authorization' => 'Bearer '.supabaseServiceRoleKey(),
        'Content-Type' => 'application/json',
        'Prefer' => 'return=representation',
    ])->acceptJson();

    $url = supabaseBaseUrl().$path;
    if ($query) {
        $url .= '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }

    $response = match (strtoupper($method)) {
        'GET' => $request->get($url),
        'POST' => $request->post($url, $payload ?? []),
        'PATCH' => $request->patch($url, $payload ?? []),
        default => throw new InvalidArgumentException("Unsupported Supabase REST method: {$method}"),
    };

    if ($response->failed()) {
        throw ValidationException::withMessages([
            'supabase' => $response->json('message') ?? $response->body(),
        ]);
    }

    return $response->json() ?? [];
}

function requireSupabaseAdmin(Request $request): array
{
    $authorization = (string) $request->header('Authorization');
    if (! str_starts_with($authorization, 'Bearer ')) {
        throw ValidationException::withMessages([
            'auth' => 'Missing Supabase Auth bearer token.',
        ]);
    }

    $accessToken = trim(substr($authorization, 7));
    $userResponse = Http::withHeaders([
        'apikey' => supabaseAnonKey(),
        'Authorization' => 'Bearer '.$accessToken,
    ])->acceptJson()->get(supabaseBaseUrl().'/auth/v1/user');

    if ($userResponse->failed()) {
        throw ValidationException::withMessages([
            'auth' => 'Invalid or expired Supabase Auth session.',
        ]);
    }

    $authUser = $userResponse->json();
    $authUserId = $authUser['id'] ?? null;
    $email = strtolower((string) ($authUser['email'] ?? ''));

    $filters = $authUserId
        ? ['or' => "(auth_user_id.eq.{$authUserId},email.eq.{$email})", 'is_active' => 'eq.true', 'limit' => 1]
        : ['email' => "eq.{$email}", 'is_active' => 'eq.true', 'limit' => 1];

    $accounts = supabaseRest('GET', '/rest/v1/user_accounts', null, array_merge($filters, [
        'select' => 'user_id,auth_user_id,email,role,is_active',
    ]));

    $account = $accounts[0] ?? null;
    $role = strtolower((string) ($account['role'] ?? ''));
    $allowedRoles = ['hr', 'hr_admin', 'admin', 'gm', 'general_manager'];

    if (! $account || ! in_array($role, $allowedRoles, true)) {
        throw ValidationException::withMessages([
            'auth' => 'Only HR/Admin/GM accounts can create users.',
        ]);
    }

    return $account;
}

function normalizeDatabaseRole(string $role): string
{
    return match ($role) {
        'hr' => 'hr_admin',
        'gm' => 'general_manager',
        'accounting' => 'accounting_finance',
        default => $role,
    };
}

Route::post('/applications/validate-recipient-email', function (Request $request) {
    $data = $request->validate([
        'email' => ['required', 'email', 'max:120'],
    ]);

    return response()->json([
        'message' => 'Email address accepted.',
        'email' => validateRecipientEmailAddress($data['email']),
    ]);
});

Route::post('/admin/user-accounts', function (Request $request) {
    requireSupabaseAdmin($request);

    $data = $request->validate([
        'name' => ['required', 'string', 'max:160'],
        'email' => ['required', 'email', 'max:160'],
        'password' => ['required', 'string', 'min:8', 'max:120'],
        'role' => ['required', 'string', 'in:hr,employee,supervisor,gm,accounting'],
        'employee_id' => ['nullable', 'string', 'max:40'],
        'outlet' => ['nullable', 'string', 'max:160'],
    ]);

    $email = validateRecipientEmailAddress($data['email']);
    $name = trim($data['name']);
    $employeeId = trim((string) ($data['employee_id'] ?? ''));
    $outlet = trim((string) ($data['outlet'] ?? ''));
    $databaseRole = normalizeDatabaseRole($data['role']);

    $existingProfiles = supabaseRest('GET', '/rest/v1/user_accounts', null, [
        'select' => 'user_id,email',
        'email' => "eq.{$email}",
        'limit' => 1,
    ]);

    if ($existingProfiles) {
        throw ValidationException::withMessages([
            'email' => 'An HRIS account profile with this email already exists.',
        ]);
    }

    $existingEmployee = null;
    if ($data['role'] === 'employee') {
        if (! $employeeId) {
            throw ValidationException::withMessages(['employee_id' => 'An employee ID is required.']);
        }

        $existingEmployee = supabaseRest('GET', '/rest/v1/employees', null, [
            'select' => 'employee_id,email,applicant_id',
            'employee_id' => "eq.{$employeeId}",
            'limit' => 1,
        ])[0] ?? null;
        if ($existingEmployee && (
            strtolower(trim((string) ($existingEmployee['email'] ?? ''))) !== $email
            || ! empty($existingEmployee['applicant_id'])
            || supabaseRest('GET', '/rest/v1/user_accounts', null, [
                'select' => 'user_id',
                'employee_id' => "eq.{$employeeId}",
                'limit' => 1,
            ])
        )) {
            throw ValidationException::withMessages([
                'employee_id' => 'This employee ID is already in use. Reopen Create Account to get a new ID.',
            ]);
        }
    }

    $createAuthResponse = Http::withHeaders([
        'apikey' => supabaseServiceRoleKey(),
        'Authorization' => 'Bearer '.supabaseServiceRoleKey(),
        'Content-Type' => 'application/json',
    ])->acceptJson()->post(supabaseBaseUrl().'/auth/v1/admin/users', [
        'email' => $email,
        'password' => $data['password'],
        'email_confirm' => true,
        ...($databaseRole === 'employee' ? ['app_metadata' => ['hris_temporary_password' => true]] : []),
        'user_metadata' => [
            'full_name' => $name,
            'role' => $databaseRole,
            'employee_id' => $employeeId ?: null,
        ],
    ]);

    if ($createAuthResponse->failed()) {
        throw ValidationException::withMessages([
            'email' => $createAuthResponse->json('message') ?? $createAuthResponse->json('msg') ?? 'The login could not be created.',
        ]);
    }

    $authUser = $createAuthResponse->json('user') ?? $createAuthResponse->json();
    $authUserId = $authUser['id'] ?? null;

    if (! $authUserId) {
        throw ValidationException::withMessages([
            'supabase' => 'Supabase Auth did not return a user id.',
        ]);
    }

    try {
        if ($data['role'] === 'employee' && ! $existingEmployee) {
            $nameParts = preg_split('/\s+/', $name) ?: [];
            $firstName = $nameParts[0] ?? '';
            $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : $firstName;

            supabaseRest('POST', '/rest/v1/employees', [
                'employee_id' => $employeeId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'outlet' => $outlet ?: null,
                'status' => 'Active',
                'hire_date' => now()->toDateString(),
            ]);
        }

        $profile = supabaseRest('POST', '/rest/v1/user_accounts', [
            'auth_user_id' => $authUserId,
            'employee_id' => $employeeId ?: null,
            'full_name' => $name,
            'email' => $email,
            'password' => null,
            'role' => $databaseRole,
            'outlet' => $outlet ?: null,
            'is_active' => true,
        ])[0] ?? null;
        if (empty($profile['user_id'])) {
            throw ValidationException::withMessages([
                'supabase' => 'The server did not return the saved account. Refresh User Accounts before retrying.',
            ]);
        }
    } catch (Throwable $error) {
        $profile = supabaseRest('GET', '/rest/v1/user_accounts', null, [
            'auth_user_id' => "eq.{$authUserId}",
            'limit' => 1,
        ])[0] ?? null;
        if (empty($profile['user_id'])) {
            $key = supabaseServiceRoleKey();
            $cleanup = Http::withToken($key)->withHeader('apikey', $key)->acceptJson()
                ->delete(supabaseBaseUrl().'/auth/v1/admin/users/'.rawurlencode($authUserId));
            if ($cleanup->failed()) {
                Log::warning('Could not roll back an incomplete staff login.', ['status' => $cleanup->status()]);
            }
            throw $error;
        }
    }

    $welcomeEmailId = sendAccountWelcomeEmail($name, $email, $data['password'], $authUserId);

    return response()->json([
        'message' => 'Supabase Auth user and HRIS account profile created.',
        'user' => $profile,
        'welcome_email_sent' => $welcomeEmailId !== null,
        'welcome_email_id' => $welcomeEmailId,
    ], 201);
});

function sendAccountWelcomeEmail(string $name, string $email, string $password, string $authUserId): ?string
{
    $key = trim((string) config('services.resend.key'));
    if ($key === '') {
        return null;
    }

    try {
        $values = ['name' => $name, 'email' => $email, 'password' => $password];
        $template = \Illuminate\Support\Facades\File::get(resource_path('views/emails/account-welcome.html'));
        $html = preg_replace_callback('/\[\[(name|email|password)\]\]/', fn ($match) => e($values[$match[1]]), $template);
        // Sequential HRIS IDs can be reused after deletion. The Auth ID is unique to this creation.
        $response = Http::withToken($key)->withHeader('Idempotency-Key', 'account-welcome/'.$authUserId)
            ->acceptJson()->timeout(8)->post('https://api.resend.com/emails', [
                'from' => sprintf('%s <%s>', config('services.resend.from_name'), config('services.resend.from_address')),
                'to' => [$email],
                'subject' => 'Welcome to Buenaventura Estate',
                'html' => $html,
                'text' => "Hi {$name},\n\nYour HRIS account is ready.\nSign-in email: {$email}\nTemporary password: {$password}\n\nSign in: https://app-dev-repository.vercel.app/login\nChange your temporary password after signing in. If you weren’t expecting this email, contact HR.",
            ]);

        $id = $response->json('id');

        return $response->successful() && is_string($id) && $id !== '' ? $id : null;
    } catch (Throwable) {
        return null;
    }
}

Route::post('/applications/hired-account', function (Request $request) {
    requireSupabaseAdmin($request);
    $data = $request->validate(['applicant_id' => ['required', 'string', 'max:40']]);
    $id = $data['applicant_id'];
    $app = supabaseRest('GET', '/rest/v1/applicants', null, [
        'select' => 'applicant_id,auth_user_id,status,is_archived,email,name,first_name,middle_name,last_name,suffix',
        'applicant_id' => "eq.{$id}",
    ])[0] ?? null;
    if (($app['status'] ?? null) !== 'Hired' || ! empty($app['is_archived'])) {
        return response()->json(['message' => 'Only an active hired application can receive an employee account.'], 409);
    }

    $recipient = validateRecipientEmailAddress($app['email'] ?? '');
    $employee = supabaseRest('GET', '/rest/v1/employees', null, [
        'select' => 'employee_id,outlet', 'applicant_id' => "eq.{$id}",
    ])[0] ?? null;
    if (! $employee) {
        return response()->json(['message' => 'Save the employee record before preparing the login.'], 409);
    }
    $employeeId = $employee['employee_id'];
    $profiles = supabaseRest('GET', '/rest/v1/user_accounts', null, [
        'select' => 'user_id,auth_user_id,email,employee_id,role,outlet,applicant_id,is_active',
        'employee_id' => "eq.{$employeeId}",
    ]);
    $existing = $profiles[0] ?? null;
    if (count($profiles) > 1 || ($existing && ($existing['role'] !== 'employee' || ! $existing['is_active']
        || (! empty($existing['applicant_id']) && $existing['applicant_id'] !== $id)))) {
        return response()->json(['message' => 'Review the linked account in User Accounts before continuing.'], 409);
    }

    $name = $app['name'] ?: trim(($app['first_name'] ?? '').' '.($app['last_name'] ?? '')) ?: 'Employee';
    $key = supabaseServiceRoleKey();
    $authApi = fn () => Http::withToken($key)->withHeader('apikey', $key)->acceptJson()->timeout(10);
    $authUrl = supabaseBaseUrl().'/auth/v1/admin/users';
    $passwordFor = fn (string $nonce) => 'Bv!'.substr(strtr(base64_encode(hash_hmac('sha256', 'hired-welcome/'.$nonce, $key, true)), '+/', '-_'), 0, 24);
    $separate = ! empty($existing['auth_user_id']) && $existing['auth_user_id'] !== ($app['auth_user_id'] ?? null)
        && strtolower($existing['email']) !== $recipient;
    $saved = $existing;
    if ($separate) {
        $auth = $authApi()->get($authUrl.'/'.$existing['auth_user_id']);
        $user = $auth->json('user') ?? $auth->json();
        if ($auth->failed() || strtolower($user['email'] ?? '') !== strtolower($existing['email'])) {
            return response()->json(['message' => 'The employee login could not be verified. Review it in User Accounts.'], 409);
        }
    } else {
        $normalize = fn (?string $value) => substr(preg_replace('/[^a-z0-9]/', '', strtolower(\Illuminate\Support\Str::ascii($value ?? ''))), 0, 25);
        $base = implode('.', array_filter([$normalize($app['last_name']), $normalize($app['first_name'])])) ?: $normalize($id);
        $nonce = (string) \Illuminate\Support\Str::uuid();
        $user = null;
        for ($suffix = 1; $suffix <= 30; $suffix++) {
            $email = $base.($suffix === 1 ? '' : '.'.$suffix).'@buenaventura.com';
            if ($email === $recipient || supabaseRest('GET', '/rest/v1/user_accounts', null, ['select' => 'user_id', 'email' => "eq.{$email}"])) {
                continue;
            }
            $created = $authApi()->post($authUrl, [
                'email' => $email, 'password' => $passwordFor($nonce), 'email_confirm' => true,
                'app_metadata' => ['hris_temporary_password' => true, 'hris_hired_welcome' => $nonce, 'hris_hired_application' => $id],
                'user_metadata' => ['full_name' => $name, 'role' => 'employee', 'employee_id' => $employeeId],
            ]);
            if (in_array($created->json('error_code'), ['email_exists', 'user_already_exists'], true)) {
                continue;
            }
            if ($created->failed()) {
                return response()->json(['message' => 'Employee login creation failed. Please retry.'], 502);
            }
            $user = $created->json('user') ?? $created->json();
            break;
        }
        if (empty($user['id'])) {
            return response()->json(['message' => 'Could not assign an unused employee email.'], 409);
        }
        $profile = [
            'auth_user_id' => $user['id'], 'employee_id' => $employeeId, 'applicant_id' => $id, 'full_name' => $name,
            'first_name' => $app['first_name'], 'middle_name' => $app['middle_name'], 'last_name' => $app['last_name'],
            'suffix' => $app['suffix'], 'email' => $user['email'], 'role' => 'employee', 'password' => null,
            'outlet' => ($existing['outlet'] ?? null) ?: ($employee['outlet'] ?? null), 'is_active' => true,
        ];
        try {
            $saved = $existing
                ? (supabaseRest('PATCH', '/rest/v1/user_accounts', $profile, [
                    'user_id' => 'eq.'.$existing['user_id'],
                    'auth_user_id' => empty($existing['auth_user_id']) ? 'is.null' : 'eq.'.$existing['auth_user_id'],
                ])[0] ?? null)
                : (supabaseRest('POST', '/rest/v1/user_accounts', $profile)[0] ?? null);
        } catch (Throwable) {
            $saved = null;
        }
        if (! $saved) {
            $saved = supabaseRest('GET', '/rest/v1/user_accounts', null, [
                'auth_user_id' => 'eq.'.$user['id'],
            ])[0] ?? null;
            if (! $saved) {
                $authApi()->delete($authUrl.'/'.$user['id']);
                return response()->json(['message' => 'Employee setup could not finish. Refresh and try again.'], 409);
            }
        }
    }

    $nonce = $user['app_metadata']['hris_hired_welcome'] ?? null;
    $password = $nonce && ($user['app_metadata']['hris_hired_application'] ?? null) === $id
        && ($user['app_metadata']['hris_temporary_password'] ?? null) === true ? $passwordFor($nonce) : null;
    $deliveryKey = $password ? 'hired-welcome/'.$user['id'] : 'hired-existing/'.$id.'/'.$user['id'];
    $sent = sendHiredWelcomeEmail($name, $recipient, $user['email'], $password, $deliveryKey);
    return response()->json(['welcome_email_sent' => $sent, 'message' => $sent
        ? 'Employee account ready. The welcome email was accepted for delivery.'
        : 'Employee account ready. The welcome email could not be sent. Select Complete Employee Account Setup to retry.']);
});

function sendHiredWelcomeEmail(string $name, string $recipient, string $email, ?string $password, string $deliveryKey): bool
{
    $key = trim((string) config('services.resend.key'));
    if ($key === '') {
        return false;
    }
    try {
        $template = \Illuminate\Support\Facades\File::get(resource_path('views/emails/hired-welcome.html'));
        $instructions = $password ? 'Change your temporary password on your first sign-in.' : 'Use your current employee password. If you need help signing in, contact HR.';
        $values = [
            'name' => e($name), 'email' => e($email),
            'passwordRow' => $password ? '<tr><td style="padding:8px 14px 12px;overflow-wrap:anywhere;"><strong>Temporary password</strong><br><span style="font-family:monospace;white-space:pre-wrap;">'.e($password).'</span></td></tr>' : '',
            'signInInstructions' => $instructions,
        ];
        $html = preg_replace_callback('/\[\[(name|email|passwordRow|signInInstructions)\]\]/', fn ($match) => $values[$match[1]], $template);
        $passwordText = $password ? "Temporary password: {$password}\n\n" : '';
        $signInText = $password ? 'Sign in at https://app-dev-repository.vercel.app/login and change your temporary password.'
            : "Sign in at https://app-dev-repository.vercel.app/login. {$instructions}";
        $response = Http::withToken($key)->withHeader('Idempotency-Key', $deliveryKey)
            ->acceptJson()->timeout(4)->retry(2, 150, function ($exception) {
                return $exception instanceof \Illuminate\Http\Client\ConnectionException
                    || ($exception instanceof \Illuminate\Http\Client\RequestException && $exception->response->serverError());
            }, throw: false)->post('https://api.resend.com/emails', [
                'from' => sprintf('%s <%s>', config('services.resend.from_name'), config('services.resend.from_address')),
                'to' => [$recipient],
                'subject' => 'You’re hired! Welcome to Buenaventura Estate',
                'html' => $html,
                'text' => "Hello {$name}!\n\nYou’re hired! Here’s your employee account.\n\nEmail: {$email}\n\n{$passwordText}{$signInText}",
            ]);
        return $response->successful() && ! empty($response->json('id'));
    } catch (Throwable) {
        return false;
    }
}

Route::post('/applications/send-applicant-id-email', function (Request $request) {
    $data = $request->validate([
        'applicant_id' => ['required', 'string', 'max:40'],
        'email' => ['required', 'email', 'max:120'],
        'name' => ['nullable', 'string', 'max:160'],
        'position' => ['nullable', 'string', 'max:160'],
    ]);
    $data['email'] = validateRecipientEmailAddress($data['email']);

    $unavailable = fn () => response()->json([
        'sent' => false,
        'code' => 'EMAIL_SERVICE_UNAVAILABLE',
        'message' => 'Confirmation email is temporarily unavailable. Your application remains saved; please keep your Applicant ID.',
    ], 503);
    $apiKey = trim((string) config('services.resend.key'));
    if (! $apiKey) {
        Log::warning('Applicant ID email skipped: RESEND_API_KEY is not configured.', [
            'applicant_id' => $data['applicant_id'],
            'email' => $data['email'],
        ]);

        return $unavailable();
    }

    $appName = config('app.name', 'Buenaventura HRIS');
    $fromAddress = config('services.resend.from_address', config('mail.from.address'));
    $fromName = config('services.resend.from_name', config('mail.from.name', $appName));
    $from = sprintf('%s <%s>', $fromName, $fromAddress);
    $applicantName = trim($data['name'] ?? '') ?: 'Applicant';
    $position = trim($data['position'] ?? '');
    $subject = "Your {$appName} Applicant ID";
    $trackingNote = 'Please keep this Applicant ID. You can use it to track your application status in the applicant portal.';

    $html = view('emails.applicant-id', [
        'appName' => $appName,
        'applicantName' => $applicantName,
        'applicantId' => $data['applicant_id'],
        'position' => $position,
        'trackingNote' => $trackingNote,
    ])->render();

    try {
        $response = Http::withToken($apiKey)
            ->timeout(10)
            ->acceptJson()
            ->asJson()
            ->post('https://api.resend.com/emails', [
                'from' => $from,
                'to' => [$data['email']],
                'subject' => $subject,
                'html' => $html,
                'text' => "Hello {$applicantName},\n\nYour Applicant ID is {$data['applicant_id']}."
                    . ($position ? "\nPosition Applied For: {$position}" : '')
                    . "\n\n{$trackingNote}\n\n{$appName}",
            ]);
    } catch (\Illuminate\Http\Client\ConnectionException $exception) {
        Log::warning('Applicant ID email provider connection failed.');
        return $unavailable();
    }

    if ($response->failed() || ! $response->json('id')) {
        $responseBody = $response->json() ?? $response->body();
        Log::warning('Applicant ID email failed via Resend.', [
            'applicant_id' => $data['applicant_id'],
            'email' => $data['email'],
            'status' => $response->status(),
            'body' => $responseBody,
        ]);

        return $unavailable();
    }

    return response()->json([
        'sent' => true,
        'message' => 'Applicant ID email sent.',
        'resend' => $response->json(),
    ]);
});

Route::post('/applications/send-status-email', function (Request $request) {
    requireSupabaseAdmin($request);
    $data = $request->validate([
        'applicant_id' => ['required', 'string', 'max:40'],
        'email' => ['required', 'email', 'max:120'],
        'name' => ['nullable', 'string', 'max:160'],
        'position' => ['nullable', 'string', 'max:160'],
        'status' => ['required', 'in:Submitted,Under Review,Missing Requirements,For Interview,Hired,Not Qualified,Not Hired,Archived'],
        'note' => ['nullable', 'string', 'max:10000'],
        'interview_date' => ['nullable', 'string', 'max:40'],
        'interview_time' => ['nullable', 'string', 'max:40'],
        'interview_location' => ['nullable', 'string', 'max:200'],
    ]);
    $data['email'] = validateRecipientEmailAddress($data['email']);
    $records = supabaseRest('GET', '/rest/v1/applicants', null, [
        'select' => 'email,status',
        'applicant_id' => 'eq.'.$data['applicant_id'],
        'limit' => 1,
    ]);
    $application = $records[0] ?? [];
    if (strtolower($application['email'] ?? '') !== $data['email'] || ($application['status'] ?? '') !== $data['status']) {
        return response()->json(['sent' => false, 'message' => 'This application changed. Refresh it before sending a status email.'], 409);
    }

    $apiKey = trim((string) config('services.resend.key'));
    if (! $apiKey) {
        Log::warning('Application status email skipped: RESEND_API_KEY is not configured.', [
            'applicant_id' => $data['applicant_id'],
            'email' => $data['email'],
            'status' => $data['status'],
        ]);

        return response()->json(['message' => 'Resend is not configured.'], 500);
    }

    $appName = config('app.name', 'Buenaventura HRIS');
    $fromAddress = config('services.resend.from_address', config('mail.from.address'));
    $fromName = config('services.resend.from_name', config('mail.from.name', $appName));
    $from = sprintf('%s <%s>', $fromName, $fromAddress);
    $applicantName = trim($data['name'] ?? '') ?: 'Applicant';
    $position = trim($data['position'] ?? '');
    $status = trim($data['status']);
    $note = trim($data['note'] ?? '');
    $interviewDate = preg_replace('/^(\d{4})-(\d{2})-(\d{2})$/', '$2/$3/$1', trim($data['interview_date'] ?? ''));
    $interviewTime = trim($data['interview_time'] ?? '');
    $interviewLocation = trim($data['interview_location'] ?? '');

    $html = view('emails.application-status', [
        'appName' => $appName,
        'applicantName' => $applicantName,
        'applicantId' => $data['applicant_id'],
        'position' => $position,
        'status' => $status,
        'note' => $note,
        'interviewDate' => $interviewDate,
        'interviewTime' => $interviewTime,
        'interviewLocation' => $interviewLocation,
    ])->render();

    $details = [];
    if ($position) $details[] = "Position: {$position}";
    if ($interviewDate) $details[] = "Interview Date: {$interviewDate}";
    if ($interviewTime) $details[] = "Interview Time: {$interviewTime}";
    if ($interviewLocation) $details[] = "Location: {$interviewLocation}";
    if ($note) $details[] = "Note: {$note}";

    try {
        $mailRequest = Http::withToken($apiKey);
        if ($status === 'Hired') {
            $mailRequest->withHeader('Idempotency-Key', 'hired-status/'.$data['applicant_id']);
        }
        $response = $mailRequest
            ->timeout(10)
            ->acceptJson()
            ->asJson()
            ->post('https://api.resend.com/emails', [
                'from' => $from,
                'to' => [$data['email']],
                'subject' => "Application/requirements status update: {$status}",
                'html' => $html,
                'text' => "Hello {$applicantName},\n\nApplicant ID: {$data['applicant_id']}\nYour application/requirements status is now: {$status}."
                    . ($details ? "\n".implode("\n", $details) : '')
                    . "\n\nWe will email you whenever your application status changes.\n\n{$appName}",
            ]);

    } catch (\Illuminate\Http\Client\ConnectionException $exception) {
        return response()->json(['sent' => false, 'message' => 'The status email service could not be reached. Your saved checklist is unchanged.'], 503);
    }

    if ($response->failed() || ! $response->json('id')) {
        $responseBody = $response->json() ?? $response->body();
        Log::warning('Application status email failed via Resend.', [
            'applicant_id' => $data['applicant_id'],
            'email' => $data['email'],
            'status' => $status,
            'resend_status' => $response->status(),
            'body' => $responseBody,
        ]);

        return response()->json(resendFailurePayload(
            $responseBody,
            $response->status(),
            'Application status email could not be sent.'
        ), 502);
    }

    return response()->json([
        'sent' => true,
        'message' => 'Application status email sent.',
        'resend' => $response->json(),
    ]);
});
