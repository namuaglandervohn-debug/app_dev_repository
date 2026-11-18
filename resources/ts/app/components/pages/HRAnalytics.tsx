import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Box, Grid, Paper, Typography } from '@mui/material';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';

type MonthRow = {
  key: string;
  month: string;
  [key: string]: string | number | null;
};

type ChartsData = {
  attendance: MonthRow[];
  performance: MonthRow[];
  outlets: { name: string; employees: number }[];
  requests: MonthRow[];
  recruitment: MonthRow[];
};

const COLORS = ['#197a49', '#37a66b', '#83c996', '#c5e8cb', '#5b8cbd', '#e3ad45'];
const GREEN = '#197a49';
const MUTED = '#718176';
const BORDER = '#e3eee4';

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(year, month - 1, 1));
};
const normalized = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
const numeric = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};
const rangeMonths = (count = 6) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);
    const key = monthKey(date);
    return { key, month: monthLabel(key) };
  });
};
const groupByMonth = <T,>(rows: T[], getDate: (row: T) => unknown) => {
  const map = new Map<string, T[]>();
  rows.forEach(row => {
    const key = String(getDate(row) ?? '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(key) && map.has(key)) map.get(key)!.push(row);
    else if (/^\d{4}-\d{2}$/.test(key)) map.set(key, [row]);
  });
  return map;
};

const emptyData = (): ChartsData => ({ attendance: [], performance: [], outlets: [], requests: [], recruitment: [] });

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Paper elevation={0} sx={{ height: '100%', p: { xs: 1.75, sm: 2.25 }, borderRadius: '22px', border: `1px solid ${BORDER}`, bgcolor: 'rgba(255,255,255,.94)', boxShadow: '0 12px 30px rgba(43,91,55,.07)' }}>
      <Typography variant="subtitle1" fontWeight={750} sx={{ color: '#1e2d24' }}>{title}</Typography>
      <Typography variant="caption" sx={{ color: MUTED }}>{subtitle}</Typography>
      <Box sx={{ width: '100%', height: 260, mt: 1.5, position: 'relative' }}>
        {children}
      </Box>
    </Paper>
  );
}

function NoChartData({ hasData }: { hasData: boolean }) {
  return hasData ? null : (
    <Box sx={{ position: 'absolute', inset: 0, zIndex: 1, display: 'grid', placeItems: 'center', color: MUTED, fontSize: '.9rem', pointerEvents: 'none' }}>
      No records for this period yet
    </Box>
  );
}

