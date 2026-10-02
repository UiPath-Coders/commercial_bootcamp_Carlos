"""POMatch_Carlos - Match PO and Check Approval (Lab 3).

Four deterministic entry points, no LLM calls:

- po_lookup             pure: ERP PO lookup + the two business rules (no UiPath SDK)
- process_invoice       one AP_Invoice_Carlos record -> po_lookup -> write POMatched / ApprovalNeeded
- process_invoice_queue drain InvoiceQueue_Carlos, delegating every transaction to process_invoice
- get_invoice_status    read-only lifecycle view of one record (Lab 10 wait loop)

Shared helpers keep the PO rules (evaluate_po, parse_po_response, _lookup) and the Data Fabric access
(_entity_id, _read_record, _write_record, _get_field) in one place. Errors are returned in
error_type / error_message, never raised out of an entry point.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx
from pydantic import BaseModel, Field
from uipath.platform import UiPath
from uipath.tracing import traced

# At INFO, httpx logs the full request URL, which for a hosted ERP carries the signed access_token.
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("POMatch_Carlos")

# --------------------------------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------------------------------

DEFAULT_ERP_API_URL = "http://localhost:8080"
PO_LOOKUP_PATH = "/api/po-lookup"
DEFAULT_ERP_PO_LOOKUP_URL = DEFAULT_ERP_API_URL + PO_LOOKUP_PATH
DEFAULT_ERP_TIMEOUT_SECONDS = 10.0

PO_TOLERANCE = 0.02
APPROVAL_THRESHOLD = 10_000

DEFAULT_ENTITY_NAME = "AP_Invoice_Carlos"
DEFAULT_QUEUE_NAME = "InvoiceQueue_Carlos"
DEFAULT_FOLDER_PATH = "Agentic Bootcamp/APAutomation_Carlos"

# match_reason codes
MATCHED = "MATCHED"
PO_NOT_FOUND = "PO_NOT_FOUND"
VENDOR_INACTIVE = "VENDOR_INACTIVE"
OUTSIDE_TOLERANCE = "OUTSIDE_TOLERANCE"

# po_lookup error_type codes (empty on success)
INVALID_INPUT = "INVALID_INPUT"
ERP_HTTP_ERROR = "ERP_HTTP_ERROR"
ERP_MALFORMED_RESPONSE = "ERP_MALFORMED_RESPONSE"
ERP_UNREACHABLE = "ERP_UNREACHABLE"

# Data Fabric / queue error_type codes
RECORD_NOT_FOUND = "RECORD_NOT_FOUND"
DATA_FABRIC_ERROR = "DATA_FABRIC_ERROR"
QUEUE_ERROR = "QUEUE_ERROR"

# AP_Invoice_Carlos schema field names (exact, case-sensitive; written as is)
F_VENDOR_NAME = "VendorName"
F_PO_NUMBER = "PONumber"
F_TOTAL_AMOUNT = "TotalAmount"
F_CURRENCY = "Currency"
F_PO_MATCHED = "POMatched"
F_APPROVAL_NEEDED = "ApprovalNeeded"
F_POSTED_TO_ERP = "PostedToERP"
F_LIFECYCLE_STATE = "InvoiceLifecycleState"
F_REVIEWED_BY = "ReviewedBy"  # added in Lab 5
F_REVIEWED_AT = "ReviewedAt"  # added in Lab 5


def erp_api_url() -> str:
    """Base URL of the ERP (legacy fallback), without a trailing slash."""
    return (os.getenv("ERP_API_URL") or DEFAULT_ERP_API_URL).strip().rstrip("/")


def erp_po_lookup_url() -> str:
    """Complete PO-lookup URL. ERP_PO_LOOKUP_URL is used exactly as supplied (a hosted value is the
    signed URL, query string included); otherwise ERP_API_URL + /api/po-lookup."""
    complete = (os.getenv("ERP_PO_LOOKUP_URL") or "").strip()
    if complete:
        return complete
    return erp_api_url() + PO_LOOKUP_PATH


def _erp_timeout() -> float:
    try:
        return float(os.getenv("ERP_TIMEOUT_SECONDS") or DEFAULT_ERP_TIMEOUT_SECONDS)
    except ValueError:
        return DEFAULT_ERP_TIMEOUT_SECONDS


def _erp_client() -> httpx.Client:
    """HTTP client for the ERP call. Tests swap this for an httpx.MockTransport client."""
    return httpx.Client(timeout=_erp_timeout())


_ACCESS_TOKEN_RE = re.compile(r"(access_token=)[^&\s\"'<>]+", re.IGNORECASE)


def redact(text: str) -> str:
    """Hide every access_token value: access_token=*** (the parameter name keeps its case)."""
    return _ACCESS_TOKEN_RE.sub(r"\1***", str(text))


# --------------------------------------------------------------------------------------------------
# PO rules (pure)
# --------------------------------------------------------------------------------------------------


class MalformedErpResponse(ValueError):
    """The ERP answered, but not with the documented {"po": {...}} shape."""


def parse_po_response(payload: Any) -> dict[str, Any]:
    """Validate the documented response and return found / vendor_active / open_amount / currency.
    Never guesses: wrong types or missing fields raise MalformedErpResponse."""
    if not isinstance(payload, dict):
        raise MalformedErpResponse(f"expected a JSON object, got {type(payload).__name__}")
    po = payload.get("po")
    if not isinstance(po, dict):
        raise MalformedErpResponse("response has no 'po' object")
    found = po.get("found")
    if not isinstance(found, bool):
        raise MalformedErpResponse("po.found is missing or not a boolean")
    vendor_active = po.get("vendorActive")
    if not isinstance(vendor_active, bool):
        raise MalformedErpResponse("po.vendorActive is missing or not a boolean")
    open_amount = po.get("openAmount")
    if isinstance(open_amount, bool) or not isinstance(open_amount, (int, float)):
        raise MalformedErpResponse("po.openAmount is missing or not a number")
    currency = po.get("currency")
    return {
        "found": found,
        "vendor_active": vendor_active,
        "open_amount": float(open_amount),
        "currency": currency if isinstance(currency, str) else "",
    }


def evaluate_po(*, found: bool, vendor_active: bool, open_amount: float, invoice_total: float) -> tuple[bool, bool, str]:
    """The two Lab 3 rules. Returns (po_matched, approval_required, match_reason).

    PO matched: found AND vendor active AND invoice total within 2% of the open amount.
    Approval needed: NOT matched OR invoice total above 10,000.
    """
    if not found:
        reason = PO_NOT_FOUND
    elif not vendor_active:
        reason = VENDOR_INACTIVE
    # compare in cents so 2% exactly matches and one cent past it does not
    elif round(abs(invoice_total - open_amount), 2) > round(abs(open_amount) * PO_TOLERANCE, 2):
        reason = OUTSIDE_TOLERANCE
    else:
        reason = MATCHED
    po_matched = reason == MATCHED
    approval_required = (not po_matched) or invoice_total > APPROVAL_THRESHOLD
    return po_matched, approval_required, reason


# --------------------------------------------------------------------------------------------------
# po_lookup
# --------------------------------------------------------------------------------------------------


class POLookupInput(BaseModel):
    vendor_name: str
    po_number: str
    invoice_total: float
    currency: str = "USD"


class POLookupOutput(BaseModel):
    po_matched: bool = False
    approval_required: bool = True
    open_amount: float = 0.0
    match_reason: str = ""
    error_type: str = ""
    error_message: str = ""


def _lookup_failed(error_type: str, message: str) -> POLookupOutput:
    """Conservative result: never a match, always routed to a human."""
    return POLookupOutput(
        po_matched=False,
        approval_required=True,
        open_amount=0.0,
        match_reason="",
        error_type=error_type,
        error_message=redact(message),
    )


def _lookup(vendor_name: str, po_number: str, invoice_total: float, currency: str) -> POLookupOutput:
    """Shared PO-lookup implementation used by po_lookup and process_invoice. Never raises."""
    po_number = (po_number or "").strip()
    if not po_number:
        return _lookup_failed(INVALID_INPUT, "po_number is required; the ERP was not called")

    url = erp_po_lookup_url()
    body = {
        "vendorName": vendor_name or "",
        "poNumber": po_number,
        "invoiceTotal": float(invoice_total),
        "currency": currency or "USD",
    }
    headers = {"Accept": "application/json"}
    token = (os.getenv("ERP_API_TOKEN") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        with _erp_client() as client:
            response = client.post(url, json=body, headers=headers)
    except Exception as exc:  # noqa: BLE001 - every transport failure is returned, not raised
        return _lookup_failed(ERP_UNREACHABLE, f"{type(exc).__name__} calling POST {redact(url)}: {exc}")

    if response.status_code != 200:
        return _lookup_failed(
            ERP_HTTP_ERROR,
            f"ERP returned HTTP {response.status_code} for POST {redact(url)}: {response.text[:200]}",
        )
    try:
        payload = response.json()
    except (json.JSONDecodeError, ValueError):
        return _lookup_failed(ERP_MALFORMED_RESPONSE, f"ERP response from {redact(url)} is not JSON")
    try:
        po = parse_po_response(payload)
    except MalformedErpResponse as exc:
        return _lookup_failed(ERP_MALFORMED_RESPONSE, f"ERP response from {redact(url)} is malformed: {exc}")

    po_matched, approval_required, reason = evaluate_po(
        found=po["found"],
        vendor_active=po["vendor_active"],
        open_amount=po["open_amount"],
        invoice_total=float(invoice_total),
    )
    return POLookupOutput(
        po_matched=po_matched,
        approval_required=approval_required,
        open_amount=po["open_amount"],
        match_reason=reason,
    )


@traced(name="po_lookup", run_type="uipath")
def po_lookup(input: POLookupInput) -> POLookupOutput:
    """Ask the ERP about one purchase order and apply the PO-matched and approval rules."""
    try:
        return _lookup(input.vendor_name, input.po_number, input.invoice_total, input.currency)
    except Exception as exc:  # noqa: BLE001 - Coded Function contract: return, never raise
        return _lookup_failed(ERP_UNREACHABLE, f"{type(exc).__name__}: {exc}")


# --------------------------------------------------------------------------------------------------
# Data Fabric helpers (shared by process_invoice and get_invoice_status)
# --------------------------------------------------------------------------------------------------

_sdk: UiPath | None = None


def sdk() -> UiPath:
    """Lazy SDK singleton; never created at import time."""
    global _sdk
    if _sdk is None:
        _sdk = UiPath()
    return _sdk


_entity_ids: dict[str, str] = {}


def _entity_id(entity_name: str) -> str:
    """Resolve the tenant-scoped entity name to its Id (cached per process)."""
    if entity_name not in _entity_ids:
        _entity_ids[entity_name] = sdk().entities.retrieve_by_name(entity_name).id
    return _entity_ids[entity_name]


class RecordNotFound(LookupError):
    pass


def _is_not_found(exc: Exception) -> bool:
    status = getattr(exc, "status_code", None) or getattr(getattr(exc, "response", None), "status_code", None)
    return status == 404 or "404" in str(exc)


def _read_record(entity_name: str, record_id: str) -> dict[str, Any]:
    """Read exactly one record and return its fields as a plain dict."""
    try:
        record = sdk().entities.get_record(_entity_id(entity_name), record_id)
    except Exception as exc:
        if _is_not_found(exc):
            raise RecordNotFound(f"record {record_id} not found in {entity_name}") from exc
        raise
    if record is None:
        raise RecordNotFound(f"record {record_id} not found in {entity_name}")
    if isinstance(record, dict):
        return record
    return record.model_dump(by_alias=True)


def _write_record(entity_name: str, record_id: str, fields: dict[str, Any]) -> None:
    """Update the given schema-named fields on one record."""
    sdk().entities.update_record(_entity_id(entity_name), record_id, fields)


def _get_field(record: dict[str, Any], name: str, default: Any = None) -> Any:
    """Read a field by name, case-insensitively (the uip df CLI prints PoNumber, the SDK PONumber).
    A field that does not exist yet (e.g. ReviewedBy before Lab 5) returns the default."""
    if name in record:
        return record[name]
    wanted = name.lower()
    for key, value in record.items():
        if isinstance(key, str) and key.lower() == wanted:
            return value
    return default


def _as_bool(value: Any, default: bool) -> bool:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes"}
    return bool(value)


def _as_text(value: Any) -> str:
    return "" if value is None else str(value)


# --------------------------------------------------------------------------------------------------
# process_invoice
# --------------------------------------------------------------------------------------------------


class ProcessInvoiceInput(BaseModel):
    record_id: str
    entity_name: str = DEFAULT_ENTITY_NAME


class ProcessInvoiceOutput(BaseModel):
    record_id: str = ""
    po_matched: bool = False
    approval_required: bool = True
    open_amount: float = 0.0
    match_reason: str = ""
    error_type: str = ""
    error_message: str = ""


def _process_failed(record_id: str, error_type: str, message: str) -> ProcessInvoiceOutput:
    return ProcessInvoiceOutput(record_id=record_id, error_type=error_type, error_message=redact(message))


@traced(name="process_invoice", run_type="uipath")
def process_invoice(input: ProcessInvoiceInput) -> ProcessInvoiceOutput:
    """Read one invoice record, run po_lookup on it and write POMatched / ApprovalNeeded back.
    Idempotent: the same record and ERP answer always write the same two values."""
    record_id = (input.record_id or "").strip()
    entity_name = (input.entity_name or "").strip() or DEFAULT_ENTITY_NAME
    if not record_id:
        return _process_failed("", INVALID_INPUT, "record_id is required")

    try:
        record = _read_record(entity_name, record_id)
    except RecordNotFound as exc:
        return _process_failed(record_id, RECORD_NOT_FOUND, str(exc))
    except Exception as exc:  # noqa: BLE001
        return _process_failed(record_id, DATA_FABRIC_ERROR, f"reading record {record_id}: {type(exc).__name__}: {exc}")

    raw_total = _get_field(record, F_TOTAL_AMOUNT)
    try:
        invoice_total = float(raw_total)
    except (TypeError, ValueError):
        return _process_failed(record_id, INVALID_INPUT, f"record {record_id} has no numeric {F_TOTAL_AMOUNT}")

    lookup = _lookup(
        vendor_name=_as_text(_get_field(record, F_VENDOR_NAME)),
        po_number=_as_text(_get_field(record, F_PO_NUMBER)),
        invoice_total=invoice_total,
        currency=_as_text(_get_field(record, F_CURRENCY)) or "USD",
    )
    if lookup.error_type:
        # leave the record untouched so a retry decides from a real ERP answer
        return _process_failed(record_id, lookup.error_type, lookup.error_message)

    try:
        _write_record(
            entity_name,
            record_id,
            {F_PO_MATCHED: lookup.po_matched, F_APPROVAL_NEEDED: lookup.approval_required},
        )
    except Exception as exc:  # noqa: BLE001
        return _process_failed(record_id, DATA_FABRIC_ERROR, f"updating record {record_id}: {type(exc).__name__}: {exc}")

    logger.info("record %s: %s", record_id, lookup.match_reason)
    return ProcessInvoiceOutput(
        record_id=record_id,
        po_matched=lookup.po_matched,
        approval_required=lookup.approval_required,
        open_amount=lookup.open_amount,
        match_reason=lookup.match_reason,
    )


# --------------------------------------------------------------------------------------------------
# process_invoice_queue
# --------------------------------------------------------------------------------------------------


class ProcessInvoiceQueueInput(BaseModel):
    queue_name: str = DEFAULT_QUEUE_NAME
    folder_path: str = DEFAULT_FOLDER_PATH
    entity_name: str = DEFAULT_ENTITY_NAME
    max_items: int = 50


class ProcessInvoiceQueueOutput(BaseModel):
    processed: int = 0
    matched: int = 0
    approval_required: int = 0
    failed: int = 0
    errors: list[str] = Field(default_factory=list)


def _start_transaction(queue_name: str, folder_path: str) -> dict[str, Any] | None:
    """Take the next available transaction, or None when the queue is empty.
    StartTransaction answers 204 with no body when nothing is left, which the SDK surfaces as a
    JSON decode error."""
    # a local run has no robot key; a robot job does and the transaction is assigned to it
    no_robot = not getattr(getattr(sdk().queues, "_execution_context", None), "robot_key", None)
    try:
        item = sdk().queues.create_transaction_item({}, queue_name=queue_name, no_robot=no_robot, folder_path=folder_path)
    except json.JSONDecodeError:
        return None
    return item or None


def _is_empty_body_error(exc: BaseException) -> bool:
    """The SDK's response.json() on an empty 200/204 body; any other ValueError is a real failure."""
    return isinstance(exc, json.JSONDecodeError) or (type(exc) is ValueError and "Expecting value" in str(exc))


