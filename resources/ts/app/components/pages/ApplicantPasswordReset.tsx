import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, CircularProgress, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import AuthBackground from '../AuthBackground';

export default function ApplicantPasswordReset({ client }: { client: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (active) setSession(error ? null : data.session);
    }).catch(() => {
      if (active) setSession(null);
    });
    return () => { active = false; };
  }, [client]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || saving || saved) return;
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setSaved(true);
      setPassword('');
      setConfirmation('');
      // The password change succeeded. Discard the temporary recovery session.
      void client.auth.signOut({ scope: 'local' }).catch(() => {});
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthBackground>
      <Container component="main" maxWidth="sm" sx={{ py: 4 }}>
        <Paper sx={{ p: { xs: 2, sm: 4 }, borderRadius: 5 }}>
          <Stack spacing={2}>
            <Typography component="h1" variant="h5" fontWeight={700}>Reset your password</Typography>
            {session === undefined && <CircularProgress size={24} aria-label="Checking password reset link" />}
            {session === null && <Alert severity="error">This reset link is invalid or expired. Request a new one from the sign-in page.</Alert>}
            {saved && <Alert severity="success">Password updated. Sign in with your new password.</Alert>}
            {(saved || session === null) && <Button href="/applicant" sx={{ alignSelf: 'flex-start' }}>Back to sign in</Button>}
            {session && !saved && (
              <Stack component="form" onSubmit={submit} spacing={2}>
                <Typography variant="body2" color="text.secondary">{session.user.email}</Typography>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField label="New password" type="password" autoComplete="new-password" required
                  inputProps={{ minLength: 8, maxLength: 120 }} value={password}
                  onChange={event => setPassword(event.target.value)} disabled={saving} />
                <TextField label="Confirm new password" type="password" autoComplete="new-password" required
                  inputProps={{ minLength: 8, maxLength: 120 }} value={confirmation}
                  onChange={event => setConfirmation(event.target.value)} disabled={saving} />
                <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save new password'}</Button>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Container>
    </AuthBackground>
  );
}
