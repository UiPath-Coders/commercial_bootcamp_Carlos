# Invoice Approval Solution — Implementation Tasks

**Source SDD:** `lab7-planner/invoice-approval-solution-sdd.md` (Solution root) + 6 child SDDs (Solution ID `invoice-approval-solution`, all `Status: ready`)
**SDD scope:** solution
**Execution autonomy:** autonomous
**Delivery model:** cloud
**Generation date:** 2026-10-05
**App type:** web (AP portal) — `PostToERP_Carlos` only
**App state:** N/A — `PostToERP_Carlos` is already built; UI discovery is not part of this plan
**UI targeting:** N/A — existing hosted-portal element ids are kept; no new UI targets are captured

> Tasks below are derived from the SDD set. The SDDs remain the architectural source of truth.
> Existing, verified Lab 2–6 components are **reuse** rows: they get verify / enhance tasks, never rebuild tasks.
> The coded app `ap-approval-review-carlos` is deployed on its own with `uip codedapp` and is **not** a project of the `.uipx` solution `InvoiceApprovalSolution_Carlos`.

## Child SDDs read

| Child SDD | Project(s) | Project list section read |
|---|---|---|
| `lab7-planner/invoice-extraction-agent-sdd.md` | `Invoice_Extraction_Agent_Carlos` + IXP `Vendor Invoice Carlos` | §9 Project Structure, §3 Tools, §8 IXP |
| `lab7-planner/invoice-intake-rpa-sdd.md` | `Invoice_Intake_RPA_Carlos` | §11 Project Structure, §12 Queue Architecture |
| `lab7-planner/invoice-approval-process-sdd.md` | `InvoiceApprovalProcess_Carlos` + Coded Functions `POMatch_Carlos` | §4 Activities Inventory, §9 Integrated Components |
| `lab7-planner/invoice-approval-agent-sdd.md` | `Invoice_Approval_Agent_Carlos` | §9 Project Structure, §3 Tools |
| `lab7-planner/ap-approval-review-app-sdd.md` | `ap-approval-review-carlos` | §10 Project Structure, §9 Integrated Components |
| `lab7-planner/post-to-erp-sdd.md` | `PostToERP_Carlos` | §11 Project Structure |

## Dependency order

```text
Wave 0  T1 readiness ─┬─ T2 entity ─ T3 bucket ─ T4 queue        (shared resources, created/verified once)
Wave 1  T5 IXP → T6 extraction agent → T7 test
        T8 intake RPA → T9 test                                  (needs T2, T3, T4, T7)
        T10 POMatch functions → T11 test                         (needs T2, T4)
        T12 approval agent → T13 test                            (needs T2, T11)
        T14 PostToERP hardening → T15 test → T16 publish         (needs T2)
        T17 coded app → T18 test → T19 standalone deploy         (needs T2; outside .uipx)
Wave 2  T20 BPMN author → T21 BPMN test                          (needs T9, T11, T13, T16)
Wave 3  T22 solution pack/publish → T23 link + deploy            (needs T21)
Wave 4  T24 end-to-end tests                                     (needs T23, T19)
        T25 post-run verification and cleanup inventory          (needs T24)
```

## Stop conditions

Execution must stop and ask the user only when one of these happens:

- `uip login status` shows a tenant other than Training and `uip login tenant set Training` plus one `uip login refresh` do not fix it, or a 401 persists (the user must run `uip login`).
- `ERP_PO_LOOKUP_URL` is missing or its token `exp` has passed: only the user can supply a new signed URL. Never print or save it.
- A step would create a machine, machine template, robot account, role, folder outside a solution deploy, or any AOps / access policy.
- A step would touch another participant's `AP_Invoice_*` entity, or would write to records outside the test files named in the task.
- The reviewer path needs a human decision in the app (T24): stop and ask the user to approve the exact invoice named in the task.
- A deploy, uninstall or cleanup step would remove an existing deployment, process or Studio Web solution: list it and let the user or facilitator remove it.
- A secret-hygiene grep (`access_token=`, signed URL) has hits that cannot be cleared with the documented resource edit.

"Many tasks", "natural pause point" and "partial result looks usable" are not stop conditions.

## Open SME items carried as assumptions

All 27 `[SME REVIEW]` items in the SDD set are default-carried (`Blocking = no`). They travel into the tasks below as `Assumption pending SME confirmation` lines and must be confirmed before production sign-off. None creates a task of its own.

---

## Task T1 — uipath-platform — Verify tenant session and folder runtime readiness

**Identity:** `platform:InvoiceApprovalSolution_Carlos:readiness`
**Status:** [ ] pending
**Blocked by:** none
**Changes:** nothing (read-only verification) — tenant session, folder `Agentic Bootcamp/APAutomation_Carlos`, serverless runtime, inherited robot
**Acceptance evidence:** `uip login status` shows org customersuccessamer / tenant Training; folder key resolved; `uip or folders runtimes <key>` shows Serverless Total 1; inherited robot listed by `uip or users list-in-folder --include-inherited` (role and count only)
**Skill prompt:**

> Load uipath-platform. Confirm the session and runtime readiness described in the Solution root SDD `lab7-planner/invoice-approval-solution-sdd.md` §1 Solution Overview (Orchestrator folder) and §4 Shared Assets & Queues (Default Serverless machine + Agentic Labs Robot, inherited from `Agentic Bootcamp`). Read-only: never create machines, robots or roles.
> Assumption pending SME confirmation: UAT / PROD environments — proceeding with default "Only DEV (Training tenant) is defined".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-solution-sdd.md. Do not infer or guess.

