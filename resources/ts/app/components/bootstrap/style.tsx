import { jsx } from '@emotion/react';
import { forwardRef, useEffect, useState } from 'react';
import type { CSSObject } from '@emotion/react';
import type { ChangeEvent, DragEvent, ForwardedRef, MouseEvent, ReactNode, Ref } from 'react';

const breakpoints = { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 };
type Breakpoint = keyof typeof breakpoints;
export const useTheme = () => theme;
export const theme = {
  palette: { error: { main: '#b73e2d' } },
  breakpoints: {
    up: (key: Breakpoint) => `(min-width: ${breakpoints[key]}px)`,
    down: (key: Breakpoint) => `(max-width: ${breakpoints[key] - 0.05}px)`,
  },
  transitions: {
    duration: { shorter: 200 },
    create: (properties: string | string[], { duration = 200 } = {}) =>
      [properties].flat().map(property => `${property} ${duration}ms ease`).join(', '),
  },
};
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}
export const lighten = (color: string, ratio: number) => `color-mix(in srgb, ${color}, white ${ratio * 100}%)`;
type StyleObject<T> = {
  [property: string]: string | number | boolean | null | undefined | StyleObject<T> | readonly unknown[] | ((value: T) => unknown);
};
export type SxProps<T = Theme> = StyleObject<T> | ((value: T) => StyleObject<T>) | readonly (StyleObject<T> | ((value: T) => StyleObject<T>) | false)[];
export type Theme = typeof theme;

const spacing: Record<string, string[]> = {
  m: ['margin'], mt: ['marginTop'], mr: ['marginRight'], mb: ['marginBottom'], ml: ['marginLeft'],
  mx: ['marginInline'], my: ['marginBlock'], p: ['padding'], pt: ['paddingTop'], pr: ['paddingRight'],
  pb: ['paddingBottom'], pl: ['paddingLeft'], px: ['paddingInline'], py: ['paddingBlock'],
  margin: ['margin'], padding: ['padding'], gap: ['gap'], rowGap: ['rowGap'], columnGap: ['columnGap'],
};
const tokens: Record<string, string> = {
  'text.primary': '#13261a', 'text.secondary': '#54705f', 'background.default': '#f2f7f3',
  'background.paper': '#fff', 'primary.main': '#1f7a47', 'primary.dark': '#13522f',
  'primary.contrastText': '#fff', 'text.disabled': '#88998e', primary: '#1f7a47',
  'secondary.main': '#d9a441', 'success.main': '#2e8b57', 'error.main': '#b73e2d',
  'warning.main': '#d9a441', 'info.main': '#2f8f8b', divider: 'rgba(31,122,71,.12)',
  'action.hover': 'rgba(31,122,71,.07)', 'action.disabled': 'rgba(19,38,26,.38)', 'action.selected': 'rgba(31,122,71,.11)',
};
const resolveValue = (key: string, value: any) => {
  if (typeof value === 'function') value = value(theme);
  if (typeof value === 'string') return tokens[value] ?? value;
  if (typeof value !== 'number') return value;
  if (key in spacing || /^(?:margin|padding)(?:Top|Right|Bottom|Left|Inline|Block)/.test(key)) return value * 8;
  if (key === 'borderRadius') return value * 12;
  if (/^(?:min|max)?(?:Width|Height)$/i.test(key) && value > 0 && value <= 1) return `${value * 100}%`;
  if (key === 'boxShadow') return value ? '0 6px 24px rgba(15,23,42,.12)' : 'none';
  if (/^border(?:Top|Right|Bottom|Left)?$/.test(key)) return value ? `${value}px solid` : 0;
  return value;
};
export function styles(input: any): CSSObject {
  if (!input) return {};
  if (typeof input === 'function') return styles(input(theme));
  if (Array.isArray(input)) return Object.assign({}, ...input.map(styles));
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    const properties = spacing[key] ?? [key === 'bgcolor' ? 'backgroundColor' : key];
    if (value && typeof value === 'object') {
      const entries = Array.isArray(value) ? Object.keys(breakpoints).map((k, n) => [k, value[n]]) : Object.entries(value);
      if (entries.length && entries.every(([at]) => at in breakpoints)) {
        for (const [at, item] of entries) {
          if (item == null) continue;
          const min = breakpoints[at as Breakpoint];
          const target = min ? (result[`@media (min-width: ${min}px)`] ??= {}) : result;
          for (const property of properties) target[property] = resolveValue(key, item);
        }
      } else result[key] = styles(value);
    } else for (const property of properties) result[property] = resolveValue(key, value);
  }
  return result;
}

const styleProps = new Set([
  ...Object.keys(spacing), 'alignItems', 'alignContent', 'alignSelf', 'bgcolor', 'border', 'borderColor',
  'borderRadius', 'bottom', 'boxShadow', 'color', 'display', 'flex', 'flexDirection', 'flexGrow',
  'flexShrink', 'flexWrap', 'fontSize', 'fontWeight', 'height', 'justifyContent', 'left', 'lineHeight',
  'maxHeight', 'maxWidth', 'minHeight', 'minWidth', 'overflow', 'position', 'right', 'textAlign', 'top', 'width', 'zIndex',
]);
export const classes = (...values: unknown[]) => values.filter(value => typeof value === 'string' && value).join(' ');
export type ControlProps = {
  sx?: SxProps;
  onClick?: (event: MouseEvent<any>) => void;
  onMouseDown?: (event: MouseEvent<any>) => void;
  onDragOver?: (event: DragEvent<any>) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};
export function forwardControl<T, P = ControlProps>(
  render: (props: P & Record<string, any>, ref: ForwardedRef<T>) => ReactNode,
) {
  // Preserve named callback types while permitting HTML and styling props.
  return forwardRef<T, any>(render) as (props: P & Record<string, any> & { ref?: Ref<T> }) => ReactNode;
}
export function element(tag: any, props: any = {}, base?: any) {
  const { component, sx, ...rest } = props;
  const shorthand: Record<string, unknown> = {};
  for (const key of Object.keys(rest)) {
    if (styleProps.has(key)) {
      shorthand[key] = rest[key];
      delete rest[key];
    }
  }
  return jsx(component ?? tag, { ...rest, css: [styles(base), styles(shorthand), styles(sx)] });
}
export function simple(tag: any, className?: string, base?: any) {
  return forwardControl<any>(({ className: extra, ...props }, ref) =>
    element(tag, { ...props, ref, className: classes(className, extra) }, base));
}
