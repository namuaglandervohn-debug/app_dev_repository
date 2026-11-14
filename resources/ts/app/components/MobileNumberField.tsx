import { useState } from 'react';
import { InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import { isPhilippineMobileNumber, localMobileNumber, MOBILE_PREFIX } from '../lib/mobileNumber';

type MobileNumberFieldProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value?: string;
  onNumberChange?: (digits: string) => void;
};

export default function MobileNumberField({ value = '', onNumberChange, InputProps, inputProps, InputLabelProps, onBlur, error, helperText, ...props }: MobileNumberFieldProps) {
  const [edited, setEdited] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const invalid = edited && !!value && !isPhilippineMobileNumber(value);
  const message = 'Enter 10 digits starting with 9.';
  const prefix = <InputAdornment position="start">{MOBILE_PREFIX}</InputAdornment>;

  return (
    <TextField {...props} type="tel" value={localMobileNumber(value)} placeholder="9XXXXXXXXX"
      InputLabelProps={{ ...InputLabelProps, shrink: true }}
      InputProps={{ ...InputProps, startAdornment: <>{InputProps?.startAdornment}{prefix}</> }}
      inputProps={{ ...inputProps, inputMode: 'numeric', pattern: '9[0-9]{9}' }}
      onChange={event => {
        const digits = localMobileNumber(event.target.value);
        setEdited(true);
        onNumberChange?.(digits);
      }}
      onBlur={event => {
        setBlurred(true);
        onBlur?.(event);
      }}
      error={error || (blurred && invalid)}
      helperText={helperText || (blurred && invalid ? message : undefined)}
    />
  );
}
