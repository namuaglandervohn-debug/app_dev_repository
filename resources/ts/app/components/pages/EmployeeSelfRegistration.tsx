import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Alert, Box, Button, CircularProgress, Container, MenuItem, Paper, Stack, TextField, Typography } from '../bootstrap';
import { ArrowBackRounded, Badge } from '../bootstrap/icons';
import AuthBackground from '../AuthBackground';
import BrandLogo from '../BrandLogo';
import { COMPANY, OUTLETS } from '../../lib/constants';
import { supabase } from '../../lib/supabaseClient';
import { employeeConfirmationRedirect } from '../../lib/applicantConfirmationRedirect';

export default function EmployeeSelfRegistration() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [outlet, setOutlet] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    const cleanFullName = fullName.trim().replace(/\s+/g, ' ');
    const cleanEmployeeId = employeeId.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanFullName || cleanFullName.split(' ').length < 2 || !cleanEmployeeId || !cleanEmail || !outlet || !password) {
      setError('Enter your full name, employee ID, email, assigned outlet, and password.');
      return;
    }
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: employeeConfirmationRedirect(window.location.origin),
          data: { registration_kind: 'employee', full_name: cleanFullName, employee_id: cleanEmployeeId, outlet },
        },
      });
      if (signupError) throw signupError;
      if (!data.user) throw new Error('Registration did not return an account. Please try again.');
      if (data.user.identities?.length === 0) throw new Error('An account already uses this email address. Sign in or contact HR for help.');
      if (data.session) await supabase.auth.signOut({ scope: 'local' });
      setPassword('');
      setConfirmation('');
      setNotice('Registration submitted for HR approval. Confirm your email and wait for HR to approve your account before signing in.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your registration.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthBackground>
      <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: '30px', background: 'rgba(250,255,249,.95)', border: '1px solid rgba(86,156,103,.24)', boxShadow: '0 24px 70px rgba(22,80,43,.18)' }}>
          <Stack alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
            <BrandLogo size={76} />
            <Typography variant="h4" component="h1" textAlign="center" fontWeight={750} sx={{ color: '#193c27', letterSpacing: '-.04em' }}>Employee account registration</Typography>
            <Typography variant="body2" textAlign="center" sx={{ color: '#607366' }}>
              Enter your Employee ID and information. HR will verify them and approve your account before you can sign in.
            </Typography>
          </Stack>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
          <Box component="form" onSubmit={submit} noValidate>
            <TextField fullWidth required label="Full Name" autoComplete="name" value={fullName}
              onChange={event => setFullName(event.target.value)} margin="normal" />
            <TextField fullWidth required label="Employee ID" autoComplete="off" value={employeeId}
              onChange={event => setEmployeeId(event.target.value)} margin="normal"
              InputProps={{ startAdornment: <Badge sx={{ mr: 1, color: '#087443' }} /> }} />
            <TextField fullWidth required label="Email address" type="email" autoComplete="email" value={email}
              onChange={event => setEmail(event.target.value)} margin="normal" />
            <TextField fullWidth required select label="Assigned Outlet" value={outlet}
              onChange={event => setOutlet(event.target.value)} margin="normal">
              {OUTLETS.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </TextField>
            <TextField fullWidth required label="New password" type="password" autoComplete="new-password" value={password}
              onChange={event => setPassword(event.target.value)} margin="normal" helperText="At least 8 characters." />
            <TextField fullWidth required label="Confirm password" type="password" autoComplete="new-password" value={confirmation}
              onChange={event => setConfirmation(event.target.value)} margin="normal"
              error={Boolean(confirmation && password !== confirmation)}
              helperText={confirmation ? (password === confirmation ? 'Passwords match.' : 'Passwords do not match.') : undefined} />
            <Button type="submit" fullWidth variant="contained" disabled={busy} startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ mt: 2, py: 1.4, borderRadius: '999px', textTransform: 'none', fontWeight: 700 }}>
              {busy ? 'Submitting…' : 'Submit registration'}
            </Button>
          </Box>
          <Button component={RouterLink} to="/login" startIcon={<ArrowBackRounded />} sx={{ mt: 2, display: 'flex', mx: 'auto' }}>Back to sign in</Button>
        </Paper>
        <Typography align="center" sx={{ mt: 2.5, color: 'rgba(255,255,255,.92)', fontSize: '.78rem', fontWeight: 700 }}>
          © {new Date().getFullYear()} {COMPANY.name} · Est. {COMPANY.established} · HRIS Capstone
        </Typography>
      </Container>
    </AuthBackground>
  );
}
