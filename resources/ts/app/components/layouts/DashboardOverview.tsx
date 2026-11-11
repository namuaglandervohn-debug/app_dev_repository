import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { accountColors } from './accountColors';

type Metric = {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconColor?: string;
  iconBackground?: string;
};

export function DashboardHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Stack
      component="header"
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      gap={1}
      sx={{ p: { xs: 1.5, sm: 2 }, mb: 2.5, border: 1, borderColor: 'divider', borderRadius: '14px', background: accountColors.dashboardHeading }}
    >
      <Typography component="h1" variant="h5" fontWeight={750} sx={{ letterSpacing: '-0.035em' }}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

export default function DashboardOverview({ metrics }: { metrics: Metric[] }) {
  return (
    <Box
      component="section"
      aria-label="Dashboard summary"
      sx={{
        display: 'grid', gap: 1.5, mb: 3,
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: `repeat(${Math.min(metrics.length, 4)}, minmax(0, 1fr))` },
      }}
    >
      {metrics.map(({ title, value, icon, iconColor, iconBackground }) => (
        <Paper
          key={title}
          elevation={0}
          sx={{
            p: { xs: 1.25, sm: 2 }, minHeight: 94, minWidth: 0, border: 1, borderRadius: '14px',
            position: 'relative', overflow: 'hidden',
            bgcolor: 'rgba(255,255,255,0.92)', color: 'text.primary', borderColor: 'divider',
            boxShadow: '0 2px 6px rgba(31,122,71,0.06)',
            '&::before': {
              content: '""', position: 'absolute', inset: '0 0 auto', height: 3,
              bgcolor: iconColor ?? 'primary.main', opacity: 0.86,
            },
          }}
        >
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ fontSize: { xs: '0.78rem', sm: '0.875rem' }, overflowWrap: 'anywhere' }}>{title}</Typography>
              <Typography sx={{ mt: 0.5, fontSize: { xs: '1.02rem', sm: '1.35rem' }, fontWeight: 750, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{value}</Typography>
            </Box>
            <Box aria-hidden="true" sx={{ display: 'grid', placeItems: 'center', width: { xs: 27, sm: 34 }, height: { xs: 27, sm: 34 }, flexShrink: 0, borderRadius: 1, bgcolor: iconBackground ?? 'background.default', color: iconColor ?? 'primary.main', '& svg': { fontSize: { xs: 16, sm: 19 } } }}>
              {icon}
            </Box>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
