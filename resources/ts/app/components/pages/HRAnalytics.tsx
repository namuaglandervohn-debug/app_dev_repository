import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert, Box, Card, CardContent, CircularProgress, FormControl, Grid,
  InputLabel, MenuItem, Paper, Select, Stack, Typography,
} from '@mui/material';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { OUTLETS } from '../../lib/constants';

type Row = Record<string, any>;
type AnalyticsData = {
  employees: Row[];
  attendance: Row[];
  evaluations: Row[];
  requests: Row[];
  applicants: Row[];
  userAccounts: Row[];
};

const GREEN = '#197a49';
const MUTED = '#718176';
const BORDER = '#e3eee4';
const COLORS = ['#197a49', '#37a66b', '#e3ad45', '#c95c54', '#5b8cbd', '#83c996'];
const EMPTY: AnalyticsData = { employees: [], attendance: [], evaluations: [], requests: [], applicants: [], userAccounts: [] };
const normalized = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
const truthy = (value: unknown) => value === true || ['true', 'yes', '1'].includes(normalized(value));
const number = (value: unknown) => {
  const parsed = Number(String(value ?? 0).replace(/[,%₱]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const dateOnly = (value: unknown) => String(value ?? '').slice(0, 10);
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const getMonthOptions = () => Array.from({ length: 18 }, (_, index) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - index);
  const value = monthKey(date);
  return { value, label: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date) };
});
const sameMonth = (value: unknown, month: string) => dateOnly(value).slice(0, 7) === month;
const outletOf = (row: Row, employeeOutlets: Map<string, string>) =>
  String(row.outlet || employeeOutlets.get(String(row.employee_id ?? '')) || 'Unassigned').trim() || 'Unassigned';
const validEvaluation = (row: Row) => ['approved', 'reviewed', 'completed'].includes(normalized(row.status));
const requestStatus = (value: unknown) => {
  const status = normalized(value);
  if (status.includes('approv')) return 'Approved';
  if (status.includes('reject') || status.includes('disapprov') || status.includes('declin')) return 'Rejected';
  return 'Pending';
};
const recruitmentStatus = (row: Row) => {
  const status = normalized(row.hiring_decision || row.status);
  if (status.includes('withdraw')) return 'Withdrawn';
  if (status.includes('reject') || status.includes('not qualified') || status.includes('not hired')) return 'Rejected';
  if (status.includes('interview')) return 'For interview';
  if (status === 'hired' || (status.includes('hired') && !status.includes('not hired'))) return 'Hired';
  return 'Pending review';
};

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper elevation={0} sx={{ height: '100%', p: { xs: 1.75, sm: 2.25 }, borderRadius: '22px', border: `1px solid ${BORDER}`, bgcolor: 'rgba(255,255,255,.94)', boxShadow: '0 12px 30px rgba(43,91,55,.07)' }}>
      <Typography variant="subtitle1" fontWeight={750} sx={{ color: '#1e2d24' }}>{title}</Typography>
      <Box sx={{ width: '100%', height: 270, mt: 1.5, position: 'relative' }}>{children}</Box>
    </Paper>
  );
}

function EmptyChart({ show }: { show: boolean }) {
  return show ? <Box sx={{ position: 'absolute', inset: 0, zIndex: 1, display: 'grid', placeItems: 'center', color: MUTED, fontSize: '.9rem', pointerEvents: 'none' }}>No records for this selection</Box> : null;
}

