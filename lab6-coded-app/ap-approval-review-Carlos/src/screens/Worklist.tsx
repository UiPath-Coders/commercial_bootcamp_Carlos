import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LogOut, RotateCw, Search, X } from 'lucide-react';
import { Entities } from '@uipath/uipath-typescript/entities';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONFIG } from '@/config/app';
import { useSchema } from '@/data/useSchema';
import { useInvoices } from '@/data/useInvoices';
import { useDecision } from '@/data/useDecision';
import { isSizeMarker, toInvoice, type Invoice } from '@/data/model';
import { KpiStrip } from '@/components/KpiStrip';
import { InvoiceTable } from '@/components/InvoiceTable';
import { InvoiceDetailPanel } from '@/components/InvoiceDetailPanel';
import { Banner, EmptyEntity, ErrorView, NoMatches, TableSkeleton } from '@/components/StateViews';
import { IconButton, focusRing } from '@/components/ui';

interface WorklistProps {
  onSignOut: () => void;
}

/** Screen 2: the AP reviewer worklist over AP_Invoice_Carlos. */
export function Worklist({ onSignOut }: WorklistProps) {
  const { sdk, userEmail, profileWarning, login } = useAuth();
  const schema = useSchema();
  const inv = useInvoices(schema.has);
  const decision = useDecision();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Record ids already re-read in full, so an empty package is fetched once, not on every render. */
  const fetchedFull = useRef(new Set<string>());

  const selected = inv.all.find((r) => r.id === selectedId) ?? null;
  const loading = inv.status === 'loading' || inv.status === 'idle';
  const error = inv.error ?? schema.error;

  const refresh = useCallback(async () => {
    await Promise.all([schema.reload(), inv.reload()]);
  }, [schema, inv]);

  // List reads may return a preview (or nothing) for long text; load the full record when a row opens.
  useEffect(() => {
    if (!selected) return;
    const pkg = selected.approvalPackageJson;
    if (!isSizeMarker(pkg) && (pkg.trim() !== '' || fetchedFull.current.has(selected.id))) return;
    fetchedFull.current.add(selected.id);
    let cancelled = false;
    new Entities(sdk)
      .getRecordByName(APP_CONFIG.entityName, selected.id)
      .then((full) => {
        if (!cancelled) inv.replaceInvoice(toInvoice(full));
      })
      .catch(() => {
        /* the panel shows the preview notice */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.approvalPackageJson, sdk]);

  const open = (row: Invoice) => {
    setSelectedId(row.id);
    setNotice(null);
    decision.clearError();
  };

  const onDecided = (next: Invoice, warning: string | null) => {
    inv.replaceInvoice(next);
    setNotice(warning ?? `Saved: ${next.invoiceNumber} is now ${next.lifecycleState}.`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-slate-900">Invoice approvals</h1>
          <span className="hidden truncate font-mono text-xs text-slate-500 sm:inline" title="Data Fabric entity">
            {APP_CONFIG.entityName}
          </span>
          {userEmail && <span className="hidden max-w-[16rem] truncate text-xs text-slate-500 md:inline">{userEmail}</span>}
          <IconButton label="Sign out" onClick={onSignOut} tooltipSide="bottom">
            <LogOut className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
        <KpiStrip kpis={inv.kpis} loading={loading || schema.status === 'loading'} />

        {schema.missingUiFields.length > 0 && (
          <Banner>
            Data integrity: {APP_CONFIG.entityName} is missing <span className="font-mono font-medium">{schema.missingUiFields.join(', ')}</span>. Lifecycle,
            recommendation and review columns cannot be trusted until the field{schema.missingUiFields.length > 1 ? 's are' : ' is'} added.
          </Banner>
        )}
        {profileWarning && <Banner>{profileWarning}</Banner>}
        {inv.reachedCap && (
          <Banner tone="info">Only the first {APP_CONFIG.fetchPageSize * APP_CONFIG.maxFetchPages} records were loaded; KPIs cover those rows.</Banner>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <label htmlFor="invoice-search" className="sr-only">
              Search by vendor name or invoice number
            </label>
            <input
              id="invoice-search"
              type="search"
              value={inv.search}
              onChange={(e) => inv.setSearch(e.target.value)}
              placeholder="Search vendor or invoice number"
              className={`w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm placeholder:text-slate-400 ${focusRing}`}
            />
            {inv.search && (
              <span className="absolute right-1 top-1/2 -translate-y-1/2">
                <IconButton label="Clear search" onClick={() => inv.setSearch('')} className="h-7 w-7">
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </span>
            )}
          </div>
          {/* Room for a lifecycle filter later. */}
          <div className="flex-1" />
          <span className="font-mono text-xs text-slate-400" aria-live="polite">
            {inv.refreshedAt ? `Updated ${inv.refreshedAt.toLocaleTimeString()}` : ''}
          </span>
          <IconButton label="Refresh" onClick={refresh} disabled={loading}>
            <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </IconButton>
        </div>

        {error && inv.status === 'error' && inv.all.length > 0 && (
          <Banner>
            Refresh failed: {error.message}{' '}
            {error.kind === 'auth' ? (
              <button type="button" onClick={login} className={`font-medium underline ${focusRing}`}>
                Sign in again
              </button>
            ) : (
              <button type="button" onClick={refresh} className={`font-medium underline ${focusRing}`}>
                Retry
              </button>
            )}
          </Banner>
        )}

        {error && inv.status !== 'ready' && inv.all.length === 0 ? (
          <ErrorView error={error} onRetry={refresh} onSignIn={login} />
        ) : loading && inv.all.length === 0 ? (
          <TableSkeleton />
        ) : inv.all.length === 0 ? (
          <EmptyEntity entityName={APP_CONFIG.entityName} onRetry={refresh} />
        ) : inv.filtered.length === 0 ? (
          <NoMatches query={inv.search} onClear={() => inv.setSearch('')} />
        ) : (
          <>
            {schema.error && <Banner>Schema check failed ({schema.error.message}); field coverage below is based on the loaded rows only.</Banner>}
            <InvoiceTable
              rows={inv.page}
              sort={inv.sort}
              onSort={inv.toggleSort}
              coverage={inv.coverage}
              has={schema.has}
              selectedId={selectedId}
              onSelect={open}
            />
            <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>
                Showing <span className="font-medium text-slate-900">{inv.pageIndex * APP_CONFIG.pageSize + 1}</span>–
                <span className="font-medium text-slate-900">{Math.min((inv.pageIndex + 1) * APP_CONFIG.pageSize, inv.filtered.length)}</span> of{' '}
                <span className="font-medium text-slate-900">{inv.filtered.length}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => inv.setPageIndex(inv.pageIndex - 1)}
                  disabled={inv.pageIndex === 0}
                  className={`inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
                </button>
                {Array.from({ length: inv.pageCount }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => inv.setPageIndex(i)}
                    aria-current={i === inv.pageIndex ? 'page' : undefined}
                    aria-label={`Page ${i + 1}`}
                    className={`h-8 min-w-8 rounded-md px-2 font-mono text-xs ${focusRing} ${
                      i === inv.pageIndex ? 'bg-accent-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => inv.setPageIndex(inv.pageIndex + 1)}
                  disabled={inv.pageIndex >= inv.pageCount - 1}
                  className={`inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                >
                  Next <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </nav>
          </>
        )}
      </main>

      {selected && (
        <>
          <div aria-hidden className="fixed inset-0 z-10 hidden bg-slate-900/20 sm:block" onClick={() => setSelectedId(null)} />
          <InvoiceDetailPanel
            invoice={selected}
            schemaOk={schema.canWriteDecision}
            has={schema.has}
            reviewerEmail={userEmail}
            decision={decision}
            onDecided={onDecided}
            notice={notice}
            onClose={() => setSelectedId(null)}
            onSignIn={login}
          />
        </>
      )}
    </div>
  );
}
