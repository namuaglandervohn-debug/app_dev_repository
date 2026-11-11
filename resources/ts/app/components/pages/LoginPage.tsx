import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  MenuItem,
  InputAdornment,
  IconButton,
  Stack,
  Chip,
  CircularProgress,
  Link,
} from "@mui/material";
import {
  Search,
  Visibility,
  VisibilityOff,
  Email,
  VpnKey,
} from "@mui/icons-material";
import AuthBackground from "../AuthBackground";
import BrandLogo from "../BrandLogo";
import { COMPANY } from "../../lib/constants";
import { consumeSignupEmailConfirmation, supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const { state } = useLocation();
  const registrationEmail = typeof state?.registrationEmail === 'string' ? state.registrationEmail : '';
  const [email, setEmail] = useState(registrationEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(registrationEmail
    ? 'Check your inbox or spam folder for the confirmation link. After verifying your email, sign in here.' : '');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState("");
  const submitting = useRef(false);
  const [signingIn, setSigningIn] = useState(false);
  const { login, user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const freshLogin = searchParams.get("fresh") === "1";
  const next = searchParams.get('next') ?? '';
  const nextQuery = /^\/apply(?:\?|$)/.test(next) ? `next=${encodeURIComponent(next)}` : '';
  const applicantPath = nextQuery ? `/applicant?${nextQuery}` : '/applicant';
  const registrationPath = `/applicant?mode=register${nextQuery ? `&${nextQuery}` : ''}`;

  useEffect(() => {
    if (consumeSignupEmailConfirmation()) {
      setNotice('Email verified. Sign in with your email and password.');
    }
  }, []);

  useEffect(() => {
    if (freshLogin) {
      logout();
      setSearchParams({}, { replace: true });
      return;
    }

    if (!loading && user) {
      navigate(user.role === 'applicant' ? applicantPath : '/dashboard', { replace: true });
    }
  }, [applicantPath, freshLogin, loading, logout, navigate, setSearchParams, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || sendingEmail || submitting.current) return;
    submitting.current = true;
    setSigningIn(true);
    setError("");
    setNotice('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      submitting.current = false;
      setSigningIn(false);
    }
  };

  const requestAccountEmail = async (kind: 'reset' | 'confirm') => {
    if (loading || sendingEmail || submitting.current) return;
    const address = email.trim().toLowerCase();
    setError('');
    setNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter your email address first.');
      return;
    }

    setSendingEmail(true);
    try {
      const redirectTo = `${window.location.origin}/applicant`;
      const { error } = kind === 'reset'
        ? await supabase.auth.resetPasswordForEmail(address, { redirectTo })
        : await supabase.auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      setNotice(kind === 'reset'
        ? 'If an account exists for that address, check your inbox or spam folder for a password reset link.'
        : 'Confirmation requested. If your email still needs confirmation, check your inbox or spam folder.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not request the email.');
    } finally {
      setSendingEmail(false);
    }
  };

  const demoAccounts = [
    {
      email: "hr@company.com",
      password: "password",
      role: "HR Personnel/Admin",
    },
    {
      email: "employee@company.com",
      password: "password",
      role: "Employee",
    },
    {
      email: "supervisor@company.com",
      password: "password",
      role: "Supervisor",
    },
    {
      email: "gm@company.com",
      password: "password",
      role: "General Manager",
    },
    {
      email: "accounting@company.com",
      password: "password",
      role: "Accounting & Finance",
    },
  ];

  const fieldSx = {
    mt: 1.4,
    mb: 0.8,
    "& .MuiInputLabel-root": {
      color: "#6F7E73",
      fontSize: "0.9rem",
      fontWeight: 700,
    },
    "& .MuiInputLabel-root.Mui-focused": {
      color: "#087443",
    },
    "& .MuiOutlinedInput-root": {
      minHeight: 54,
      borderRadius: "16px",
      backgroundColor: "rgba(255,255,255,0.92)",
      boxShadow: "0 10px 24px rgba(26, 83, 55, 0.06)",
      transition: "all 180ms ease",
      "& fieldset": {
        borderColor: "rgba(56, 116, 77, 0.16)",
      },
      "&:hover": {
        backgroundColor: "#FFFFFF",
        boxShadow: "0 14px 30px rgba(26, 83, 55, 0.10)",
        transform: "translateY(-1px)",
      },
      "&:hover fieldset": {
        borderColor: "rgba(8, 116, 67, 0.34)",
      },
      "&.Mui-focused": {
        backgroundColor: "#FFFFFF",
        boxShadow: "0 16px 34px rgba(8, 116, 67, 0.14)",
      },
      "&.Mui-focused fieldset": {
        borderColor: "#2DA861",
        borderWidth: "1.5px",
      },
    },
    "& .MuiInputBase-input": {
      color: "#11221A",
      fontSize: "0.94rem",
    },
  };

  return (
    <AuthBackground>
      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            overflow: "hidden",
            p: { xs: 2.7, sm: 4, md: 4.6 },
            borderRadius: "28px",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(248,253,247,0.94) 48%, rgba(239,250,238,0.92) 100%)",
            backdropFilter: "blur(22px)",
            border: "1px solid rgba(255,255,255,0.78)",
            boxShadow:
              "0 32px 70px rgba(10, 34, 24, 0.28), inset 0 1px 0 rgba(255,255,255,0.85)",
            "&::before": {
              content: '""',
              position: "absolute",
              width: 220,
              height: 220,
              top: -95,
              right: -85,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(68,185,111,0.24) 0%, rgba(68,185,111,0.08) 52%, rgba(68,185,111,0) 72%)",
              pointerEvents: "none",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              width: 180,
              height: 180,
              left: -90,
              bottom: -82,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(217,164,65,0.18) 0%, rgba(217,164,65,0.06) 55%, rgba(217,164,65,0) 74%)",
              pointerEvents: "none",
            },
          }}
        >
          <Box sx={{ position: "relative", zIndex: 1 }}>
            {/* Brand header */}
            <Stack alignItems="center" spacing={1.25} sx={{ mb: 3 }}>
              <Box
                sx={{
                  width: { xs: 66, sm: 76 },
                  height: { xs: 66, sm: 76 },
                  borderRadius: "24px",
                  bgcolor: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow:
                    "0 20px 34px rgba(8, 116, 67, 0.34), inset 0 1px 0 rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.58)",
                }}
              >
                <BrandLogo size="100%" />
              </Box>

              <Chip
                size="small"
                label="BUENAVENTURA ESTATE"
                sx={{
                  height: 28,
                  px: 0.5,
                  letterSpacing: 1.6,
                  bgcolor: "#DDF5E5",
                  color: "#006B3C",
                  border: "1px solid rgba(45,168,97,0.20)",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  "& .MuiChip-label": { px: 1.2 },
                }}
              />

              <Typography
                align="center"
                sx={{
                  maxWidth: 430,
                  fontSize: { xs: "1.38rem", sm: "1.72rem" },
                  fontWeight: 700,
                  color: "#122019",
                  lineHeight: 1.15,
                  letterSpacing: "-0.04em",
                }}
              >
                Human Resource Information System
              </Typography>
            </Stack>

            {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2,
                  borderRadius: "16px",
                  border: "1px solid rgba(211, 47, 47, 0.14)",
                  fontWeight: 700,
                  "& .MuiAlert-message": { fontSize: "0.88rem" },
                }}
              >
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <TextField
                select
                disabled={loading || signingIn}
                fullWidth
                label="Quick Demo Account"
                value={selectedDemo}
                onChange={(e) => {
                  const val = e.target.value;
                  const acc = demoAccounts.find((a) => a.email === val);
                  setSelectedDemo(val);
                  if (acc) {
                    setEmail(acc.email);
                    setPassword(acc.password);
                  }
                }}
                margin="normal"
                size="medium"
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 19, color: "#0A7A43" }} />
                    </InputAdornment>
                  ),
                }}
                SelectProps={{
                  displayEmpty: true,
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        mt: 1,
                        borderRadius: "18px",
                        border: "1px solid rgba(45,168,97,0.14)",
                        boxShadow: "0 18px 40px rgba(17, 48, 34, 0.18)",
                        "& .MuiMenuItem-root": {
                          fontSize: "0.9rem",
                          borderRadius: "12px",
                          mx: 1,
                          my: 0.4,
                        },
                        "& .MuiMenuItem-root.Mui-selected": {
                          bgcolor: "#DDF5E5",
                          color: "#006B3C",
                        },
                      },
                    },
                  },
                }}
                sx={fieldSx}
              >
                <MenuItem key="demo-placeholder" value="" disabled>
                  <em style={{ color: "#8A978D", fontStyle: "normal", fontWeight: 700 }}>
                    — Select a demo role —
                  </em>
                </MenuItem>
                {demoAccounts.map((account) => (
                  <MenuItem key={account.email} value={account.email}>
                    {account.role}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                label="Email"
                disabled={loading || signingIn}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setSelectedDemo(''); }}
                margin="normal"
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ fontSize: 19, color: "#0A7A43" }} />
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />

              <TextField
                fullWidth
                label="Password"
                disabled={loading || signingIn}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <VpnKey sx={{ fontSize: 19, color: "#0A7A43" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((s) => !s)}
                        edge="end"
                        size="small"
                        sx={{
                          color: "#557261",
                          bgcolor: "rgba(221,245,229,0.55)",
                          border: "1px solid rgba(45,168,97,0.12)",
                          "&:hover": {
                            bgcolor: "#DDF5E5",
                            color: "#006B3C",
                          },
                        }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />

              <Button
                type="submit"
                disabled={loading || signingIn || sendingEmail}
                aria-busy={loading || signingIn}
                startIcon={loading || signingIn ? <CircularProgress size={18} color="inherit" /> : undefined}
                fullWidth
                variant="contained"
                size="large"
                sx={{
                  mt: 3,
                  mb: 2,
                  py: 1.45,
                  borderRadius: "16px",
                  textTransform: "none",
                  fontSize: "0.98rem",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "#FFFFFF",
                  background:
                    "linear-gradient(135deg, #087443 0%, #2DA861 56%, #61C982 100%)",
                  boxShadow: "0 18px 32px rgba(8,116,67,0.28)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #006B3C 0%, #229756 56%, #4FBC73 100%)",
                    boxShadow: "0 22px 38px rgba(8,116,67,0.34)",
                    transform: "translateY(-1px)",
                  },
                  transition: "all 180ms ease",
                }}
              >
                {signingIn ? 'Signing in…' : loading ? 'Checking session…' : 'Sign In to HRIS'}
              </Button>
            </form>
            <Stack direction="row" flexWrap="wrap" justifyContent="center" gap={1} sx={{ mb: 1 }}>
              <Button size="small" disabled={loading || signingIn || sendingEmail} onClick={() => void requestAccountEmail('reset')}>Forgot password?</Button>
              <Button size="small" disabled={loading || signingIn || sendingEmail} onClick={() => void requestAccountEmail('confirm')}>Resend confirmation email</Button>
            </Stack>
            <Link
              component={RouterLink}
              to={registrationPath}
              underline="always"
              variant="body2"
              sx={{ display: "block", width: "fit-content", mx: "auto", color: "#087443", fontWeight: 700 }}
            >
              Create an applicant account here
            </Link>
          </Box>
        </Paper>

        <Typography
          align="center"
          sx={{
            mt: 2.5,
            color: "rgba(255,255,255,0.92)",
            fontSize: "0.78rem",
            fontWeight: 700,
            textShadow: "0 2px 12px rgba(0,0,0,0.22)",
          }}
        >
          © {new Date().getFullYear()} {COMPANY.name} · Est. {COMPANY.established} · HRIS Capstone
        </Typography>
      </Container>
    </AuthBackground>
  );
}
