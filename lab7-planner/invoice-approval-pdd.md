# Process Design Document: Vendor Invoice Approval

| Item | Value |
|---|---|
| Process name | Vendor Invoice Approval |
| Process owner | Accounts Payable (AP) |
| Document status | Draft for business review |
| Source | `source-process.md` and the Lab 7 business brief |
| Data classification | Confidential (contains vendor tax IDs, bank details and invoice amounts) |
| Currency | USD |

This document describes the business process only. It does not prescribe tools, products or a technical
design. The Solution Design Document (SDD) will cover those later.

---

## 1. Purpose

Finance pays vendor invoices only after it has checked that each invoice is complete, that it bills against a real
purchase order (PO) for the right amount, that it has been approved where policy requires approval, and that it
has been posted to the ERP for payment. Today most of this work is manual. Staff key in invoice data, chase
approvers and reconcile POs by hand.

The target process aims to:

1. **Reduce manual invoice entry.** Invoice data is captured from the document, not typed in by hand.
2. **Reduce approval delays.** Approvers get a complete, structured package with a recommendation.
3. **Capture early-payment discounts.** Invoices reach posting and payment sooner.
4. **Prevent duplicate payments.** Each invoice has one record, and an invoice that has already been posted is
   never posted again.

## 2. Scope

**In scope**

- Vendor invoices that arrive as documents (for example, PDF attachments sent by email).
- Capturing the eight core invoice fields.
- Checking that the invoice is structurally complete and creating one invoice record for it.
- Matching the invoice to its PO in the ERP and deciding whether approval is needed.
- Assembling an approval package with a recommendation for invoices that need approval.
- An AP reviewer approving or rejecting the invoice, with the decision recorded.
- Posting approved and auto-approved invoices to the ERP / AP portal, submitting them for payment and closing
  them.

**Out of scope:** see section 13.

## 3. Actors

| Actor | Role in the process |
|---|---|
| Vendor | Sends the invoice. Receives a rejection when the invoice is structurally incomplete (see open question OQ-1). |
| AP reviewer | Reviews approval packages and their recommendations, then approves or rejects. In this lab the AP reviewer acts on behalf of the named budget approver. |
| Budget approver | The budget owner named on the approval package, and the owner of the business decision. In this lab the AP reviewer records the decision on the approver's behalf. |
| ERP | The system of record for purchase orders, vendor status and payments. Invoices are posted here through the ERP / AP portal. |

## 4. Systems (business view)

| System | Business role |
|---|---|
| Invoice intake channel | Where vendor invoices arrive (email inbox / document drop). |
| Invoice record store | Holds the single invoice record that every step reads and updates. |
| ERP | Supplies PO existence, PO open amount and vendor status. Receives the posted invoice and schedules payment. |
| ERP / AP portal | The screen AP uses to post invoices into the ERP. |
| Review workspace | Where the AP reviewer reads approval packages and records approve / reject decisions. |

## 5. Trigger

A vendor invoice document arrives through the intake channel. Each invoice document starts one run of the
process. The run ends in one of three outcomes:

- **Rejected – structurally incomplete** (end after step 2)
- **Rejected – reviewer decision** (end after step 5)
- **Paid / closed** (end after step 6)

## 6. Process steps

### Step 1: Extract Invoice Data

- **Input:** the vendor invoice document.
- **Activity:** read these eight fields from the document:

  | # | Field |
  |---|---|
  | 1 | Vendor Name |
  | 2 | Vendor Tax ID |
  | 3 | Invoice Number |
  | 4 | Invoice Date |
  | 5 | PO Number |
  | 6 | Total Amount |
  | 7 | Currency |
  | 8 | Due Date |

- **Output:** a set of extracted invoice fields, passed to step 2.

### Step 2: Validate & Create Record

- **Input:** the extracted fields.
- **Activity:** check structural validity: both PO Number and Total Amount must be present.
- **Decision: Valid?** (see section 7).
  - **Yes:** create **exactly one** invoice record holding the eight extracted fields and a Processed Timestamp.
    Every later step reads and updates this same record. No later step creates a second record for the same
    invoice.
  - **No:** the invoice is **Rejected as structurally incomplete** and returned to the vendor. The process ends.
