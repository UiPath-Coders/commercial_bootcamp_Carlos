import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isEvaluationRow, type DecisionKind, type Invoice } from '@/data/model';
import { focusRing } from './ui';

interface Props {
  kind: DecisionKind;
  invoice: Invoice;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}

/** Modal confirmation naming the exact invoice; Reject also collects a one-line reason. */
export function ConfirmDialog({ kind, invoice, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const isReject = kind === 'reject';
  const canConfirm = !isReject || reason.trim().length > 0;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (canConfirm) onConfirm(isReject ? reason.trim() : undefined);
        }}
        className="space-y-4 p-6"
      >
        <h2 id={titleId} className="font-display text-lg font-semibold text-slate-900">
          {isReject ? 'Reject invoice?' : 'Approve invoice?'}
        </h2>
        <p className="break-words text-sm text-slate-600">
          {isReject ? 'Reject' : 'Approve'} invoice <span className="font-mono font-medium text-slate-900">{invoice.invoiceNumber || '—'}</span> from{' '}
          <span className="font-medium text-slate-900">{invoice.vendorName || '—'}</span>. This sets InvoiceLifecycleState to{' '}
          <span className="font-mono">{isReject ? 'REJECTED' : 'APPROVED'}</span> and records you as the reviewer.
        </p>
        {isEvaluationRow(invoice) && (
          <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <span>This is a Lab 5 evaluation row, not a vendor invoice. Check the invoice number before you confirm.</span>
          </p>
        )}
        {isReject && (
          <div className="space-y-1">
            <label htmlFor={reasonId} className="text-sm font-medium text-slate-700">
              Reason
            </label>
            <input
              id={reasonId}
              type="text"
              required
              autoFocus
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="One line, saved to the approval package"
              className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm ${focusRing}`}
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            autoFocus={!isReject}
            className={`rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${focusRing}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canConfirm}
            className={`rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
              isReject ? 'border border-red-300 bg-white text-red-700 hover:bg-red-50' : 'bg-accent-600 text-white hover:bg-accent-700'
            }`}
          >
            {isReject ? 'Reject' : 'Approve'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
