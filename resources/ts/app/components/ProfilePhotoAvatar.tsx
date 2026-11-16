import { useId, useState } from 'react';
import { Avatar, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, type SxProps, type Theme } from '@mui/material';
import { profileAvatarSx } from './layouts/profileStyles';

export default function ProfilePhotoAvatar({ photo, initials, name, sx = profileAvatarSx }: {
  photo?: string | null;
  initials?: string;
  name?: string;
  sx?: SxProps<Theme>;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const titleId = useId();
  const fallback = initials ?? (name?.trim().charAt(0).toUpperCase() || '?');
  if (!photo) return <Avatar aria-hidden="true" sx={sx}>{fallback}</Avatar>;

  return (
    <>
      <ButtonBase type="button" aria-label={name ? `Preview profile picture for ${name}` : 'Preview profile picture'} aria-haspopup="dialog"
        onClick={event => { event.stopPropagation(); setPreviewOpen(true); }}
        sx={{ borderRadius: '50%', flexShrink: 0, '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.dark', outlineOffset: 3 } }}>
        <Avatar aria-hidden="true" src={photo} sx={sx}>{fallback}</Avatar>
      </ButtonBase>
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="sm" fullWidth aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}>
        <DialogTitle id={titleId}>{name || 'Profile Picture'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', bgcolor: '#f6fbf7' }}>
          <Box component="img" src={photo} alt="Profile picture"
            sx={{ display: 'block', width: '100%', maxHeight: '65vh', objectFit: 'contain', p: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
