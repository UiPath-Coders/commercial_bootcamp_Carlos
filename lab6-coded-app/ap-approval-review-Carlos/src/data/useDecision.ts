import { useCallback, useState } from 'react';
import { Entities } from '@uipath/uipath-typescript/entities';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONFIG } from '@/config/app';
import { F, LIFECYCLE } from './fields';
import { isSizeMarker, mergeInvoice, readField, str, type DecisionKind, type Invoice } from './model';
import { toAppError, type AppError } from './errors';

/**
 * The reviewer write (the "Approved?" gateway), on the same AP_Invoice_Carlos record:
 *   Approve : InvoiceLifecycleState = APPROVED
 *   Reject  : InvoiceLifecycleState = REJECTED, reason appended to ApprovalPackageJson as "reviewerNote"
 *   Both    : ReviewedBy = signed-in email, ReviewedAt = now
 */

export interface DecisionResult {
  invoice: Invoice;
  /** Set when the reject reason could not be appended to the package. */
  warning: string | null;
}

export interface PendingDecision {
  invoice: Invoice;
  kind: DecisionKind;
  reason?: string;
}

export interface DecisionState {
  saving: DecisionKind | null;
  error: AppError | null;
  /** The last failed attempt, so the panel can offer Retry. */
  failed: PendingDecision | null;
  clearError: () => void;
  decide: (p: PendingDecision) => Promise<DecisionResult | null>;
}

function appendReviewerNote(packageJson: string, note: string): { value: string | null; warning: string | null } {
  const trimmed = packageJson.trim();
  if (isSizeMarker(trimmed)) {
    return { value: null, warning: 'ApprovalPackageJson could not be read in full, so the reason was not added to it. The decision was saved.' };
  }
  if (trimmed === '') return { value: JSON.stringify({ reviewerNote: note }), warning: null };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { value: JSON.stringify({ ...(parsed as Record<string, unknown>), reviewerNote: note }), warning: null };
    }
    return { value: JSON.stringify({ package: parsed, reviewerNote: note }), warning: null };
  } catch {
    return { value: null, warning: 'ApprovalPackageJson is not valid JSON, so the reason was not added to it. The decision was saved.' };
  }
}

export function useDecision(): DecisionState {
  const { sdk, userEmail } = useAuth();
  const [saving, setSaving] = useState<DecisionKind | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [failed, setFailed] = useState<PendingDecision | null>(null);

  const decide = useCallback(
    async ({ invoice, kind, reason }: PendingDecision): Promise<DecisionResult | null> => {
      if (!userEmail) {
        setError({ kind: 'auth', message: 'Your signed-in email is unknown, so ReviewedBy cannot be written. Sign out and back in.' });
        return null;
      }
      setSaving(kind);
      setError(null);
      setFailed(null);
      try {
        const entities = new Entities(sdk);
        const patch: Record<string, unknown> = {
          [F.InvoiceLifecycleState]: kind === 'approve' ? LIFECYCLE.APPROVED : LIFECYCLE.REJECTED,
          [F.ReviewedBy]: userEmail,
          [F.ReviewedAt]: new Date().toISOString(),
        };

        let warning: string | null = null;
        if (kind === 'reject') {
          // Re-read the single record so the note lands on the full package, never on a list preview.
          let fullPackage = invoice.approvalPackageJson;
          try {
            const full = await entities.getRecordByName(APP_CONFIG.entityName, invoice.id);
            fullPackage = str(readField(full as Record<string, unknown>, F.ApprovalPackageJson));
          } catch {
            // Keep the list value; appendReviewerNote refuses a size marker.
          }
          const note = appendReviewerNote(fullPackage, (reason ?? '').trim());
          if (note.value != null) patch[F.ApprovalPackageJson] = note.value;
          warning = note.warning;
        }

        const response = await entities.updateRecord({ name: APP_CONFIG.entityName }, invoice.id, patch);
        // The response echoes the record; merge it over the patch so the row shows what the server stored.
        return { invoice: mergeInvoice(invoice, { ...patch, ...(response as Record<string, unknown>) }), warning };
      } catch (err) {
        setError(toAppError(err, `Unable to ${kind} this invoice.`));
        setFailed({ invoice, kind, reason });
        return null;
      } finally {
        setSaving(null);
      }
    },
    [sdk, userEmail],
  );

  return {
    saving,
    error,
    failed,
    clearError: () => {
      setError(null);
      setFailed(null);
    },
    decide,
  };
}
