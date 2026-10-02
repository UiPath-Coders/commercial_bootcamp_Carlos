"""Invoice_Approval_Agent_Carlos: Lab 5 LangGraph coded agent (Build Approval Package step).

Input : {"recordId": "<AP_Invoice_Carlos record Id>"}
Reads : that exact tenant-scoped record (entity name resolved once to its Id)
Guard : already prepared, or APPROVED / REJECTED / POSTED -> return the existing result, no LLM, no write
Gates : four deterministic gates, in order, before any LLM call
LLM   : gate 4 only, for the approval narrative inside ApprovalPackageJson
Writes: ApprovalEvidenceState, MissingApprovalFields, AgentRecommendation, ApprovalPackageJson,
        AgentProcessedAt, InvoiceLifecycleState on the same record

    START -> load_record -> retry_guard -+-> evaluate_gates -+-> write_narrative -> write_back -+-> finish -> END
                                         |                   +------------------> write_back -+
                                         +--------------------------------------------------- +
    Any node that fails routes straight to finish with errorType / errorMessage set.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from approval_gates import GateResult, evaluate_gates, format_missing_fields, is_already_prepared, parse_missing_fields
from config import AGENT_NAME, PACKAGE_VERSION, load_settings
from data_fabric import RecordNotFoundError, read_invoice_record, write_agent_outputs
from narrative import generate_narrative, narrative_input

# At INFO, httpx logs full request URLs.
logging.getLogger("httpx").setLevel(logging.WARNING)


# --------------------------------------------------------------------------- #
# Contract (entry-points.json is generated from these by `uip codedagent init`)
# --------------------------------------------------------------------------- #
class GraphInput(BaseModel):
    recordId: str = Field(description="Data Fabric Id of the AP_Invoice_Carlos record to prepare")


class GraphOutput(BaseModel):
    recordId: str = Field(description="The same record Id that was read (and updated)")
    approvalEvidenceState: Optional[str] = Field(
        default=None, description="NOT_EVALUATED | NOT_REQUIRED | INCOMPLETE | COMPLETE"
    )
    missingApprovalFields: list[str] = Field(default_factory=list, description="Empty required approval inputs")
    recommendation: Optional[str] = Field(
        default=None, description="HOLD_PO_MISMATCH | AUTO_APPROVED | NEEDS_AP_REVIEW | READY_FOR_APPROVAL"
    )
    invoiceLifecycleState: Optional[str] = Field(default=None, description="InvoiceLifecycleState on the record")
    wasAlreadyPrepared: bool = Field(
        default=False, description="True when the retry guard returned the existing result without new work"
    )
    errorType: Optional[str] = Field(default=None, description="Error category, null on success")
    errorMessage: Optional[str] = Field(default=None, description="Sanitized error message, null on success")


class GraphState(BaseModel):
    recordId: str
    # Allow-listed record fields only (VendorTaxId is dropped in data_fabric.normalize_record).
    record: Optional[dict[str, Any]] = None
    decision: Optional[dict[str, Any]] = None
    narrative: Optional[dict[str, Any]] = None
    approvalEvidenceState: Optional[str] = None
    missingApprovalFields: list[str] = Field(default_factory=list)
    recommendation: Optional[str] = None
    invoiceLifecycleState: Optional[str] = None
    wasAlreadyPrepared: bool = False
    errorType: Optional[str] = None
    errorMessage: Optional[str] = None


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
_SECRET_PATTERNS = (
    re.compile(r"access_token=[^&\s\"']+", re.IGNORECASE),
    re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),
    re.compile(r"https?://\S+"),
)


def sanitize(message: str, limit: int = 300) -> str:
    for pattern in _SECRET_PATTERNS:
        message = pattern.sub("[redacted]", message)
    return message[:limit]


def error_update(error_type: str, exc: Exception) -> dict[str, Any]:
    return {"errorType": error_type, "errorMessage": sanitize(f"{type(exc).__name__}: {exc}")}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_approval_package(
    record: dict[str, Any], gate: GateResult, narrative: Optional[dict[str, Any]], processed_at: str
) -> dict[str, Any]:
    """Structured package stored in ApprovalPackageJson (narrative only for gate 4)."""
    return {
        "version": PACKAGE_VERSION,
        "agent": AGENT_NAME,
        "entity": load_settings().entity_name,
        "recordId": record.get("Id"),
        "processedAt": processed_at,
        "invoice": {
            "vendorName": record.get("VendorName"),
            "invoiceNumber": record.get("InvoiceNumber"),
            "invoiceDate": record.get("InvoiceDate"),
            "dueDate": record.get("DueDate"),
            "poNumber": record.get("PONumber"),
            "totalAmount": record.get("TotalAmount"),
            "currency": record.get("Currency"),
        },
        "poMatch": {"poMatched": record.get("POMatched"), "approvalNeeded": record.get("ApprovalNeeded")},
        "evidence": {
            "glAccount": record.get("GLAccount"),
            "costCenter": record.get("CostCenter"),
            "approver": record.get("Approver"),
            "paymentTerms": record.get("PaymentTerms"),
            "vendorRiskScore": record.get("VendorRiskScore"),
            "receiptReference": record.get("ReceiptReference"),
            "invoiceLineSummary": record.get("InvoiceLineSummary"),
        },
        "gates": [dict(step) for step in gate.gate_trace],
        "decision": {
            "firedGate": gate.fired_gate,
            "approvalEvidenceState": gate.approval_evidence_state,
            "missingApprovalFields": list(gate.missing_approval_fields),
            "agentRecommendation": gate.recommendation,
            "invoiceLifecycleState": gate.invoice_lifecycle_state,
        },
        "narrative": narrative,
    }


def agent_output_fields(gate: GateResult, package: dict[str, Any], processed_at: str) -> dict[str, Any]:
    """Exactly the six fields written back, with schema names."""
    return {
        "ApprovalEvidenceState": gate.approval_evidence_state,
        "MissingApprovalFields": format_missing_fields(gate.missing_approval_fields),
        "AgentRecommendation": gate.recommendation,
        "ApprovalPackageJson": json.dumps(package, default=str),
        "AgentProcessedAt": processed_at,
        "InvoiceLifecycleState": gate.invoice_lifecycle_state,
    }


# --------------------------------------------------------------------------- #
# Nodes
# --------------------------------------------------------------------------- #
async def load_record(state: GraphState) -> dict[str, Any]:
    record_id = (state.recordId or "").strip()
    if not record_id:
        return {"errorType": "InvalidInput", "errorMessage": "recordId is required"}
    try:
        record = read_invoice_record(record_id)
    except RecordNotFoundError as exc:
        return error_update("RecordNotFound", exc)
    except Exception as exc:  # noqa: BLE001
        return error_update("DataFabricReadError", exc)
    # Large package JSON is not needed in state; the guard only needs to know it exists.
    has_package = bool(str(record.get("ApprovalPackageJson") or "").strip())
    record = {**record, "Id": record_id, "ApprovalPackageJson": "<present>" if has_package else None}
    return {"recordId": record_id, "record": record}


async def retry_guard(state: GraphState) -> dict[str, Any]:
    record = state.record or {}
    if not is_already_prepared(record):
        return {}
    return {
        "approvalEvidenceState": record.get("ApprovalEvidenceState"),
        "missingApprovalFields": parse_missing_fields(record.get("MissingApprovalFields")),
        "recommendation": record.get("AgentRecommendation"),
        "invoiceLifecycleState": record.get("InvoiceLifecycleState"),
        "wasAlreadyPrepared": True,
    }


async def run_gates(state: GraphState) -> dict[str, Any]:
    try:
        return {"decision": evaluate_gates(state.record or {}).to_dict()}
    except Exception as exc:  # noqa: BLE001 - e.g. an unparseable boolean
        return error_update("GateEvaluationError", exc)


async def write_narrative(state: GraphState) -> dict[str, Any]:
    return {"narrative": generate_narrative(narrative_input(state.record or {}))}


async def write_back(state: GraphState) -> dict[str, Any]:
    gate = GateResult.from_dict(state.decision or {})
    processed_at = utc_now_iso()
    package = build_approval_package(state.record or {}, gate, state.narrative, processed_at)
    try:
        write_agent_outputs(state.recordId, agent_output_fields(gate, package, processed_at))
    except Exception as exc:  # noqa: BLE001
        return error_update("DataFabricWriteError", exc)
    return {
        "approvalEvidenceState": gate.approval_evidence_state,
        "missingApprovalFields": list(gate.missing_approval_fields),
        "recommendation": gate.recommendation,
        "invoiceLifecycleState": gate.invoice_lifecycle_state,
    }


async def finish(state: GraphState) -> dict[str, Any]:
    # The runtime keeps only the last node's delta as output, so every output field is returned here.
    return {
        "recordId": state.recordId,
        "approvalEvidenceState": state.approvalEvidenceState,
        "missingApprovalFields": list(state.missingApprovalFields),
        "recommendation": state.recommendation,
        "invoiceLifecycleState": state.invoiceLifecycleState,
        "wasAlreadyPrepared": state.wasAlreadyPrepared,
        "errorType": state.errorType,
        "errorMessage": state.errorMessage,
    }


# --------------------------------------------------------------------------- #
# Routing
# --------------------------------------------------------------------------- #
def after_load(state: GraphState) -> Literal["retry_guard", "finish"]:
    return "finish" if state.errorType else "retry_guard"


def after_guard(state: GraphState) -> Literal["evaluate_gates", "finish"]:
    return "finish" if state.wasAlreadyPrepared else "evaluate_gates"


def after_gates(state: GraphState) -> Literal["write_narrative", "write_back", "finish"]:
    if state.errorType or not state.decision:
        return "finish"
    return "write_narrative" if state.decision["fired_gate"] == 4 else "write_back"


builder = StateGraph(GraphState, input_schema=GraphInput, output_schema=GraphOutput)
builder.add_node("load_record", load_record)
builder.add_node("retry_guard", retry_guard)
builder.add_node("evaluate_gates", run_gates)
builder.add_node("write_narrative", write_narrative)
builder.add_node("write_back", write_back)
builder.add_node("finish", finish)

builder.add_edge(START, "load_record")
builder.add_conditional_edges("load_record", after_load, ["retry_guard", "finish"])
builder.add_conditional_edges("retry_guard", after_guard, ["evaluate_gates", "finish"])
builder.add_conditional_edges("evaluate_gates", after_gates, ["write_narrative", "write_back", "finish"])
builder.add_edge("write_narrative", "write_back")
builder.add_edge("write_back", "finish")
builder.add_edge("finish", END)

graph = builder.compile()