def _complete_transaction(queue_name: str, folder_path: str, transaction_id: int, result: dict[str, Any]) -> None:
    """SetTransactionResult by the numeric transaction Id (the GUID Key returns 404)."""
    try:
        sdk().queues.complete_transaction_item(str(transaction_id), result, queue_name=queue_name, folder_path=folder_path)
    except ValueError as exc:
        if not _is_empty_body_error(exc):
            raise  # empty body: the status was set


def _transaction_id(item: dict[str, Any]) -> int | None:
    value = item.get("Id")
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def _business_failure(reason: str, details: str) -> dict[str, Any]:
    return {
        "IsSuccessful": False,
        "ProcessingException": {"Reason": reason, "Details": details[:1000], "Type": "BusinessException"},
    }


@traced(name="process_invoice_queue", run_type="uipath")
def process_invoice_queue(input: ProcessInvoiceQueueInput) -> ProcessInvoiceQueueOutput:
    """Drain the invoice queue: each transaction's Reference is an AP_Invoice record Id, handed to
    process_invoice. Successful when it succeeds, Failed (business exception) otherwise."""
    out = ProcessInvoiceQueueOutput()
    queue_name = (input.queue_name or "").strip() or DEFAULT_QUEUE_NAME
    folder_path = (input.folder_path or "").strip() or DEFAULT_FOLDER_PATH
    entity_name = (input.entity_name or "").strip() or DEFAULT_ENTITY_NAME

    for _ in range(max(0, input.max_items)):
        try:
            item = _start_transaction(queue_name, folder_path)
        except Exception as exc:  # noqa: BLE001
            out.errors.append(f"{QUEUE_ERROR}: starting a transaction on {queue_name}: {type(exc).__name__}: {exc}")
            break
        if item is None:
            break

        transaction_id = _transaction_id(item)
        record_id = _as_text(item.get("Reference")).strip()
        if transaction_id is None:
            # it could never be set Successful/Failed, so do not write its record either
            out.processed += 1
            out.failed += 1
            out.errors.append(f"{record_id or '<no reference>'}: {QUEUE_ERROR}: transaction has no numeric Id")
            continue
        try:
            result = process_invoice(ProcessInvoiceInput(record_id=record_id, entity_name=entity_name))
        except Exception as exc:  # noqa: BLE001 - never leave a transaction In Progress
            result = ProcessInvoiceOutput(record_id=record_id, error_type=DATA_FABRIC_ERROR, error_message=f"{type(exc).__name__}: {exc}")

        out.processed += 1
        if result.error_type:
            out.failed += 1
            out.errors.append(f"{record_id or '<no reference>'}: {result.error_type}: {result.error_message}")
            completion = _business_failure(result.error_type, result.error_message)
        else:
            out.matched += int(result.po_matched)
            out.approval_required += int(result.approval_required)
            completion = {
                "IsSuccessful": True,
                "Output": {
                    "POMatched": result.po_matched,
                    "ApprovalNeeded": result.approval_required,
                    "MatchReason": result.match_reason,
                },
            }
        try:
            _complete_transaction(queue_name, folder_path, transaction_id, completion)
        except Exception as exc:  # noqa: BLE001
            out.errors.append(f"{record_id}: {QUEUE_ERROR}: setting transaction result: {type(exc).__name__}: {exc}")

    logger.info("queue %s: processed %d, failed %d", queue_name, out.processed, out.failed)
    return out