- [ ] Check `uip login status`; switch to tenant Training if needed
- [ ] Resolve the folder key of `Agentic Bootcamp/APAutomation_Carlos` from `uip or folders list --limit 200`
- [ ] Check serverless runtime and inherited robot assignment on the folder
- [ ] **Validate:** readiness facts recorded in the task notes (no emails, no keys other than the folder key)

## Task T2 — uipath-platform — Verify shared Data Fabric entity AP_Invoice_Carlos

**Identity:** `platform:InvoiceApprovalSolution_Carlos:entity:AP_Invoice_Carlos`
**Status:** [ ] pending
**Blocked by:** T1
**Changes:** Data Fabric entity `AP_Invoice_Carlos` (tenant-scoped) — verification only; schema is final at 27 user fields
**Acceptance evidence:** `uip df entities get <id>` lists all 27 user fields with the formats in root SDD §4 (ApprovalPackageJson MULTILINE_TEXT; AgentProcessedAt and ReviewedAt DATETIME_WITH_TZ); a record query with `selectedFields` excluding VendorTaxId and ApprovalPackageJson returns rows
**Skill prompt:**

> Load uipath-platform. Verify the shared entity `AP_Invoice_Carlos` against the shared data model table in §4 Shared Assets & Queues of `lab7-planner/invoice-approval-solution-sdd.md`. It is tenant-scoped: never pass a folder key, and never read other `AP_Invoice_*` entities. Any record read that is shown or saved must exclude VendorTaxId and ApprovalPackageJson, and amounts must not be saved.
> Assumption pending SME confirmation: Rejection reason (OQ-6) — proceeding with default "Free text appended to ApprovalPackageJson as `reviewerNote` (as built)".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-solution-sdd.md. Do not infer or guess.

- [ ] Compare the entity's user fields and types with root SDD §4 (27 fields, 6 groups)
- [ ] Query records with confidential fields excluded and count lifecycle states
- [ ] **Validate:** field list matches; no confidential value printed or saved

## Task T3 — uipath-platform — Verify storage bucket InvoiceInbox_Carlos

**Identity:** `platform:InvoiceApprovalSolution_Carlos:bucket:InvoiceInbox_Carlos`
**Status:** [ ] pending
**Blocked by:** T1
**Changes:** storage bucket `InvoiceInbox_Carlos` in `Agentic Bootcamp/APAutomation_Carlos` — verification only
**Acceptance evidence:** `bucket-files list` shows the invoice PDFs at the bucket root, including the files reserved for Lab 10 (007, 009) and at least one file whose record is already POSTED (for BPMN debug)
**Skill prompt:**

> Load uipath-platform. Verify the bucket `InvoiceInbox_Carlos` described in §4 Shared Assets & Queues of `lab7-planner/invoice-approval-solution-sdd.md` holds the invoice files the intake RPA and the BPMN `FileName` input expect. Do not upload, move or delete files.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-solution-sdd.md. Do not infer or guess.

- [ ] List bucket files (`Data.Items`) and note the file names only
- [ ] Identify one file whose record is already POSTED for T21 debug runs; mark 007 and 009 as reserved
- [ ] **Validate:** file list recorded; nothing modified

## Task T4 — uipath-platform — Verify queue InvoiceQueue_Carlos

**Identity:** `platform:InvoiceApprovalSolution_Carlos:queue:InvoiceQueue_Carlos`
**Status:** [ ] pending
**Blocked by:** T1
**Changes:** queue `InvoiceQueue_Carlos` in `Agentic Bootcamp/APAutomation_Carlos` — verification only
**Acceptance evidence:** `uip or queues get <key>` shows unique reference enabled and Max Retries 0, matching intake SDD §12 Queue Configuration; no item left In Progress
**Skill prompt:**

> Load uipath-platform. Verify the queue `InvoiceQueue_Carlos` against §12 Queue Architecture of `lab7-planner/invoice-intake-rpa-sdd.md` and the queue row in §4 of `lab7-planner/invoice-approval-solution-sdd.md` (batch path only; BPMN path passes `CreateQueueItem=false`). Use the full folder path for queue calls.
> Assumption pending SME confirmation: Duplicate detection (OQ-8) — proceeding with default "Same InvoiceNumber → existing record reused; queue unique reference = record Id".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-intake-rpa-sdd.md. Do not infer or guess.

- [ ] Read queue settings and compare with intake SDD §12 Queue Configuration
- [ ] Count items by status; confirm none is In Progress
- [ ] **Validate:** settings match; nothing modified

## Task T5 — uipath-ixp — Verify IXP model Vendor Invoice Carlos (validation)

**Identity:** `ixp:Vendor Invoice Carlos:model-validation`
**Status:** [ ] pending
**Blocked by:** T1
**Changes:** IXP project `Vendor Invoice Carlos` — verification only (no retraining, no new tag)
**Acceptance evidence:** model version 6 carries tag `live`; latest predictions on the lab documents match `lab1-ixp/reference/expected-extractions.json` for the eight fields (VendorTaxId compared as match/miss only; dates compared as dates)
**Skill prompt:**

