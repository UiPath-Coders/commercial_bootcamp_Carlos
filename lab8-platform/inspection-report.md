# Lab 8: platform inspection report

Tenant: Training (staging). Inspected 2026-10-05 with read-only `uip or` commands; nothing was changed.
Keys, ids, emails and colleague names are left out on purpose (see README redaction list).

## 1. Folder: Agentic Bootcamp/APAutomation_Carlos

| Property | Value |
|---|---|
| Type | Standard (not personal, not a Solution folder) |
| Parent | `Agentic Bootcamp` (Standard, top-level) |
| Permission model | Fine-grained |
| Provisioning | Automatic |
| Package feed | Tenant processes feed (no folder-specific feed) |
| Sub-folders | 1: `Invoice_Extraction_Agent_Carlos` (Solution folder, created by the Lab 2 agent deployment) |

### Users (with inherited), counted by role

13 principals in total: 11 directory users, 1 directory group (Agentic Bootcamp Participants), 1 robot account
(Agentic Labs Robot). Every user and the group are inherited from `Agentic Bootcamp`; the robot is assigned
directly on the folder and also inherited from the parent.

| Role combination | Users | Group | Robot |
|---|---|---|---|
| Automation Developer + Folder Administrator | 9 (includes you) | 1 | 0 |
| Automation Developer + Automation Publisher + Folder Administrator | 1 | 0 | 0 |
| Folder Administrator only | 1 | 0 | 0 |
| Automation User | 0 | 0 | 1 |

Totals per role: Folder Administrator 12, Automation Developer 11, Automation Publisher 1, Automation User 1.
`Agentic Bootcamp` has the same 13 principals with the same roles, all assigned directly there.
The participant group's Folder Administrator grant on the parent is intentional (Lab 2 creates sub-folders).

### Machines

| Folder | Directly assigned machines |
|---|---|
| APAutomation_Carlos | None (normal: machines are inherited) |
| Agentic Bootcamp | Default Serverless (template, Serverless); Agentic Labs Unattended Robot (template, expected) |

Both templates have 0 unattended/headless/non-production/test slots. Jobs use the inherited Default Serverless
machine with the Serverless runtime.

### Runtimes

| Runtime type | APAutomation_Carlos (Total / Connected / Available) | Agentic Bootcamp |
|---|---|---|
| Serverless | 1 / 0 / 0 | 1 / 0 / 0 |
| Serverless Test Automation | 1 / 0 / 0 | 1 / 0 / 0 |
| Automation Cloud robot | 0 / 0 / 0 | 1 / 0 / 0 |
| All other types | 0 | 0 |

Connected/Available 0 is normal for serverless: capacity is allocated per job.

### Robot and library associations

- Robot: Agentic Labs Robot (Automation User) is the only robot account in the folder.
- Libraries: the tenant library feed is empty; no libraries are associated.
- Processes in the folder (7): Invoice_Intake_RPA_Carlos 1.0.0, PostToERP_Carlos 1.0.0,
  POMatch_Carlos_po_lookup / _process_invoice / _process_invoice_queue / _get_invoice_status 0.0.2,
  Invoice_Approval_Agent_Carlos 0.0.1.
- Processes in the Solution sub-folder (1): Invoice_Extraction_Agent_Carlos 1.0.0.

## 2. Storage bucket: InvoiceEvidence_Lab

Pre-check: before creation the folder held one bucket (`InvoiceInbox_Carlos`); no `InvoiceEvidence_Lab` existed.

| Setting | Value |
|---|---|
| Folder | Agentic Bootcamp/APAutomation_Carlos |
| Description | Lab 8: synthetic invoice and approval documents (test data only) |
| Storage provider | Orchestrator built-in (no external provider, container or credential store) |
| Access options | None (default read/write; not read-only) |
| Shared with other folders | No (1 folder) |
| Tags | None |

Verification: `buckets get` returned the settings above. Test upload `lab8/bucket-test-file.txt`
(text/plain, 151 bytes, synthetic text with no vendor, banking, tax or credential data; local copy
`bucket-test-file.txt`) succeeded and appears in `bucket-files list`.

## 3. Data Fabric entity: AP_Invoice_Carlos

Only this entity was read (schema and records). Other participants' `AP_Invoice_*` entities were not opened.

| Property | Value |
|---|---|
| Display name | AP Invoice Carlos |
| Scope | Tenant (no folder; entity-level RBAC off, analytics off) |
| Fields | 33 total: 27 user fields + 6 system fields |
| Record count | 11 |
| Records by lifecycle state | READY_FOR_APPROVAL 3, EXTRACTED 3, NEEDS_AP_REVIEW 2, AUTO_APPROVED 1, HOLD_PO_MISMATCH 1, POSTED 1 |

