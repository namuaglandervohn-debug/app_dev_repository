<?php

namespace Tests\Feature;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Tests\TestCase;

#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class ApplicantEmailTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['services.resend.key' => " test-key\n", 'services.resend.from_address' => 'sender@example.com', 'services.resend.from_name' => 'HRIS']);
        Http::preventStrayRequests();
    }

    private function payload(): array
    {
        return ['applicant_id' => 'APP-2026-ABC123', 'email' => 'applicant@example.com', 'name' => 'Applicant'];
    }

    private function fakeStatusEmail(string $status, callable $provider): void
    {
        config([
            'services.supabase.url' => 'https://supabase.test',
            'services.supabase.anon_key' => 'anon',
            'services.supabase.service_role_key' => 'service',
        ]);
        Http::fake(fn (Request $request) => match (parse_url($request->url(), PHP_URL_PATH)) {
            '/auth/v1/user' => Http::response(['id' => 'hr-auth', 'email' => 'hr@example.com']),
            '/rest/v1/user_accounts' => Http::response([['role' => 'hr_admin', 'email' => 'hr@example.com']]),
            '/rest/v1/applicants' => Http::response([['email' => $this->payload()['email'], 'status' => $status]]),
            '/emails' => $provider(),
        });
    }

    public function test_invalid_key_returns_delivery_notice_instead_of_provider_error(): void
    {
        Http::fake(['api.resend.com/*' => Http::response(['message' => 'API key is invalid'], 401)]);
        $this->postJson('/api/applications/send-applicant-id-email', $this->payload())
            ->assertStatus(503)->assertJsonPath('sent', false)->assertJsonPath('code', 'EMAIL_SERVICE_UNAVAILABLE')
            ->assertDontSee('API key is invalid');
    }

    public function test_missing_key_does_not_call_email_provider(): void
    {
        config(['services.resend.key' => '']);
        Http::fake();
        $this->postJson('/api/applications/send-applicant-id-email', $this->payload())->assertStatus(503)->assertJsonPath('sent', false);
        Http::assertNothingSent();
    }

    public function test_success_acknowledges_delivery_and_uses_cached_sender_configuration(): void
    {
        Http::fake(['api.resend.com/*' => Http::response(['id' => 'mail-id'])]);
        $this->postJson('/api/applications/send-applicant-id-email', $this->payload())->assertOk()->assertJsonPath('sent', true);
        Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer test-key') && $request['from'] === 'HRIS <sender@example.com>');
    }

    public function test_connection_failure_is_a_controlled_email_failure(): void
    {
        Http::fake(fn () => throw new ConnectionException('Provider unavailable'));
        $this->postJson('/api/applications/send-applicant-id-email', $this->payload())->assertStatus(503)->assertJsonPath('sent', false);
    }

    public function test_requirements_status_email_accepts_checklist_summary_and_confirms_sending(): void
    {
        $this->fakeStatusEmail('Under Review', fn () => Http::response(['id' => 'status-mail-id']));
        $this->withToken('staff-token')->postJson('/api/applications/send-status-email', array_merge($this->payload(), ['status' => 'Under Review', 'note' => str_repeat('Requirements detail. ', 80)]))
            ->assertOk()->assertJsonPath('sent', true);
        Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer test-key') && $request['from'] === 'HRIS <sender@example.com>' && str_contains($request['text'], 'Under Review'));
    }

    public function test_status_email_connection_failure_preserves_the_saved_checklist(): void
    {
        $this->fakeStatusEmail('Missing Requirements', fn () => Http::failedConnection('Provider unavailable'));
        $this->withToken('staff-token')->postJson('/api/applications/send-status-email', array_merge($this->payload(), ['status' => 'Missing Requirements']))
            ->assertStatus(503)->assertJsonPath('sent', false);
    }
}