function MetricCard({ label, value, color = GREEN }: { label: string; value: string; color?: string }) {
  return (
    <Card elevation={0} sx={{ height: '100%', border: `1px solid ${BORDER}`, borderRadius: '18px', bgcolor: 'rgba(255,255,255,.94)' }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="body2" color="text.secondary" fontWeight={650}>{label}</Typography>
        <Typography variant="h4" fontWeight={800} sx={{ color, mt: .5 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

export default function HRAnalytics() {
  const monthOptions = useMemo(getMonthOptions, []);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [outlet, setOutlet] = useState('All Outlets');
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const sources: Array<[keyof AnalyticsData, PromiseLike<any>]> = [
        ['employees', supabase.from('employees').select('employee_id,outlet,status,department,position')],
        ['attendance', supabase.from('attendance_logs').select('employee_id,attendance_date,is_absent,is_late,late_minutes')],
        ['evaluations', supabase.from('employee_evaluations').select('employee_id,outlet,evaluation_period_end,final_weighted_score,status')],
        ['requests', supabase.from('employee_requests').select('employee_id,request_type,status,created_at,start_date')],
        ['applicants', supabase.from('applicants').select('applicant_id,status,hiring_decision,created_at')],
        ['userAccounts', supabase.from('user_accounts').select('employee_id,applicant_id,outlet')],
      ];
      const results = await Promise.allSettled(sources.map(([, query]) => query));
      if (!active) return;
      const next: AnalyticsData = { ...EMPTY };
      const failures: string[] = [];
      results.forEach((result, index) => {
        const key = sources[index][0];
        if (result.status === 'rejected' || result.value.error) {
          failures.push({ employees: 'Employees', attendance: 'Attendance', evaluations: 'Performance', requests: 'Requests', applicants: 'Recruitment', userAccounts: 'Outlet assignments' }[key]);
          return;
        }
        next[key] = result.value.data ?? [];
      });
      setData(next);
      if (failures.length) console.warn('Some HR analytics sources could not load:', failures);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const employeeOutlets = useMemo(() => {
    const map = new Map(data.employees.map(row => [String(row.employee_id ?? ''), String(row.outlet ?? 'Unassigned')]));
    data.userAccounts.forEach(row => {
      if (row.employee_id && row.outlet) map.set(String(row.employee_id), String(row.outlet));
    });
    return map;
  }, [data.employees, data.userAccounts]);
  const applicantOutlets = useMemo(() => new Map(data.userAccounts.filter(row => row.applicant_id && row.outlet).map(row => [String(row.applicant_id), String(row.outlet)])), [data.userAccounts]);
  const inOutlet = (row: Row) => outlet === 'All Outlets' || outletOf(row, employeeOutlets).toLowerCase() === outlet.toLowerCase();
  const monthAttendance = data.attendance.filter(row => sameMonth(row.attendance_date, month) && inOutlet(row));
  const monthEvaluations = data.evaluations.filter(row => sameMonth(row.evaluation_period_end, month) && validEvaluation(row) && inOutlet(row));
  const monthRequests = data.requests.filter(row => sameMonth(row.created_at || row.start_date, month) && normalized(row.request_type).includes('leave') && inOutlet(row));
  const monthApplicants = data.applicants.filter(row => sameMonth(row.created_at, month) && (outlet === 'All Outlets' || String(row.outlet || applicantOutlets.get(String(row.applicant_id ?? '')) || '').toLowerCase() === outlet.toLowerCase()));

  const attendanceTrend = useMemo(() => {
    const [year, monthNumber] = month.split('-').map(Number);
    const days = new Date(year, monthNumber, 0).getDate();
    const grouped = new Map<string, { present: number; late: number; absent: number }>();
    monthAttendance.forEach(row => {
      const day = dateOnly(row.attendance_date).slice(8, 10);
      if (!day) return;
      const current = grouped.get(day) ?? { present: 0, late: 0, absent: 0 };
      if (truthy(row.is_absent)) current.absent += 1;
      else if (truthy(row.is_late) || number(row.late_minutes) > 0) current.late += 1;
      else current.present += 1;
      grouped.set(day, current);
    });
    return Array.from({ length: days }, (_, index) => {
      const label = String(index + 1).padStart(2, '0');
      const values = grouped.get(label) ?? { present: 0, late: 0, absent: 0 };
      return { label, ...values };
    });
  }, [month, monthAttendance]);

  const performanceByOutlet = useMemo(() => {
    const grouped = new Map<string, { total: number; count: number }>();
    monthEvaluations.forEach(row => {
      const key = outletOf(row, employeeOutlets);
      const current = grouped.get(key) ?? { total: 0, count: 0 };
      current.total += number(row.final_weighted_score);
      current.count += 1;
      grouped.set(key, current);
    });
    return Array.from(grouped, ([name, result]) => ({ name, average: Number((result.total / result.count).toFixed(1)), evaluations: result.count })).sort((a, b) => b.average - a.average);
  }, [monthEvaluations, employeeOutlets]);

  const recruitment = useMemo(() => {
    const statuses = ['For interview', 'Hired', 'Pending review', 'Rejected', 'Withdrawn'];
    const counts = new Map(statuses.map(status => [status, 0]));
    monthApplicants.forEach(row => {
      const status = recruitmentStatus(row);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    });
    return statuses.map(name => ({ name, value: counts.get(name) ?? 0 })).filter(item => item.value > 0);
  }, [monthApplicants]);

  const leaveByOutlet = useMemo(() => {
    const rows = new Map<string, { Approved: number; Pending: number; Rejected: number }>();
    monthRequests.forEach(row => {
      const name = outletOf(row, employeeOutlets);
      const current = rows.get(name) ?? { Approved: 0, Pending: 0, Rejected: 0 };
      current[requestStatus(row.status)] += 1;
      rows.set(name, current);
    });
    return Array.from(rows, ([name, counts]) => ({ name, ...counts })).sort((a, b) => (b.Approved + b.Pending + b.Rejected) - (a.Approved + a.Pending + a.Rejected));
  }, [monthRequests, employeeOutlets]);

  const employeeDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    data.employees.filter(row => normalized(row.status) === 'active' && (outlet === 'All Outlets' || outletOf(row, employeeOutlets).toLowerCase() === outlet.toLowerCase())).forEach(row => {
      const name = outletOf(row, employeeOutlets);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return Array.from(counts, ([name, employees]) => ({ name, employees })).sort((a, b) => b.employees - a.employees);
  }, [data.employees, employeeOutlets, outlet]);

  const averagePerformance = monthEvaluations.length ? monthEvaluations.reduce((sum, row) => sum + number(row.final_weighted_score), 0) / monthEvaluations.length : null;
  const tooltip = { contentStyle: { borderRadius: 12, borderColor: BORDER }, labelStyle: { color: '#1e2d24', fontWeight: 700 } };
  const monthLabel = monthOptions.find(option => option.value === month)?.label ?? month;

  return (
    <Box sx={{ mt: 2.5, mb: 2.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" gap={1.5} sx={{ mb: 1.75 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#1e2d24', letterSpacing: '-.025em' }}>HR Analytics</Typography>
          <Typography variant="body2" color="text.secondary">{monthLabel}{outlet !== 'All Outlets' ? ` · ${outlet}` : ' · All outlets'}</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <FormControl size="small" sx={{ minWidth: 190, bgcolor: 'white' }}>
            <InputLabel id="analytics-outlet-label">Outlet</InputLabel>
            <Select labelId="analytics-outlet-label" value={outlet} label="Outlet" onChange={event => setOutlet(event.target.value)}>
              <MenuItem value="All Outlets">All Outlets</MenuItem>
              {OUTLETS.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 190, bgcolor: 'white' }}>
            <InputLabel id="analytics-month-label">Reporting month</InputLabel>
            <Select labelId="analytics-month-label" value={month} label="Reporting month" onChange={event => setMonth(event.target.value)}>
              {monthOptions.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {loading && <Alert severity="info" icon={<CircularProgress size={16} />} sx={{ mb: 1.5, borderRadius: '14px' }}>Loading HR analytics…</Alert>}

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Employees" value={loading ? '…' : data.employees.filter(row => outlet === 'All Outlets' || outletOf(row, employeeOutlets).toLowerCase() === outlet.toLowerCase()).length.toLocaleString()} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Average performance" value={loading ? '…' : averagePerformance === null ? '—' : `${averagePerformance.toFixed(1)}%`} color="#5b8cbd" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Applicants this month" value={loading ? '…' : monthApplicants.length.toLocaleString()} color="#bd8120" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Leave requests this month" value={loading ? '…' : monthRequests.length.toLocaleString()} color="#8b5ad8" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Attendance Trends by Day">
            {!loading && <EmptyChart show={!monthAttendance.length} />}
            <ResponsiveContainer width="100%" height="100%"><LineChart data={attendanceTrend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} /><XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 12 }} /><Tooltip {...tooltip} /><Legend />
              <Line type="monotone" dataKey="present" name="On time" stroke="#37a66b" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="late" name="Late" stroke="#e3ad45" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="absent" name="Absent" stroke="#c95c54" strokeWidth={2.5} dot={false} />
            </LineChart></ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Average Performance by Outlet">
            {!loading && <EmptyChart show={!performanceByOutlet.length} />}
            <ResponsiveContainer width="100%" height="100%"><BarChart data={performanceByOutlet} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} /><XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fill: MUTED, fontSize: 12 }} /><Tooltip {...tooltip} /><Bar dataKey="average" name="Average score (%)" fill={GREEN} radius={[5, 5, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Recruitment Status">
            {!loading && <EmptyChart show={!recruitment.length} />}
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={recruitment} dataKey="value" nameKey="name" cx="50%" cy="46%" outerRadius={78} innerRadius={44} paddingAngle={3}>
              {recruitment.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
            </Pie><Tooltip {...tooltip} /><Legend verticalAlign="bottom" content={({ payload }) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: .75, px: 1, pt: .5 }}>
                {(payload ?? []).map((item: any) => {
                  const name = String(item.value ?? '');
                  const count = recruitment.find(row => row.name === name)?.value ?? 0;
                  return <Box key={name} sx={{ display: 'inline-flex', alignItems: 'center', gap: .5, px: .8, py: .3, borderRadius: 1, bgcolor: '#f5faf4', color: '#4f6254', fontSize: 11, whiteSpace: 'nowrap' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />{name}: {count}
                  </Box>;
                })}
              </Box>
            )} /></PieChart></ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Leave Requests by Outlet and Status">
            {!loading && <EmptyChart show={!leaveByOutlet.length} />}
            <ResponsiveContainer width="100%" height="100%"><BarChart data={leaveByOutlet} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} /><XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 12 }} /><Tooltip {...tooltip} /><Legend />
              <Bar dataKey="Approved" stackId="requests" fill="#37a66b" /><Bar dataKey="Pending" stackId="requests" fill="#e3ad45" /><Bar dataKey="Rejected" stackId="requests" fill="#c95c54" />
            </BarChart></ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ChartCard title="Active Employees by Outlet">
            {!loading && <EmptyChart show={!employeeDistribution.length} />}
            <ResponsiveContainer width="100%" height="100%"><BarChart data={employeeDistribution} margin={{ top: 8, right: 16, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} /><XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 12 }} /><Tooltip {...tooltip} /><Bar dataKey="employees" name="Active employees" fill={GREEN} radius={[5, 5, 0, 0]}>
                {employeeDistribution.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
              </Bar>
            </BarChart></ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