> Load uipath-ixp. Validate the IXP model contract documented in §8 Integrated Components → IXP / Document Understanding Models of `lab7-planner/invoice-extraction-agent-sdd.md` (eight fields, tag `live` = v6, no folder deployment) and its success metrics in §5 Evaluation Criteria.
> Assumption pending SME confirmation: Model deployment — proceeding with default "Keep tag `live` (as built); no folder deployment".
> Assumption pending SME confirmation: Accuracy target — proceeding with default "100% on the 5 lab documents; production target to be agreed".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-extraction-agent-sdd.md. Do not infer or guess.

- [ ] Confirm the model version and the `live` tag
- [ ] Read predictions for the lab documents and compare field by field with the expected extractions
- [ ] **Validate:** per-field match table recorded with VendorTaxId as match/miss only

## Task T6 — uipath-agents — Verify Invoice_Extraction_Agent_Carlos deployment and IXP binding

**Identity:** `agents:Invoice_Extraction_Agent_Carlos:verify-deployment`
**Status:** [ ] pending
**Blocked by:** T5
**Changes:** low-code agent `Invoice_Extraction_Agent_Carlos` (solution deployment in `Agentic Bootcamp/APAutomation_Carlos/Invoice_Extraction_Agent_Carlos`) — verify; redeploy only if the IXP resource binding differs from the SDD
**Acceptance evidence:** agent resource `VendorInvoiceIXP` points to project `Vendor Invoice Carlos`, tag `live`, `guardrail.policies []`; one job on a lab document returns the eight fields in the documented formats
**Skill prompt:**

> Load uipath-agents. Verify the low-code agent against §2 Agent Framework, §3 Tools, §6 Orchestrator Bindings and §9 Project Structure → Low-code Agent Structure of `lab7-planner/invoice-extraction-agent-sdd.md`. Reuse the existing deployment; redeploy as a solution under the APAutomation_Carlos folder key only if the binding is wrong.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-extraction-agent-sdd.md. Do not infer or guess.

- [ ] Check the agent's IXP tool resource against SDD §3 / §8
- [ ] Confirm the deployed process and folder path in SDD §6
- [ ] **Validate:** agent project validates; one job succeeds with the output schema in SDD §3

## Task T7 — uipath-agents — Testing: Invoice_Extraction_Agent_Carlos (MANDATORY)

**Identity:** `agents:Invoice_Extraction_Agent_Carlos:testing`
**Status:** [ ] pending
**Blocked by:** T6
**Changes:** evaluation results only (no project change)
**Acceptance evidence:** evaluation set in SDD §10 passes — happy path, missing-field case returns empty values (intake decides Valid?), error case with missing `SourceFile` returns an error; results recorded without tax IDs or amounts
**Skill prompt:**

> Load uipath-agents and run its testing workflow end-to-end for `Invoice_Extraction_Agent_Carlos`. Always thorough: happy path + edge cases + error scenarios. Use §5 Evaluation Criteria and §10 Testing Strategy of `lab7-planner/invoice-extraction-agent-sdd.md` as the test inputs. See that skill's testing references for commands, test-case authoring, and best practices. Do not describe the testing procedure here — the specialist owns it.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-extraction-agent-sdd.md. Do not infer or guess.

- [ ] Run testing workflow per uipath-agents' testing reference
- [ ] **Validate:** all tests pass; record results

## Task T8 — uipath-rpa — Verify / enhance Invoice_Intake_RPA_Carlos against the BPMN contract

**Identity:** `rpa:Invoice_Intake_RPA_Carlos:Main.xaml`
**Status:** [ ] pending
**Blocked by:** T2, T3, T4, T7
**Changes:** RPA project `lab2-rpa/Invoice_Intake_RPA_Carlos/` (`Main.xaml`, `ProcessInvoiceFile.xaml`, `ExtractInvoiceData.xaml`, `CreateInvoiceRecord.xaml`) — enhance only where the as-built contract differs from the SDD
**Acceptance evidence:** `uip rpa build` succeeds; Main exposes `FileName`, `CreateQueueItem` in and `RecordId` (GUID string), `IsValid`, `WasDuplicate`, `ErrorMessage` out exactly as root SDD §3 flow #1; new records start `InvoiceLifecycleState = EXTRACTED`
**Skill prompt:**

> Load uipath-rpa. Verify `Invoice_Intake_RPA_Carlos` against §3 Detailed Process Steps, §4 Business Rules, §5 Data Definitions, §7 Exception Handling and §11 Workflow Inventory of `lab7-planner/invoice-intake-rpa-sdd.md`, and against the call contract in flow #1 of §3 Cross-Project Data Flow of `lab7-planner/invoice-approval-solution-sdd.md`. Enhance only the gaps; keep the existing argument names (they are the contract) and never declare a variable named like an argument.
> Assumption pending SME confirmation: Vendor return (PDD OQ-1) — proceeding with default "No vendor message; IsValid false and ErrorMessage returned; BPMN ends Invalid Invoice".
> Assumption pending SME confirmation: Duplicate rule (OQ-8) — proceeding with default "InvoiceNumber (as built)".
> Assumption pending SME confirmation: Volume — proceeding with default "Not stated; sized at 1 serverless job per file".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-intake-rpa-sdd.md. Do not infer or guess.

