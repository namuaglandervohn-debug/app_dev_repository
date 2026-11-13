import { formatDisplayDate } from '../../lib/displayDate';
import DashboardOverview, { DashboardHeader } from '../layouts/DashboardOverview';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Typography,
  Box,
  Button,
  Grid,
  Paper,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  PersonAddAlt1,
  PeopleAlt,
  EmojiEvents,
  Timelapse,
  TrendingUp,
  Apartment,
  CalendarMonth,
  ArrowForwardRounded,
  WorkspacePremium,
  Insights,
  FactCheck,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const GREEN_UI = {
  pageBg:
    'radial-gradient(circle at top left, rgba(220, 246, 219, 0.95), rgba(248, 252, 245, 0.98) 34%, #f7fbf3 100%)',
  cardBg: 'rgba(255, 255, 255, 0.92)',
  cardBgSoft: 'rgba(245, 252, 241, 0.88)',
  border: 'rgba(139, 184, 144, 0.24)',
  borderStrong: 'rgba(73, 156, 92, 0.32)',
  green: '#3aa865',
  greenDark: '#1f7a46',
  greenSoft: '#e6f8e9',
  text: '#1e2d24',
  muted: '#6c7d70',
  shadow: '0 20px 55px rgba(43, 91, 55, 0.10)',
  shadowSoft: '0 12px 28px rgba(43, 91, 55, 0.08)',
};

const softCardSx = {
  borderRadius: '26px',
  border: `1px solid ${GREEN_UI.border}`,
  background: GREEN_UI.cardBg,
  boxShadow: GREEN_UI.shadow,
};

const innerCardSx = {
  borderRadius: '20px',
  border: `1px solid ${GREEN_UI.border}`,
  background: GREEN_UI.cardBgSoft,
  boxShadow: GREEN_UI.shadowSoft,
};

const pillButtonSx = {
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 700,
  px: 2,
};

const softIconBoxSx = {
  width: 44,
  height: 44,
  borderRadius: '16px',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  background: GREEN_UI.greenSoft,
  color: GREEN_UI.greenDark,
};

