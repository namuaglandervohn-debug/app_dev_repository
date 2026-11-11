const border = 'rgba(139, 184, 144, 0.24)';
const borderStrong = 'rgba(73, 156, 92, 0.32)';

export const profileCardSx = {
  borderRadius: '26px',
  border: `1px solid ${border}`,
  background: 'rgba(255, 255, 255, 0.92)',
  boxShadow: '0 20px 55px rgba(43, 91, 55, 0.10)',
};

export const profileDetailsSx = {
  borderRadius: '20px',
  border: `1px solid ${border}`,
  background: 'rgba(245, 252, 241, 0.88)',
  boxShadow: '0 12px 28px rgba(43, 91, 55, 0.08)',
};

export const profileFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '16px',
    backgroundColor: '#fbfef9',
    transition: 'all 180ms ease',
    '& fieldset': { borderColor: border },
    '&:hover fieldset': { borderColor: borderStrong },
    '&.Mui-focused fieldset': { borderColor: '#3aa865', borderWidth: 1.5 },
    '&.Mui-disabled': { backgroundColor: '#f6fbf4' },
  },
  '& .MuiInputLabel-root': { color: '#6c7d70' },
  '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#1e2d24' },
  '& .MuiFormHelperText-root': { color: '#6c7d70' },
};