- **Output:** one invoice record (lifecycle state: *Extracted*).

### Step 3: Match PO & Check Approval

- **Input:** the invoice record.
- **Activity:** look up the PO in the ERP and evaluate the rules:
  - the PO exists;
  - the vendor is active;
  - the invoice total is within the PO open amount, with a **2% tolerance**.
- Set **PO Matched** = all three conditions are true.
- Set **Approval Needed** = PO not matched **OR** invoice total **greater than 10,000 USD**.
- **Decision: Approval needed?** (see section 7).
  - **No:** the invoice is **auto-approved**. Steps 4 and 5 are skipped and the invoice goes straight to step 6.
  - **Yes:** continue to step 4.
- **Output:** the record updated with PO Matched and Approval Needed.

### Step 4: Build Approval Package

- **Input:** an invoice record that needs approval.
- **Activity:** gather the seven approval inputs:

  | # | Approval input |
  |---|---|
  | 1 | GL Account |
  | 2 | Cost Center |
  | 3 | Approver (named budget owner) |
  | 4 | Payment Terms |
  | 5 | Vendor Risk Score |
  | 6 | Receipt Reference (goods receipt) |
  | 7 | Invoice Line Summary |

- Assemble a structured **approval package** and produce a **recommendation** (for example, approve or reject,
  with a short rationale).
- Set the **evidence state**:
  - *Complete:* all seven inputs are present. The package is ready for approval.
  - *Incomplete:* one or more inputs are missing. List them in **Missing Fields** and flag the package for AP
    review instead of sending it to the approver as complete.
- Record the time the package was prepared (**agent timestamp**).
- **Output:** the record updated with the approval inputs, evidence state, missing fields, recommendation,
  approval package and lifecycle state (*Ready for approval* or *Needs AP review*).

### Step 5: Review & Approve

- **Input:** the approval package and recommendation.
- **Activity:** the AP reviewer, acting for the named budget approver, reads the package and either approves or
  rejects the invoice.
- Record **Reviewed By**, **Reviewed At** and, on rejection, the **rejection reason**.
- **Decision: Approved?** (see section 7).
  - **Yes:** continue to step 6.
  - **No:** the invoice is **Rejected (reviewer decision)** and is not posted. The process ends.
- **Output:** the record updated with the decision (lifecycle state: *Approved* or *Rejected*).

### Step 6: Post to ERP & Pay

- **Input:** an invoice that is **ready to post** (see rule BR-4).
- **Activity:** post the invoice in the ERP / AP portal, submit it for payment, and close the invoice.
- Set **Posted To ERP** = true. An invoice that is already posted is never posted again.
- **Output:** the record updated with lifecycle state *Posted*. The process ends with **Paid / closed**.

## 7. Decision points

| Gateway | After step | Question | Yes path | No path |
|---|---|---|---|---|
| **Valid?** | 2 | Are PO Number and Total Amount both present? | Create the record and go to step 3 | **Rejected**: structurally incomplete, returned to the vendor |
| **Approval needed?** | 3 | Is the PO not matched, or is the total above 10,000 USD? | Go to step 4 | **Auto-approved**: skip steps 4–5 and go to step 6 |
| **Approved?** | 5 | Did the reviewer approve? | Go to step 6 | **Rejected**: reviewer decision, not posted |

The process has two Rejected ends and one Paid end.

## 8. Business rules

| ID | Rule | Definition |
|---|---|---|
| BR-1 | Structurally valid | PO Number is present **AND** Total Amount is present. |
| BR-2 | PO matched | PO exists **AND** vendor is active **AND** invoice total is within the PO open amount with a **2% tolerance**. |
| BR-3 | Approval required | **NOT** PO matched **OR** invoice total **> 10,000 USD**. |
| BR-4 | Ready to post | PO matched **AND** not already posted **AND** (no approval needed **OR** approved by a reviewer). |
| BR-5 | Single record | Every structurally valid invoice has exactly one invoice record. Every step after step 2 updates that record and never creates another. |
| BR-6 | No double posting | An invoice whose Posted To ERP is true is never posted again. |
| BR-7 | Decided invoices stay decided | An invoice that is Approved, Rejected or Posted is not moved back to an earlier state by re-running a step. |