export default function GMDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [forInterview, setForInterview] = useState<any[]>([]);
  const [topEvaluations, setTopEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: applicantsData, error: applicantsError } = await supabase
          .from('applicants')
          .select('*')
          .eq('status', 'For Interview')
          .order('interview_date', { ascending: true })
          .limit(5);

        if (applicantsError) throw applicantsError;

        const mappedApplicants = (applicantsData ?? []).map((app: any) => ({
          id: app.applicant_id,
          name: `${app.first_name ?? ''} ${app.middle_name ?? ''} ${app.last_name ?? ''}`
            .replace(/\s+/g, ' ')
            .trim(),
          position: app.position_applied ?? '',
          interviewDate: app.interview_date ?? '',
          interviewTime: app.interview_time ?? '',
          status: app.status ?? '',
        }));

        setForInterview(mappedApplicants);

        setStats({
          forInterviewCount: mappedApplicants.length,
          activeEmployees: 0,
          pendingRequests: 0,
        });

        setTopEvaluations([]);
      } catch (e) {
        console.error('GM dashboard error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statCards = [
    {
      title: 'Active Employees',
      value: loading ? '…' : String(stats?.activeEmployees ?? 0),
      icon: <PeopleAlt />,
      iconColor: GREEN_UI.greenDark,
      iconBackground: 'rgba(58, 168, 101, 0.14)',
    },
    {
      title: 'For Interview',
      value: loading ? '…' : String(stats?.forInterviewCount ?? 0),
      icon: <PersonAddAlt1 />,
      iconColor: '#2f8f8b',
      iconBackground: 'rgba(47, 143, 139, 0.13)',
    },
    {
      title: 'Pending Evaluation Approvals',
      value: loading ? '…' : String(topEvaluations.length),
      icon: <TrendingUp />,
      iconColor: '#d9a441',
      iconBackground: 'rgba(217, 164, 65, 0.16)',
    },
    {
      title: 'Pending Requests',
      value: loading ? '…' : String(stats?.pendingRequests ?? 0),
      icon: <Timelapse />,
      iconColor: '#b73e2d',
      iconBackground: 'rgba(183, 62, 45, 0.13)',
    },
  ];


  return (
    <Box sx={{ minWidth: 0 }}>
      <DashboardHeader title="General Manager Dashboard" />

      {/* Loading */}
      {loading && (
        <Paper elevation={0} sx={{ ...softCardSx, p: 2, mb: 2.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <CircularProgress size={18} sx={{ color: GREEN_UI.green }} />
          <Typography variant="body2" sx={{ color: GREEN_UI.muted, fontWeight: 700 }}>
            Loading estate data…
          </Typography>
        </Paper>
      )}
      {/* Stat Cards */}
      <DashboardOverview metrics={statCards} />

      <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
        {/* Applicants For Interview */}
        <Grid size={{ xs: 12 }}>
          <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.5 }, height: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                flexWrap: 'wrap',
                gap: 1.5,
                mb: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ ...softIconBoxSx }}>
                  <CalendarMonth />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: GREEN_UI.text, letterSpacing: '-0.025em' }}>
                    Applicants for Interview
                  </Typography>
                  <Typography variant="caption" sx={{ color: GREEN_UI.muted, fontWeight: 700 }}>
                    Upcoming interview queue
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                variant="contained"
                onClick={() => navigate('/dashboard/recruitment')}
                endIcon={<ArrowForwardRounded />}
                sx={{ ...pillButtonSx, bgcolor: GREEN_UI.green, '&:hover': { bgcolor: GREEN_UI.greenDark } }}
              >
                Manage
              </Button>
            </Box>

            <Divider sx={{ borderColor: GREEN_UI.border, mb: 1.5 }} />

            {forInterview.length === 0 ? (
              <Paper elevation={0} sx={{ ...innerCardSx, bgcolor: '#ffffff', p: 2.2, textAlign: 'center' }}>
                <Box sx={{ ...softIconBoxSx, mx: 'auto', mb: 1 }}>
                  <FactCheck />
                </Box>
                <Typography fontWeight={700} sx={{ color: GREEN_UI.text }}>
                  No scheduled interviews
                </Typography>
                <Typography variant="body2" sx={{ color: GREEN_UI.muted, mt: 0.5 }}>
                  No applicants are currently marked for interview.
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ display: 'grid', gap: 1.25 }}>
                {forInterview.map(a => (
                  <Paper
                    key={a.id}
                    elevation={0}
                    sx={{
                      ...innerCardSx,
                      p: 1.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                      <Box sx={{ ...softIconBoxSx, width: 40, height: 40, borderRadius: '14px' }}>
                        <PersonAddAlt1 fontSize="small" />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: GREEN_UI.text }} noWrap>
                          {a.name || 'Unnamed Applicant'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: GREEN_UI.muted }} noWrap>
                          {a.position} · {formatDisplayDate(a.interviewDate, 'Date TBD')} {a.interviewTime || ''}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label="For Interview"
                      size="small"
                      variant="outlined"
                      sx={{
                        bgcolor: '#e9f6ff',
                        color: '#1d6f9c',
                        borderColor: '#b7dff7',
                        fontWeight: 600,
                      }}
                    />
                  </Paper>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Pending Evaluations */}
      {topEvaluations.length > 0 && (
        <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.5 }, mt: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ ...softIconBoxSx }}>
                <Insights />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ color: GREEN_UI.text, letterSpacing: '-0.025em' }}>
                  Evaluations — Pending Your Approval
                </Typography>
                <Typography variant="caption" sx={{ color: GREEN_UI.muted, fontWeight: 700 }}>
                  Performance approvals requiring General Manager review
                </Typography>
              </Box>
            </Box>
            <Button
              size="small"
              variant="contained"
              onClick={() => navigate('/dashboard/evaluation')}
              startIcon={<WorkspacePremium />}
              sx={{ ...pillButtonSx, bgcolor: GREEN_UI.green, '&:hover': { bgcolor: GREEN_UI.greenDark } }}
            >
              Approve Now
            </Button>
          </Box>

          <Divider sx={{ borderColor: GREEN_UI.border, mb: 1 }} />

          <Box sx={{ display: 'grid', gap: 1.25 }}>
            {topEvaluations.map((e, i) => (
              <Paper
                key={e.id}
                elevation={0}
                sx={{ ...innerCardSx, p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                  <Chip
                    label={`#${i + 1}`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      bgcolor: i === 0 ? '#fff7e0' : GREEN_UI.greenSoft,
                      color: i === 0 ? '#9b6b00' : GREEN_UI.greenDark,
                    }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ color: GREEN_UI.text }} noWrap>
                      {e.employee}
                    </Typography>
                    <Typography variant="caption" sx={{ color: GREEN_UI.muted }} noWrap>
                      {e.position} · {e.period}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body1" fontWeight={700} sx={{ color: GREEN_UI.greenDark }}>
                  {e.finalScore?.toFixed(2)}%
                </Typography>
              </Paper>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
