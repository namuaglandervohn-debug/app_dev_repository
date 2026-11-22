import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useId, useState } from 'react';
import type { ChangeEvent, FocusEvent, KeyboardEvent, ReactElement, ReactNode, Ref } from 'react';
import { Form } from 'react-bootstrap';
import { classes, element, forwardControl, simple } from './style';

export type TextFieldProps = {
  type?: string; value?: any; onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>; inputProps?: React.InputHTMLAttributes<HTMLInputElement> & Record<string, unknown>;
  InputProps?: any; InputLabelProps?: any;
  [key: string]: any;
};
export const FormControl = forwardControl<any>(({ fullWidth, size, variant, error, disabled, required, ...props }, ref) =>
  element('div', { ...props, ref, className: classes('hris-form MuiFormControl-root', fullWidth && 'w-100', props.className) }));
export const InputLabel = forwardControl<any>(({ shrink, required, ...props }, ref) =>
  element('label', { ...props, ref, className: classes('form-label MuiInputLabel-root', props.className) }));
export const InputAdornment = forwardControl<any>(({ position, disablePointerEvents, ...props }, ref) =>
  element('span', { ...props, ref, className: classes('input-group-text MuiInputAdornment-root', props.className) }, { pointerEvents: disablePointerEvents ? 'none' : undefined }));
export const MenuItem = forwardControl<any>(({ dense, divider, selected, value, ...props }, ref) =>
  element('button', { type: 'button', ...props, ref, className: classes('dropdown-item MuiMenuItem-root', selected && 'Mui-selected active', props.className) }));
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}
type SelectOption = ReactElement<{ value?: string | number }>;
function selectOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap<SelectOption>(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.props.value === undefined) return selectOptions(child.props.children);
    return [<option key={child.key ?? String(child.props.value)} value={child.props.value} disabled={child.props.disabled}>{textOf(child.props.children)}</option>];
  });
}
export const Select = forwardControl<any, { onChange?: (event: ChangeEvent<HTMLSelectElement>) => void }>(({
  children, label, labelId, labelPlacement, size, variant, displayEmpty, renderValue, MenuProps, IconComponent,
  fullWidth, native, inputProps, input, sx, className, ...props
}, ref) => {
  const options = selectOptions(children);
  const needsPlaceholder = !props.multiple && (props.value === '' || props.defaultValue === '')
    && !options.some(option => option.props.value === '');
  return element(Form.Select, {
    ...props, ...inputProps, ref, sx, size: size === 'small' ? 'sm' : size === 'large' ? 'lg' : undefined,
    'aria-labelledby': labelId, 'aria-label': labelId ? undefined : label,
    className: classes('MuiInputBase-root MuiOutlinedInput-root MuiSelect-root', fullWidth && 'w-100', className),
    children: <>{needsPlaceholder && <option value="" disabled>{label ? `Select ${String(label).toLowerCase()}` : 'Select an option'}</option>}{options}</>,
  });
});

export const TextField = forwardControl<HTMLDivElement, TextFieldProps>(({
  id, children, label, helperText, multiline, rows, minRows, maxRows, select, fullWidth, error,
  InputProps = {}, InputLabelProps, inputProps, SelectProps, FormHelperTextProps, slotProps, slots,
  inputRef, variant, margin, color, size, sx, className, autoFocus, disabled, required, ...props
}, ref) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = helperText ? fieldId + '-help' : undefined;
  const { startAdornment, endAdornment, readOnly, ref: groupRef, inputProps: nestedInput, sx: inputStyles, ...groupProps } = { ...InputProps, ...slotProps?.input };
  const field = {
    ...props, ...nestedInput, ...inputProps, ...slotProps?.htmlInput,
    id: fieldId, ref: inputRef, size: size === 'small' ? 'sm' : undefined, disabled, required,
    autoFocus, readOnly, 'aria-describedby': helperId ?? inputProps?.['aria-describedby'],
    isInvalid: error, className: classes('MuiInputBase-input MuiOutlinedInput-input', inputProps?.className),
  };
  return element('div', {
    ref, sx, className: classes('hris-form MuiFormControl-root MuiTextField-root', fullWidth && 'w-100', disabled && 'Mui-disabled', className),
    children: <>
      {label != null && <InputLabel htmlFor={fieldId} className={classes(disabled && 'Mui-disabled', error && 'Mui-error')}>{label}</InputLabel>}
      {element('div', {
        ref: groupRef, sx: inputStyles, className: classes('hris-field MuiInputBase-root MuiOutlinedInput-root', disabled && 'Mui-disabled', error && 'Mui-error', (startAdornment || endAdornment) && 'input-group', groupProps.className),
        children: <>
          {startAdornment}
          {select ? <Select {...field} {...SelectProps} label={label} size={size}>{children}</Select>
            : <Form.Control {...field} as={multiline ? 'textarea' : 'input'} rows={multiline ? rows ?? minRows ?? 2 : undefined} />}
          {endAdornment}
        </>,
      })}
      {helperText && <div id={helperId} className={classes('form-text MuiFormHelperText-root', error && 'text-danger', FormHelperTextProps?.className)}>{helperText}</div>}
    </>,
  }, { marginBlock: margin === 'normal' ? '12px' : margin === 'dense' ? '6px' : undefined });
});

