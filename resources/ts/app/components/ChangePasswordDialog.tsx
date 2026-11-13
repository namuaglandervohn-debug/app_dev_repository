import { useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField, type TextFieldProps } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

function PasswordField({ label, slotProps, ...props }: TextFieldProps & { label: string }) {
  const [visible, setVisible] = useState(false);

  return <TextField {...props} label={label} type={visible ? 'text' : 'password'}
    slotProps={{
      ...slotProps,
      input: {
        endAdornment: <InputAdornment position="end">
          <IconButton type="button" edge="end" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            onMouseDown={event => event.preventDefault()} onClick={() => setVisible(value => !value)}>
            {visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
          </IconButton>
        </InputAdornment>,
      },
    }}
  />;
}

export default function ChangePasswordDialog({ required = false, onClose, onSuccess }: {
  required?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { changePassword } = useAuth();
  const submitting = useRef(false);
  const [askForCurrent, setAskForCurrent] = useState(!required);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fields = new FormData(event.currentTarget);
    const current = String(fields.get('currentPassword') ?? '');
    const password = String(fields.get('newPassword') ?? '');
    if (password !== fields.get('confirmPassword')) {
      setError('The new passwords do not match.');
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('Use a shorter password. Supabase accepts up to 72 bytes.');
      return;
    }
    if (current && current === password) {
      setError('Choose a password different from your current password.');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await changePassword(password, current);
      onSuccess?.();
    } catch (cause) {
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'current_password_required') {
        setAskForCurrent(true);
        setError('Enter your temporary password to continue.');
      } else {
        setError(cause instanceof Error ? cause.message : 'The password could not be changed. Please try again.');
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog open fullWidth maxWidth="xs" aria-labelledby="change-password-title"
      disableEscapeKeyDown={required || busy} onClose={required || busy ? undefined : onClose}>
      <form onSubmit={submit}>
        <DialogTitle id="change-password-title">
          {required ? 'Change your temporary password here first' : 'Change Password'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {askForCurrent && (
              <PasswordField autoFocus required name="currentPassword" autoComplete="current-password"
                label={required ? 'Temporary password' : 'Current password'} />
            )}
            <PasswordField autoFocus={!askForCurrent} required name="newPassword" autoComplete="new-password"
              label="New password" helperText="Use at least 8 characters." slotProps={{ htmlInput: { minLength: 8 } }} />
            <PasswordField required name="confirmPassword" autoComplete="new-password" label="Confirm new password" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={busy}>{required ? 'Sign Out' : 'Cancel'}</Button>
          <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Saving…' : 'Change Password'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