- [ ] Compare Main.xaml arguments with SDD §5 Option B data definitions and root SDD §3 flow #1
- [ ] Confirm the Valid? gate (BR-01, BR-02) and idempotent create on InvoiceNumber (BR-03)
- [ ] Confirm `CreateQueueItem=false` skips the queue item
- [ ] **Validate:** `uip rpa build` succeeds (retry validate once on the Helm timeout)

## Task T9 — uipath-rpa — Testing: Invoice_Intake_RPA_Carlos (MANDATORY)

**Identity:** `rpa:Invoice_Intake_RPA_Carlos:testing`
**Status:** [ ] pending
**Blocked by:** T8
**Changes:** test runs only; republish through uipath-platform only if T8 changed the package
**Acceptance evidence:** SDD §17 cases pass — valid file creates or reuses one record (`WasDuplicate` true on re-run), structurally incomplete file returns `IsValid` false with no record, missing file faults; serverless job outputs recorded by RecordId only
**Skill prompt:**

> Load uipath-rpa and run its testing workflow end-to-end for `Invoice_Intake_RPA_Carlos`. Always thorough: happy path + edge cases + error scenarios. Use §17 Testing Strategy of `lab7-planner/invoice-intake-rpa-sdd.md` as the test inputs; do not use the files reserved for Lab 10 (007, 009). See that skill's testing references for commands, test-case authoring, and best practices. Do not describe the testing procedure here — the specialist owns it.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-intake-rpa-sdd.md. Do not infer or guess.

- [ ] Run testing workflow per uipath-rpa's testing reference
- [ ] **Validate:** all tests pass; record results

## Task T10 — uipath-functions — Verify POMatch_Carlos entry-point bindings and environment variables

**Identity:** `functions:POMatch_Carlos:bindings`
**Status:** [ ] pending
**Blocked by:** T2, T4
**Changes:** Coded Functions package `POMatch_Carlos` 0.0.2 (`lab3-api/POMatch_Carlos/`) and its four Orchestrator processes — re-bind entry points or set env vars only where they differ from the SDD
**Acceptance evidence:** `uip or packages entry-points POMatch_Carlos:0.0.2` lists the four entry points; each process `POMatch_Carlos_<ep>` is bound to its own entry point; a job of `_process_invoice` started without `--environment-variables` reaches the ERP (proves the process env var); first line of `main.py` sets httpx to WARNING
**Skill prompt:**

> Load uipath-functions. Verify the Coded Functions table in §9 Integrated Components → Coded Functions of `lab7-planner/invoice-approval-process-sdd.md`: four entry points, one process each, typed inputs/outputs, match reasons, and `ERP_PO_LOOKUP_URL` as a process environment variable on `_process_invoice` and `_process_invoice_queue`. Never print, save or commit the signed URL or its token; check it only by decoding the token's `exp`.
> Assumption pending SME confirmation: ERP retry (OQ-7) — proceeding with default "No automatic retry; Operational Failure end; AP re-runs".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-process-sdd.md. Do not infer or guess.

- [ ] List entry points from the package and compare with the SDD table
- [ ] Check each process's entry-point binding; re-bind any process silently rebound to the first entry point
- [ ] Confirm the env var on the two processes by a job without job-level env vars (do not print it)
- [ ] **Validate:** four bindings correct; httpx logging line present; no secret in output

## Task T11 — uipath-functions — Testing: POMatch_Carlos (validation)

**Identity:** `functions:POMatch_Carlos:testing`
**Status:** [ ] pending
**Blocked by:** T10
**Changes:** test runs only
**Acceptance evidence:** `test_rules.py`, `test_po_lookup_live.py` and `test_po_lookup_errors.py` pass against participant code; `get_invoice_status` returns unset ApprovalNeeded as true and unset PostedToERP as false; tolerance applies in both directions
**Skill prompt:**

> Load uipath-functions and run its testing workflow for `POMatch_Carlos`. Always thorough: happy path + edge cases + error scenarios, covering the rules and match reasons in §9 Coded Functions of `lab7-planner/invoice-approval-process-sdd.md`. Run only the participant-compatible reference tests listed in `lab3-api/reference/README.md`. See that skill's testing references for commands. Do not describe the testing procedure here — the specialist owns it.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-process-sdd.md. Do not infer or guess.

- [ ] Run the function tests and one local run per entry point
- [ ] **Validate:** all tests pass; record results without amounts

## Task T12 — uipath-agents — Verify / enhance Invoice_Approval_Agent_Carlos

**Identity:** `agents:Invoice_Approval_Agent_Carlos:main.py`
**Status:** [ ] pending
**Blocked by:** T2, T11
**Changes:** coded LangGraph agent `lab5-coded-agent/agent/Invoice_Approval_Agent_Carlos/` (`main.py`, `approval_gates.py`, `narrative.py`, `data_fabric.py`) — enhance only gaps; redeploy as a new version only if changed
**Acceptance evidence:** graph nodes and gate table match SDD §3; retry guard never downgrades APPROVED / REJECTED / POSTED; VendorTaxId never enters graph state; process `Invoice_Approval_Agent_Carlos` accepts `{"recordId": …}`
**Skill prompt:**

