import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { Alert, Box, Button, CircularProgress, Container, Grid, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { ArrowBackRounded } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import AuthBackground from '../AuthBackground';
import BrandLogo from '../BrandLogo';
import { DashboardHeader } from '../layouts/DashboardOverview';
import { fileToDataUrl } from '../../lib/applicationFiles';
import { recruitmentStatusLabel } from '../../lib/recruitmentStatus';
import { accountColors } from '../layouts/accountColors';
import { APPLICANT_COUNTRIES, APPLICANT_NATIONALITIES } from '../../lib/applicantProfile';
import { completeApplicantAddress, PH_PROVINCES_BY_REGION, CITIES_BY_PROVINCE, BARANGAYS_BY_CITY, ZIP_BY_CITY } from '../../lib/applicantAddress';

const initial = { firstName: '', middleName: '', lastName: '', suffix: '', birthdate: '', contactNumber: '', gender: '', civilStatus: '', nationality: 'Filipino', currentCountry: 'Philippines', currentRegion: '', currentProvince: '', currentCity: '', currentBarangay: '', currentStreet: '', currentZipCode: '' };
const fields: [keyof typeof initial, string, boolean][] = [
  ['firstName', 'First name', true], ['middleName', 'Middle name', false], ['lastName', 'Last name', true], ['suffix', 'Suffix', false],
  ['birthdate', 'Date of birth', true], ['contactNumber', 'Mobile number', true], ['gender', 'Gender', false], ['civilStatus', 'Civil status', false],
  ['nationality', 'Nationality', false], ['currentCountry', 'Country', true], ['currentRegion', 'Region', false], ['currentProvince', 'Province', false], ['currentCity', 'City / Municipality', true], ['currentBarangay', 'Barangay', false], ['currentStreet', 'Street / House No. / Purok', true], ['currentZipCode', 'ZIP Code', false],
];
const requirementFileTypes: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};
type ApplicantSubmission = {
  applicant_id: string;
  position_applied: string;
  status: string;
  requirements_note: string | null;
  is_archived: boolean;
  has_resume: boolean;
  has_birth_cert: boolean;
  has_tor: boolean;
  has_med_cert: boolean;
  custom_requirements: { label: string; checked: boolean }[] | null;
};

function missingRequirements(app: ApplicantSubmission) {
  return [
    !app.has_resume && 'Resume / CV',
    !app.has_birth_cert && 'Birth Certificate',
    !app.has_tor && 'Transcript of Records',
    !app.has_med_cert && 'Medical Certificate',
    ...(app.custom_requirements ?? []).filter(requirement => !requirement.checked).map(requirement => requirement.label),
  ].filter(Boolean).join(', ');
}

