"""Deterministic core of the approval agent: the retry guard and the four gates.

Pure functions only: no I/O, no LLM. Input is one AP_Invoice record as a dict
keyed by schema field names (see data_fabric.normalize_record).

| # | Condition                            | Evidence      | Recommendation / lifecycle |
|---|--------------------------------------|---------------|----------------------------|
| 1 | POMatched false                      | NOT_EVALUATED | HOLD_PO_MISMATCH           |
| 2 | ApprovalNeeded false (explicit)      | NOT_REQUIRED  | AUTO_APPROVED              |
| 3 | a required approval input is empty   | INCOMPLETE    | NEEDS_AP_REVIEW            |
| 4 | otherwise                            | COMPLETE      | READY_FOR_APPROVAL         |

Only gate 4 leads to an LLM call, and that call happens in main.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

# Gate 3 requirements, in the order MissingApprovalFields reports them.
REQUIRED_APPROVAL_INPUTS: tuple[str, ...] = ("GLAccount", "CostCenter", "Approver", "ReceiptReference")

APPROVAL_INPUT_FIELDS: tuple[str, ...] = (
    "GLAccount",
    "CostCenter",
    "Approver",
    "PaymentTerms",
    "VendorRiskScore",
    "ReceiptReference",
    "InvoiceLineSummary",
)

# ApprovalEvidenceState
NOT_EVALUATED = "NOT_EVALUATED"
NOT_REQUIRED = "NOT_REQUIRED"
INCOMPLETE = "INCOMPLETE"
COMPLETE = "COMPLETE"

# AgentRecommendation / InvoiceLifecycleState
HOLD_PO_MISMATCH = "HOLD_PO_MISMATCH"
AUTO_APPROVED = "AUTO_APPROVED"
NEEDS_AP_REVIEW = "NEEDS_AP_REVIEW"
READY_FOR_APPROVAL = "READY_FOR_APPROVAL"

# Reviewer / ERP states owned by Lab 6 and Lab 4
APPROVED = "APPROVED"
REJECTED = "REJECTED"
POSTED = "POSTED"

# A non-empty package plus one of these states means the agent already did its work.
PREPARED_STATES = frozenset({AUTO_APPROVED, READY_FOR_APPROVAL, APPROVED, REJECTED, POSTED})
# These are never downgraded, with or without a package.
PROTECTED_STATES = frozenset({APPROVED, REJECTED, POSTED})

_TRUE_STRINGS = {"true", "1", "yes", "y", "t"}
_FALSE_STRINGS = {"false", "0", "no", "n", "f", ""}


@dataclass(frozen=True)
class GateResult:
    approval_evidence_state: str
    missing_approval_fields: tuple[str, ...]
    recommendation: str
    invoice_lifecycle_state: str
    fired_gate: int
    gate_trace: tuple[dict[str, Any], ...] = field(default_factory=tuple)

    @property
    def requires_narrative(self) -> bool:
        return self.fired_gate == 4

    def to_dict(self) -> dict[str, Any]:
        return {
            "approval_evidence_state": self.approval_evidence_state,
            "missing_approval_fields": list(self.missing_approval_fields),
            "recommendation": self.recommendation,
            "invoice_lifecycle_state": self.invoice_lifecycle_state,
            "fired_gate": self.fired_gate,
            "gate_trace": [dict(step) for step in self.gate_trace],
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "GateResult":
        return cls(
            approval_evidence_state=data["approval_evidence_state"],
            missing_approval_fields=tuple(data.get("missing_approval_fields") or ()),
            recommendation=data["recommendation"],
            invoice_lifecycle_state=data["invoice_lifecycle_state"],
            fired_gate=data["fired_gate"],
            gate_trace=tuple(data.get("gate_trace") or ()),
        )


def as_bool(value: Any) -> bool:
    """Normalise a Data Fabric Boolean. None (never written) counts as False."""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    text = str(value).strip().lower()
    if text in _TRUE_STRINGS:
        return True
    if text in _FALSE_STRINGS:
        return False
    raise ValueError(f"Cannot interpret {value!r} as a boolean")


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    return False


def missing_required_inputs(record: Mapping[str, Any]) -> tuple[str, ...]:
    return tuple(name for name in REQUIRED_APPROVAL_INPUTS if is_empty(record.get(name)))


def lifecycle_state(record: Mapping[str, Any]) -> str:
    return str(record.get("InvoiceLifecycleState") or "").strip().upper()


def is_already_prepared(record: Mapping[str, Any]) -> bool:
    """Retry guard: skip all work when the record is already prepared or past the agent's stage.

    True when a non-empty ApprovalPackageJson exists with a prepared lifecycle
    state, or when the state is APPROVED / REJECTED / POSTED (never downgraded,
    even without a package).
    """
    state = lifecycle_state(record)
    if state in PROTECTED_STATES:
        return True
    return not is_empty(record.get("ApprovalPackageJson")) and state in PREPARED_STATES


def evaluate_gates(record: Mapping[str, Any]) -> GateResult:
    """Run gates 1-4 in order and stop at the first that fires."""
    trace: list[dict[str, Any]] = []

    # Gate 1: PO matched? Unset counts as false, so the record is held, never auto-approved.
    po_matched = as_bool(record.get("POMatched"))
    trace.append({"gate": 1, "check": "POMatched == true", "value": record.get("POMatched"), "passed": po_matched})
    if not po_matched:
        return GateResult(NOT_EVALUATED, (), HOLD_PO_MISMATCH, HOLD_PO_MISMATCH, 1, tuple(trace))

    # Gate 2: approval needed? Unset counts as true (as in Lab 3 get_invoice_status).
    raw_needed = record.get("ApprovalNeeded")
    approval_needed = True if raw_needed is None else as_bool(raw_needed)
    trace.append({"gate": 2, "check": "ApprovalNeeded != false", "value": raw_needed, "passed": approval_needed})
    if not approval_needed:
        return GateResult(NOT_REQUIRED, (), AUTO_APPROVED, AUTO_APPROVED, 2, tuple(trace))

    # Gate 3: approval evidence complete?
    missing = missing_required_inputs(record)
    trace.append({"gate": 3, "check": "required approval inputs present", "missing": list(missing), "passed": not missing})
    if missing:
        return GateResult(INCOMPLETE, missing, NEEDS_AP_REVIEW, NEEDS_AP_REVIEW, 3, tuple(trace))

    # Gate 4: everything passed; main.py asks the LLM for the narrative.
    trace.append({"gate": 4, "check": "all checks passed", "passed": True})
    return GateResult(COMPLETE, (), READY_FOR_APPROVAL, READY_FOR_APPROVAL, 4, tuple(trace))


def format_missing_fields(missing: tuple[str, ...] | list[str]) -> str:
    """MissingApprovalFields as stored on the record: comma-separated, empty when none."""
    return ", ".join(missing)


def parse_missing_fields(value: Any) -> list[str]:
    if is_empty(value):
        return []
    return [part.strip() for part in str(value).split(",") if part.strip()]
