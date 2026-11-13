import { formatDisplayDate } from '../../lib/displayDate';
import { employeeApplicationFields } from '../../lib/employeeApplicationFields';
import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Divider, CircularProgress,
  Alert, Card, CardContent, Avatar, TextField, Button, IconButton,
  Stack, LinearProgress, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import {
  AccountCircle, BusinessCenter, Phone, Email, LocationOn, CalendarMonth,
  Assignment, TaskAlt, CancelOutlined, HelpOutline, Badge,
  EditNote, Save, Close, CloudUpload, InsertDriveFile, LockReset,
  DeleteOutline as DeleteIcon, FileDownload, Visibility,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import ActionSnackbar from '../ActionSnackbar';
import ChangePasswordDialog from '../ChangePasswordDialog';
import { profileCardSx as softCardSx, profileDetailsSx as innerCardSx, profileFieldSx as softTextFieldSx, profileAvatarSx, profileHeroSx, profileIconSx as sectionIconSx } from '../layouts/profileStyles';
import ProfileSummary from '../layouts/ProfileSummary';

interface Employee {
  id: string; name: string; position: string; department?: string;
  outlet: string; status: string; contact: string; email?: string;
  address?: string; supervisor?: string; dateHired?: string;
  emergencyContact?: string; tin?: string; sss?: string;
  philhealth?: string; pagibig?: string;
}

interface Application {
  id: string; name: string; position: string; dateApplied: string;
  status: string; email?: string; hasResume?: boolean; hasBirthCert?: boolean;
  hasTOR?: boolean; hasMedCert?: boolean; requirementsNote?: string;
  education?: string; experience?: string; phone?: string; address?: string;
  emergencyContact?: string; tin?: string; sss?: string; philhealth?: string;
  pagibig?: string; documents?: DocFile[];
}

interface DocFile { name: string; size: number; uploadedAt: string; dataUrl?: string; }

const EDITABLE_FIELDS: { key: keyof Employee; label: string; icon: React.ReactNode }[] = [
  { key: 'contact',          label: 'Contact Number',   icon: <Phone fontSize="small" /> },
  { key: 'email',            label: 'Email Address',    icon: <Email fontSize="small" /> },
  { key: 'address',          label: 'Home Address',     icon: <LocationOn fontSize="small" /> },
  { key: 'emergencyContact', label: 'Emergency Contact',icon: <Phone fontSize="small" /> },
];

const READONLY_FIELDS: { key: keyof Employee; label: string; icon: React.ReactNode }[] = [
  { key: 'position',   label: 'Position / Job Title',  icon: <BusinessCenter fontSize="small" /> },
  { key: 'department', label: 'Department',            icon: <Badge fontSize="small" /> },
  { key: 'outlet',     label: 'Outlet / Branch',       icon: <LocationOn fontSize="small" /> },
  { key: 'dateHired',  label: 'Date Hired',            icon: <CalendarMonth fontSize="small" /> },
];

const DOCS_KEY = 'my_profile_docs';

const GREEN_UI = {
  pageBg: 'radial-gradient(circle at top left, rgba(220, 246, 219, 0.95), rgba(248, 252, 245, 0.98) 34%, #f7fbf3 100%)',
  border: 'rgba(139, 184, 144, 0.24)',
  borderStrong: 'rgba(73, 156, 92, 0.32)',
  green: '#3aa865',
  greenDark: '#1f7a46',
  greenSoft: '#e6f8e9',
  text: '#1e2d24',
  muted: '#6c7d70',
  shadowSoft: '0 12px 28px rgba(43, 91, 55, 0.08)',
};

const pillButtonSx = {
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 600,
  px: 2,
};

const sectionHeaderSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1.5,
  mb: 2,
  flexWrap: 'wrap',
};


const rowCardSx = {
  borderRadius: '18px',
  border: `1px solid ${GREEN_UI.border}`,
  background: '#fbfff9',
};

const firstValue = (...values: unknown[]) =>
  values.find(value => String(value ?? '').trim()) as string | undefined;