Notes on the rules:

- A total of exactly 10,000 USD does **not** require approval on its own, because the rule is *greater than*.
- Under BR-4, an invoice that is not PO-matched cannot be posted even after a reviewer approves it. See OQ-4.

## 9. Data fields on the invoice record

| Group | Field | Set in step | Notes |
|---|---|---|---|
| Extracted | Vendor Name | 1–2 | |
| Extracted | Vendor Tax ID | 1–2 | **Confidential** |
| Extracted | Invoice Number | 1–2 | |
| Extracted | Invoice Date | 1–2 | Date |
| Extracted | PO Number | 1–2 | Required for validity |
| Extracted | Total Amount | 1–2 | **Confidential**. Required for validity |
| Extracted | Currency | 1–2 | USD in this process |
| Extracted | Due Date | 1–2 | Date |
| Processing | Processed Timestamp | 2 | When the record was created |
| Processing | PO Matched | 3 | Yes / No (BR-2) |
| Processing | Approval Needed | 3 | Yes / No (BR-3) |
| Processing | Posted To ERP | 6 | Yes / No. Defaults to No |
| Approval inputs | GL Account | 4 | |
| Approval inputs | Cost Center | 4 | |
| Approval inputs | Approver | 4 | Named budget owner |
| Approval inputs | Payment Terms | 4 | |
| Approval inputs | Vendor Risk Score | 4 | |
| Approval inputs | Receipt Reference | 4 | Goods receipt |
| Approval inputs | Invoice Line Summary | 4 | |
| Approval outputs | Evidence State | 4 | Complete / Incomplete |
| Approval outputs | Missing Fields | 4 | List of approval inputs that are absent |
| Approval outputs | Recommendation | 4 | Recommended decision and rationale |
| Approval outputs | Approval Package | 4 | Structured package shown to the reviewer |
| Approval outputs | Agent Timestamp | 4 | When the package was prepared |
| Lifecycle | Lifecycle State | 2–6 | See section 9.1 |
| Reviewer decision | Reviewed By | 5 | Reviewer identity |
| Reviewer decision | Reviewed At | 5 | Decision timestamp |
| Reviewer decision | Rejection Reason | 5 | Only when rejected. See OQ-6 |

### 9.1 Lifecycle states (proposed)

| State | Meaning |
|---|---|
| Extracted | The record has been created from a structurally valid invoice. |
| Ready for approval | The approval package is complete and waiting for a reviewer decision. |
| Needs AP review | The approval package has missing evidence and is flagged for AP review. |
| Approved | The reviewer approved the invoice. |
| Rejected | The reviewer rejected the invoice. |
| Posted | The invoice has been posted to the ERP and submitted for payment (closed). |

Structurally incomplete invoices get no record (BR-5 applies only to valid invoices). See OQ-2 for how they are
tracked.

## 10. Exception paths

| ID | Exception | Detected in | Handling |
|---|---|---|---|
| EX-1 | PO Number or Total Amount missing | Step 2 | Reject as structurally incomplete and return to the vendor. No record is created. |
| EX-2 | Other extracted fields are missing or unreadable (for example, Due Date) | Steps 1–2 | The invoice is still valid under BR-1. The gap is visible on the record. See OQ-3. |
| EX-3 | PO not found in the ERP | Step 3 | PO Matched = No, so approval is required. The invoice goes to steps 4–5. |
| EX-4 | Vendor inactive | Step 3 | PO Matched = No, so approval is required. |
| EX-5 | Invoice total outside the PO open amount plus 2% tolerance | Step 3 | PO Matched = No, so approval is required. |
| EX-6 | ERP unavailable during PO lookup | Step 3 | Do not guess a match result. Retry later, and leave the record unchanged until the lookup succeeds. Escalation timing: see OQ-7. |
| EX-7 | Approval evidence incomplete | Step 4 | Evidence State = Incomplete, Missing Fields listed, flagged for AP review (*Needs AP review*). |
| EX-8 | Reviewer rejects | Step 5 | Record the reviewer, time and reason. The invoice is not posted (Rejected end). |
| EX-9 | No reviewer decision within the expected time | Step 5 | The invoice stays waiting and visible to AP. Time limit and escalation: see OQ-5. |
| EX-10 | Invoice already posted | Step 6 | Do not post again (BR-6). Treat the run as complete. |
| EX-11 | Posting to the ERP / AP portal fails | Step 6 | Posted To ERP stays No and the record stays in its pre-posting state, so posting can be retried safely. |
| EX-12 | Same invoice received twice | Step 2 | See OQ-8. The no-double-posting rule (BR-6) protects payment, but duplicate detection at intake is not yet defined. |

