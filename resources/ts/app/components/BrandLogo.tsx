import { Box } from '@mui/material';

export default function BrandLogo({ size }: { size: number | string }) {
  return (
    <Box
      component="img"
      src="/buenaventura-logo.png"
      alt=""
      sx={{ display: 'block', width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}
