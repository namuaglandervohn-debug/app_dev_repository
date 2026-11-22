import { Children, cloneElement, isValidElement, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Offcanvas, Overlay, Toast } from 'react-bootstrap';
import { classes, element, forwardControl, simple } from './style';

export type AlertColor = 'success' | 'info' | 'warning' | 'error';
export const Alert = forwardControl<any>(({
  severity = 'success', variant, icon, action, onClose, closeText = 'Close', children, ...props
}, ref) => {
  const tone = severity === 'error' ? 'danger' : severity;
  return element('div', { ...props, ref, role: 'alert',
    className: classes('alert hris-alert MuiAlert-root', `alert-${tone}`, variant === 'filled' && `text-bg-${tone}`, props.className),
    children: <>
      {icon !== false && <span className="MuiAlert-icon">{icon ?? <i className={`bi bi-${severity === 'success' ? 'check-circle' : severity === 'error' ? 'exclamation-circle' : severity === 'warning' ? 'exclamation-triangle' : 'info-circle'}`} aria-hidden="true" />}</span>}
      <div className="MuiAlert-message">{children}</div>
      {action ?? (onClose && <button type="button" onClick={onClose} className={classes('btn-close', variant === 'filled' && 'btn-close-white')} aria-label={closeText} />)}
    </>,
  });
});
export const Snackbar = forwardControl<any>(({
  open, autoHideDuration, onClose, anchorOrigin, message, action, children, TransitionComponent, ...props
}, ref) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open || !autoHideDuration) return;
    const timer = window.setTimeout(() => onCloseRef.current?.(null, 'timeout'), autoHideDuration);
    return () => window.clearTimeout(timer);
  }, [open, autoHideDuration, message]);
  if (!open) return null;
  const { vertical = 'bottom', horizontal = 'left' } = anchorOrigin ?? {};
  return createPortal(element('div', {
    ...props, ref, role: 'presentation', className: classes('hris-snackbar', props.className),
    children: children ?? <Toast show><Toast.Body>{message}{action}</Toast.Body></Toast>,
  }, { [vertical]: '24px', [horizontal === 'right' ? 'right' : 'left']: horizontal === 'center' ? '50%' : '24px',
    transform: horizontal === 'center' ? 'translateX(-50%)' : undefined,
  }), document.body);
});

const sizes: Record<string, string> = { xs: '360px', sm: '600px', md: '900px', lg: '1200px', xl: '1440px' };
export const Dialog = forwardControl<any>(({
  open, onClose, fullWidth, maxWidth = 'sm', fullScreen, PaperProps, pixelWidth, scroll, disableEscapeKeyDown,
  keepMounted, TransitionProps, slotProps, slots, children, sx, ...props
}, ref) => {
  const id = useId();
  const close = () => onClose?.({}, 'backdropClick');
  return element(Modal, {
    ...props, ref, sx, show: open, onHide: close, animation: false, keyboard: !disableEscapeKeyDown,
    backdrop: onClose ? true : 'static', fullscreen: fullScreen,
    centered: !fullScreen, scrollable: true, 'aria-labelledby': props['aria-labelledby'] ?? id,
    className: classes('hris-modal MuiDialog-root', props.className),
    style: { '--hris-modal-width': maxWidth === false ? 'calc(100vw - 24px)' : sizes[maxWidth], ...props.style },
    dialogClassName: classes('MuiDialog-container', fullWidth && 'hris-modal-full'),
    contentClassName: classes('MuiDialog-paper', PaperProps?.className),
    children: element('div', { sx: PaperProps?.sx ?? slotProps?.paper?.sx, id, className: 'hris-modal-content', children }),
  });
});
export const DialogTitle = simple('div', 'modal-header MuiDialogTitle-root');
export const DialogContent = forwardControl<any>(({ dividers, ...props }, ref) =>
  element('div', { ...props, ref, className: classes('modal-body MuiDialogContent-root', dividers && 'border-block', props.className) }));
export const DialogActions = forwardControl<any>(({ disableSpacing, ...props }, ref) =>
  element('div', { ...props, ref, className: classes('modal-footer MuiDialogActions-root', props.className) }));

export const Popover = forwardControl<any>(({
  anchorEl, open, onClose, anchorOrigin, transformOrigin, PaperProps, children, sx, ...props
}, ref) => (
  <Overlay show={open} target={anchorEl} placement={anchorOrigin?.horizontal === 'left' ? 'bottom-start' : 'bottom-end'}
    rootClose onHide={onClose} transition={false}>
    {({ popper, show, ...overlay }) => element('div', {
      ...props, ...overlay, ref: overlay.ref ?? ref, sx: [sx, PaperProps?.sx],
      className: classes('hris-popover MuiPopover-paper MuiPaper-root', PaperProps?.className, props.className),
      children,
    })}
  </Overlay>
));
export const Menu = forwardControl<any>(({ children, MenuListProps, ...props }, ref) =>
  <Popover {...props} ref={ref} className="dropdown-menu show hris-menu">
    <div role="menu" {...MenuListProps}>{children}</div>
  </Popover>);
export const Drawer = forwardControl<any>(({
  variant, open, onClose, anchor = 'left', ModalProps, PaperProps, children, sx, ...props
}, ref) => {
  if (variant === 'permanent' || variant === 'persistent') return element('aside', {
    ...props, ref, sx, className: classes('hris-drawer', props.className),
    children: element('div', { sx: PaperProps?.sx, className: 'hris-drawer-paper MuiDrawer-paper', children }),
  });
  return element(Offcanvas, {
    ...props, ref, sx, show: open, onHide: onClose, placement: anchor === 'right' ? 'end' : anchor === 'left' ? 'start' : anchor,
    className: classes('hris-offcanvas', props.className),
    children: element('div', { sx: PaperProps?.sx, className: 'MuiDrawer-paper', children }),
  });
});
export function Tooltip({ title, children }: any) {
  const child = Children.toArray(children)[0];
  return isValidElement<{ title?: string }>(child) && typeof title === 'string' ? cloneElement(child, { title }) : children;
}
