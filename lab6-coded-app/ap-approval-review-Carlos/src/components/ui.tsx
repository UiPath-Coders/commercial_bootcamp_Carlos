import type { ComponentProps, ReactNode } from 'react';

/** Shared focus ring: one teal accent for every interactive element. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

/** Icon-only button with an accessible label and a hover/focus tooltip. */
export function IconButton({
  label,
  children,
  className = '',
  tooltipSide = 'top',
  ...rest
}: ComponentProps<'button'> & { label: string; children: ReactNode; tooltipSide?: 'top' | 'bottom' | 'left' }) {
  const pos =
    tooltipSide === 'bottom'
      ? 'top-full mt-1.5 left-1/2 -translate-x-1/2'
      : tooltipSide === 'left'
        ? 'right-full mr-1.5 top-1/2 -translate-y-1/2'
        : 'bottom-full mb-1.5 left-1/2 -translate-x-1/2';
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing} ${className}`}
        {...rest}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-30 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${pos}`}
      >
        {label}
      </span>
    </span>
  );
}

export function NeutralPill({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex max-w-full items-center truncate rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
    >
      {children}
    </span>
  );
}

export function NeededPill() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950">Needed</span>
  );
}

export function EvaluationTag() {
  return (
    <span
      title="Lab 5 evaluation record"
      className="inline-flex shrink-0 items-center rounded border border-slate-200 bg-white px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-slate-500"
    >
      Evaluation data
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded bg-slate-200/80 ${className}`} />;
}
