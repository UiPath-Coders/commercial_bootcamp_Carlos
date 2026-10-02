"""Data Fabric I/O for the agent (UiPath Python SDK, tenant scope, no folder key).

Two functions cross the I/O boundary and both are @mockable, so evaluations and
tests can replace them:

* read_invoice_record(record_id)          -> record dict (schema names, allow-listed fields only)
* write_agent_outputs(record_id, fields)  -> None (writes only the six agent fields)

Field names are matched case-insensitively on read (the uip df CLI prints
PoMatched / PoNumber / GlAccount; the SDK returns schema names) and written
with the schema names. VendorTaxId and every field not listed in RECORD_FIELDS
are dropped on read, so they never reach graph state, logs, or the LLM.
"""

from __future__ import annotations

from typing import Any, Mapping

from uipath.eval.mocks import mockable

from config import Settings, load_settings

# Schema names of the fields the agent may hold in state. VendorTaxId is deliberately absent.
RECORD_FIELDS: tuple[str, ...] = (
    "Id",
    "VendorName",
    "InvoiceNumber",
    "InvoiceDate",
    "DueDate",
    "PONumber",
    "TotalAmount",
    "Currency",
    "POMatched",
    "ApprovalNeeded",
    "PostedToERP",
    "GLAccount",
    "CostCenter",
    "Approver",
    "PaymentTerms",
    "VendorRiskScore",
    "ReceiptReference",
    "InvoiceLineSummary",
    "ApprovalEvidenceState",
    "MissingApprovalFields",
    "AgentRecommendation",
    "ApprovalPackageJson",
    "AgentProcessedAt",
    "InvoiceLifecycleState",
    "ReviewedBy",
    "ReviewedAt",
)

# The six fields this agent owns. Nothing else is ever written.
AGENT_OUTPUT_FIELDS: tuple[str, ...] = (
    "ApprovalEvidenceState",
    "MissingApprovalFields",
    "AgentRecommendation",
    "ApprovalPackageJson",
    "AgentProcessedAt",
    "InvoiceLifecycleState",
)


class RecordNotFoundError(LookupError):
    """The record Id does not exist in the entity."""


def normalize_record(raw: Mapping[str, Any]) -> dict[str, Any]:
    """Map raw keys case-insensitively onto RECORD_FIELDS; drop everything else."""
    by_lower = {str(key).lower(): value for key, value in raw.items()}
    return {name: by_lower.get(name.lower()) for name in RECORD_FIELDS}


def _sdk():
    # Lazy: `uip codedagent init` imports this module without credentials.
    from uipath.platform import UiPath

    return UiPath()


def resolve_entity_id(settings: Settings, sdk: Any = None) -> str:
    """Entity Id for the configured name. AP_INVOICE_ENTITY_ID skips the lookup."""
    if settings.entity_id:
        return settings.entity_id
    sdk = sdk or _sdk()
    return sdk.entities.retrieve_by_name(settings.entity_name).id  # tenant-scoped: no folder_key


def _is_not_found(exc: Exception) -> bool:
    status = getattr(getattr(exc, "response", None), "status_code", None) or getattr(exc, "status_code", None)
    return status == 404 or "404" in str(exc)[:200]


@mockable()
def read_invoice_record(record_id: str) -> dict[str, Any]:
    """Read one AP_Invoice record by Id (tenant scope)."""
    settings = load_settings()
    sdk = _sdk()
    entity_id = resolve_entity_id(settings, sdk)
    try:
        record = sdk.entities.get_record(entity_id, record_id)
    except Exception as exc:  # noqa: BLE001 - re-raised with a sanitized type
        if _is_not_found(exc):
            raise RecordNotFoundError(f"Record {record_id} not found in {settings.entity_name}") from None
        raise
    raw = record.model_dump(by_alias=True)
    normalized = normalize_record(raw)
    normalized["Id"] = normalized.get("Id") or getattr(record, "id", None) or record_id
    return normalized


@mockable()
def write_agent_outputs(record_id: str, fields: dict[str, Any]) -> None:
    """Write the six agent output fields to the same record. The response is discarded."""
    unexpected = sorted(set(fields) - set(AGENT_OUTPUT_FIELDS))
    if unexpected:
        raise ValueError(f"Refusing to write non-agent fields: {unexpected}")
    settings = load_settings()
    sdk = _sdk()
    entity_id = resolve_entity_id(settings, sdk)
    # The update echoes the whole record (VendorTaxId included); never keep or log it.
    sdk.entities.update_record(entity_id, record_id, fields)
