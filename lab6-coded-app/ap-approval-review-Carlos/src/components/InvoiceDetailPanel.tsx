import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, Info, Loader2, LogIn, RotateCw, X } from 'lucide-react';
import { DETAIL_GROUPS, F, type FieldName } from '@/data/fields';
import { date, decisionAvailability, formatDateTime, isEmptyValue, isEvaluationRow, readField, type DecisionKind, type Invoice } from '@/data/model';
import type { DecisionState } from '@/data/useDecision';
import { ApprovalPackageView } from './ApprovalPackageView';
import { ConfirmDialog } from './ConfirmDialog';
import { EvaluationTag, IconButton, focusRing } from './ui';

interface Props {
  invoice: Invoice;
  schemaOk: boolean;
  /** False when the live schema is known and lacks the field. */
  has: (f: FieldName) => boolean;
  reviewerEmail: string | null;
  decision: DecisionState;
  /** Called after a successful write with the updated row. */
  onDecided: (next: Invoice, warning: string | null) => void;
  notice: string | null;
  onClose: () => void;
  /** Restart sign-in after a 401 on a write. */
  onSignIn: () => void;
}

const DATE_ONLY = new Set<string>([F.InvoiceDate, F.DueDate]);
const TIMESTAMPS = new Set<string>([F.ProcessedTimestamp, F.AgentProcessedAt, F.ReviewedAt, F.CreateTime, F.UpdateTime]);
const MONO = new Set<string>([F.InvoiceNumber, F.PONumber, F.TotalAmount, F.Currency, F.GLAccount, F.CostCenter, F.ReceiptReference]);
/** Rendered by ApprovalPackageView, not as a raw value. */
const PACKAGE_FIELD = F.ApprovalPackageJson;