> Load uipath-agents. Verify the coded agent against §2 Agent Framework, §3 Tools (gate table and tool invocation policy), §4 Memory / RAG, §6 Orchestrator Bindings, §7 Error Handling & Escalation and §9 Coded Agent Structure of `lab7-planner/invoice-approval-agent-sdd.md`, and its inputs/outputs in flow #9 of §3 Cross-Project Data Flow of `lab7-planner/invoice-approval-solution-sdd.md`.
> Assumption pending SME confirmation: Required evidence — proceeding with default "GLAccount, CostCenter, Approver, ReceiptReference (as built); PaymentTerms, VendorRiskScore, InvoiceLineSummary optional".
> Assumption pending SME confirmation: Approve unmatched PO (OQ-4) — proceeding with default "No — PO-mismatched invoices end Held (HOLD_PO_MISMATCH)".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-agent-sdd.md. Do not infer or guess.

- [ ] Compare graph nodes and the four gates with SDD §3
- [ ] Confirm the retry guard and the no-VendorTaxId-in-state rule
- [ ] Confirm the deployed process and its input argument
- [ ] **Validate:** agent project builds; unit tests of `approval_gates.py` pass

## Task T13 — uipath-agents — Testing: Invoice_Approval_Agent_Carlos (MANDATORY)

**Identity:** `agents:Invoice_Approval_Agent_Carlos:testing`
**Status:** [ ] pending
**Blocked by:** T12
**Changes:** evaluation results only (the live eval writes agent fields on the six TRAIN records)
**Acceptance evidence:** evaluation set in SDD §10 passes; a gate-4 record (AP-TRAIN-1006) proves exactly one LLM call via `uip traces spans get`; a re-run on a prepared record makes no second LLM call
**Skill prompt:**

> Load uipath-agents and run its testing workflow end-to-end for `Invoice_Approval_Agent_Carlos`. Always thorough: happy path + edge cases + error scenarios + trajectory evaluation. Use §5 Evaluation Criteria and §10 Testing Strategy of `lab7-planner/invoice-approval-agent-sdd.md` as the test inputs. Ask before clearing agent fields on any record. See that skill's testing references for commands, test-case authoring, and best practices. Do not describe the testing procedure here — the specialist owns it.
> Assumption pending SME confirmation: Narrative quality bar — proceeding with default "LLM-judge criteria in §5; AP lead review in UAT".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-agent-sdd.md. Do not infer or guess.

- [ ] Run testing workflow per uipath-agents' testing reference
- [ ] **Validate:** all tests pass; record results by record Id only

## Task T14 — uipath-rpa — Harden PostToERP_Carlos ready-to-post rule (BR-04)

**Identity:** `rpa:PostToERP_Carlos:ResolveInvoice.xaml`
**Status:** [ ] pending
**Blocked by:** T2
**Changes:** RPA project `lab4-rpa/PostToERP_Carlos/` — `ResolveInvoice.xaml` (ready-to-post check); existing portal workflows and Object Repository untouched
**Acceptance evidence:** when ApprovalNeeded is true or unset, posting also requires `InvoiceLifecycleState = APPROVED`; `uip rpa build` succeeds; `grep -c "role='AX" PostInvoiceInPortal.xaml` prints 0; `grep -rl localhost` on the project (excluding `.local`) is empty
**Skill prompt:**

> Load uipath-rpa. Implement the target hardening of BR-04 described in §3 Detailed Process Steps → Step 6c and §4 Business Rules of `lab7-planner/post-to-erp-sdd.md`: keep the as-built ready-to-post rule and additionally require the record state APPROVED when approval is needed. The project is already built: do not re-capture UI targets or change `PostInvoiceInPortal.xaml`; keep the hosted-portal element ids. Keep Main's un-prefixed output names and never declare a local variable with the same name.
> Assumption pending SME confirmation: Approve unmatched PO (OQ-4) — proceeding with default "No (PDD BR-4)".
> Assumption pending SME confirmation: Portal credential — proceeding with default "Keep the optional scripted sign-in as built; credential asset recommended before production".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/post-to-erp-sdd.md. Do not infer or guess.

- [ ] Add the APPROVED-state condition to the ready-to-post check in `ResolveInvoice.xaml`
- [ ] Keep `Posted = false` with a reason when the rule fails
- [ ] Run the portability greps (AX selectors, localhost)
- [ ] **Validate:** `uip rpa build` succeeds

## Task T15 — uipath-rpa — Testing: PostToERP_Carlos (MANDATORY)

**Identity:** `rpa:PostToERP_Carlos:testing`
**Status:** [ ] pending
**Blocked by:** T14
**Changes:** test runs only
**Acceptance evidence:** SDD §17 cases pass on serverless against the hosted portal (`PortalUrl` from root SDD §4) — already-posted record returns `WasAlreadyPosted` true without opening the portal; case B2 (approval needed, not APPROVED) returns `Posted` false with ApprovalConfirmed false and true; a ready record posts once and ends POSTED
**Skill prompt:**

> Load uipath-rpa and run its testing workflow end-to-end for `PostToERP_Carlos`. Always thorough: happy path + edge cases + error scenarios, using §17 Testing Strategy of `lab7-planner/post-to-erp-sdd.md` (include case B2 after the BR-04 hardening). Done means the serverless job against the hosted portal; never test against a localhost portal. Do not use the records of files reserved for Lab 10 (007, 009). See that skill's testing references for commands. Do not describe the testing procedure here — the specialist owns it.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/post-to-erp-sdd.md. Do not infer or guess.