### Fields and data types

| Field | Type | Notes |
|---|---|---|
| Id | UUID | System, primary key |
| CreatedBy, UpdatedBy, RecordOwner | RELATIONSHIP | System (to SystemUser) |
| CreateTime, UpdateTime | DATETIME_WITH_TZ | System |
| ProcessedTimestamp | DATETIME_WITH_TZ | Lab 2 |
| VendorName, InvoiceNumber, PONumber, Currency, InvoiceLifecycleState | STRING | Lab 2 |
| VendorTaxId | STRING | Lab 2; sensitive, never read here |
| TotalAmount | DECIMAL | Lab 2; never read here |
| InvoiceDate, DueDate | DATE | Lab 2 |
| POMatched, ApprovalNeeded, PostedToERP | BOOLEAN | Lab 2-4 |
| GLAccount, CostCenter, Approver, PaymentTerms, VendorRiskScore, ReceiptReference, InvoiceLineSummary | STRING | Lab 5 approval inputs |
| ApprovalEvidenceState, MissingApprovalFields, AgentRecommendation, ReviewedBy | STRING | Lab 5/6 agent and review output |
| ApprovalPackageJson | MULTILINE_TEXT | Lab 5; never read here |
| AgentProcessedAt, ReviewedAt | DATETIME_WITH_TZ | Lab 5/6 |

No field is required beyond the system fields, none is unique or encrypted, and there are no choice-set or
attachment fields. The schema has no bank-detail field.

### Sample records (5, oldest first)

Queried with `uip df records query` and `selectedFields` limited to the columns below, so VendorTaxId,
TotalAmount and ApprovalPackageJson never left the server. Synthetic data, USD only.

| InvoiceNumber | VendorName | InvoiceDate | DueDate | PONumber | POMatched | ApprovalNeeded | PostedToERP | State |
|---|---|---|---|---|---|---|---|---|
| NW-88214 | Northwind Office Supplies Inc. | 2026-03-04 | 2026-04-03 | PO-2026-0431 | true | false | true | POSTED |
| CLL-2026-3391 | Contoso Logistics LLC | 2026-03-06 | 2026-04-20 | PO-2026-0447 | true | true | false (unset) | READY_FOR_APPROVAL |
| AF19427 | Ableton Fabrication, Inc. | 2026-03-09 | 2026-04-08 | PO-2026-0452 | true | false | false (unset) | EXTRACTED |
| MCS-Q1-20418 | Meridian Cloud Services Corp. | 2026-03-01 | 2026-03-31 | PO-2026-0399 | true | true | false (unset) | EXTRACTED |
| BHC-4471 | Blue Harbor Catering Co. | 2026-03-11 | 2026-03-26 | PO-2026-0461 | false | true | false (unset) | EXTRACTED |

## 4. Queue: InvoiceQueue_Carlos

`InvoiceQueue_Carlos` is the only queue in the folder (invoice-related; no other queue names exist there).

| Setting | Value |
|---|---|
| Description | Lab 2 invoice queue (reference = Data Fabric record ID) |
| Unique reference enforced | Yes |
| Max retries | 0 (auto-retry off) |
| Retry abandoned items | No |
| Shared with other folders | No (1 folder) |
| Total transactions | 5 |

### Items by status

| New | In Progress | Failed | Abandoned | Retried | Successful | Deleted |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 5 | 0 |

### Sample items (all 5, newest first)

Safe metadata only. Item payloads (SpecificContent, Output) were not printed or saved. References are record
ids, truncated here.

| Reference | Status | Priority | Created (UTC) | Processing start - end (UTC) | Retries | Exception |
|---|---|---|---|---|---|---|
| …b45c (1) | Successful | Normal | 2026-10-01 21:34:39 | 2026-10-02 19:06:23 - 19:06:24 | 0 | none |
| …b45c (2) | Successful | Normal | 2026-10-01 21:34:14 | 2026-10-02 19:06:22 - 19:06:23 | 0 | none |
| …b45c (3) | Successful | Normal | 2026-10-01 21:33:49 | 2026-10-02 19:06:21 - 19:06:22 | 0 | none |
| …b45c (4) | Successful | Normal | 2026-10-01 21:33:26 | 2026-10-02 19:06:20 - 19:06:21 | 0 | none |
| …b45c (5) | Successful | Normal | 2026-10-01 21:33:04 | 2026-10-02 19:06:17 - 19:06:19 | 0 | none |

Items were added by Lab 2 intake on 2026-10-01 and consumed by the Lab 3 queue function on 2026-10-02, each in
about 1-2 s. No review status, defer date or due date is set. Nothing was retried, deleted, postponed or changed.

## 5. Operational health: Lab 2-5 processes

