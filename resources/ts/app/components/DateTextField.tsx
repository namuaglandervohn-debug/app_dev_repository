import { useRef, useState, type ChangeEvent } from 'react';
import { Box, IconButton, InputAdornment, TextField as MuiTextField, type TextFieldProps } from '@mui/material';
import { CalendarMonthOutlined } from '@mui/icons-material';
import { formatDisplayDate, parseDisplayDate } from '../lib/displayDate';

// Keep ISO values at the form boundary and render the same date order in every browser locale.
export default function DateTextField({ type, ...props }: TextFieldProps) {
  return type === 'date' ? <FormattedDateField {...props} /> : <MuiTextField type={type} {...props} />;
}

function FormattedDateField({ value, onChange, onBlur, inputProps, InputProps, InputLabelProps, ...props }: TextFieldProps) {
  const isoValue = String(value ?? '');
  const [draft, setDraft] = useState<string | null>(null);
  const calendar = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLInputElement>(null);
  const min = inputProps?.min as string | undefined;
  const max = inputProps?.max as string | undefined;
  const isAllowed = (iso: string) => (!min || iso >= min) && (!max || iso <= max);
  const displayed = draft ?? formatDisplayDate(isoValue, isoValue === '—' ? isoValue : '');
  const draftDate = draft && parseDisplayDate(draft);
  const invalid = Boolean(draft && (!draftDate || !isAllowed(draftDate)));
  const [blurred, setBlurred] = useState(false);
  const invalidMessage = 'Enter a valid date in MM/DD/YYYY format within the allowed range.';

  function emit(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, iso: string) {
    const field = { value: iso, name: event.target.name, id: event.target.id };
    onChange?.({ ...event, target: field, currentTarget: field } as ChangeEvent<HTMLInputElement>);
  }

  return (
    <Box sx={{ position: 'relative', width: props.fullWidth ? '100%' : undefined }}>
      <MuiTextField
        {...props}
        type="text"
        value={displayed}
        placeholder="MM/DD/YYYY"
        inputRef={textInput}
        InputLabelProps={{ ...InputLabelProps, shrink: true }}
        inputProps={{ ...inputProps, min: undefined, max: undefined, inputMode: 'numeric', maxLength: 10 }}
        InputProps={{
          ...InputProps,
          endAdornment: !props.disabled && !InputProps?.readOnly && !inputProps?.readOnly ? (
            <InputAdornment position="end">
              <IconButton type="button" size="small" aria-label={typeof props.label === 'string' ? `Open calendar for ${props.label}` : 'Open calendar'}
                onClick={() => {
                  const input = calendar.current;
                  try {
                    if (typeof input?.showPicker === 'function') input.showPicker();
                    else input?.click();
                  } catch {
                    textInput.current?.focus();
                  }
                }}>
                <CalendarMonthOutlined fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : InputProps?.endAdornment,
        }}
        onChange={event => {
          const input = event.target.value;
          const text = /^\d{4}-\d{2}-\d{2}$/.test(input) ? formatDisplayDate(input) : input;
          if (!/^[\d/]*$/.test(text)) return;
          const iso = parseDisplayDate(text);
          setDraft(text);
          const nextValue = iso && isAllowed(iso) ? iso : '';
          event.target.setCustomValidity(text && !nextValue ? invalidMessage : '');
          if (nextValue !== isoValue) emit(event, nextValue);
        }}
        onBlur={event => {
          if (!invalid) setDraft(null);
          setBlurred(true);
          onBlur?.(event);
        }}
        error={props.error || (blurred && invalid)}
        helperText={props.helperText || (blurred && invalid ? invalidMessage : undefined)}
      />
      <input type="date" ref={calendar} tabIndex={-1} aria-hidden="true" disabled={props.disabled}
        value={isoValue} min={min} max={max}
        style={{ position: 'absolute', insetInlineEnd: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={event => {
          setDraft(null);
          textInput.current?.setCustomValidity('');
          onChange?.({ ...event, target: { value: event.target.value, name: props.name, id: props.id } } as ChangeEvent<HTMLInputElement>);
        }} />
    </Box>
  );
}