const safeJson = (value: unknown): any => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return {};
  }
};

const normalizeApplicationDocuments = (applicant: any, coverLetter: any): DocFile[] => {
  const docs: DocFile[] = [];
  const pushDoc = (name: unknown, dataUrl?: unknown) => {
    const cleanName = String(name ?? '').trim();
    if (!cleanName || docs.some(doc => doc.name === cleanName)) return;
    docs.push({
      name: cleanName,
      size: 0,
      uploadedAt: applicant?.created_at ?? new Date().toISOString(),
      dataUrl: typeof dataUrl === 'string' ? dataUrl : undefined,
    });
  };

  pushDoc(applicant?.resume_file_name, applicant?.resume_file_data);

  const fileSources = [
    applicant?.supporting_document_files,
    applicant?.supporting_documents,
    coverLetter?.submittedDocuments,
  ];

  fileSources.forEach(source => {
    const parsed = typeof source === 'string' ? safeJson(source) : source;
    const items = Array.isArray(parsed)
      ? parsed
      : typeof source === 'string'
        ? source.split(',').filter(Boolean)
        : source && typeof source === 'object'
          ? [source]
          : [];
    items.forEach((item: any) => {
      if (typeof item === 'string') {
        pushDoc(item);
      } else {
        pushDoc(item?.name ?? item?.fileName ?? item?.label, item?.data ?? item?.dataUrl);
      }
    });
  });

  return docs;
};

const mimeFromFileName = (name: string) => {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (['jpg', 'jpeg'].includes(extension ?? '')) return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'doc') return 'application/msword';
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
};

const getDocSource = (doc: DocFile) => {
  const raw = String(doc.dataUrl ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('http')) return raw;
  return `data:${mimeFromFileName(doc.name)};base64,${raw}`;
};

const isPreviewableDoc = (doc: DocFile) => {
  const mime = mimeFromFileName(doc.name);
  return mime.startsWith('image/') || mime === 'application/pdf';
};