function formatValue(field: string, v: unknown): string {
  if (isEmptyValue(v)) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (field === F.VendorTaxId) {
    const s = String(v);
    return s.length > 4 ? `•••• ${s.slice(-4)}` : '••••';
  }
  if (DATE_ONLY.has(field)) return date(v)?.toISOString().slice(0, 10) ?? String(v);
  if (TIMESTAMPS.has(field)) return formatDateTime(date(v));
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function FieldRow({ field, value, absent = false }: { field: string; value: unknown; absent?: boolean }) {
  if (absent) {
    return (
      <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 py-1.5 text-sm">
        <dt className="truncate text-slate-500" title={field}>
          {field}
        </dt>
        <dd className="min-w-0 break-words text-xs italic leading-5 text-slate-400">Field {field} is not in the schema</dd>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <dt className="truncate text-slate-500" title={field}>
        {field}
      </dt>
      <dd className={`min-w-0 break-words text-slate-900 ${MONO.has(field) || TIMESTAMPS.has(field) || DATE_ONLY.has(field) ? 'font-mono text-xs leading-5' : ''}`}>
        {formatValue(field, value)}
      </dd>
    </div>
  );
}

export function InvoiceDetailPanel({ invoice, schemaOk, has, reviewerEmail, decision, onDecided, notice, onClose, onSignIn }: Props) {
  const [confirming, setConfirming] = useState<DecisionKind | null>(null);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const availability = decisionAvailability(invoice, { schemaOk, reviewerEmail });
  const saving = decision.saving;
  const errorForThis = decision.failed?.invoice.id === invoice.id ? decision.error : null;

  useEffect(() => {
    closeRef.current?.focus();
  }, [invoice.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming, onClose]);

  const known = new Set(DETAIL_GROUPS.flatMap((g) => g.fields.map((f) => f.toLowerCase())));
  const system = new Set(['id', 'createtime', 'updatetime', 'createdby', 'updatedby', 'recordowner']);
  const otherFields = Object.keys(invoice.raw).filter((k) => !known.has(k.toLowerCase()) && !system.has(k.toLowerCase()));

  const run = async (kind: DecisionKind, reason?: string) => {
    setConfirming(null);
    const result = await decision.decide({ invoice, kind, reason });
    if (result) onDecided(result.invoice, result.warning);
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(invoice.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the id is visible and selectable */
    }
  };

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-labelledby="panel-title"
      className="fixed inset-0 z-20 flex flex-col bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[min(36rem,100%)] sm:border-l sm:border-slate-200"
    >
      <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 id="panel-title" className="truncate font-display text-lg font-semibold text-slate-900" title={invoice.vendorName}>
            {invoice.vendorName || 'Unknown vendor'}
          </h2>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-sm text-slate-600">{invoice.invoiceNumber || '—'}</span>
            {isEvaluationRow(invoice) && <EvaluationTag />}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1">
            <span className="truncate font-mono text-[11px] text-slate-400" title="Record ID">
              {invoice.id}
            </span>
            <IconButton label={copied ? 'Copied' : 'Copy record ID'} onClick={copyId} className="h-6 w-6" tooltipSide="bottom">
              {copied ? <Check className="h-3 w-3 text-accent-600" /> : <Copy className="h-3 w-3" />}
            </IconButton>
          </div>
        </div>
        <IconButton label="Close panel" onClick={onClose} ref={closeRef} tooltipSide="left">
          <X className="h-4 w-4" />
        </IconButton>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        {/* Decision area first: it is what the reviewer came for. */}
        <section aria-label="Human decision" className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <h3 className="mb-2 font-display text-sm font-semibold text-slate-800">Decision</h3>
          {availability.note && (
            <p className={`mb-3 flex items-start gap-2 text-sm ${availability.enabled ? 'text-amber-800' : 'text-slate-600'}`}>
              {availability.enabled ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              <span className="break-words">{availability.note}</span>
            </p>
          )}
          {availability.enabled && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving != null}
                onClick={() => setConfirming('approve')}
                className={`inline-flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
              >
                {saving === 'approve' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Approve
              </button>
              <button
                type="button"
                disabled={saving != null}
                onClick={() => setConfirming('reject')}
                className={`inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
              >
                {saving === 'reject' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Reject
              </button>
            </div>
          )}
          {saving && (
            <p role="status" className="mt-2 text-xs text-slate-500">
              Saving…
            </p>
          )}
          {errorForThis && decision.failed && (
            <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <span className="min-w-0 flex-1 break-words">{errorForThis.message}</span>
              {errorForThis.kind === 'auth' && (
                <button
                  type="button"
                  onClick={onSignIn}
                  className={`inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 ${focusRing}`}
                >
                  <LogIn className="h-3.5 w-3.5" aria-hidden /> Sign in again
                </button>
              )}
              <button
                type="button"
                onClick={() => decision.failed && run(decision.failed.kind, decision.failed.reason)}
                className={`inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 ${focusRing}`}
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden /> Retry
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="mt-3 break-words text-sm text-slate-600">
              {notice}
            </p>
          )}
        </section>

        {DETAIL_GROUPS.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h3 className="mb-1 border-b border-slate-100 pb-1 font-display text-sm font-semibold text-slate-800">{group.title}</h3>
            <dl>
              {group.fields
                .filter((f) => f !== PACKAGE_FIELD)
                .map((f) => (
                  <FieldRow key={f} field={f} value={readField(invoice.raw, f)} absent={!has(f)} />
                ))}
            </dl>
            {group.fields.includes(PACKAGE_FIELD) && !has(PACKAGE_FIELD) && (
              <dl>
                <FieldRow field={PACKAGE_FIELD} value={null} absent />
              </dl>
            )}
            {group.fields.includes(PACKAGE_FIELD) && has(PACKAGE_FIELD) && (
              <div className="mt-3">
                <ApprovalPackageView invoice={invoice} />
              </div>
            )}
          </section>
        ))}

        {otherFields.length > 0 && (
          <section aria-label="Other fields">
            <h3 className="mb-1 border-b border-slate-100 pb-1 font-display text-sm font-semibold text-slate-800">Other fields</h3>
            <dl>
              {otherFields.map((k) => (
                <FieldRow key={k} field={k} value={invoice.raw[k]} />
              ))}
            </dl>
          </section>
        )}

        <section aria-label="Record">
          <h3 className="mb-1 border-b border-slate-100 pb-1 font-display text-sm font-semibold text-slate-800">Record</h3>
          <dl>
            <FieldRow field="Id" value={invoice.id} />
            <FieldRow field={F.CreateTime} value={readField(invoice.raw, F.CreateTime)} />
            <FieldRow field={F.UpdateTime} value={readField(invoice.raw, F.UpdateTime)} />
          </dl>
        </section>
      </div>

      {confirming && (
        <ConfirmDialog kind={confirming} invoice={invoice} onCancel={() => setConfirming(null)} onConfirm={(reason) => run(confirming, reason)} />
      )}
    </aside>
  );
}