- [ ] Run testing workflow per uipath-rpa's testing reference
- [ ] **Validate:** all tests pass; record results by RecordId and PostingId only

## Task T16 — uipath-platform — Publish the hardened PostToERP_Carlos version

**Identity:** `platform:PostToERP_Carlos:process-version`
**Status:** [ ] pending
**Blocked by:** T15
**Changes:** package `PostToERP_Carlos` (new version) and process `PostToERP_Carlos` in `Agentic Bootcamp/APAutomation_Carlos`
**Acceptance evidence:** `uip or packages list` shows the new version; the process points to it; one serverless job on an already-posted record returns `WasAlreadyPosted` true
**Skill prompt:**

> Load uipath-platform. Publish the hardened `PostToERP_Carlos` package as a new version and move the existing process in `Agentic Bootcamp/APAutomation_Carlos` to it, per §16 Deployment Environment of `lab7-planner/post-to-erp-sdd.md`. Upload the package without `--folder-key`; update the existing process instead of creating a second one.
> Assumption pending SME confirmation: UAT / PROD — proceeding with default "DEV only".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/post-to-erp-sdd.md. Do not infer or guess.

- [ ] Pack and upload the new package version
- [ ] Update the process to the new version
- [ ] **Validate:** one smoke job succeeds with `WasAlreadyPosted` true

## Task T17 — uipath-coded-apps — Verify / enhance ap-approval-review-carlos decision flow

**Identity:** `coded-apps:ap-approval-review-carlos:decision-flow`
**Status:** [ ] pending
**Blocked by:** T2
**Changes:** coded app source `lab6-coded-app/ap-approval-review-carlos/` (React + Vite + Tailwind) — enhance only gaps; this app is **not** added to the `.uipx` solution
**Acceptance evidence:** Approve and Reject are enabled only for READY_FOR_APPROVAL / NEEDS_AP_REVIEW with ApprovalNeeded true; NEEDS_AP_REVIEW shows the one-line incomplete-evidence note; a decision writes InvoiceLifecycleState, ReviewedBy, ReviewedAt and `reviewerNote` via `updateRecord({ name }, id, patch)`; `npm run build` succeeds
**Skill prompt:**

> Load uipath-coded-apps. Verify the app against §3 Pages & Routes, §4 Components, §6 API Integration, §7 User Flows and §8 Error Handling of `lab7-planner/ap-approval-review-app-sdd.md`. The entity is addressed by name; keep `uipath.json` baseUrl as the plain host and `.uipath/` git-ignored. The app stays outside the `InvoiceApprovalSolution_Carlos` `.uipx` lifecycle.
> Assumption pending SME confirmation: Rejection reason field (OQ-6) — proceeding with default "Free-text `reviewerNote` appended to ApprovalPackageJson (as built)".
> Assumption pending SME confirmation: Approve with incomplete evidence (OQ-11) — proceeding with default "Yes, with the incomplete-evidence note shown (as built)".
> Assumption pending SME confirmation: Reviewer access — proceeding with default "Folder users of `APAutomation_Carlos`".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/ap-approval-review-app-sdd.md. Do not infer or guess.

- [ ] Compare the decision enablement rule and the write patch with SDD §6 / §7
- [ ] Confirm VendorTaxId is not shown and the table has no Record ID column
- [ ] **Validate:** `npm run build` succeeds

## Task T18 — uipath-coded-apps — Testing: ap-approval-review-carlos (MANDATORY)

**Identity:** `coded-apps:ap-approval-review-carlos:testing`
**Status:** [ ] pending
**Blocked by:** T17
**Changes:** test runs only (any decision on a real record waits for T24 and the user)
**Acceptance evidence:** SDD §11 unit and E2E cases pass; decision buttons disabled for every other state; after any test decision, no other record changed to APPROVED / REJECTED
**Skill prompt:**

> Load uipath-coded-apps and run its testing workflow end-to-end for `ap-approval-review-carlos`. Always thorough: happy path + edge cases + error scenarios, using §11 Testing Strategy of `lab7-planner/ap-approval-review-app-sdd.md`. Do not approve or reject a real invoice in this task; the reviewer decision belongs to T24 and the user. See that skill's testing references for commands. Do not describe the testing procedure here — the specialist owns it.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/ap-approval-review-app-sdd.md. Do not infer or guess.

- [ ] Run testing workflow per uipath-coded-apps' testing reference
- [ ] **Validate:** all tests pass; record results

## Task T19 — uipath-coded-apps — Standalone deploy of ap-approval-review-carlos (outside the .uipx)

**Identity:** `coded-apps:ap-approval-review-carlos:deploy`
**Status:** [ ] pending
**Blocked by:** T18
**Changes:** coded app package `ap-approval-review-carlos` (new version only if T17 changed code) deployed to `Agentic Bootcamp/APAutomation_Carlos` — not part of `InvoiceApprovalSolution_Carlos`
**Acceptance evidence:** `uip or packages list` shows package `ap-approval-review-carlos` at the deployed version; an HTTP check of `https://customersuccessamer.staging.uipath.host/ap-approval-review-carlos` returns 200; the solution manifest does not list the app
**Skill prompt:**

