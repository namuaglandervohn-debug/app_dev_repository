import { Box, Button, Paper, Typography } from '../bootstrap';
import { Home, Login } from '../bootstrap/icons';
import { Link as RouterLink, useNavigate } from 'react-router';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 3,
        background: 'radial-gradient(circle at top left, rgba(220, 246, 219, 0.95), #f7fbf3 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
          borderRadius: 4,
          border: '1px solid rgba(139, 184, 144, 0.24)',
        }}
      >
        <Typography variant="h3" fontWeight={700} sx={{ color: '#1e2d24', mb: 1 }}>
          404
        </Typography>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#1f7a46', mb: 1 }}>
          Page not found
        </Typography>
        <Typography variant="body2" sx={{ color: '#6c7d70', mb: 3 }}>
          This link may be outdated or the page was moved. Use one of the options below to continue.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            component={RouterLink}
            to="/"
            variant="contained"
            startIcon={<Home />}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1f7a47' }}
          >
            Go to home
          </Button>
          <Button
            variant="outlined"
            startIcon={<Login />}
            onClick={() => navigate('/login')}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Sign in
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