## 11. Security and privacy

- **Confidential data:** vendor tax IDs, vendor bank details and invoice amounts.
- **Who may see it:** authorised AP users may store and view this data on the invoice record and in the review
  workspace.
- **Where it must never appear:**
  - logs (system, job or audit logs);
  - chat transcripts;
  - generated documentation, including this PDD, the SDDs and the task lists.
- Documentation describes the formats of these fields (for example, "decimal amount in USD") and never shows
  sample values.
- Access credentials, tokens and signed links used to reach the ERP must never be logged, stored in
  documentation or shared in chat.
- Reviewer actions are attributable: every decision records who made it and when.
- All data in this lab is synthetic.

## 12. Assumptions

| ID | Assumption |
|---|---|
| A-1 | All invoices are in USD. No currency conversion is needed. |
| A-2 | The ERP is the authoritative source for PO existence, PO open amount and vendor status. |
| A-3 | In this lab the AP reviewer acts on behalf of the named budget approver, and their decision counts as the approver's decision. |
| A-4 | One document contains one invoice. |
| A-5 | Invoice data in this lab is synthetic. |
| A-6 | The 2% tolerance and the 10,000 USD threshold are fixed policy values for this process. |

## 13. Out of scope

- Payment execution and bank transfer after the invoice is submitted for payment in the ERP.
- Vendor master-data maintenance (creating vendors, changing vendor status or bank details).
- Creating or amending purchase orders.
- Non-PO invoices, credit notes and multi-currency invoices.
- Three-way match at line level beyond the Receipt Reference captured in the approval package.
- Vendor communications other than returning a structurally incomplete invoice.
- Tax calculation or tax compliance checks.

## 14. Acceptance criteria

| ID | Criterion | How it is measured |
|---|---|---|
| AC-1 | All eight fields are captured | For a test set of invoices with known values, 100% of the eight fields match the expected values (dates compared as dates). |
| AC-2 | Invalid invoices are rejected | 100% of test invoices missing PO Number or Total Amount end as *Rejected – structurally incomplete* and create no record. |
| AC-3 | One record per valid invoice | Every structurally valid test invoice produces exactly 1 record. Re-running any later step leaves the record count at 1. |
| AC-4 | PO match follows BR-2 | 100% of test cases (PO missing, vendor inactive, total within tolerance, total beyond tolerance) produce the expected PO Matched value. |
| AC-5 | Approval decision follows BR-3 | 100% of test cases produce the expected Approval Needed value, including a total of exactly 10,000 USD (no approval required by amount alone). |
| AC-6 | Auto-approval skips review | 100% of matched invoices with no approval needed reach *Posted* with no approval package and no reviewer decision. |
| AC-7 | Approval packages are complete or flagged | 100% of invoices needing approval have an approval package and a recommendation. Every package with missing evidence is *Needs AP review* and lists the missing fields. |
| AC-8 | Reviewer decisions are recorded | 100% of approved or rejected invoices record Reviewed By and Reviewed At. 100% of rejected invoices record a rejection reason. |
| AC-9 | Rejected invoices are never posted | 0 rejected invoices have Posted To ERP = Yes. |
| AC-10 | No duplicate posting | 0 invoices are posted more than once, including when posting is retried. |
| AC-11 | Only ready invoices are posted | 100% of posted invoices satisfied BR-4 at posting time. |
| AC-12 | Confidential data stays out of logs and documents | A scan of logs, transcripts and generated documentation finds 0 vendor tax IDs, bank details or invoice amounts. |
| AC-13 | Faster cycle time | Median time from invoice arrival to *Posted* for auto-approved invoices is below the target in OQ-9. |

## 15. Open questions