Sources: `uip or jobs list --all-fields` on APAutomation_Carlos and, separately, on its Solution sub-folder
`Invoice_Extraction_Agent_Carlos`; `uip or processes list`; `uip or triggers list` (time and queue);
`uip or jobs logs` per job, counted by level client-side. `jobs get` was not used. Job EnvironmentVariables,
InputArguments and OutputArguments were never printed or saved. No job was started, stopped or retried.

### Processes, versions, runtime

| Process | Type | Version | Folder | Jobs | States | Duration (s) |
|---|---|---|---|---|---|---|
| Invoice_Intake_RPA_Carlos (Lab 2) | RPA process | 1.0.0 | APAutomation_Carlos | 2 | 2 Successful | 129, 25 |
| Invoice_Extraction_Agent_Carlos (Lab 2) | Low-code agent | 1.0.0 | Solution sub-folder | 6 | 6 Successful | 18-25 |
| POMatch_Carlos_process_invoice_queue (Lab 3) | Python function | 0.0.2 | APAutomation_Carlos | 1 | 1 Successful | 19 |
| POMatch_Carlos_process_invoice (Lab 3) | Python function | 0.0.2 | APAutomation_Carlos | 2 | 2 Successful | 11, 10 |
| POMatch_Carlos_po_lookup (Lab 3) | Python function | 0.0.2 | APAutomation_Carlos | 1 | 1 Successful | 9 |
| POMatch_Carlos_get_invoice_status (Lab 3) | Python function | 0.0.2 | APAutomation_Carlos | 3 | 3 Successful | 9-10 |
| PostToERP_Carlos (Lab 4) | RPA process (browser) | 1.0.0 | APAutomation_Carlos | 2 | 2 Successful | 83, 3 |
| Invoice_Approval_Agent_Carlos (Lab 5) | Coded agent | 0.0.1 | APAutomation_Carlos | 3 | 3 Successful | 34, 9, 8 |

Versions are the processes' current package versions; `jobs list` does not expose a per-job package version.
Job window: 2026-10-01 21:32 to 2026-10-03 01:12 UTC, 20 jobs in total. All jobs were started manually
(source Manual), ran on the Serverless runtime on the inherited Default Serverless machine, at Normal
priority. Job retention is 30 days on every process.

- Runtime availability: Serverless 1 in the folder (inherited); Connected/Available 0 is normal for serverless.
- Robot: Agentic Labs Robot (Automation User) in the folder.
- Triggers: none (0 time triggers, 0 queue triggers) in either folder.

### Exceptions

- Faulted: none. Stopped: none. Pending / Running / Suspended: none.
- Long-running: none unusual. The longest runs are first-of-batch cold starts: Intake 129 s (5 PDFs, waits on
  5 agent child jobs), PostToERP 83 s (hosted portal cold start), approval agent 34 s on its first run
  versus 8-9 s afterwards.

### Log summary (counted by level; messages redacted)

| Process | Info | Warn | Error | Notes |
|---|---|---|---|---|
| Intake RPA | 39 | 1 | 0 | Warn = expected duplicate-invoice skip on the re-run |
| Extraction agent | 531 | 28 | 0 | Instrumentation/span warnings; first run also warns about deserializing unregistered types from checkpoint and a missing `id` in uipath.json |
| POMatch functions (7 jobs) | 9-26 each | 0 | 2 per job | "Resource overwrites read from ...uipath.json (0 entries)" and an empty `{}`: known noise |
| PostToERP | 21 | 0 | 0 | Clean |
| Approval agent | 27 | 0 | 4 per job | Known overwrites noise + `{}`, plus a Python FutureWarning (deprecated `uipath.platform.common.constants` import inside uipath_langchain) logged at Error level |

The Lab 5 governance 403 line did not appear in these jobs.

### Health summary

Healthy. 20 of 20 jobs Successful across both folders, no faulted, stopped, pending or abnormally long jobs, no
triggers to misfire, and serverless capacity is assigned. Every Error-level log line is either known noise or
a stderr warning on a Successful job.

### Hand-off to uipath-troubleshoot (observations only, not diagnosed)

1. Approval agent: FutureWarning about the deprecated `uipath.platform.common.constants` import is written
   at Error level on every run; check whether a uipath / uipath_langchain upgrade is needed before the old
   module is removed.
2. Extraction agent: "Deserializing unregistered type ... from checkpoint. This will be blocked" warnings on
   the first run; check whether a future runtime would block resume of IXP checkpoints.
3. Extraction agent: "'id' field not present in uipath.json" warning.
4. Two get_invoice_status jobs on 2026-10-03 (00:41 and 01:12 UTC), after the Lab 3 tests, were started
   manually; confirm where they came from.
5. Every Python job logs an empty `{}` at Error level next to the overwrites line; confirm this is the same
   noise.
