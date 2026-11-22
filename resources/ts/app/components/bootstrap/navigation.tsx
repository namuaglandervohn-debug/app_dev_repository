import { Children, cloneElement, createContext, isValidElement, useContext } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { classes, element, forwardControl, simple } from './style';

export const Tabs = forwardControl<any, { onChange?: (event: MouseEvent<HTMLButtonElement>, value: any) => void }>(({
  value, onChange, children, variant, scrollButtons, allowScrollButtonsMobile, indicatorColor,
  textColor, TabIndicatorProps, selectionFollowsFocus, ...props
}, ref) => element('div', {
  ...props, ref, role: 'tablist', className: classes('nav nav-tabs hris-tabs MuiTabs-root', props.className),
  children: Children.map(children, (child, index) => {
    if (!isValidElement<any>(child)) return child;
    const selectedValue = child.props.value ?? index;
    return cloneElement(child, { selected: selectedValue === value, onClick: (event: any) => onChange?.(event, selectedValue) });
  }),
}, { flexWrap: variant === 'scrollable' ? 'nowrap' : 'wrap' }));
export const Tab = forwardControl<any>(({
  label, icon, iconPosition, selected, wrapped, disableRipple, value, ...props
}, ref) => element('button', {
  type: 'button', ...props, ref, role: 'tab', 'aria-selected': Boolean(selected),
  className: classes('nav-link MuiTab-root', selected && 'active Mui-selected', props.className),
  children: <>{icon}{label}</>,
}));
export const Table = forwardControl<any>(({ size, stickyHeader, padding, ...props }, ref) =>
  element('table', { ...props, ref, className: classes('table hris-table MuiTable-root', size === 'small' && 'table-sm', stickyHeader && 'hris-table-sticky', props.className) }));
export const TableContainer = simple('div', 'table-responsive MuiTableContainer-root');
const TableHeadContext = createContext(false);
const TableHeadElement = simple('thead', 'MuiTableHead-root');
export const TableHead = forwardControl<any>((props, ref) =>
  <TableHeadContext.Provider value><TableHeadElement {...props} ref={ref} /></TableHeadContext.Provider>);
export const TableBody = simple('tbody', 'MuiTableBody-root');
export const TableRow = forwardControl<any>(({ hover, selected, ...props }, ref) =>
  element('tr', { ...props, ref, className: classes('MuiTableRow-root', hover && 'hris-table-hover', selected && 'table-active Mui-selected', props.className) }));
export const TableCell = forwardControl<any>(({ align, padding, variant, size, sortDirection, ...props }, ref) => {
  const isHeading = useContext(TableHeadContext);
  return element(variant === 'head' || isHeading ? 'th' : 'td', {
    ...props, ref, className: classes('MuiTableCell-root', props.className),
  }, { textAlign: align, padding: padding === 'none' ? 0 : undefined });
});
export const TablePagination = forwardControl<any, {
  onPageChange: (event: MouseEvent<HTMLButtonElement>, page: number) => void;
  onRowsPerPageChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}>(({
  count, page, rowsPerPage, rowsPerPageOptions = [10, 25, 50], onPageChange, onRowsPerPageChange,
  labelRowsPerPage = 'Rows per page', labelDisplayedRows, ActionsComponent, ...props
}, ref) => {
  const start = count ? page * rowsPerPage + 1 : 0;
  const end = Math.min(count, (page + 1) * rowsPerPage);
  return element('div', {
    ...props, ref, className: classes('hris-pagination MuiTablePagination-root', props.className),
    children: <>
      <label className="d-flex align-items-center gap-2">{labelRowsPerPage}
        <select aria-label={typeof labelRowsPerPage === 'string' ? labelRowsPerPage : 'Rows per page'} className="form-select form-select-sm w-auto" value={rowsPerPage} onChange={onRowsPerPageChange}>
          {rowsPerPageOptions.map((option: any) => <option key={option?.value ?? option} value={option?.value ?? option}>{option?.label ?? option}</option>)}
        </select>
      </label>
      <span>{labelDisplayedRows?.({ from: start, to: end, count, page }) ?? `${start}–${end} of ${count}`}</span>
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!page} onClick={event => onPageChange(event, page - 1)} aria-label="Previous page">‹</button>
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={end >= count} onClick={event => onPageChange(event, page + 1)} aria-label="Next page">›</button>
    </>,
  });
});