These business decisions are not answered by the source process. They are left open on purpose and must be
resolved by the process owner.

| ID | Question |
|---|---|
| OQ-1 | How is a structurally incomplete invoice "returned to the vendor": an automatic reply, an AP-sent message, or a vendor-portal notice? Who owns that communication? |
| OQ-2 | Should rejected-as-incomplete invoices be logged anywhere for audit and reporting, given that they get no invoice record? |
| OQ-3 | Should missing non-mandatory fields (for example, Due Date or Vendor Tax ID) block the invoice, send it to review, or only be flagged? |
| OQ-4 | Can a reviewer approve an invoice that is **not** PO-matched? Under BR-4 it still cannot be posted. What should happen next: PO amendment, manual posting, or rejection? |
| OQ-5 | What is the approval time limit, and who is the escalation contact when a reviewer does not act? |
| OQ-6 | Is the rejection reason a free-text field or a fixed list of reason codes? |
| OQ-7 | How long should the process retry an unavailable ERP before it escalates to AP? |
| OQ-8 | How is a duplicate invoice detected at intake (for example, same vendor and invoice number), and what happens to it? |
| OQ-9 | What are the target cycle times (arrival to posting, arrival to decision) and the early-payment discount window the process must meet? |
| OQ-10 | Does the 2% tolerance apply only above the PO open amount, or in both directions? |
| OQ-11 | Can an AP reviewer approve a package flagged *Needs AP review*, or must the missing evidence be supplied first? |
| OQ-12 | Is the AP reviewer's on-behalf approval acceptable outside this lab, or must the named budget approver decide directly in production? |

---

## 16. Gap analysis: what is built versus this PDD

Inspected on 2026-10-05 with read-only commands. Scope: the folder `Agentic Bootcamp/APAutomation_Carlos`, its
solution sub-folder `Invoice_Extraction_Agent_Carlos`, and the tenant-scoped resources its processes use: the IXP
project `Vendor Invoice Carlos`, the Data Fabric entity `AP_Invoice_Carlos` and the coded app
`ap-approval-review-carlos`. Nothing was changed. Confidential values (tax IDs, amounts, reviewer identities)
were not read into this document.

**Status key**

- **Implemented and verified:** the component exists, and the tenant holds evidence (successful jobs, updated
  records) that it ran.
- **Partially implemented:** the component exists, but part of the step is unbuilt or has never run.
- **Target-state only:** not built yet.

### 16.1 Inventory found

| Resource | Type | Location | State |
|---|---|---|---|
| `Vendor Invoice Carlos` | IXP extraction project | Tenant | Model version 6, 5 validated documents, project score "excellent" (F1 = 1 on the Vendor Invoice group). No Orchestrator folder deployment; consumed through its `live` tag. |
| `Invoice_Extraction_Agent_Carlos` 1.0.0 | Agent (solution) | `…/APAutomation_Carlos/Invoice_Extraction_Agent_Carlos` (Solution folder) | 6 jobs, all Successful |
| `Invoice_Intake_RPA_Carlos` 1.0.0 | RPA process | `APAutomation_Carlos` | 2 jobs, all Successful |
| `InvoiceInbox_Carlos` | Storage bucket | `APAutomation_Carlos` | Intake document drop |
| `InvoiceQueue_Carlos` | Queue (unique reference enforced) | `APAutomation_Carlos` | 5 transactions processed, 0 waiting, 0 in progress |
| `POMatch_Carlos` 0.0.2 (`po_lookup`, `process_invoice`, `process_invoice_queue`, `get_invoice_status`) | Python coded function, 4 processes | `APAutomation_Carlos` | 7 jobs, all Successful |
| `Invoice_Approval_Agent_Carlos` 0.0.1 | Coded agent | `APAutomation_Carlos` | 3 jobs, all Successful |
| `ap-approval-review-carlos` 1.0.1 | Coded web app | `APAutomation_Carlos` | Package published. App URL answers HTTP 200. |
| `PostToERP_Carlos` 1.0.0 | RPA process (browser UI automation) | `APAutomation_Carlos` | 2 jobs, all Successful |
| `AP_Invoice_Carlos` | Data Fabric entity | Tenant | 27 user fields, 11 records |

