import type { ReactNode } from 'react';
import { ArrowForwardRounded } from '@mui/icons-material';
import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material';
import { Link, useOutletContext } from 'react-router';

export type DashboardAction = { text: string; path: string; icon: ReactNode };

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
      sx={{ pb: 2, mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography component="h1" variant="h5" fontWeight={750} sx={{ letterSpacing: '-0.035em' }}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

export default function DashboardOverview({ metrics }: { metrics: Metric[] }) {
  const actions = useOutletContext<DashboardAction[]>() ?? [];
  return (
    <Stack spacing={2.75} sx={{ mb: 3 }}>
      <Box
        component="section"
        aria-label="Dashboard summary"
        sx={{
          display: 'grid', gap: 1.5,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: `repeat(${Math.min(metrics.length, 4)}, minmax(0, 1fr))` },
        }}
      >
        {metrics.map(({ title, value, icon, iconColor, iconBackground }, index) => (
          <Paper
            key={title}
            elevation={0}
            sx={{
              p: { xs: 1.25, sm: 2 }, minHeight: 94, minWidth: 0, border: 1, borderRadius: '14px',
              bgcolor: index === 0 ? 'primary.main' : 'background.paper',
              color: index === 0 ? 'primary.contrastText' : 'text.primary',
              borderColor: index === 0 ? 'primary.main' : 'divider',
              boxShadow: '0 2px 6px rgba(31,122,71,0.06)',
            }}
          >
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} color={index === 0 ? 'inherit' : 'text.secondary'} sx={{ fontSize: { xs: '0.78rem', sm: '0.875rem' }, overflowWrap: 'anywhere' }}>{title}</Typography>
                <Typography sx={{ mt: 0.5, fontSize: { xs: '1.02rem', sm: '1.35rem' }, fontWeight: 750, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{value}</Typography>
              </Box>
              <Box aria-hidden="true" sx={{ display: 'grid', placeItems: 'center', width: { xs: 27, sm: 34 }, height: { xs: 27, sm: 34 }, flexShrink: 0, borderRadius: 1, bgcolor: index === 0 ? 'rgba(255,255,255,0.16)' : iconBackground ?? 'background.default', color: index === 0 ? 'inherit' : iconColor ?? 'primary.main', '& svg': { fontSize: { xs: 16, sm: 19 } } }}>
                {icon}
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>
      {actions.length > 0 && (
        <Box component="section" aria-label="Quick actions">
          <Typography component="h2" variant="subtitle1" fontWeight={750} sx={{ mb: 1.25 }}>Quick Actions</Typography>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            {actions.map(({ text, path, icon }) => (
              <ButtonBase
                component={Link}
                to={path}
                key={path}
                sx={{
                  display: 'flex', justifyContent: 'flex-start', gap: 1.5, textAlign: 'left', p: 1.75,
                  minHeight: 68, border: 1, borderColor: 'divider', borderRadius: '14px',
                  bgcolor: 'background.paper', color: 'text.primary',
                  '&:hover, &.Mui-focusVisible': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <Box aria-hidden="true" sx={{ display: 'grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0, bgcolor: 'rgba(31,122,71,0.10)', color: 'primary.main', borderRadius: 1, '& svg': { fontSize: 19 } }}>{icon}</Box>
                <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>{text}</Typography>
                <ArrowForwardRounded aria-hidden="true" sx={{ fontSize: 17, color: 'primary.main' }} />
              </ButtonBase>
            ))}
          </Box>
        </Box>
      )}
    </Stack>
  );
}