> Load uipath-coded-apps. If T17 changed the app, bump the version and redeploy it on its own, as §10 Project Structure → Deployment Target of `lab7-planner/ap-approval-review-app-sdd.md` states (`npm run build` → `uip codedapp pack dist` → `publish -t Web` → `deploy --folder-key <APAutomation_Carlos key>`). If nothing changed, verify the deployed 1.0.1 only. Never add the app to the `.uipx` solution.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/ap-approval-review-app-sdd.md. Do not infer or guess.

- [ ] Decide redeploy vs verify from T17's result
- [ ] Pack, publish and deploy with a bumped version when needed
- [ ] **Validate:** package listed; app URL returns HTTP 200

## Task T20 — uipath-maestro-bpmn — Author InvoiceApprovalProcess_Carlos

**Identity:** `maestro-bpmn:InvoiceApprovalProcess_Carlos:InvoiceApprovalProcess_Carlos.bpmn`
**Status:** [ ] pending
**Blocked by:** T9, T11, T13, T16
**Changes:** new BPMN project `lab10-maestro-bpmn/InvoiceApprovalSolution_Carlos/InvoiceApprovalProcess_Carlos/` (`.bpmn`, `project.uiproj`, `entry-points.json`, `bindings_v2.json`) inside the new solution `InvoiceApprovalSolution_Carlos.uipx`
**Acceptance evidence:** the process validates; it contains the 18 activities and 5 end events of SDD §4 / §6, the three gateways of §5, the PT2M timer loop with at most 6 polls, and an error boundary on every service task; StartJob calls use literal release keys of the five existing processes
**Skill prompt:**

> Load uipath-maestro-bpmn. Author the BPMN process exactly as §2 Process Diagram, §4 Activities Inventory, §5 Gateways & Sequence Flows, §6 Events, §7 Data Objects & Variables, §9 Integrated Components, §10 Error Handling & Retry and §12 Project Structure of `lab7-planner/invoice-approval-process-sdd.md` describe. It calls the already-published processes `Invoice_Intake_RPA_Carlos`, `POMatch_Carlos_process_invoice`, `Invoice_Approval_Agent_Carlos`, `POMatch_Carlos_get_invoice_status` and `PostToERP_Carlos`; the reviewer app is not called (the poll reads the record). Follow the repository's Lab 10 runtime rules; use the reference shape in `lab10-maestro-bpmn/reference/` but none of its `_Reference` names or placeholder keys.
> Assumption pending SME confirmation: Review timeout (OQ-5) — proceeding with default "6 polls × PT2M (about 13 minutes), then end Held".
> Assumption pending SME confirmation: Approve unmatched (OQ-4) — proceeding with default "No — end Held".
> Assumption pending SME confirmation: Vendor return (OQ-1) — proceeding with default "No notification; end Invalid Invoice".
> Assumption pending SME confirmation: ERP retry (OQ-7) — proceeding with default "No automatic retry; Operational Failure end; AP re-runs".
> Assumption pending SME confirmation: Production trigger — proceeding with default "Manual / API start with `FileName` per invoice".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-process-sdd.md. Do not infer or guess.

- [ ] Create the solution folder and the BPMN project per SDD §12
- [ ] Author activities, gateways, events and variables per SDD §4–§7
- [ ] Write `entry-points.json` (FileName input) and `bindings_v2.json` (name + folderPath per process) by hand, then refresh
- [ ] **Validate:** BPMN validate passes

## Task T21 — uipath-maestro-bpmn — Testing: InvoiceApprovalProcess_Carlos (MANDATORY)

**Identity:** `maestro-bpmn:InvoiceApprovalProcess_Carlos:testing`
**Status:** [ ] pending
**Blocked by:** T20
**Changes:** debug runs only (each debug run leaves a Studio Web solution — list it for cleanup)
**Acceptance evidence:** debug run on the already-POSTED file from T3 ends Paid via `gwPosted`; gateway, boundary-event and error-path cases of SDD §13 that do not need files 007 / 009 pass; `resources/` grep for `access_token` / `environmentVariables` is clean before debug
**Skill prompt:**

> Load uipath-maestro-bpmn and run its testing workflow end-to-end for `InvoiceApprovalProcess_Carlos`. Always thorough: happy path + gateway coverage + boundary-event and timeout scenarios + error paths, using §13 Testing Strategy of `lab7-planner/invoice-approval-process-sdd.md`. Debug only with a file whose record is already POSTED; never with 007 or 009. See that skill's testing references for commands. Do not describe the testing procedure here — the specialist owns it.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-process-sdd.md. Do not infer or guess.

- [ ] Run testing workflow per uipath-maestro-bpmn's testing reference
- [ ] List the debug solution ids for cleanup
- [ ] **Validate:** all tests pass; record element executions per case

## Task T22 — uipath-solution — Pack and publish InvoiceApprovalSolution_Carlos

**Identity:** `solution:InvoiceApprovalSolution_Carlos:pack-publish`
**Status:** [ ] pending
**Blocked by:** T21
**Changes:** solution `lab10-maestro-bpmn/InvoiceApprovalSolution_Carlos/` (`.uipx` manifest, `resources/`) and its published package
**Acceptance evidence:** `resources refresh` run and env vars cleared from `resources/`; packed zip (nested nupkgs included) has 0 hits for `access_token=`; publish succeeds; the manifest lists the BPMN project only (no coded app)
**Skill prompt:**