# --------------------------------------------------------------------------------------------------
# get_invoice_status
# --------------------------------------------------------------------------------------------------


class GetInvoiceStatusInput(BaseModel):
    record_id: str
    entity_name: str = DEFAULT_ENTITY_NAME


class GetInvoiceStatusOutput(BaseModel):
    record_id: str = ""
    invoice_lifecycle_state: str = ""
    approval_needed: bool = True
    posted_to_erp: bool = False
    reviewed_by: str = ""
    reviewed_at: str = ""
    found: bool = False
    error_type: str = ""
    error_message: str = ""


@traced(name="get_invoice_status", run_type="uipath")
def get_invoice_status(input: GetInvoiceStatusInput) -> GetInvoiceStatusOutput:
    """Read-only lifecycle view of one record for the Lab 10 wait loop. Never writes."""
    record_id = (input.record_id or "").strip()
    entity_name = (input.entity_name or "").strip() or DEFAULT_ENTITY_NAME
    if not record_id:
        return GetInvoiceStatusOutput(error_type=INVALID_INPUT, error_message="record_id is required")

    try:
        record = _read_record(entity_name, record_id)
    except RecordNotFound as exc:
        return GetInvoiceStatusOutput(record_id=record_id, error_type=RECORD_NOT_FOUND, error_message=str(exc))
    except Exception as exc:  # noqa: BLE001
        return GetInvoiceStatusOutput(
            record_id=record_id,
            error_type=DATA_FABRIC_ERROR,
            error_message=redact(f"reading record {record_id}: {type(exc).__name__}: {exc}"),
        )

    return GetInvoiceStatusOutput(
        record_id=record_id,
        invoice_lifecycle_state=_as_text(_get_field(record, F_LIFECYCLE_STATE)),
        approval_needed=_as_bool(_get_field(record, F_APPROVAL_NEEDED), default=True),
        posted_to_erp=_as_bool(_get_field(record, F_POSTED_TO_ERP), default=False),
        reviewed_by=_as_text(_get_field(record, F_REVIEWED_BY)),
        reviewed_at=_as_text(_get_field(record, F_REVIEWED_AT)),
        found=True,
    )
