import { APPROVAL_INPUT_FIELDS, type FieldName } from './fields';
import { isEmptyValue, isSizeMarker, missingFieldList, readField, str, type Invoice } from './model';

/**
 * Readable view of ApprovalPackageJson. The Lab 5 agent writes
 * { narrative: { summary, risk_flags }, poMatch: { poMatched }, evidence: {...}, decision: {...} },
 * but other agents shape it differently, so every lookup tries a few likely keys.
 */
export interface EvidenceItem {
  field: FieldName;
  present: boolean;
  /** Listed in MissingApprovalFields. */
  flaggedMissing: boolean;
}

export interface ApprovalPackage {
  status: 'empty' | 'preview' | 'invalid' | 'ok';
  narrative: string | null;
  riskFlags: string[];
  evidence: EvidenceItem[];
  poMatched: boolean | null;
  openAmount: string | null;
  matchReason: string | null;
  reviewerNote: string | null;
  rawPretty: string | null;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Case- and separator-insensitive key lookup: "open_amount" matches "openAmount". */
function pick(obj: unknown, ...keys: string[]): unknown {
  if (!isObj(obj)) return undefined;
  const norm = (k: string) => k.toLowerCase().replace(/[_\s-]/g, '');
  const index = new Map(Object.keys(obj).map((k) => [norm(k), k]));
  for (const key of keys) {
    const hit = index.get(norm(key));
    if (hit !== undefined && obj[hit] != null) return obj[hit];
  }
  return undefined;
}

function textOf(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  return null;
}

export function parseApprovalPackage(inv: Invoice): ApprovalPackage {
  const text = inv.approvalPackageJson.trim();
  const missing = new Set(missingFieldList(inv.missingApprovalFields).map((s) => s.toLowerCase()));
  const evidenceFromRecord = (pkgEvidence?: unknown): EvidenceItem[] =>
    APPROVAL_INPUT_FIELDS.map((field) => {
      const fromRecord = readField(inv.raw, field);
      const fromPkg = pick(pkgEvidence, field);
      return {
        field,
        present: !isEmptyValue(fromRecord) || !isEmptyValue(fromPkg),
        flaggedMissing: missing.has(field.toLowerCase()),
      };
    });

  const base: ApprovalPackage = {
    status: 'empty',
    narrative: null,
    riskFlags: [],
    evidence: evidenceFromRecord(),
    poMatched: inv.poMatched,
    openAmount: null,
    matchReason: null,
    reviewerNote: null,
    rawPretty: null,
  };

  if (!text) return base;
  if (isSizeMarker(text)) return { ...base, status: 'preview' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ...base, status: 'invalid', rawPretty: text };
  }
  if (!isObj(parsed)) return { ...base, status: 'invalid', rawPretty: JSON.stringify(parsed, null, 2) };

  const narrativeNode = pick(parsed, 'narrative', 'summary', 'approvalNarrative');
  const narrative = textOf(narrativeNode) ?? textOf(pick(narrativeNode, 'summary', 'text', 'narrative'));
  const flagsNode = pick(narrativeNode, 'risk_flags', 'riskFlags') ?? pick(parsed, 'risk_flags', 'riskFlags');
  const riskFlags = Array.isArray(flagsNode) ? flagsNode.map(str).filter(Boolean) : [];

  const po = pick(parsed, 'poMatch', 'po_match', 'poMatchResult');
  const openAmount = textOf(pick(po, 'openAmount', 'poOpenAmount', 'remainingAmount') ?? pick(parsed, 'openAmount', 'poOpenAmount'));
  const matchReason = textOf(pick(po, 'matchReason', 'reason') ?? pick(parsed, 'matchReason'));

  return {
    status: 'ok',
    narrative,
    riskFlags,
    evidence: evidenceFromRecord(pick(parsed, 'evidence', 'approvalEvidence', 'approvalInputs')),
    poMatched: inv.poMatched,
    openAmount,
    matchReason,
    reviewerNote: textOf(pick(parsed, 'reviewerNote')),
    rawPretty: JSON.stringify(parsed, null, 2),
  };
}