export default function ApplicantPortal() {
  const { user, loading, login, logout } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(0);
  const [profile, setProfile] = useState<Record<string, any>>({ ...initial });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [profileOwner, setProfileOwner] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [applications, setApplications] = useState<ApplicantSubmission[]>([]);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [requirementFiles, setRequirementFiles] = useState<File[]>([]);
  const profileReady = ready && profileOwner === user?.id;
  const next = params.get('next')?.startsWith('/apply') ? params.get('next')! : '/apply';
  useEffect(() => {
    if (user?.role !== 'applicant') return;
    let active = true;
    setReady(false);
    void (async () => {
      try {
        const result = await supabase.from('applicant_profiles').select('profile').eq('auth_user_id', user.id).single();
        if (result.error) throw result.error;
        const list = await supabase.from('applicants')
          .select('applicant_id,position_applied,status,requirements_note,is_archived,has_resume,has_birth_cert,has_tor,has_med_cert,custom_requirements')
          .eq('auth_user_id', user.id).order('created_at', { ascending: false });
        if (list.error) throw list.error;
        if (active) { setProfile({ ...initial, ...completeApplicantAddress(result.data.profile) }); setApplications(list.data || []); setProfileOwner(user.id); setReady(true); }
      } catch (e: any) { if (active) setError(e.message || 'Could not load your profile.'); }
    })();
    return () => { active = false; };
  }, [user?.id, user?.role]);
  const choices: Partial<Record<keyof typeof initial, string[]>> = { nationality: APPLICANT_NATIONALITIES, suffix: ['', 'Jr.', 'Sr.', 'II', 'III', 'IV'], gender: ['Male', 'Female', 'Prefer not to say'], civilStatus: ['Single', 'Married', 'Widowed', 'Separated'], currentCountry: APPLICANT_COUNTRIES, currentRegion: profile.currentCountry === 'Philippines' ? Object.keys(PH_PROVINCES_BY_REGION) : undefined, currentProvince: profile.currentCountry === 'Philippines' ? PH_PROVINCES_BY_REGION[profile.currentRegion] : undefined, currentCity: CITIES_BY_PROVINCE[profile.currentProvince], currentBarangay: BARANGAYS_BY_CITY[profile.currentCity] };
  const personalFields = <Grid container spacing={2}>{fields.map(([key, label, required]) => <Grid key={key} size={{ xs: 12, sm: 6 }}>
    <TextField select={Boolean(choices[key])} fullWidth required={required} label={label} value={profile[key] || ''} type={key === 'birthdate' ? 'date' : 'text'} InputLabelProps={key === 'birthdate' || choices[key] ? { shrink: true } : undefined} inputProps={key === 'birthdate' ? { max: new Date().toISOString().slice(0,10) } : { maxLength: 200 }} disabled={busy} onChange={e => { const value = e.target.value; setProfile(prev => ({ ...prev, [key]: value, ...(key === 'currentCountry' ? { currentRegion: '', currentProvince: '', currentCity: '', currentBarangay: '', currentZipCode: '' } : key === 'currentRegion' ? { currentProvince: '', currentCity: '', currentBarangay: '', currentZipCode: '' } : key === 'currentProvince' ? { currentCity: '', currentBarangay: '', currentZipCode: '' } : key === 'currentCity' ? { currentBarangay: '', currentZipCode: ZIP_BY_CITY[value] || '' } : {}) })); }}>{choices[key] ? [<MenuItem key="empty" value="">Select {label.toLowerCase()}</MenuItem>, ...choices[key]!.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)] : null}</TextField>
  </Grid>)}</Grid>;
  const validateProfile = () => {
    if (fields.some(([key,, required]) => required && !String(profile[key] || '').trim())) throw new Error('Complete all required personal information.');
    if (!profile.birthdate || profile.birthdate > new Date().toISOString().slice(0,10)) throw new Error('Enter a valid date of birth.');
    if (!/^(?:\+?63|0)?9\d{9}$/.test(String(profile.contactNumber).replace(/[\s()-]/g,''))) throw new Error('Enter a valid Philippine mobile number.');
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice('');
    try {
      if (user?.role === 'applicant') {
        validateProfile();
        const result = await supabase.from('applicant_profiles').update({ profile: completeApplicantAddress(profile), updated_at: new Date().toISOString() }).eq('auth_user_id', user.id).select('auth_user_id').single();
        if (result.error) throw result.error;
        setNotice('Profile saved. Future applications will use these details.');
      } else if (mode === 1) {
        validateProfile();
        const result = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: `${window.location.origin}/applicant`, data: { registration_kind: 'applicant', applicant_profile: completeApplicantAddress(profile) } } });
        if (result.error) throw result.error;
        setPassword('');
        setNotice('If your email still needs confirmation, check your inbox or spam folder for a link. If you already confirmed it, sign in.');
        setMode(0);
      } else { await login(email.trim().toLowerCase(), password); setPassword(''); }
    } catch (e: any) {
      setError(e.code === 'invalid_credentials' ? 'Email or password is incorrect. Use Forgot password to set a new one.' : e.message || 'Could not complete this action.');
    }
    finally { setBusy(false); }
  };
  const resendConfirmation = async () => {
    if (busy || !email.trim()) { setError('Enter your registration email first.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/applicant` } });
      if (result.error) throw result.error;
      setNotice('Confirmation requested. If your email still needs confirmation, check your inbox or spam folder. If you already confirmed it, sign in.');
    } catch (e: any) { setError(e.message || 'Could not resend the confirmation email.'); }
    finally { setBusy(false); }
  };
  const sendPasswordReset = async () => {
    const address = email.trim().toLowerCase();
    if (busy) return;
    setError('');
    setNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter your applicant email address first.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${window.location.origin}/applicant` });
      if (error) throw error;
      setNotice('If an account exists for that address, check your inbox or spam folder for a password reset link.');
    } catch (e: any) {
      setError(e.message || 'Could not request a password reset link.');
    } finally {
      setBusy(false);
    }
  };
  const submitRequirements = async (applicantId: string) => {
    if (busy || requirementFiles.length === 0) return;
    setError('');
    setNotice('');
    if (requirementFiles.length > 5 || requirementFiles.reduce((bytes, file) => bytes + file.size, 0) > 10 * 1024 * 1024) {
      setError('Upload one to five files, up to 10 MB total.');
      return;
    }
    setBusy(true);
    try {
      const documents = await Promise.all(requirementFiles.map(async (file) => {
        const type = requirementFileTypes[file.name.split('.').pop()?.toLowerCase() ?? ''];
        if (!type || !file.size) throw new Error('Use PDF, Word, JPG, or PNG documents.');
        return { name: file.name, type, data: await fileToDataUrl(new Blob([file], { type })) };
      }));
      const { error: uploadError } = await supabase.rpc('resubmit_application_requirements', { p_applicant_id: applicantId, p_files: documents });
      if (uploadError) throw uploadError;
      setApplications(current => current.map(app => app.applicant_id === applicantId ? { ...app, status: 'Under Review' } : app));
      setUploadFor(null);
      setRequirementFiles([]);
      setNotice('Your additional documents were submitted for HR review.');
    } catch (e: any) {
      setError(e.message || 'Could not upload the documents.');
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Box sx={{ p: 5 }}><CircularProgress /></Box>;
  if (user && user.role !== 'applicant') return <Navigate to="/dashboard" replace />;
  const backButton = (
    <Button component={Link} to="/careers" startIcon={<ArrowBackRounded />} sx={{ mb: 1 }}>
      Back
    </Button>
  );
  if (user) {
    return (
      <Box sx={{ minHeight: '100vh', background: accountColors.dashboard }}>
        <Box component="header" sx={{ background: accountColors.header, color: accountColors.onGreen, borderBottom: 1, borderColor: accountColors.onGreenBorder }}>
          <Container maxWidth="lg">
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 60 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <BrandLogo size={36} />
                <Typography fontWeight={750}>Buenaventura HRIS</Typography>
              </Stack>
              <Button color="inherit" disabled={busy} onClick={() => { setReady(false); setProfileOwner(null); setProfile({ ...initial }); setApplications([]); setUploadFor(null); setRequirementFiles([]); logout(); }}>Sign out</Button>
            </Stack>
          </Container>
        </Box>
        <Container component="main" maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
          {backButton}
          <DashboardHeader title="Applicant account">
            <Button component={Link} to={next} variant="contained" disabled={!profileReady}>Apply for a job</Button>
          </DashboardHeader>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
          <Grid container spacing={2} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                <Typography component="h2" variant="h6" fontWeight={750} sx={{ mb: 2 }}>My profile</Typography>
                {profileReady && (
                  <Box component="form" onSubmit={submit}>
                    {personalFields}
                    <Button type="submit" variant="contained" disabled={busy} sx={{ mt: 2 }}>{busy ? 'Please wait...' : 'Save profile'}</Button>
                  </Box>
                )}
                {!profileReady && !error && <CircularProgress size={24} aria-label="Loading applicant profile" />}
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
                  <Typography component="h2" variant="h6" fontWeight={750}>Your applications</Typography>
                  <Button onClick={() => window.location.reload()}>Refresh status</Button>
                </Stack>
                {applications.length === 0 && <Typography color="text.secondary">No applications submitted yet.</Typography>}
                {profileReady && applications.map(app => (
                  <Paper key={app.applicant_id} variant="outlined" sx={{ p: 1.5, mt: 1.25, borderRadius: 2 }}>
                    <Typography fontWeight={700}>{app.position_applied} - {app.is_archived ? 'Archived' : recruitmentStatusLabel(app.status)}</Typography>
                    <Typography variant="body2" color="text.secondary">{app.applicant_id}</Typography>
                    <Button component={Link} to={`/track?id=${encodeURIComponent(app.applicant_id)}`} sx={{ mt: 0.5 }}>View application status</Button>
                    {app.status === 'Missing Requirements' && !app.is_archived && (
                      <Stack spacing={1} alignItems="flex-start" sx={{ mt: 1 }}>
                        <Typography variant="body2">{missingRequirements(app)}</Typography>
                        {app.requirements_note && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{app.requirements_note}</Typography>}
                        {uploadFor === app.applicant_id ? (
                          <>
                            <Typography component="label" variant="body2">
                              Supporting documents (up to 5 files, 10 MB total)
                              <Box component="input" type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" disabled={busy}
                                onChange={event => setRequirementFiles(Array.from(event.currentTarget.files ?? []))} sx={{ display: 'block', maxWidth: '100%', mt: 0.5 }} />
                            </Typography>
                            <Button variant="contained" disabled={busy || !requirementFiles.length} onClick={() => void submitRequirements(app.applicant_id)}>
                              {busy ? 'Uploading…' : 'Submit documents'}
                            </Button>
                          </>
                        ) : (
                          <Button variant="outlined" disabled={busy} onClick={() => { setUploadFor(app.applicant_id); setRequirementFiles([]); }}>
                            Upload missing requirements
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Paper>
                ))}
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    );
  }
  return <AuthBackground><Container maxWidth="md" sx={{ py: 4 }}><Paper sx={{ p: { xs: 2, sm: 4 }, borderRadius: 5 }}>
    {backButton}
    <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Applicant account</Typography>
    <Typography sx={{ mb: 3 }}>Create your profile once. Review and reuse it whenever you apply for another position.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
    <Tabs value={mode} onChange={(_, value) => { setMode(value); setError(''); }} sx={{ mb: 3 }}><Tab label="Sign in" /><Tab label="Create account" /></Tabs>
    <Box component="form" onSubmit={submit}><Stack spacing={3}>
      <TextField label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputProps={{ maxLength: 120 }} disabled={busy} />
      <TextField label="Password" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode ? 'new-password' : 'current-password'} inputProps={{ minLength: 8, maxLength: 120 }} disabled={busy} />
      {mode === 1 && personalFields}
      <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Please wait...' : mode === 1 ? 'Create applicant account' : 'Sign in'}</Button>
    </Stack></Box>
    {mode === 0 && (
      <Stack direction="row" flexWrap="wrap" sx={{ mt: 1 }}>
        <Button disabled={busy} onClick={() => void sendPasswordReset()}>Forgot password?</Button>
        <Button disabled={busy} onClick={() => void resendConfirmation()}>Resend confirmation email</Button>
      </Stack>
    )}
  </Paper></Container></AuthBackground>;
}
