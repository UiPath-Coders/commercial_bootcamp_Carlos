import { useState } from 'react';
import { ChevronRight, CircleCheck, CircleX } from 'lucide-react';
import { parseApprovalPackage } from '@/data/approvalPackage';
import type { Invoice } from '@/data/model';
import { focusRing } from './ui';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

export function ApprovalPackageView({ invoice }: { invoice: Invoice }) {
  const [showRaw, setShowRaw] = useState(false);
  const pkg = parseApprovalPackage(invoice);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Agent narrative</h4>
        {pkg.status === 'empty' ? (
          <p className="text-sm text-slate-400">No approval package on this record yet.</p>
        ) : pkg.status === 'preview' ? (
          <p className="text-sm text-slate-500">The package was returned as a size preview only; reopen the invoice to load it in full.</p>
        ) : pkg.status === 'invalid' ? (
          <p className="text-sm text-amber-800">ApprovalPackageJson is not valid JSON. See the raw value below.</p>
        ) : pkg.narrative ? (
          <p className="break-words text-sm leading-relaxed text-slate-800">{pkg.narrative}</p>
        ) : (
          <p className="text-sm text-slate-400">The package carries no narrative (only READY_FOR_APPROVAL invoices get one).</p>
        )}
        {pkg.riskFlags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {pkg.riskFlags.map((f) => (
              <li key={f} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600">
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence checklist</h4>
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {pkg.evidence.map((e) => (
            <li
              key={e.field}
              className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm ${e.flaggedMissing ? 'bg-amber-50' : ''}`}
            >
              <span className={`font-mono text-xs ${e.flaggedMissing ? 'font-semibold text-amber-900' : 'text-slate-700'}`}>{e.field}</span>
              {e.present ? (
                <span className="inline-flex items-center gap-1 text-xs text-accent-700">
                  <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Present
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1 text-xs ${e.flaggedMissing ? 'font-semibold text-amber-800' : 'text-slate-500'}`}>
                  <CircleX className="h-3.5 w-3.5" aria-hidden /> Missing
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">PO match</h4>
        <div className="rounded-md border border-slate-200 px-3 py-1">
          <Row label="POMatched">{pkg.poMatched == null ? '—' : pkg.poMatched ? 'Yes' : 'No'}</Row>
          <Row label="Open amount">
            <span className="font-mono text-xs">{pkg.openAmount ?? '—'}</span>
          </Row>
          <Row label="Reason">
            <span className="break-words text-slate-700">{pkg.matchReason ?? '—'}</span>
          </Row>
        </div>
      </div>

      {pkg.reviewerNote && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Reviewer note</h4>
          <p className="break-words rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">{pkg.reviewerNote}</p>
        </div>
      )}

      {pkg.rawPretty && (
        <div>
          <button
            type="button"
            aria-expanded={showRaw}
            onClick={() => setShowRaw((s) => !s)}
            className={`inline-flex items-center gap-1 rounded text-xs font-medium text-slate-500 hover:text-slate-800 ${focusRing}`}
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showRaw ? 'rotate-90' : ''}`} aria-hidden />
            View raw JSON
          </button>
          {showRaw && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
              {pkg.rawPretty}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