> Load uipath-solution. Package the solution as §8 Next Steps → Terminal artefact of `lab7-planner/invoice-approval-solution-sdd.md` and the Security row of §12 Non-Functional Requirements of `lab7-planner/invoice-approval-process-sdd.md` describe: refresh resources, strip environment variables from `resources/`, pack, check the pack for `access_token=`, then publish. Keep the `.uipx` manifest in git and ignore build zips. Do not add `ap-approval-review-carlos` to the solution.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-solution-sdd.md. Do not infer or guess.

- [ ] Refresh resources and clear `environmentVariables` from every resource file
- [ ] Pack and grep the zip for `access_token=`
- [ ] Publish the package
- [ ] **Validate:** publish succeeds; secret grep shows 0 hits

## Task T23 — uipath-solution — Link the five Lab processes and deploy the solution

**Identity:** `solution:InvoiceApprovalSolution_Carlos:deploy`
**Status:** [ ] pending
**Blocked by:** T22
**Changes:** deployment config file and a new child folder under `Agentic Bootcamp/APAutomation_Carlos` created by `deploy run`
**Acceptance evidence:** `deploy config link` applied for the five existing processes with `--folder-path "Agentic Bootcamp/APAutomation_Carlos"`; `deploy status` (by PipelineDeploymentId) reports success; `APAutomation_Carlos` still holds exactly one copy of each Lab 2–5 process; the new folder name is reported to the user
**Skill prompt:**

> Load uipath-solution. Deploy as §8 Next Steps → Terminal artefact of `lab7-planner/invoice-approval-solution-sdd.md` describes: get the deploy config for the published package, link the five existing Lab processes (never install copies), then deploy as a new child folder under `Agentic Bootcamp/APAutomation_Carlos`. A new version needs a new deployment name; never uninstall an older deployment.
> Assumption pending SME confirmation: UAT / PROD environments — proceeding with default "Only DEV (Training tenant) is defined".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-solution-sdd.md. Do not infer or guess.

- [ ] Get the deploy config and link each of the five processes
- [ ] Run the deploy (rerun once on an HTTP 500 execution timeout)
- [ ] **Validate:** deploy status succeeds; no duplicate Lab processes in the parent folder

## Task T24 — uipath-maestro-bpmn — End-to-end tests through the deployed solution

**Identity:** `maestro-bpmn:InvoiceApprovalSolution_Carlos:e2e-testing`
**Status:** [ ] pending
**Blocked by:** T23, T19
**Changes:** BPMN instances and the invoice records they process (files 007 and 009 are used here for the first time)
**Acceptance evidence:** root SDD §7 E2E-01 to E2E-10 recorded — 007 ends Paid with its record POSTED; 009 waits in the timer loop, resumes within one poll after the user approves VA-INV-40592 (Vertex Analytics) in the app, and ends Paid; timeout case ends Held after PollCount 6; secret-hygiene check (E2E-10) shows 0 hits
**Skill prompt:**

> Load uipath-maestro-bpmn and run the solution-level end-to-end tests in §7 Testing Strategy of `lab7-planner/invoice-approval-solution-sdd.md`, together with the End-to-End Orchestration Test in §13 of `lab7-planner/invoice-approval-process-sdd.md`. Monitor instances by element executions and instance variables. For the reviewer path, stop and ask the user to approve the exact invoice VA-INV-40592 (Vertex Analytics) in `ap-approval-review-carlos` — not TRAIN-VA-1006.
> Assumption pending SME confirmation: Review time limit (OQ-5) — proceeding with default "6 polls × 2 minutes (about 13 minutes), then end Held".
> Assumption pending SME confirmation: On-behalf approval (OQ-12) — proceeding with default "Yes for the lab; production requires the named approver".
> Assumption pending SME confirmation: Cycle-time targets (OQ-9) — proceeding with default "None set; measured from Processed Timestamp to posting".
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-solution-sdd.md. Do not infer or guess.

- [ ] Run 007 (auto-approved path) and confirm Paid + POSTED
- [ ] Run 009 (reviewer path); ask the user to approve the named invoice; confirm Paid
- [ ] Run the remaining E2E cases with non-reserved files
- [ ] **Validate:** every E2E row has its expected end state and assertions recorded

## Task T25 — uipath-platform — Post-run verification and cleanup inventory

**Identity:** `platform:InvoiceApprovalSolution_Carlos:post-run-verification`
**Status:** [ ] pending
**Blocked by:** T24
**Changes:** nothing (read-only) — produces the cleanup list for the user / facilitator
**Acceptance evidence:** no record other than the approved test invoice changed to APPROVED / REJECTED; job lists checked per solution sub-folder; leftover deployment folders and Studio Web debug solutions listed; no environment variables or tokens pasted anywhere
**Skill prompt:**

> Load uipath-platform. Verify the post-run state against §6 Non-Functional Requirements (Compliance, Logging & Monitoring) of `lab7-planner/invoice-approval-solution-sdd.md`: record states by lifecycle (confidential fields excluded), jobs per solution sub-folder, and a list of leftover deployment folders and debug solutions. Read-only: report what to clean up; never delete or uninstall.
> Use values, mappings, and structure exactly as documented in the SDD at lab7-planner/invoice-approval-solution-sdd.md. Do not infer or guess.

- [ ] Count records by lifecycle state and confirm only the intended record was decided
- [ ] List jobs per solution sub-folder and their states
- [ ] List leftover deployment folders and debug solutions for cleanup
- [ ] **Validate:** inventory recorded; nothing modified
