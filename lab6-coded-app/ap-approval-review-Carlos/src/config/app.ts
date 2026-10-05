/**
 * App settings that are not part of the OAuth/SDK config (that lives in uipath.json).
 * Nothing here is a secret.
 */
export const APP_CONFIG = {
  /** Tenant-scoped Data Fabric entity, addressed by name. No folder key is passed to any Entities call. */
  entityName: 'AP_Invoice_Carlos',
  /** Rows per table page. Small on purpose: about eleven seeded records span three pages. */
  pageSize: 5,
  /** Rows per SDK request while following the cursor. */
  fetchPageSize: 100,
  /** Safety cap on cursor pages so a runaway entity cannot hang the UI. */
  maxFetchPages: 50,
} as const;