Records by lifecycle state (11 in total): EXTRACTED 3, READY_FOR_APPROVAL 3, NEEDS_AP_REVIEW 2,
AUTO_APPROVED 1, HOLD_PO_MISMATCH 1, POSTED 1, APPROVED 0, REJECTED 0. No record has Reviewed By or Reviewed
At set.

### 16.2 Step-by-step gap table

| # | PDD step | Built by | Status | Evidence | Gap |
|---|---|---|---|---|---|
| 1 | Extract Invoice Data | IXP project `Vendor Invoice Carlos` (v6, `live`) called by `Invoice_Extraction_Agent_Carlos` | **Implemented and verified** | 6 successful agent jobs. Model metrics show F1 = 1 on all fields over 5 validated documents. Every record holds the eight extracted fields. | The model is consumed by tag, not through a folder deployment. Validated on 5 documents only. |
| 2 | Validate & Create Record | `Invoice_Intake_RPA_Carlos` (bucket `InvoiceInbox_Carlos` → entity `AP_Invoice_Carlos` + queue `InvoiceQueue_Carlos`) | **Implemented and verified** | 2 successful jobs. 5 records created as EXTRACTED, with 5 matching queue transactions. The queue enforces unique references. The workflow has Valid?/Rejected and Duplicate branches. | The *Rejected – structurally incomplete* end has never run in the tenant: all 5 lab invoices were valid. Returning an invoice to the vendor (OQ-1) is not built. |
| 3 | Match PO & Check Approval | `POMatch_Carlos` (`po_lookup`, `process_invoice`, `process_invoice_queue`) | **Implemented and verified** | 4 successful matching jobs. Records carry PO Matched and Approval Needed, including both PO-matched and not-matched cases. | None for the rules themselves. The 2% tolerance direction (OQ-10) follows the build, not a business decision. |
| 4 | Build Approval Package | `Invoice_Approval_Agent_Carlos` | **Implemented and verified** | 3 successful agent jobs. 8 records carry an agent timestamp and evidence state: COMPLETE → READY_FOR_APPROVAL (3), INCOMPLETE → NEEDS_AP_REVIEW (2), NOT_REQUIRED → AUTO_APPROVED (1), NOT_EVALUATED → HOLD_PO_MISMATCH (1). | The build adds AUTO_APPROVED and HOLD_PO_MISMATCH, which the PDD lifecycle list (9.1) lacks. The PO-mismatch hold path is OQ-4. |
| 5 | Review & Approve | Coded app `ap-approval-review-carlos` 1.0.1 | **Partially implemented** | The app is deployed (HTTP 200). Its code writes APPROVED/REJECTED, Reviewed By and Reviewed At. | No reviewer decision has gone through it: 0 APPROVED, 0 REJECTED, and Reviewed By is empty on every record. The rejection reason has no field of its own; it is appended to the approval package as a reviewer note (OQ-6). No approval time limit or escalation (OQ-5). |
| 6 | Post to ERP & Pay | `PostToERP_Carlos` 1.0.0 against the hosted AP portal | **Partially implemented** | 2 successful jobs. 1 invoice (no approval needed) is POSTED with Posted To ERP = true. A re-run of the same record returned "already posted" (BR-6 holds). | No reviewer-approved invoice has been posted. The AUTO_APPROVED record is still unposted because nothing calls posting automatically. Payment submission after posting is outside the tenant. |

### 16.3 Cross-cutting gaps

| Area | Status | Gap |
|---|---|---|
| End-to-end orchestration (trigger → 6 steps → 3 gateways → 2 Rejected ends and 1 Paid end) | **Target-state only** | No process connects the steps. Each component is started on its own. Planned for Lab 10 (Maestro BPMN). |
| Waiting for a human decision (EX-9) | **Target-state only** | Nothing waits for or escalates a pending review. |
| Exceptions EX-6 / EX-11 (ERP unavailable, posting failure) | **Partially implemented** | Components fail safely one by one. No retry or escalation policy runs across the whole process (OQ-7). |
| Security: no confidential data in logs or documents | **Partially implemented** | Builds keep tax IDs and tokens out of logs and state. This was not checked across all job logs in this step. |
