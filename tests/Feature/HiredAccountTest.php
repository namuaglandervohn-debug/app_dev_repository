<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Tests\TestCase;

#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class HiredAccountTest extends TestCase
{
    private function fakeApi(string $status = 'Hired'): void
    {
        config([
            'services.supabase.url' => 'https://supabase.test',
            'services.supabase.anon_key' => 'anon',
            'services.supabase.service_role_key' => 'service',
            'services.resend.key' => 'test-mail',
        ]);
        Http::preventStrayRequests();
        Http::fake(function (Request $request) use ($status) {
            $path = parse_url($request->url(), PHP_URL_PATH);
            parse_str(parse_url($request->url(), PHP_URL_QUERY) ?? '', $query);
            return match ($path) {
                '/auth/v1/user' => Http::response(['id' => 'gm-auth', 'email' => 'gm@example.test']),
                '/rest/v1/applicants' => Http::response([[
                    'applicant_id' => 'APP-2026-0001', 'auth_user_id' => 'applicant-auth',
                    'status' => $status, 'is_archived' => false, 'email' => 'applicant@example.test',
                    'name' => 'New <Employee>', 'first_name' => 'New', 'middle_name' => '',
                    'last_name' => 'Employee', 'suffix' => '',
                ]]),
                '/rest/v1/employees' => Http::response([['employee_id' => 'EMP-2026-0001']]),
                '/rest/v1/user_accounts' => Http::response(match (true) {
                    isset($query['or']) => [['role' => 'general_manager']],
                    $request->method() === 'POST' => [$request->data() + ['user_id' => 'USR-2026-0001']],
                    default => [],
                }),
                '/auth/v1/admin/users' => Http::response(['id' => 'employee-auth'] + $request->data(), 201),
                '/emails' => Http::response(['id' => 'mail-fixture']),
            };
        });
    }

    public function test_hired_applicant_gets_a_separate_login_and_branded_email(): void
    {
        $this->fakeApi();
        $this->withToken('admin-token')->postJson('/api/applications/hired-account', [
            'applicant_id' => 'APP-2026-0001', 'email' => 'ignored@example.test',
        ])->assertOk()->assertJsonPath('welcome_email_sent', true)->assertJsonMissingPath('password');
        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/auth/v1/admin/users')
            && $request->method() === 'POST' && $request['email'] === 'employee.new@buenaventura.com'
            && $request['app_metadata']['hris_temporary_password'] === true);
        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/emails')
            && $request['to'] === ['applicant@example.test']
            && str_contains($request['html'], 'Hello New &lt;Employee&gt;!')
            && str_contains($request['html'], '#1ea44e'));
        Http::assertNotSent(fn (Request $request) => $request->method() === 'PUT');
    }

    public function test_no_account_or_email_is_created_before_the_hiring_decision(): void
    {
        $this->fakeApi('For Interview');
        $this->withToken('admin-token')->postJson('/api/applications/hired-account', [
            'applicant_id' => 'APP-2026-0001',
        ])->assertConflict();
        Http::assertNotSent(fn (Request $request) => $request->method() !== 'GET');
    }
}
