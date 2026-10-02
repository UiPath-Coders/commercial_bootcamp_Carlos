"""Data Fabric and queue entry points with the UiPath SDK faked. No network, no login."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

import main
from main import (
    GetInvoiceStatusInput,
    ProcessInvoiceInput,
    ProcessInvoiceOutput,
    ProcessInvoiceQueueInput,
    POLookupOutput,
    get_invoice_status,
    process_invoice,
    process_invoice_queue,
)

ENTITY_ID = "entity-id-1"


class FakeEntities:
    def __init__(self, records: dict[str, dict]):
        self.records = records
        self.writes: list[tuple[str, str, dict]] = []

    def retrieve_by_name(self, name):
        assert name == main.DEFAULT_ENTITY_NAME
        return SimpleNamespace(id=ENTITY_ID)

    def get_record(self, entity_key, record_id):
        assert entity_key == ENTITY_ID
        if record_id not in self.records:
            raise RuntimeError("404 Not Found")
        return dict(self.records[record_id], Id=record_id)

    def update_record(self, entity_key, record_id, data):
        assert entity_key == ENTITY_ID
        self.writes.append((entity_key, record_id, dict(data)))
        self.records[record_id].update(data)


class FakeQueues:
    def __init__(self, items: list[dict]):
        self.items = list(items)
        self.started: list[dict] = []
        self.completed: list[tuple[str, dict]] = []
        self._execution_context = SimpleNamespace(robot_key=None)

    def create_transaction_item(self, item, queue_name=None, no_robot=False, *, folder_path=None, folder_key=None):
        self.started.append({"queue_name": queue_name, "folder_path": folder_path, "no_robot": no_robot})
        if not self.items:
            raise json.JSONDecodeError("Expecting value", "", 0)  # 204: queue empty
        return self.items.pop(0)

    def complete_transaction_item(self, transaction_key, result, queue_name=None, *, folder_path=None, folder_key=None):
        self.completed.append((transaction_key, result))
        raise json.JSONDecodeError("Expecting value", "", 0)  # empty body on success


@pytest.fixture
def fake_sdk(monkeypatch):
    def install(records=None, items=None):
        fake = SimpleNamespace(entities=FakeEntities(records or {}), queues=FakeQueues(items or []))
        monkeypatch.setattr(main, "_sdk", fake)
        monkeypatch.setattr(main, "_entity_ids", {})
        return fake

    return install


# ---------------------------------------------------------------- process_invoice_queue


def test_queue_delegates_every_transaction_to_process_invoice(fake_sdk, monkeypatch):
    fake = fake_sdk(items=[{"Id": 11, "Reference": "rec-1"}, {"Id": 12, "Reference": "rec-2"}])
    calls = []

    def spy(inp: ProcessInvoiceInput) -> ProcessInvoiceOutput:
        calls.append((inp.record_id, inp.entity_name))
        matched = inp.record_id == "rec-1"
        return ProcessInvoiceOutput(record_id=inp.record_id, po_matched=matched, approval_required=not matched, match_reason="MATCHED" if matched else "PO_NOT_FOUND")

    monkeypatch.setattr(main, "process_invoice", spy)
    out = process_invoice_queue(ProcessInvoiceQueueInput())

    assert calls == [("rec-1", "AP_Invoice_Carlos"), ("rec-2", "AP_Invoice_Carlos")]
    assert [key for key, _ in fake.queues.completed] == ["11", "12"]
    assert all(result["IsSuccessful"] for _, result in fake.queues.completed)
    assert out.model_dump() == {"processed": 2, "matched": 1, "approval_required": 1, "failed": 0, "errors": []}
    assert fake.queues.started[0]["folder_path"] == "Agentic Bootcamp/APAutomation_Carlos"
    assert fake.queues.started[0]["queue_name"] == "InvoiceQueue_Carlos"


def test_queue_marks_failed_business_exception_and_continues(fake_sdk, monkeypatch):
    fake = fake_sdk(items=[{"Id": 21, "Reference": "bad"}, {"Id": 22, "Reference": "good"}])

    def spy(inp: ProcessInvoiceInput) -> ProcessInvoiceOutput:
        if inp.record_id == "bad":
            return ProcessInvoiceOutput(record_id="bad", error_type="ERP_UNREACHABLE", error_message="ConnectError")
        return ProcessInvoiceOutput(record_id="good", po_matched=True, approval_required=False, match_reason="MATCHED")

    monkeypatch.setattr(main, "process_invoice", spy)
    out = process_invoice_queue(ProcessInvoiceQueueInput())

    failed = dict(fake.queues.completed)["21"]
    assert failed["IsSuccessful"] is False
    assert failed["ProcessingException"]["Type"] == "BusinessException"
    assert failed["ProcessingException"]["Reason"] == "ERP_UNREACHABLE"
    assert dict(fake.queues.completed)["22"]["IsSuccessful"] is True
    assert (out.processed, out.matched, out.failed) == (2, 1, 1)
    assert out.errors == ["bad: ERP_UNREACHABLE: ConnectError"]


def test_queue_respects_max_items(fake_sdk, monkeypatch):
    fake = fake_sdk(items=[{"Id": i, "Reference": f"r{i}"} for i in range(5)])
    monkeypatch.setattr(main, "process_invoice", lambda inp: ProcessInvoiceOutput(record_id=inp.record_id, po_matched=True, approval_required=False))
    out = process_invoice_queue(ProcessInvoiceQueueInput(max_items=2))
    assert out.processed == 2
    assert len(fake.queues.items) == 3


def test_queue_never_leaves_a_transaction_in_progress_when_process_invoice_raises(fake_sdk, monkeypatch):
    fake = fake_sdk(items=[{"Id": 31, "Reference": "boom"}])

    def explode(inp):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(main, "process_invoice", explode)
    out = process_invoice_queue(ProcessInvoiceQueueInput())
    assert fake.queues.completed[0][1]["IsSuccessful"] is False
    assert out.failed == 1


def test_queue_does_not_process_a_transaction_it_cannot_complete(fake_sdk, monkeypatch):
    """An item without a numeric Id can never be set Successful/Failed, so its record must not be written."""
    fake = fake_sdk(items=[{"Reference": "rec-1"}, {"Id": "not-a-number", "Reference": "rec-2"}])
    monkeypatch.setattr(main, "process_invoice", lambda inp: pytest.fail("must not process an item it cannot complete"))
    out = process_invoice_queue(ProcessInvoiceQueueInput())
    assert (out.processed, out.failed) == (2, 2)
    assert all("no numeric Id" in e for e in out.errors)
    assert fake.queues.completed == []


def test_queue_transaction_without_reference_fails_cleanly(fake_sdk):
    fake = fake_sdk(records={}, items=[{"Id": 41, "Reference": None}, {"Id": 42, "Reference": ""}])
    out = process_invoice_queue(ProcessInvoiceQueueInput())
    assert (out.processed, out.failed) == (2, 2)
    assert [r["IsSuccessful"] for _, r in fake.queues.completed] == [False, False]
    assert fake.entities.writes == []


def test_complete_tolerates_a_plain_empty_body_value_error_but_not_real_errors(fake_sdk):
    fake = fake_sdk()

    def empty_body(*a, **k):
        raise ValueError("Expecting value: line 1 column 1 (char 0)")

    fake.queues.complete_transaction_item = empty_body
    main._complete_transaction("q", "f", 1, {"IsSuccessful": True})  # must not raise

    def server_error(*a, **k):
        raise RuntimeError("500 Internal Server Error")

    fake.queues.complete_transaction_item = server_error
    with pytest.raises(RuntimeError):
        main._complete_transaction("q", "f", 1, {"IsSuccessful": True})


# ---------------------------------------------------------------- get_invoice_status


def test_get_invoice_status_performs_no_write(fake_sdk):
    fake = fake_sdk(records={"rec-1": {"InvoiceLifecycleState": "AWAITING_REVIEW", "ApprovalNeeded": True, "PostedToERP": False}})
    out = get_invoice_status(GetInvoiceStatusInput(record_id="rec-1"))
    assert fake.entities.writes == []
    assert out.found is True and out.error_type == ""
    assert out.invoice_lifecycle_state == "AWAITING_REVIEW"


def test_get_invoice_status_defaults_unset_fields_and_tolerates_missing_lab5_fields(fake_sdk):
    fake = fake_sdk(records={"rec-1": {"InvoiceLifecycleState": None, "ApprovalNeeded": None, "PostedToERP": None}})
    out = get_invoice_status(GetInvoiceStatusInput(record_id="rec-1"))
    assert out.model_dump() == {
        "record_id": "rec-1",
        "invoice_lifecycle_state": "",
        "approval_needed": True,
        "posted_to_erp": False,
        "reviewed_by": "",
        "reviewed_at": "",
        "found": True,
        "error_type": "",
        "error_message": "",
    }
    assert fake.entities.writes == []


def test_get_invoice_status_reads_lab5_fields_case_insensitively(fake_sdk):
    fake_sdk(records={"rec-1": {"approvalneeded": False, "postedtoerp": True, "ReviewedBy": "ap.reviewer", "reviewedAt": "2026-10-02T10:00:00Z"}})
    out = get_invoice_status(GetInvoiceStatusInput(record_id="rec-1"))
    assert (out.approval_needed, out.posted_to_erp) == (False, True)
    assert (out.reviewed_by, out.reviewed_at) == ("ap.reviewer", "2026-10-02T10:00:00Z")


def test_get_invoice_status_unknown_record(fake_sdk):
    fake = fake_sdk(records={})
    out = get_invoice_status(GetInvoiceStatusInput(record_id="missing"))
    assert out.found is False and out.error_type == "RECORD_NOT_FOUND"
    assert fake.entities.writes == []


# ---------------------------------------------------------------- process_invoice


def _fake_lookup(calls):
    def lookup(vendor_name, po_number, invoice_total, currency):
        calls.append((vendor_name, po_number, invoice_total, currency))
        return POLookupOutput(po_matched=True, approval_required=True, open_amount=22700.0, match_reason="MATCHED")

    return lookup


def test_process_invoice_reads_cli_style_names_and_writes_schema_names(fake_sdk, monkeypatch):
    fake = fake_sdk(records={"rec-1": {"VendorName": "Vertex Analytics Corp.", "PoNumber": "PO-2026-0405", "TotalAmount": "22700.00", "Currency": "USD"}})
    calls = []
    monkeypatch.setattr(main, "_lookup", _fake_lookup(calls))

    out = process_invoice(ProcessInvoiceInput(record_id="rec-1"))

    assert calls == [("Vertex Analytics Corp.", "PO-2026-0405", 22700.0, "USD")]
    assert fake.entities.writes == [(ENTITY_ID, "rec-1", {"POMatched": True, "ApprovalNeeded": True})]
    assert out.model_dump() == {
        "record_id": "rec-1",
        "po_matched": True,
        "approval_required": True,
        "open_amount": 22700.0,
        "match_reason": "MATCHED",
        "error_type": "",
        "error_message": "",
    }


def test_process_invoice_is_idempotent(fake_sdk, monkeypatch):
    fake = fake_sdk(records={"rec-1": {"VendorName": "V", "PONumber": "PO-1", "TotalAmount": 100.0, "Currency": "USD"}})
    monkeypatch.setattr(main, "_lookup", _fake_lookup([]))
    first = process_invoice(ProcessInvoiceInput(record_id="rec-1"))
    second = process_invoice(ProcessInvoiceInput(record_id="rec-1"))
    assert first == second
    assert fake.entities.writes[0] == fake.entities.writes[1]


def test_process_invoice_erp_error_leaves_record_untouched(fake_sdk, monkeypatch):
    fake = fake_sdk(records={"rec-1": {"VendorName": "V", "PONumber": "PO-1", "TotalAmount": 100.0}})
    monkeypatch.setattr(
        main, "_lookup", lambda **kw: POLookupOutput(error_type="ERP_UNREACHABLE", error_message="ConnectError")
    )
    out = process_invoice(ProcessInvoiceInput(record_id="rec-1"))
    assert out.error_type == "ERP_UNREACHABLE"
    assert out.po_matched is False and out.approval_required is True
    assert fake.entities.writes == []


def test_process_invoice_unknown_record(fake_sdk):
    fake = fake_sdk(records={})
    out = process_invoice(ProcessInvoiceInput(record_id="nope"))
    assert out.error_type == "RECORD_NOT_FOUND"
    assert fake.entities.writes == []


def test_process_invoice_and_po_lookup_share_the_rules():
    """process_invoice calls the same _lookup implementation as po_lookup (no duplicated rules)."""
    import inspect

    assert "_lookup(" in inspect.getsource(main.process_invoice)
    assert "_lookup(" in inspect.getsource(main.po_lookup)
