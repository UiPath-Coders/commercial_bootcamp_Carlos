/**
 * AP_Invoice_Carlos field system names, as discovered with `uip df entities get`.
 * Writes use these exact names; reads also match them case-insensitively
 * (see `readField` in model.ts) because some tools re-case acronyms.
 */
export const F = {
  // Data Fabric system fields
  Id: 'Id',
  CreateTime: 'CreateTime',
  UpdateTime: 'UpdateTime',

  // Invoice (Lab 2)
  ProcessedTimestamp: 'ProcessedTimestamp',
  VendorName: 'VendorName',
  VendorTaxId: 'VendorTaxId',
  InvoiceNumber: 'InvoiceNumber',
  InvoiceDate: 'InvoiceDate',
  PONumber: 'PONumber',
  TotalAmount: 'TotalAmount',
  Currency: 'Currency',
  DueDate: 'DueDate',

  // PO match / posting (Labs 3 and 4)
  POMatched: 'POMatched',
  ApprovalNeeded: 'ApprovalNeeded',
  PostedToERP: 'PostedToERP',

  // The seven approval inputs (Lab 5 seeds)
  GLAccount: 'GLAccount',
  CostCenter: 'CostCenter',
  Approver: 'Approver',
  PaymentTerms: 'PaymentTerms',
  VendorRiskScore: 'VendorRiskScore',
  ReceiptReference: 'ReceiptReference',
  InvoiceLineSummary: 'InvoiceLineSummary',

  // Agent package (Lab 5)
  ApprovalEvidenceState: 'ApprovalEvidenceState',
  MissingApprovalFields: 'MissingApprovalFields',
  AgentRecommendation: 'AgentRecommendation',
  ApprovalPackageJson: 'ApprovalPackageJson',
  AgentProcessedAt: 'AgentProcessedAt',

  // Review decision (written by this app)
  InvoiceLifecycleState: 'InvoiceLifecycleState',
  ReviewedBy: 'ReviewedBy',
  ReviewedAt: 'ReviewedAt',
} as const;

export type FieldName = (typeof F)[keyof typeof F];

export const APPROVAL_INPUT_FIELDS: FieldName[] = [
  F.GLAccount,
  F.CostCenter,
  F.Approver,
  F.PaymentTerms,
  F.VendorRiskScore,
  F.ReceiptReference,
  F.InvoiceLineSummary,
];

/** Detail-panel groups. Every record field not listed here lands in "Other fields". */
export const DETAIL_GROUPS: { title: string; fields: FieldName[] }[] = [
  {
    title: 'Invoice',
    fields: [F.VendorName, F.VendorTaxId, F.InvoiceNumber, F.InvoiceDate, F.DueDate, F.PONumber, F.TotalAmount, F.Currency, F.ProcessedTimestamp],
  },
  { title: 'PO match', fields: [F.POMatched, F.ApprovalNeeded, F.PostedToERP] },
  { title: 'Approval evidence', fields: APPROVAL_INPUT_FIELDS },
  {
    title: 'Agent package',
    fields: [F.ApprovalEvidenceState, F.MissingApprovalFields, F.AgentRecommendation, F.AgentProcessedAt, F.ApprovalPackageJson],
  },
  { title: 'Review decision', fields: [F.InvoiceLifecycleState, F.ReviewedBy, F.ReviewedAt] },
];

/** Fields the UI depends on; any of these missing from the live schema raises the data-integrity banner. */
export const UI_DEPENDENT_FIELDS: FieldName[] = [F.InvoiceLifecycleState, F.AgentRecommendation, F.ReviewedBy];

/** Fields the approve / reject write touches. */
export const DECISION_WRITE_FIELDS: FieldName[] = [F.InvoiceLifecycleState, F.ReviewedBy, F.ReviewedAt];

export const LIFECYCLE = {
  EXTRACTED: 'EXTRACTED',
  HOLD_PO_MISMATCH: 'HOLD_PO_MISMATCH',
  AUTO_APPROVED: 'AUTO_APPROVED',
  NEEDS_AP_REVIEW: 'NEEDS_AP_REVIEW',
  READY_FOR_APPROVAL: 'READY_FOR_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  POSTED: 'POSTED',
} as const;

export const PENDING_REVIEW_STATES: string[] = [LIFECYCLE.NEEDS_AP_REVIEW, LIFECYCLE.READY_FOR_APPROVAL];
export const RECOMMENDED_FOR_APPROVAL = LIFECYCLE.READY_FOR_APPROVAL;

export type SortKey = 'vendor' | 'po' | 'total' | 'approvalNeeded' | 'lifecycle' | 'recommendation' | 'updated';

export const TABLE_COLUMNS: { key: SortKey; label: string; field: FieldName; align?: 'right' }[] = [
  { key: 'vendor', label: 'Vendor', field: F.VendorName },
  { key: 'po', label: 'PO Number', field: F.PONumber },
  { key: 'total', label: 'Total', field: F.TotalAmount, align: 'right' },
  { key: 'approvalNeeded', label: 'Approval required', field: F.ApprovalNeeded },
  { key: 'lifecycle', label: 'Lifecycle State', field: F.InvoiceLifecycleState },
  { key: 'recommendation', label: 'Recommendation', field: F.AgentRecommendation },
  { key: 'updated', label: 'Updated', field: F.UpdateTime },
];
