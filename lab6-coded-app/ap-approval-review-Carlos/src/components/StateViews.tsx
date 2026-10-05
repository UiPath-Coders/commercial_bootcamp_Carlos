import type { ReactNode } from 'react';
import { AlertTriangle, CloudOff, Inbox, LockKeyhole, RotateCw, SearchX } from 'lucide-react';
import type { AppError } from '@/data/errors';
import { Skeleton, focusRing } from './ui';

function Frame({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden>
        {icon}
      </span>
      <h2 className="font-display text-base font-semibold text-slate-900">{title}</h2>
      <div className="max-w-md break-words text-sm text-slate-600">{children}</div>
      {action}
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-1 inline-flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 ${focusRing}`}
    >
      {children}
    </button>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading invoices" className="rounded-lg border border-slate-200 bg-white">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-3 py-3 last:border-b-0">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="hidden h-5 w-28 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function EmptyEntity({ entityName, onRetry }: { entityName: string; onRetry: () => void }) {
  return (
    <Frame icon={<Inbox className="h-5 w-5" />} title="No invoices yet" action={<ActionButton onClick={onRetry}><RotateCw className="h-4 w-4" aria-hidden /> Refresh</ActionButton>}>
      {entityName} has no records. Run the Lab 2 intake robot to load invoices, then refresh.
    </Frame>
  );
}

export function NoMatches({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <Frame icon={<SearchX className="h-5 w-5" />} title="No matching invoices" action={<ActionButton onClick={onClear}>Clear search</ActionButton>}>
      Nothing matches “{query}” by vendor name or invoice number.
    </Frame>
  );
}

export function ErrorView({ error, onRetry, onSignIn }: { error: AppError; onRetry: () => void; onSignIn: () => void }) {
  if (error.kind === 'auth') {
    return (
      <Frame icon={<LockKeyhole className="h-5 w-5" />} title="Sign-in needed" action={<ActionButton onClick={onSignIn}>Sign in again</ActionButton>}>
        {error.message}
      </Frame>
    );
  }
  return (
    <Frame
      icon={error.kind === 'forbidden' ? <AlertTriangle className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
      title={error.kind === 'forbidden' ? 'Access denied' : error.kind === 'not-found' ? 'Entity not found' : 'Data Fabric is not responding'}
      action={<ActionButton onClick={onRetry}><RotateCw className="h-4 w-4" aria-hidden /> Retry</ActionButton>}
    >
      {error.message}
      {error.status ? <span className="mt-1 block font-mono text-xs text-slate-400">HTTP {error.status}</span> : null}
    </Frame>
  );
}

export function Banner({ children, tone = 'warning' }: { children: ReactNode; tone?: 'warning' | 'info' }) {
  return (
    <div
      role={tone === 'warning' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
        tone === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-700'
      }`}
    >
      <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'warning' ? 'text-amber-600' : 'text-slate-400'}`} aria-hidden />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}
