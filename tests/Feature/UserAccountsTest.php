<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Tests\TestCase;

#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class UserAccountsTest extends TestCase
{
    public function test_creates_the_employee_before_linking_the_account(): void
    {
        config([
            'services.supabase.url' => 'https://supabase.test',
            'services.supabase.anon_key' => 'test-anon',
            'services.supabase.service_role_key' => 'test-service',
            'services.resend.key' => 'test-resend',
        ]);
        $writes = [];
        Http::preventStrayRequests();
        Http::fake(function (Request $request) use (&$writes) {
            $path = parse_url($request->url(), PHP_URL_PATH);
            parse_str(parse_url($request->url(), PHP_URL_QUERY) ?? '', $query);

            if ($request->method() === 'GET') {
                return match (true) {
                    $path === '/auth/v1/user' => Http::response(['id' => 'hr-auth', 'email' => 'hr@example.test']),
                    isset($query['or']) => Http::response([['role' => 'hr_admin']]),
                    default => Http::response([]),
                };
            }

            $writes[] = $path;

            return match ($path) {
                '/auth/v1/admin/users' => Http::response(['id' => 'new-auth'], 201),
                '/rest/v1/employees', '/rest/v1/user_accounts' => Http::response([$request->data()], 201),
                '/emails' => Http::response(['id' => 'test-message'], 200),
            };
        });

        $this->withToken('test-token')->postJson('/api/admin/user-accounts', [
            'name' => 'Test Employee',
            'email' => 'employee@example.test',
            'password' => 'Example-Test123',
            'role' => 'employee',
            'employee_id' => 'EMP001',
        ])->assertCreated()->assertJsonPath('user.employee_id', 'EMP001')
            ->assertJsonPath('welcome_email_sent', true)->assertJsonPath('welcome_email_id', 'test-message');

        $this->assertSame(['/auth/v1/admin/users', '/rest/v1/employees', '/rest/v1/user_accounts', '/emails'], $writes);
        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.resend.com/emails'
            && $request->hasHeader('Idempotency-Key', 'account-welcome/new-auth')
            && $request['to'] === ['employee@example.test']
            && str_contains($request['html'], 'Welcome to Buenaventura Estate')
            && str_contains($request['html'], 'Example-Test123'));
    }
}
