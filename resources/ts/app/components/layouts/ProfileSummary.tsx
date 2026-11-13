import type { ReactNode } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { profileCardSx, profileIconSx } from './profileStyles';

type SummaryItem = { label: string; value: string | number; icon: ReactNode };

export default function ProfileSummary({ items }: { items: SummaryItem[] }) {
  return (
    <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
      {items.map(({ label, value, icon }) => (
        <Grid key={label} size={{ xs: 12, sm: 6 }}>
          <Paper elevation={0} sx={{
            ...profileCardSx, p: 2, minHeight: 126,
            transition: 'transform 180ms ease, box-shadow 180ms ease',
            '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 22px 48px rgba(43, 91, 55, 0.13)' },
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: '#6c7d70', fontWeight: 600 }}>{label}</Typography>
                <Typography variant="h5" fontWeight={700}
                  sx={{ color: '#1e2d24', mt: 0.5, letterSpacing: '-0.04em', overflowWrap: 'anywhere' }}>
                  {value}
                </Typography>
              </Box>
              <Box sx={profileIconSx} aria-hidden="true">{icon}</Box>
            </Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
