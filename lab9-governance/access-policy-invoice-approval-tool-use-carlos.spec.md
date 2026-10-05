# Policy Spec: Invoice Approval Tool Use Carlos

Draft only. Nothing in this file has been created or deployed in the tenant. `uip gov access-policy create`
was not run. The policy JSON sits next to this file:
[access-policy-invoice-approval-tool-use-carlos.json](access-policy-invoice-approval-tool-use-carlos.json).

Scope: organization `customersuccessamer`, tenant `Training` (https://staging.uipath.com).

## Narrative

Only the Lab 10 Maestro process **InvoiceApprovalProcess_Carlos** may call the approval agent
**Invoice_Approval_Agent_Carlos** and the RPA process **PostToERP_Carlos** as tools. Both tools live in
`Agentic Bootcamp/APAutomation_Carlos`. Any other caller (another Maestro process, an agent, a Flow or a
case) gets no Allow from this policy, so the call falls to the platform default, which is Deny. The policy
does not limit which user or robot runs the caller. The **POMatch_Carlos functions cannot be governed yet**:
ToolUsePolicy has no Function resource type. The caller is left as the placeholder
`BIND_AFTER_LAB10:InvoiceApprovalProcess_Carlos` until Lab 10 creates the process.

## Spec components

| # | Component | Value |
|---|---|---|
| 1 | Name | Invoice Approval Tool Use Carlos |
| 2 | Description | The narrative above, shortened (see JSON `description`) |
| 3 | Status | Simulated (evaluated, not enforced, until someone activates it) |
| 4 | Enforcement | Allow (other callers are denied by default) |
| 5 | Resource type | Agent; RPA |
| 6 | Resource scope | 2 specific processes (table below) |
| 7 | Resource tag filter | none |
| 8 | Actor Process type | Maestro |
| 9 | Actor Process scope | 1 specific process: `BIND_AFTER_LAB10:InvoiceApprovalProcess_Carlos` (placeholder) |
| 10 | Actor Process tag filter | none |
| 11-12 | Actor Identity | none: any user or robot that runs the allowed caller |

## Affected resources (resolved in `Agentic Bootcamp/APAutomation_Carlos`, 2026-10-05)

| Resource | Orchestrator type | Policy resource type | Version | Process Key (UUID) |
|---|---|---|---|---|
| Invoice_Approval_Agent_Carlos | Agent | Agent | 0.0.1 | `90403394-D6E2-4849-9B55-27B94EEBC4D4` |
| PostToERP_Carlos | Process | RPA (`RPAWorkflow`) | 1.0.0 | `7AB9607F-95F8-4849-B0A6-BFD591C3FFDB` |

Read from `uip or processes list --folder-path "Agentic Bootcamp/APAutomation_Carlos" --all-fields`.
No identifier was typed by hand or made up.

### Not governed by this policy

| Resource | Why |
|---|---|
| POMatch_Carlos_po_lookup, _process_invoice, _process_invoice_queue, _get_invoice_status (Function, 0.0.2) | ToolUsePolicy has no Function resource type (allowed types: Agent, Maestro, RPA, API workflow, Case, Flow). Lab 10 calls these, but no tool-use policy can gate them today. Revisit if a Function type is added. |
| Invoice_Intake_RPA_Carlos, Invoice_Extraction_Agent_Carlos | Not part of this request. They stay ungoverned by this policy. |

## Proposed rules

```json
"selectors": [
  { "resourceType": "Agent",       "values": ["90403394-D6E2-4849-9B55-27B94EEBC4D4"], "operator": "Or" },
  { "resourceType": "RPAWorkflow", "values": ["7AB9607F-95F8-4849-B0A6-BFD591C3FFDB"], "operator": "Or" }
],
"executableRule": {
  "values": [
    { "type": "AgenticProcess", "values": ["BIND_AFTER_LAB10:InvoiceApprovalProcess_Carlos"], "operator": "Or" }
  ]
},
"enforcement": "Allow",
"status": "Simulated"
```

No Actor Identity rule (`actorRule` is left out): the request names no user or group limit.

## Scenarios (once bound and Active)

| # | Caller | Calls | Result |
|---|---|---|---|
| A1 | InvoiceApprovalProcess_Carlos (Maestro, Lab 10) | Invoice_Approval_Agent_Carlos | **Allowed** |
| A2 | InvoiceApprovalProcess_Carlos (Maestro, Lab 10) | PostToERP_Carlos | **Allowed** |
| A3 | InvoiceApprovalProcess_Carlos, run by any user or robot | either tool | **Allowed** (no identity limit) |
| D1 | Any other Maestro process, including another participant's InvoiceApprovalProcess_* | either tool | **Denied** |
| D2 | A `uip maestro bpmn debug` run of the Lab 10 BPMN (runs under a temporary Studio Web solution, so a different process Key) | either tool | **Denied** |
| D3 | A copy of the Lab 10 process deployed under a new name or version folder (e.g. a `_v101` deployment) | either tool | **Denied** until its Key is added |
| D4 | Any agent (e.g. Invoice_Extraction_Agent_Carlos, or the approval agent calling PostToERP_Carlos) | either tool | **Denied** |
| D5 | Any Maestro Flow (e.g. the challenge `.flow` project) | either tool | **Denied** |
| D6 | Any Case Management process | either tool | **Denied** |
| N1 | Lab 10 calling the POMatch_Carlos functions | function | **Not governed** (no Function type) |
| N2 | A job started directly in Orchestrator or with `uip or jobs start` | either tool | **Not governed**: this is not a tool call from another workflow |

RPA and API workflows cannot be callers in a ToolUsePolicy, so they never appear as the Actor Process.
While the policy is **Simulated**, D1-D6 are only reported in evaluation details; nothing is blocked.

## Local check (the policy service has no server-side validate)

Checked by reading the JSON locally, without calling the service:

- `policyType` = ToolUsePolicy; `enforcement` = Allow (never Deny); `status` = Simulated.
- `organizationId` and `tenantId` match the current `uip login status` (customersuccessamer / Training).
- Every selector and executable entry has a non-empty `values` and an `Or`/`None` operator.
- One selector per resource type; `RPAWorkflow` appears only as a resource, never as a caller.
- Caller type `AgenticProcess` (Maestro) is a valid Actor Process type.
- No `actorRule`, no `tags`, no server-managed fields (`id`, `createdBy`, ...).
- The only non-UUID value is the intended placeholder `BIND_AFTER_LAB10:InvoiceApprovalProcess_Carlos`.
  The service takes process Key UUIDs, so this file **must not be submitted until the placeholder is replaced**.

## What must be bound and deployed after Lab 10

Lab 9 does none of this. Policy creation and activation are for whoever owns governance on the tenant
(facilitator or admin); participants never create or deploy access policies in this bootcamp.

1. **Lab 10 creates the caller.** Deploying the Lab 10 solution creates the Maestro process
   `InvoiceApprovalProcess_Carlos` in its solution sub-folder under `Agentic Bootcamp/APAutomation_Carlos`.
2. **Look up its process Key** (the release Key UUID, not the dotted ProcessKey name):
   `uip or processes list --folder-key <Lab 10 solution folder key> --process-type ProcessOrchestration --name InvoiceApprovalProcess_Carlos --output json`
   and take `Key`.
3. **Bind it.** Replace `BIND_AFTER_LAB10:InvoiceApprovalProcess_Carlos` in the JSON with that Key.
   If Lab 10 is redeployed as a new deployment (new folder, new process), use the Key of the one in use.
4. **Check the tool Keys still match.** Lab 10 must link the existing Lab processes
   (`uip solution deploy config link ... --folder-path "Agentic Bootcamp/APAutomation_Carlos"`), so the
   BPMN calls the two Keys above. If the solution installed its own copies instead, those copies have new
   Keys; put them in `selectors[].values` or the policy will not cover what Lab 10 actually calls. Re-run
   `uip or processes list --folder-path "Agentic Bootcamp/APAutomation_Carlos"` to confirm.
5. **Create in Simulated:** `uip gov access-policy create --file access-policy-invoice-approval-tool-use-carlos.json --output json`.
6. **Evaluate with real Keys** (tenant-scoped login): the Lab 10 Key against each tool should return Allow,
   and another caller (for example the approval agent's Key) against PostToERP_Carlos should return Deny.
7. **Activate** (`status: "Active"` via `update`) only after the evaluation and a Simulated Lab 10 run look
   right. Expect D2: Lab 10 debug runs will be denied once Active.
