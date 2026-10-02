# Canonical Day 2 Handoff

## Repository

- Lab 5 starter: `UiPath-Coders/commercial_bootcamp_lab_assets` → `lab5-coded-agent/`
- Participant: `Carlos`

## UiPath resources

| Value | Verified result |
| --- | --- |
| Folder name | `APAutomation_Carlos` (full path `Agentic Bootcamp/APAutomation_Carlos`) |
| Folder key | `d9519350-ca22-4f67-ab86-b6b568431e66` |
| Queue name | `InvoiceQueue_Carlos` |
| Entity name | `AP_Invoice_Carlos` (tenant-scoped, no folder key) |
| Entity ID | `1a1f4d42-d7bd-f111-a6a9-6045bddc9767` |
| Entity key | `1a1f4d42-d7bd-f111-a6a9-6045bddc9767` (= Entity ID; the SDK calls it entity_key) |
| Canonical record ID | `24aa04bc-dfbd-f111-a6a9-6045bddbb45c` (InvoiceNumber `CLL-2026-3391`, Contoso Logistics LLC) |

## Day 1 evidence

Verified 2026-10-02 with `uip df records query`, `uip or queue-items list` and `uip or jobs logs`.

| Check | Status | Evidence reference |
| --- | --- | --- |
| Queue Reference equals canonical record ID | `VERIFIED` | `InvoiceQueue_Carlos` item Id 21507770, Reference = canonical record ID, Status Successful (processed 2026-10-02 19:06:20 UTC) |
| POMatched verified from Lab 3 | `VERIFIED` (`true`) | Job `POMatch_Carlos_process_invoice_queue` c1a7c9a7-0655-48cb-8046-d1e59b635bac (Successful) logged `record 24aa04bc-…: MATCHED`; confirmed again by `POMatch_Carlos_process_invoice` job 6573032c-8781-4536-841e-487b734b4698 |
| ApprovalNeeded verified from Lab 3 | `VERIFIED` (`true`) | Same Lab 3 runs; live record shows `ApprovalNeeded = true`, `PostedToERP = false`, `InvoiceLifecycleState = EXTRACTED` |

## Lab 5 evidence

| Value | Result |
| --- | --- |
| Agent project | `agent/Invoice_Approval_Agent_Carlos/` (LangGraph coded agent, entry point `agent`) |
| Agent name | `Invoice_Approval_Agent_Carlos` |
| Recommendation | `READY_FOR_APPROVAL` (canonical record, gate 4, ApprovalEvidenceState `COMPLETE`, MissingApprovalFields empty, LLM narrative in ApprovalPackageJson; local run 2026-10-02T20:51:23Z) |
| Lifecycle state | `READY_FOR_APPROVAL` |
| Deployment reference | Package `Invoice_Approval_Agent_Carlos` 0.0.1 (tenant feed, `uip codedagent deploy --tenant`); process `Invoice_Approval_Agent_Carlos` in `Agentic Bootcamp/APAutomation_Carlos`, process key `90403394-d6e2-4849-9b55-27b94eebc4d4`; entry point `agent` (UniqueId `4fe26be4-8fe6-4576-b62b-a5b805deac2b`) |

### Tested contract (from `uip or packages entry-points Invoice_Approval_Agent_Carlos:0.0.1`)

- Input: `{ "recordId": string }` (required).
- Output: `recordId`, `approvalEvidenceState`, `missingApprovalFields` (string[]), `recommendation`,
  `invoiceLifecycleState`, `wasAlreadyPrepared` (boolean), `errorType`, `errorMessage`.
- Run with `uip or jobs start <process key> --folder-key <folder key> --runtime-type Serverless --machine-keys <Default Serverless key> --input-arguments '{"recordId":"<Id>"}' --wait-for-completion`.

### Evidence

| Check | Result |
| --- | --- |
| Six-case smoke evaluation (`evaluations/eval-sets/smoke-test.json`, 1 worker) | 6/6 passed (score 1.0) on the AP-TRAIN records: 1001/1006 READY_FOR_APPROVAL, 1002/1005 NEEDS_AP_REVIEW, 1003 AUTO_APPROVED, 1004 HOLD_PO_MISMATCH |
| Deployed run on AP-TRAIN-1003 (TRAIN-MC-1003) after clearing its six agent fields | Job `099699ff-6f27-4072-9680-4278e814408c` Successful: NOT_REQUIRED / AUTO_APPROVED, `wasAlreadyPrepared` false, record updated |
| Repeated invocation, same recordId | Job `24b54576-47fa-4d7f-845b-58461c52c8fd` Successful: `wasAlreadyPrepared` true; ApprovalPackageJson (same hash), AgentProcessedAt and InvoiceLifecycleState unchanged |
| Gate-4 record AP-TRAIN-1006 (TRAIN-VA-1006), already prepared | Job `fe0bb553-4a17-4181-81db-fbfc469f95fa` Successful: `wasAlreadyPrepared` true, record unchanged; `uip traces spans get d9166240-6673-4617-8235-861e02c0104f` shows only load_record, entity_retrieve_by_name, entity_get_record, retry_guard, finish (no gates, no LLM, no write) |

## Lab 6 evidence

| Value | Result |
| --- | --- |
| App name | `ap-approval-review-Carlos` |
| Deployment URL | `<SANITIZED_APP_URL>` |
| Reviewer decision | `<APPROVED or REJECTED>` by `<user_email>` at `<REVIEWED_AT>` |

Do not record tokens, secrets, vendor tax IDs, bank details, or invoice amounts.