const RadioContext = createContext<{ name: string; value: any; onChange?: (e: any, value: string) => void } | null>(null);
const LabelContext = createContext<string | undefined>(undefined);
export const RadioGroup = forwardControl<any, { onChange?: (event: ChangeEvent<HTMLInputElement>, value: string) => void }>(({ row, value, name, onChange, defaultValue, children, ...props }, ref) => {
  const id = useId();
  const [internal, setInternal] = useState(defaultValue);
  return <RadioContext.Provider value={{ name: name ?? id, value: value ?? internal, onChange: (event, selected) => {
    if (value === undefined) setInternal(selected);
    onChange?.(event, selected);
  } }}>{element('div', { ...props, ref, role: 'radiogroup', children }, { display: 'flex', flexDirection: row ? 'row' : 'column' })}</RadioContext.Provider>;
});
export const FormGroup = simple('div', 'form-group');
export function FormControlLabel({ control, label, labelPlacement, disabled, value, onChange, sx, ...props }: any) {
  const input = isValidElement<{ disabled?: boolean; onChange?: (event: ChangeEvent<HTMLInputElement>) => void }>(control)
    ? cloneElement(control, { disabled: disabled ?? control.props.disabled, onChange: control.props.onChange ?? onChange })
    : control;
  return <LabelContext.Provider value={value}>{element('label', {
    ...props, sx, className: classes('hris-control-label MuiFormControlLabel-root', props.className),
    children: <>{labelPlacement === 'start' && label}{input}{labelPlacement !== 'start' && <span className="MuiFormControlLabel-label">{label}</span>}</>,
  })}</LabelContext.Provider>;
}
function checkInput(type: 'checkbox' | 'radio') {
  return forwardControl<HTMLInputElement, { onChange?: (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void }>(({
    size, color, icon, checkedIcon, indeterminateIcon, indeterminate, disableRipple, checked, onChange, inputProps, value, className, ...props
  }, ref) => {
    const radio = useContext(RadioContext);
    const inheritedValue = useContext(LabelContext);
    const selectedValue = value ?? inheritedValue;
    const change = (event: ChangeEvent<HTMLInputElement>) => {
      onChange?.(event, event.target.checked);
      if (type === 'radio') radio?.onChange?.(event, event.target.value);
    };
    return element('input', {
      ...props, ...inputProps,
      ref: (node: HTMLInputElement | null) => {
        if (node && type === 'checkbox') node.indeterminate = Boolean(indeterminate);
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      type, value: selectedValue, name: props.name ?? (type === 'radio' ? radio?.name : undefined),
      checked: checked ?? (type === 'radio' && radio ? radio.value === selectedValue : undefined), onChange: change,
      'aria-checked': indeterminate ? 'mixed' : undefined,
      className: classes('form-check-input hris-check', type === 'radio' ? 'MuiRadio-root' : 'MuiCheckbox-root', checked && 'Mui-checked', className),
    }, { width: size === 'small' ? '1em' : '1.15em', height: size === 'small' ? '1em' : '1.15em' });
  });
}
export const Checkbox = checkInput('checkbox');
export const Radio = checkInput('radio');
export const Slider = forwardControl<any, { onChange?: (event: ChangeEvent<HTMLInputElement>, value: number) => void }>(({ value, onChange, onChangeCommitted, valueLabelDisplay, marks, size, color, ...props }, ref) =>
  element('input', {
    ...props, ref, type: 'range', value, className: classes('form-range MuiSlider-root', props.className),
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange?.(event, event.target.valueAsNumber),
    onPointerUp: (event: any) => onChangeCommitted?.(event, event.currentTarget.valueAsNumber),
  }));

export function Autocomplete<T, Multiple extends boolean = false>(props: {
  options: readonly T[]; value?: any; getOptionLabel?: (option: T) => string;
  multiple?: Multiple;
  isOptionEqualToValue?: (option: T, value: T) => boolean;
  onChange?: (event: any, value: Multiple extends true ? T[] : T | null) => void;
  onInputChange?: (event: any, value: string, reason: string) => void;
  renderOption?: (props: any, option: T, info: { selected: boolean }) => ReactNode;
  renderInput: (params: any) => ReactNode; [key: string]: any;
}) {
  const {
    options, value, inputValue, multiple, freeSolo, disableCloseOnSelect, disableClearable, disabled,
    getOptionLabel = (option: T) => String(option ?? ''), isOptionEqualToValue = (a: T, b: T) => a === b,
    onChange, onInputChange, renderOption, renderInput, noOptionsText = 'No options', sx,
  } = props;
  const id = useId();
  const [open, setOpen] = useState(false);
  const selectedLabel = multiple || value == null ? '' : getOptionLabel(value);
  const [draft, setDraft] = useState(selectedLabel);
  const [active, setActive] = useState(0);
  useEffect(() => { if (!open) setDraft(selectedLabel); }, [selectedLabel, open]);
  const query = inputValue ?? draft;
  const selected = (option: T) => multiple ? (value ?? []).some((entry: T) => isOptionEqualToValue(option, entry))
    : value != null && isOptionEqualToValue(option, value);
  const filtered = options.filter(option => !query || (!multiple && query === selectedLabel) || getOptionLabel(option).toLowerCase().includes(query.toLowerCase()));
  const choose = (event: any, option: T) => {
    const next = multiple ? selected(option) ? (value ?? []).filter((entry: T) => !isOptionEqualToValue(option, entry)) : [...(value ?? []), option] : option;
    onChange?.(event, next);
    const text = multiple ? '' : getOptionLabel(option);
    setDraft(text);
    onInputChange?.(event, text, 'reset');
    if (!multiple || !disableCloseOnSelect) setOpen(false);
  };
  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (open) setActive(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % Math.max(1, filtered.length));
    } else if (event.key === 'Enter' && open && (filtered[active] !== undefined || (freeSolo && query))) {
      event.preventDefault();
      choose(event, filtered[active] ?? query as T);
    } else if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };
  return element('div', {
    sx, className: 'hris-autocomplete MuiAutocomplete-root',
    children: <>
      {renderInput({
        id, disabled,
        InputProps: {
          startAdornment: multiple && value?.length > 0 ? <span className="hris-autocomplete-values">{value.map(getOptionLabel).join(', ')}</span> : null,
          endAdornment: <button type="button" className="hris-button-base px-2" aria-label={open ? 'Close options' : 'Open options'}
            disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { document.getElementById(id)?.focus(); setOpen(!open); }}>▾</button>,
        },
        inputProps: {
          role: 'combobox', 'aria-expanded': open, 'aria-autocomplete': 'list', 'aria-controls': id + '-options',
          'aria-activedescendant': open && filtered[active] !== undefined ? id + '-' + active : undefined,
          autoComplete: 'off', ...(multiple && value?.length ? { required: false } : {}),
          value: query,
          onFocus: () => { setOpen(true); setActive(0); },
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            setOpen(false);
            if (freeSolo && draft !== selectedLabel && !multiple) onChange?.(event, draft as any);
          },
          onChange: (event: ChangeEvent<HTMLInputElement>) => {
            const text = event.target.value;
            setDraft(text); setActive(0); setOpen(true);
            onInputChange?.(event, text, 'input');
            if (!text && !disableClearable && !multiple && !freeSolo) onChange?.(event, null as any);
          },
          onKeyDown: handleKey,
        },
      })}
      {open && !disabled && <ul className="dropdown-menu show hris-options" role="listbox" id={id + '-options'} aria-multiselectable={multiple || undefined}>
        {!filtered.length && <li className="dropdown-item disabled">{noOptionsText}</li>}
        {filtered.map((option, index) => {
          const itemProps = {
            id: id + '-' + index, role: 'option', 'aria-selected': selected(option),
            className: classes('dropdown-item', index === active && 'active'),
            onMouseEnter: () => setActive(index),
            onMouseDown: (event: any) => event.preventDefault(),
            onClick: (event: any) => choose(event, option),
          };
          return <Option key={index}>{renderOption ? renderOption(itemProps, option, { selected: selected(option) }) : <li {...itemProps}>{getOptionLabel(option)}</li>}</Option>;
        })}
      </ul>}
    </>,
  });
}
function Option({ children }: { children: ReactNode }) { return <>{children}</>; }