export default function HRAnalytics() {
  const [data, setData] = useState<ChartsData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadIssues, setLoadIssues] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const months = rangeMonths();
    const firstMonth = months[0].key;
    const start = `${firstMonth}-01`;
    const endDate = new Date();
    const end = `${monthKey(endDate)}-${String(endDate.getDate()).padStart(2, '0')}`;
    const createdAfter = `${start}T00:00:00`;

    const load = async () => {
      const results = await Promise.allSettled([
        supabase.from('attendance_logs').select('attendance_date,is_absent,is_late,late_minutes').gte('attendance_date', start).lte('attendance_date', end),
        supabase.from('employee_evaluations').select('evaluation_period_end,final_weighted_score,status').gte('evaluation_period_end', start).lte('evaluation_period_end', end),
        supabase.from('employees').select('employee_id,outlet,status'),
        supabase.from('employee_requests').select('request_type,created_at').gte('created_at', createdAfter).lte('created_at', `${end}T23:59:59`),
        supabase.from('applicants').select('status,created_at').gte('created_at', createdAfter).lte('created_at', `${end}T23:59:59`),
      ]);

      if (!active) return;
      const names = ['Attendance', 'Performance', 'Employee outlet', 'Requests', 'Recruitment'];
      const failures: string[] = [];
      const rowsBySource = results.map((result, index) => {
        if (result.status === 'rejected') {
          failures.push(names[index]);
          return [];
        }
        if (result.value.error) {
          failures.push(names[index]);
          return [];
        }
        return result.value.data ?? [];
      });
      const [attendanceRows, evaluationRows, employees, requestRows, applicantRows] = rowsBySource as any[][];

      const attendanceMonths = groupByMonth(attendanceRows, row => row.attendance_date);
      const performanceMonths = groupByMonth(evaluationRows.filter(row => ['approved', 'reviewed', 'submitted'].includes(normalized(row.status))), row => row.evaluation_period_end);
      const requestMonths = groupByMonth(requestRows, row => row.created_at);
      const recruitmentMonths = groupByMonth(applicantRows, row => row.created_at);

      const attendance = months.map(month => {
        const rows = attendanceMonths.get(month.key) ?? [];
        let absent = 0;
        let late = 0;
        rows.forEach(row => {
          if (row.is_absent) absent += 1;
          else if (row.is_late || numeric(row.late_minutes) > 0) late += 1;
        });
        return { ...month, onTime: Math.max(0, rows.length - absent - late), late, absent };
      });

      const performance = months.map(month => {
        const rows = performanceMonths.get(month.key) ?? [];
        const average = rows.length ? rows.reduce((sum, row) => sum + numeric(row.final_weighted_score), 0) / rows.length : 0;
        return { ...month, average: rows.length ? Number(average.toFixed(1)) : null, evaluations: rows.length };
      });

      const outletCounts = new Map<string, number>();
      employees.filter(row => normalized(row.status) === 'active').forEach(row => {
        const outlet = String(row.outlet ?? '').trim() || 'Unassigned';
        outletCounts.set(outlet, (outletCounts.get(outlet) ?? 0) + 1);
      });
      const outlets = Array.from(outletCounts, ([name, employees]) => ({ name, employees })).sort((a, b) => b.employees - a.employees);

      const requests = months.map(month => {
        const rows = requestMonths.get(month.key) ?? [];
        return {
          ...month,
          leave: rows.filter(row => normalized(row.request_type).includes('leave')).length,
          overtime: rows.filter(row => normalized(row.request_type).includes('overtime')).length,
          undertime: rows.filter(row => normalized(row.request_type).includes('undertime')).length,
        };
      });

      const recruitment = months.map(month => {
        const rows = recruitmentMonths.get(month.key) ?? [];
        return {
          ...month,
          received: rows.filter(row => ['application received', 'submitted', 'under review', 'missing requirements'].includes(normalized(row.status))).length,
          interview: rows.filter(row => normalized(row.status).includes('interview')).length,
          hired: rows.filter(row => normalized(row.status) === 'hired').length,
          notQualified: rows.filter(row => ['not qualified', 'not hired'].includes(normalized(row.status))).length,
        };
      });

      setData({ attendance, performance, outlets, requests, recruitment });
      setLoadIssues(failures);
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, []);

  const chartTooltip = { contentStyle: { borderRadius: 12, borderColor: BORDER }, labelStyle: { color: '#1e2d24', fontWeight: 700 } };

  return (
    <Box sx={{ mt: 2.5, mb: 2.5 }}>
      <Box sx={{ mb: 1.75 }}>
        <Typography variant="h5" fontWeight={800} sx={{ color: '#1e2d24', letterSpacing: '-.025em' }}>HR Data &amp; Trends</Typography>
        <Typography variant="body2" sx={{ color: MUTED }}>Six-month view of attendance, performance, staffing, requests, and recruitment.</Typography>
      </Box>
      {!!loadIssues.length && (
        <Alert severity="warning" sx={{ mb: 1.5, borderRadius: '14px' }}>
          Some charts could not load: {loadIssues.join(', ')}. The remaining charts still show available records.
        </Alert>
      )}
      {loading && <Alert severity="info" sx={{ mb: 1.5, borderRadius: '14px' }}>Loading HR analytics…</Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Employee Attendance Trends" subtitle="On-time, late, and absent records by month">
            {!loading && <NoChartData hasData={data.attendance.some(row => Number(row.onTime) + Number(row.late) + Number(row.absent) > 0)} />}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.attendance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 12 }} />
                <Tooltip {...chartTooltip} />
                <Legend />
                <Bar dataKey="onTime" name="On time" fill="#37a66b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" name="Late" fill="#e3ad45" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="#c95c54" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Employee Performance Trends" subtitle="Average final evaluation score for completed evaluations">
            {!loading && <NoChartData hasData={data.performance.some(row => Number(row.evaluations) > 0)} />}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.performance} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: MUTED, fontSize: 12 }} />
                <Tooltip {...chartTooltip} />
                <Legend />
                <Line type="monotone" dataKey="average" name="Average score" stroke={GREEN} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Employee Distribution per Outlet" subtitle="Active employees grouped by their assigned outlet">
            {!loading && <NoChartData hasData={data.outlets.length > 0} />}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.outlets} dataKey="employees" nameKey="name" cx="50%" cy="48%" outerRadius={86} innerRadius={45} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                  {data.outlets.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip {...chartTooltip} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Leave, Overtime & Undertime Trends" subtitle="Submitted employee requests by month and type">
            {!loading && <NoChartData hasData={data.requests.some(row => Number(row.leave) + Number(row.overtime) + Number(row.undertime) > 0)} />}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.requests} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 12 }} />
                <Tooltip {...chartTooltip} />
                <Legend />
                <Bar dataKey="leave" name="Leave" fill="#5b8cbd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="overtime" name="Overtime" fill="#37a66b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="undertime" name="Undertime" fill="#e3ad45" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ChartCard title="Recruitment & Application Trends" subtitle="Application volume and hiring outcomes by month">
            {!loading && <NoChartData hasData={data.recruitment.some(row => Number(row.received) + Number(row.interview) + Number(row.hired) + Number(row.notQualified) > 0)} />}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.recruitment} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 12 }} />
                <Tooltip {...chartTooltip} />
                <Legend />
                <Bar dataKey="received" name="Received / Under review" fill="#5b8cbd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="interview" name="For interview" fill="#e3ad45" radius={[4, 4, 0, 0]} />
                <Bar dataKey="hired" name="Hired" fill="#37a66b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="notQualified" name="Not qualified" fill="#c95c54" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