export default function MyProfile() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [applicationFields, setApplicationFields] = useState<ReturnType<typeof employeeApplicationFields>>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [previewDoc, setPreviewDoc] = useState<DocFile | null>(null);

  // Document management
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        let found: Employee | null = null;
        let employeeRow: any = null;
        let accountOutlet = '';

        if (user.employeeId) {
          const { data: row } = await supabase
            .from('employees')
            .select('*')
            .eq('employee_id', user.employeeId)
            .maybeSingle();

          employeeRow = row;

          const { data: account } = await supabase
            .from('user_accounts')
            .select('outlet')
            .eq('employee_id', user.employeeId)
            .maybeSingle();
          accountOutlet = account?.outlet ?? '';
        }

        let applicant: any = null;
        if (employeeRow?.applicant_id) {
          const { data } = await supabase
            .from('applicants')
            .select('*')
            .eq('applicant_id', employeeRow.applicant_id)
            .maybeSingle();
          applicant = data;
        }

        if (!applicant) {
          const lookupEmail = firstValue(employeeRow?.email, user.email);
          if (lookupEmail) {
            const { data } = await supabase
              .from('applicants')
              .select('*')
              .eq('email', lookupEmail)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            applicant = data;
          }
        }

        const coverLetter = safeJson(applicant?.cover_letter);
        setApplicationFields(employeeRow ? employeeApplicationFields(employeeRow, applicant, coverLetter) : []);

        if (employeeRow) {
          const row = employeeRow;
          if (row) {
            const fullName = [row.first_name, row.middle_name, row.last_name, row.suffix]
              .filter(Boolean)
              .join(' ')
              .trim();
            found = {
              id: row.employee_id,
              name: fullName || applicant?.name || user.name,
              position: firstValue(row.position, applicant?.position_applied) ?? '',
              department: row.department ?? '',
              outlet: firstValue(accountOutlet, row.outlet, (user as any)?.outlet) ?? '',
              status: row.status ?? 'Active',
              contact: firstValue(row.phone_number, applicant?.phone_number) ?? '',
              email: firstValue(row.email, applicant?.email, user.email) ?? '',
              address: firstValue(row.address, applicant?.address, coverLetter?.currentAddress, coverLetter?.permanentAddress) ?? '',
              dateHired: row.hire_date ?? '',
              emergencyContact: firstValue(row.emergency_contact, applicant?.emergency_contact) ?? '',
              tin: firstValue(row.tin, applicant?.tin) ?? '',
              sss: firstValue(row.sss, applicant?.sss) ?? '',
              philhealth: firstValue(row.philhealth, applicant?.philhealth) ?? '',
              pagibig: firstValue(row.pagibig, applicant?.pagibig) ?? '',
            };
          }
        }

        setEmployee(found);
        setEditForm(found ?? {});

        setApplication(
          applicant
            ? {
                id: applicant.applicant_id,
                name: applicant.name ?? user.name,
                position: applicant.position_applied ?? '',
                dateApplied: applicant.created_at ?? '',
                status: applicant.status ?? '',
                email: applicant.email ?? undefined,
                phone: applicant.phone_number ?? undefined,
                address: firstValue(applicant.address, coverLetter?.currentAddress, coverLetter?.permanentAddress),
                emergencyContact: applicant.emergency_contact ?? undefined,
                education: applicant.education ?? undefined,
                experience: applicant.experience ?? undefined,
                hasResume: applicant.has_resume ?? Boolean(applicant.resume_file_name || applicant.resume_file_data),
                hasBirthCert: applicant.has_birth_cert ?? false,
                hasTOR: applicant.has_tor ?? false,
                hasMedCert: applicant.has_med_cert ?? false,
                requirementsNote: applicant.requirements_note ?? undefined,
                tin: applicant.tin ?? undefined,
                sss: applicant.sss ?? undefined,
                philhealth: applicant.philhealth ?? undefined,
                pagibig: applicant.pagibig ?? undefined,
                documents: normalizeApplicationDocuments(applicant, coverLetter),
              }
            : null
        );
      } catch (e) {
        console.error('MyProfile load error:', e);
      } finally {
        setLoading(false);
      }
    })();
    // Load local documents
    try {
      const stored = localStorage.getItem(`${DOCS_KEY}_${user.id ?? user.email}`);
      if (stored) setDocs(JSON.parse(stored));
    } catch (_) {}
  }, [user]);

  const saveDocs = (newDocs: DocFile[]) => {
    setDocs(newDocs);
    try {
      localStorage.setItem(`${DOCS_KEY}_${user?.id ?? user?.email}`, JSON.stringify(newDocs));
    } catch (_) {}
  };

  const handleSave = async () => {
    if (!employee || !user?.employeeId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          phone_number: editForm.contact ?? null,
          email: editForm.email ?? null,
          address: editForm.address ?? null,
          emergency_contact: editForm.emergencyContact ?? null,
        })
        .eq('employee_id', user.employeeId);

      if (error) throw error;

      const updated = { ...employee, ...editForm } as Employee;
      setEmployee(updated);
      setEditing(false);
      setSnackbar({ open: true, message: '✅ Profile updated successfully!', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed to save: ${e.message}`, severity: 'error' });
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newDocs: DocFile[] = [...docs];
    for (const file of Array.from(files)) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newDocs.push({
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            dataUrl: e.target?.result as string,
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    saveDocs(newDocs);
    setUploading(false);
    setSnackbar({ open: true, message: `✅ ${files.length} document(s) uploaded!`, severity: 'success' });
  };

  const handleDownload = (doc: DocFile) => {
    const source = getDocSource(doc);
    if (!source) return;
    const a = document.createElement('a');
    a.href = source;
    a.download = doc.name;
    a.click();
  };

  const handleViewDoc = (doc: DocFile) => {
    if (!getDocSource(doc)) return;
    setPreviewDoc(doc);
  };

  const handleDeleteDoc = (idx: number) => {
    saveDocs(docs.filter((_, i) => i !== idx));
  };

  const initials = (user?.name ?? 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
  const profileName = user?.name ?? employee?.name ?? 'My Profile';
  const profileStatus = employee?.status ?? 'Active';
  const applicationDocs = application?.documents ?? [];
  const totalDocumentCount = docs.length + applicationDocs.length;

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100%',
          p: { xs: 1.5, sm: 2.25, md: 3 },
          background: GREEN_UI.pageBg,
          color: GREEN_UI.text,
          borderRadius: { xs: 0, md: '32px' },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            ...softCardSx,
            minHeight: 320,
            display: 'grid',
            placeItems: 'center',
            p: 4,
          }}
        >
          <Stack spacing={2} alignItems="center">
            <CircularProgress sx={{ color: GREEN_UI.green }} />
            <Typography variant="body2" sx={{ color: GREEN_UI.muted, fontWeight: 700 }}>
              Loading your profile…
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100%',
        p: { xs: 1.5, sm: 2.25, md: 3 },
        background: GREEN_UI.pageBg,
        color: GREEN_UI.text,
        borderRadius: { xs: 0, md: '32px' },
      }}
    >
      <Paper elevation={0} sx={profileHeroSx}>
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <Avatar sx={profileAvatarSx}>
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h4"
                fontWeight={700}
                sx={{
                  fontSize: { xs: '1.55rem', sm: '2rem', md: '2.35rem' },
                  color: GREEN_UI.text,
                  letterSpacing: '-0.04em',
                  lineHeight: 1.08,
                  mb: 0.75,
                }}
              >
                {profileName}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                <Chip
                  icon={<BusinessCenter sx={{ fontSize: '16px !important' }} />}
                  label={employee?.position ?? 'No position linked'}
                  size="small"
                  sx={{ bgcolor: '#fbfff9', border: `1px solid ${GREEN_UI.border}`, color: GREEN_UI.text, fontWeight: 600}}
                />
                <Chip
                  icon={<LocationOn sx={{ fontSize: '16px !important' }} />}
                  label={employee?.outlet ?? 'No outlet'}
                  size="small"
                  sx={{ bgcolor: '#fbfff9', border: `1px solid ${GREEN_UI.border}`, color: GREEN_UI.text, fontWeight: 600}}
                />
                <Chip
                  label={profileStatus}
                  size="small"
                  sx={{
                    bgcolor: profileStatus === 'Active' ? '#e5f8e9' : '#fff7e0',
                    color: profileStatus === 'Active' ? '#217a43' : '#9b6b00',
                    border: `1px solid ${profileStatus === 'Active' ? '#a9dfb6' : '#f5d786'}`,
                    fontWeight: 700,
                  }}
                />
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<LockReset />} onClick={() => setPasswordDialogOpen(true)} sx={pillButtonSx}>
              Change Password
            </Button>
            {employee && !editing && (
              <Button
                variant="contained"
                startIcon={<EditNote />}
                onClick={() => { setEditing(true); setEditForm(employee); }}
                sx={{
                  ...pillButtonSx,
                  py: 1.1,
                  bgcolor: GREEN_UI.green,
                  boxShadow: '0 12px 24px rgba(58, 168, 101, 0.25)',
                  '&:hover': { bgcolor: GREEN_UI.greenDark, boxShadow: '0 16px 28px rgba(31, 122, 70, 0.28)' },
                }}
              >
                Edit Profile
              </Button>
            )}
            {editing && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  startIcon={<Close />}
                  onClick={() => { setEditing(false); setEditForm(employee ?? {}); }}
                  sx={{ ...pillButtonSx, borderColor: GREEN_UI.borderStrong, color: GREEN_UI.greenDark, bgcolor: '#fbfff9' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                  onClick={handleSave}
                  disabled={saving}
                  sx={{
                    ...pillButtonSx,
                    bgcolor: GREEN_UI.green,
                    boxShadow: '0 12px 24px rgba(58, 168, 101, 0.25)',
                    '&:hover': { bgcolor: GREEN_UI.greenDark },
                  }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </Stack>
            )}
          </Box>
        </Box>
      </Paper>

      <ProfileSummary items={[
        { label: 'Employee ID', value: employee?.id ?? 'Not linked', icon: <Badge /> },
        { label: 'Outlet / Branch', value: employee?.outlet || 'Not set', icon: <LocationOn /> },
        { label: 'Documents', value: totalDocumentCount, icon: <InsertDriveFile /> },
        { label: 'Contact', value: employee?.contact ?? 'Not set', icon: <Phone /> },
      ]} />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.5 }, mb: 2.5 }}>
            <Box sx={sectionHeaderSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={sectionIconSx}><AccountCircle /></Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                    Personal & Employment Information
                  </Typography>
                </Box>
              </Box>
              {editing && (
                <Chip
                  label="Editing"
                  size="small"
                  sx={{ bgcolor: '#fff7e0', color: '#9b6b00', border: '1px solid #f5d786', fontWeight: 700}}
                />
              )}
            </Box>
            <Divider sx={{ mb: 2.5, borderColor: GREEN_UI.border }} />

            {!employee ? (
              <Alert severity="info" sx={{ borderRadius: '18px', border: `1px solid ${GREEN_UI.border}` }}>
                No employee record found for your account. Please contact HR to link your profile.
              </Alert>
            ) : (
              <>
                <Paper elevation={0} sx={{ ...innerCardSx, p: { xs: 1.5, sm: 2 }, mb: 2.25 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: GREEN_UI.greenDark, fontWeight: 700, letterSpacing: '0.08em' }}>
                    EMPLOYMENT DETAILS · HR MANAGED
                  </Typography>
                  <Grid container spacing={1.5}>
                    {READONLY_FIELDS.map(({ key, label, icon }) => (
                      <Grid key={key} size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label={label}
                          value={key === 'dateHired' ? formatDisplayDate(employee.dateHired, '—') : employee[key] ?? '—'}
                          disabled
                          size="small"
                          sx={softTextFieldSx}
                          InputProps={{ startAdornment: <Box sx={{ mr: 1, color: GREEN_UI.greenDark, display: 'flex' }}>{icon}</Box> }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>

                <Paper elevation={0} sx={{ ...innerCardSx, p: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: GREEN_UI.greenDark, fontWeight: 700, letterSpacing: '0.08em' }}>
                    {editing ? 'YOUR INFORMATION · EDITABLE' : 'YOUR INFORMATION'}
                  </Typography>
                  <Grid container spacing={1.5}>
                    {EDITABLE_FIELDS.map(({ key, label, icon }) => (
                      <Grid key={key} size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label={label}
                          size="small"
                          value={editing ? (editForm as any)[key] ?? '' : (employee as any)[key] ?? '—'}
                          onChange={editing ? e => {
                            const v = key === 'contact'
                              ? e.target.value.replace(/\D/g, '').slice(0, 11)
                              : e.target.value;
                            setEditForm({ ...editForm, [key]: v });
                          } : undefined}
                          disabled={!editing}
                          inputProps={key === 'contact' ? { maxLength: 11, inputMode: 'numeric' } : undefined}
                          placeholder={key === 'contact' && editing ? '09XXXXXXXXX' : undefined}
                          helperText={key === 'contact' && editing ? `${((editForm as any)[key] ?? '').length}/11` : undefined}
                          sx={softTextFieldSx}
                          InputProps={{ startAdornment: <Box sx={{ mr: 1, color: GREEN_UI.greenDark, display: 'flex' }}>{icon}</Box> }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>

                <Paper elevation={0} sx={{ ...innerCardSx, p: { xs: 1.5, sm: 2 }, mt: 2.25 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: GREEN_UI.greenDark, fontWeight: 700, letterSpacing: '0.08em' }}>
                    GOVERNMENT AND BANK DETAILS
                  </Typography>
                  <Grid container spacing={1.5}>
                    {[
                      ['TIN', employee.tin || application?.tin || '000-000-000-000'],
                      ['SSS', employee.sss || application?.sss || '00-0000000-0'],
                      ['PhilHealth', employee.philhealth || application?.philhealth || '00-000000000-0'],
                      ['Pag-IBIG', employee.pagibig || application?.pagibig || '0000-0000-0000'],
                    ].map(([label, value]) => (
                      <Grid key={label} size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label={label}
                          value={value}
                          disabled
                          size="small"
                          sx={softTextFieldSx}
                          InputProps={{ startAdornment: <Box sx={{ mr: 1, color: GREEN_UI.greenDark, display: 'flex' }}><Badge fontSize="small" /></Box> }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>

                {applicationFields.map(({ title, fields }) => (
                  <Paper key={title} elevation={0} sx={{ ...innerCardSx, p: { xs: 1.5, sm: 2 }, mt: 2.25 }}>
                    <Typography component="h3" variant="caption" sx={{ display: 'block', mb: 1.5, color: GREEN_UI.greenDark, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {title}
                    </Typography>
                    <Grid container spacing={1.5}>
                      {fields.map(([label, value]) => (
                        <Grid key={label} size={{ xs: 12, sm: 6 }}>
                          <TextField fullWidth size="small" label={label} value={value || '—'}
                            multiline={value.length > 40 || value.includes('\n')}
                            slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
                            sx={softTextFieldSx}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                ))}
              </>
            )}
          </Paper>

          <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.5 } }}>
            <Box sx={sectionHeaderSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={sectionIconSx}><Badge /></Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                    Account Information
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Divider sx={{ mb: 2, borderColor: GREEN_UI.border }} />
            <Grid container spacing={1.25}>
              {[
                ['Account ID', user?.id ?? '—', <Badge fontSize="small" />],
                ['Username / Email', user?.email ?? '—', <Email fontSize="small" />],
                ['Role', user?.role === 'hr' ? 'HR Personnel / Admin' : user?.role === 'employee' ? 'Employee' : user?.role === 'supervisor' ? 'Supervisor' : user?.role === 'gm' ? 'General Manager' : 'Accounting & Finance', <AccountCircle fontSize="small" />],
                ['Linked Employee ID', user?.employeeId ?? '—', <Badge fontSize="small" />],
              ].map(([k, v, icon]) => (
                <Grid key={String(k)} size={12}>
                  <Box
                    sx={{
                      ...rowCardSx,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      gap: 1.5,
                      p: 1.35,
                      flexDirection: { xs: 'column', sm: 'row' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: GREEN_UI.muted }}>
                      {icon}
                      <Typography variant="body2" fontWeight={600}>{k}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600} sx={{ color: GREEN_UI.text, textAlign: { xs: 'left', sm: 'right' }, wordBreak: 'break-word' }}>
                      {v}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.5 }, mb: 2.5 }}>
            <Box sx={sectionHeaderSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={sectionIconSx}><CloudUpload /></Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                    My Documents
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Divider sx={{ mb: 2, borderColor: GREEN_UI.border }} />

            <Box
              onClick={() => fileRef.current?.click()}
              sx={{
                border: '2px dashed',
                borderColor: GREEN_UI.borderStrong,
                borderRadius: '20px',
                p: { xs: 2, sm: 2.5 },
                textAlign: 'center',
                cursor: 'pointer',
                mb: 2,
                bgcolor: '#fbfff9',
                transition: 'all 180ms ease',
                '&:hover': {
                  borderColor: GREEN_UI.green,
                  bgcolor: GREEN_UI.greenSoft,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={e => handleFileUpload(e.target.files)}
              />
              <Box
                sx={{
                  width: 54,
                  height: 54,
                  borderRadius: '18px',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: GREEN_UI.greenSoft,
                  color: GREEN_UI.greenDark,
                  mx: 'auto',
                  mb: 1,
                }}
              >
                <CloudUpload />
              </Box>
              <Typography variant="body2" fontWeight={700} sx={{ color: GREEN_UI.text }}>
                Click to Upload Documents
              </Typography>
              <Typography variant="caption" sx={{ color: GREEN_UI.muted }}>
                PDF, DOC, DOCX, JPG, PNG · Max 10 MB each
              </Typography>
            </Box>
            {uploading && <LinearProgress sx={{ mb: 1.5, bgcolor: GREEN_UI.greenSoft }} />}

            {docs.length === 0 ? (
              <Paper elevation={0} sx={{ ...innerCardSx, p: 2, textAlign: 'center' }}>
                <InsertDriveFile sx={{ color: GREEN_UI.muted, mb: 0.5 }} />
                <Typography variant="body2" sx={{ color: GREEN_UI.muted, fontWeight: 700 }}>
                  No documents uploaded yet
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={1}>
                {docs.map((doc, i) => (
                  <Box
                    key={i}
                    sx={{
                      ...rowCardSx,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1.25,
                      transition: 'all 180ms ease',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: GREEN_UI.shadowSoft },
                    }}
                  >
                    <Box sx={{ ...sectionIconSx, width: 38, height: 38, borderRadius: '14px' }}>
                      <InsertDriveFile sx={{ fontSize: 20 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" fontWeight={700} sx={{ color: GREEN_UI.text, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: GREEN_UI.muted }}>
                        {formatBytes(doc.size)} · {formatDisplayDate(doc.uploadedAt)}
                      </Typography>
                    </Box>
                    <Tooltip title={doc.dataUrl ? "View" : "Preview unavailable"}>
                      <span>
                        <IconButton size="small" disabled={!doc.dataUrl} onClick={() => handleViewDoc(doc)} sx={{ color: GREEN_UI.greenDark }}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={doc.dataUrl ? "Download" : "Download unavailable"}>
                      <span>
                      <IconButton size="small" disabled={!doc.dataUrl} onClick={() => handleDownload(doc)} sx={{ color: GREEN_UI.greenDark }}>
                        <FileDownload fontSize="small" />
                      </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Remove">
                      <IconButton size="small" color="error" onClick={() => handleDeleteDoc(i)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.5 } }}>
            <Box sx={sectionHeaderSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={sectionIconSx}><Assignment /></Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                    Application Documents
                  </Typography>
                  <Typography variant="body2" sx={{ color: GREEN_UI.muted }}>
                    Requirement status from your application record.
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Divider sx={{ mb: 2, borderColor: GREEN_UI.border }} />

            {!application ? (
              <Alert severity="info" sx={{ fontSize: '0.82rem', borderRadius: '18px', border: `1px solid ${GREEN_UI.border}` }}>
                No application record found. Documents will appear here once your application is on file.
              </Alert>
            ) : (
              <Box>
                <Paper elevation={0} sx={{ ...innerCardSx, p: 1.5, mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: GREEN_UI.muted, display: 'block', fontWeight: 600 }}>
                    Application: {application.id}
                  </Typography>
                  <Typography variant="caption" sx={{ color: GREEN_UI.text, display: 'block', fontWeight: 700 }}>
                    Applied {formatDisplayDate(application.dateApplied)}
                  </Typography>
                </Paper>
                {applicationDocs.length > 0 && (
                  <Stack spacing={1} sx={{ mb: 1.5 }}>
                    {applicationDocs.map((doc, i) => (
                      <Box
                        key={`${doc.name}-${i}`}
                        sx={{
                          ...rowCardSx,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1.25,
                        }}
                      >
                        <Box sx={{ ...sectionIconSx, width: 38, height: 38, borderRadius: '14px' }}>
                          <InsertDriveFile sx={{ fontSize: 20 }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="caption" fontWeight={700} sx={{ color: GREEN_UI.text, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: GREEN_UI.muted }}>
                            Application file
                          </Typography>
                        </Box>
                        <Tooltip title={doc.dataUrl ? "View" : "Preview unavailable"}>
                          <span>
                            <IconButton size="small" disabled={!doc.dataUrl} onClick={() => handleViewDoc(doc)} sx={{ color: GREEN_UI.greenDark }}>
                              <Visibility fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={doc.dataUrl ? "Download" : "Download unavailable"}>
                          <span>
                            <IconButton size="small" disabled={!doc.dataUrl} onClick={() => handleDownload(doc)} sx={{ color: GREEN_UI.greenDark }}>
                              <FileDownload fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    ))}
                  </Stack>
                )}
                {[
                  { key: 'hasResume',    label: 'Resume / CV' },
                  { key: 'hasBirthCert', label: 'Birth Certificate' },
                  { key: 'hasTOR',       label: 'Transcript of Records (TOR)' },
                  { key: 'hasMedCert',   label: 'Medical Certificate' },
                ].map(({ key, label }) => {
                  const submitted = !!(application as any)[key];
                  return (
                    <Card
                      key={key}
                      variant="outlined"
                      sx={{
                        mb: 1.25,
                        borderRadius: '18px',
                        bgcolor: submitted ? '#f0fdf4' : '#fff5f5',
                        borderColor: submitted ? '#86efac' : '#fca5a5',
                      }}
                    >
                      <CardContent sx={{ py: '10px !important', px: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          {submitted
                            ? <TaskAlt sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
                            : <CancelOutlined sx={{ color: 'error.main', fontSize: 20, flexShrink: 0 }} />}
                          <Typography variant="body2" fontWeight={600} sx={{ color: GREEN_UI.text }}>{label}</Typography>
                        </Box>
                        <Chip
                          label={submitted ? 'On File' : 'Missing'}
                          size="small"
                          sx={{
                            bgcolor: submitted ? '#e5f8e9' : '#fdeaea',
                            color: submitted ? '#217a43' : '#9c2f2f',
                            border: `1px solid ${submitted ? '#a9dfb6' : '#efb8b8'}`,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
                {application.requirementsNote && (
                  <Alert severity="warning" sx={{ mt: 1.25, borderRadius: '18px', border: `1px solid ${GREEN_UI.border}` }} icon={<HelpOutline />}>
                    <Typography variant="caption"><strong>HR Note:</strong> {application.requirementsNote}</Typography>
                  </Alert>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {passwordDialogOpen && <ChangePasswordDialog
        onClose={() => setPasswordDialogOpen(false)}
        onSuccess={() => {
          setPasswordDialogOpen(false);
          setSnackbar({ open: true, message: 'Password updated.', severity: 'success' });
        }}
      />}
      <ActionSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
      />

      <Dialog
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '24px', overflow: 'hidden', border: `1px solid ${GREEN_UI.border}` } }}
      >
        <DialogTitle sx={{ bgcolor: '#fbfff9', borderBottom: `1px solid ${GREEN_UI.border}`, color: GREEN_UI.text, fontWeight: 700 }}>
          {previewDoc?.name}
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#f7fbf3', minHeight: 420 }}>
          {previewDoc && isPreviewableDoc(previewDoc) ? (
            mimeFromFileName(previewDoc.name).startsWith('image/') ? (
              <Box
                component="img"
                src={getDocSource(previewDoc)}
                alt={previewDoc.name}
                sx={{ display: 'block', maxWidth: '100%', maxHeight: '72vh', mx: 'auto', objectFit: 'contain' }}
              />
            ) : (
              <Box
                component="iframe"
                src={getDocSource(previewDoc)}
                title={previewDoc.name}
                sx={{ width: '100%', height: '72vh', border: 0, display: 'block', bgcolor: '#fff' }}
              />
            )
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <InsertDriveFile sx={{ color: GREEN_UI.muted, fontSize: 44, mb: 1 }} />
              <Typography fontWeight={700} sx={{ color: GREEN_UI.text }}>Preview is not available for this file type.</Typography>
              <Typography variant="body2" sx={{ color: GREEN_UI.muted, mt: 0.5 }}>Download the file to open it on your device.</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, bgcolor: '#fbfff9', borderTop: `1px solid ${GREEN_UI.border}` }}>
          {previewDoc && (
            <Button startIcon={<FileDownload />} onClick={() => handleDownload(previewDoc)} sx={{ ...pillButtonSx, color: GREEN_UI.greenDark }}>
              Download
            </Button>
          )}
          <Button variant="contained" onClick={() => setPreviewDoc(null)} sx={{ ...pillButtonSx, bgcolor: GREEN_UI.green, '&:hover': { bgcolor: GREEN_UI.greenDark } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
