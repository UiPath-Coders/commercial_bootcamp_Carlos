import type { EntityRecord } from '@uipath/uipath-typescript/entities';
import { F, LIFECYCLE, type FieldName } from './fields';

/** Typed view over one AP_Invoice_Carlos record. `raw` keeps every field for the detail panel. */
export interface Invoice {
  id: string;
  raw: Record<string, unknown>;

  vendorName: string;
  invoiceNumber: string;
  poNumber: string;
  totalAmount: number | null;
  currency: string;
  processedTimestamp: Date | null;

  poMatched: boolean | null;
  approvalNeeded: boolean | null;

  approvalEvidenceState: string;
  missingApprovalFields: string;
  agentRecommendation: string;
  approvalPackageJson: string;
  agentProcessedAt: Date | null;
  lifecycleState: string;

  reviewedBy: string;
  reviewedAt: Date | null;

  createTime: Date | null;
  updateTime: Date | null;
}

export const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

export const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export const bool = (v: unknown): boolean | null => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
  }
  return null;
};

export const date = (v: unknown): Date | null => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function isEmptyValue(v: unknown): boolean {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

/** List reads may return a size marker instead of long text. Never render it as content or write it back. */
export function isSizeMarker(v: unknown): boolean {
  return typeof v === 'string' && /^HasValue=(true|false)\b/i.test(v.trim());
}

/** Read a field by its schema name, falling back to a case-insensitive key match. */
export function readField(raw: Record<string, unknown>, field: string): unknown {
  if (field in raw) return raw[field];
  const lower = field.toLowerCase();
  const key = Object.keys(raw).find((k) => k.toLowerCase() === lower);
  return key ? raw[key] : undefined;
}

export function toInvoice(record: EntityRecord | Record<string, unknown>): Invoice {
  const r = record as Record<string, unknown>;
  const get = (f: FieldName) => readField(r, f);
  return {
    id: str(get(F.Id)),
    raw: r,
    vendorName: str(get(F.VendorName)),
    invoiceNumber: str(get(F.InvoiceNumber)),
    poNumber: str(get(F.PONumber)),
    totalAmount: num(get(F.TotalAmount)),
    currency: str(get(F.Currency)),
    processedTimestamp: date(get(F.ProcessedTimestamp)),
    poMatched: bool(get(F.POMatched)),
    approvalNeeded: bool(get(F.ApprovalNeeded)),
    approvalEvidenceState: str(get(F.ApprovalEvidenceState)),
    missingApprovalFields: str(get(F.MissingApprovalFields)),
    agentRecommendation: str(get(F.AgentRecommendation)),
    approvalPackageJson: str(get(F.ApprovalPackageJson)),
    agentProcessedAt: date(get(F.AgentProcessedAt)),
    lifecycleState: str(get(F.InvoiceLifecycleState)).trim().toUpperCase(),
    reviewedBy: str(get(F.ReviewedBy)),
    reviewedAt: date(get(F.ReviewedAt)),
    createTime: date(get(F.CreateTime)),
    updateTime: date(get(F.UpdateTime)),
  };
}

/** Merge a write into an existing row so the table and panel update without a reload. */
export function mergeInvoice(existing: Invoice, patch: Record<string, unknown>): Invoice {
  return toInvoice({ ...existing.raw, ...patch, Id: existing.id });
}

export function isEvaluationRow(inv: Pick<Invoice, 'invoiceNumber'>): boolean {
  return inv.invoiceNumber.toUpperCase().startsWith('TRAIN-');
}

/** MissingApprovalFields is a delimited string; split it into field names. */
export function missingFieldList(text: string): string[] {
  return text
    .split(/[,;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Decision rules (the "Approved?" gateway)
// ---------------------------------------------------------------------------

export type DecisionKind = 'approve' | 'reject';

export interface DecisionAvailability {
  enabled: boolean;
  /** One-line note (incomplete evidence) or explanation (why no action is available). */
  note: string | null;
}

export function decisionAvailability(
  inv: Invoice,
  opts: { schemaOk: boolean; reviewerEmail: string | null },
): DecisionAvailability {
  const state = inv.lifecycleState;
  const reviewable = state === LIFECYCLE.READY_FOR_APPROVAL || state === LIFECYCLE.NEEDS_AP_REVIEW;

  if (reviewable && inv.approvalNeeded === true) {
    if (!opts.schemaOk) {
      return { enabled: false, note: 'The entity is missing InvoiceLifecycleState, ReviewedBy or ReviewedAt, so a decision cannot be saved.' };
    }
    if (!opts.reviewerEmail) {
      return { enabled: false, note: 'Your signed-in email could not be resolved, so ReviewedBy cannot be recorded. Sign out and back in.' };
    }
    if (state === LIFECYCLE.NEEDS_AP_REVIEW) {
      return {
        enabled: true,
        note: `Approval evidence is incomplete: missing ${inv.missingApprovalFields || 'fields not listed'}.`,
      };
    }
    return { enabled: true, note: null };
  }

  switch (state) {
    case LIFECYCLE.READY_FOR_APPROVAL:
    case LIFECYCLE.NEEDS_AP_REVIEW:
      return { enabled: false, note: `${state} but ApprovalNeeded is not true, so no human decision applies. Rerun the Lab 5 agent on this record.` };
    case LIFECYCLE.AUTO_APPROVED:
      return { enabled: false, note: 'Auto-approved by the agent: no human decision is needed.' };
    case LIFECYCLE.HOLD_PO_MISMATCH:
      return { enabled: false, note: 'On hold for a PO mismatch: resolve it upstream; reviewers do not decide this state.' };
    case LIFECYCLE.APPROVED:
      return { enabled: false, note: `Already approved${inv.reviewedBy ? ` by ${inv.reviewedBy}` : ''}.` };
    case LIFECYCLE.REJECTED:
      return { enabled: false, note: `Already rejected${inv.reviewedBy ? ` by ${inv.reviewedBy}` : ''}.` };
    case LIFECYCLE.POSTED:
      return { enabled: false, note: 'Already posted to the ERP: nothing left to decide.' };
    case LIFECYCLE.EXTRACTED:
    case '':
      return { enabled: false, note: 'The approval agent has not prepared this invoice yet.' };
    default:
      return { enabled: false, note: `State "${state}" cannot be decided here.` };
  }
}

// ---------------------------------------------------------------------------
// "Approval required" pill
// ---------------------------------------------------------------------------

const APPROVAL_OPEN_STATES = new Set<string>(['', LIFECYCLE.EXTRACTED, LIFECYCLE.NEEDS_AP_REVIEW, LIFECYCLE.READY_FOR_APPROVAL]);
const APPROVAL_DECIDED_WORDS: Record<string, string> = {
  [LIFECYCLE.APPROVED]: 'Approved',
  [LIFECYCLE.REJECTED]: 'Rejected',
  [LIFECYCLE.POSTED]: 'Posted',
};

export function approvalPill(inv: Pick<Invoice, 'approvalNeeded' | 'lifecycleState'>): { tone: 'needed' | 'decided'; text: string } | null {
  if (inv.approvalNeeded !== true) return null;
  const decided = APPROVAL_DECIDED_WORDS[inv.lifecycleState];
  if (decided) return { tone: 'decided', text: decided };
  if (APPROVAL_OPEN_STATES.has(inv.lifecycleState)) return { tone: 'needed', text: 'Needed' };
  return null;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatAmount(amount: number | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function formatDateTime(d: Date | null): string {
  if (!d) return '—';
  return d.toISOString().replace('T', ' ').replace(/:\d{2}\.\d{3}Z$/, 'Z');
}

export function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
