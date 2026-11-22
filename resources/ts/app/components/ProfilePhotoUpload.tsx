import { useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from './bootstrap';
import { AddAPhotoOutlined } from './bootstrap/icons';

const PHOTO_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_LENGTH = 196608;

async function preparePhoto(file: File) {
  if (!PHOTO_TYPES.split(',').includes(file.type) || !file.size || file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose a JPG, PNG, or WebP photo up to 8 MB.');
  }

  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode().catch(() => { throw new Error('This image could not be opened. Choose another photo.'); });
    const scale = Math.min(1, 384 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the photo in this browser.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL('image/jpeg', 0.8);
    if (photo.length > MAX_PHOTO_LENGTH || !photo.startsWith('data:image/jpeg;base64,')) {
      throw new Error('Could not prepare this photo. Choose a smaller image.');
    }
    return photo;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export default function ProfilePhotoUpload({ photo, disabled, onUpload }: {
  photo?: string | null;
  disabled?: boolean;
  onUpload: (photo: string) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file?: File) => {
    if (!file || uploading || disabled) return;
    setUploading(true);
    setError('');
    try {
      await onUpload(await preparePhoto(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the profile picture. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <input hidden type="file" ref={input} accept={PHOTO_TYPES} aria-label="Choose a profile picture"
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          void upload(file);
        }} />
      <Button type="button" size="small" variant="outlined" disabled={disabled || uploading}
        startIcon={uploading ? <CircularProgress size={15} color="inherit" /> : <AddAPhotoOutlined />}
        onClick={() => input.current?.click()} sx={{ textTransform: 'none' }}>
        {uploading ? 'Uploading…' : photo ? 'Change Profile Picture' : 'Upload Profile Picture'}
      </Button>
      {error && <Typography role="alert" variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>{error}</Typography>}
    </Box>
  );
}
