import { useState } from 'react';
import { Avatar, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { profileAvatarSx } from './layouts/profileStyles';

export default function ProfilePhotoAvatar({ photo, initials }: { photo?: string | null; initials: string }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  if (!photo) return <Avatar aria-hidden="true" sx={profileAvatarSx}>{initials}</Avatar>;

  return (
    <>
      <ButtonBase aria-label="Preview profile picture" aria-haspopup="dialog" onClick={() => setPreviewOpen(true)}
        sx={{ borderRadius: '50%', flexShrink: 0, '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.dark', outlineOffset: 3 } }}>
        <Avatar aria-hidden="true" src={photo} sx={profileAvatarSx}>{initials}</Avatar>
      </ButtonBase>
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="sm" fullWidth aria-labelledby="profile-photo-preview-title">
        <DialogTitle id="profile-photo-preview-title">Profile Picture</DialogTitle>
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
