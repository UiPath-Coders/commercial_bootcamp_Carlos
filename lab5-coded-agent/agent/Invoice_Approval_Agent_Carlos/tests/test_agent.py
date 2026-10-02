"""Offline tests: gates, retry guard, error paths, and the read/write boundary (all I/O mocked)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import main
from data_fabric import AGENT_OUTPUT_FIELDS, RecordNotFoundError, normalize_record

CASES = json.loads(
    (Path(__file__).resolve().parents[3] / "lab-assets/vendor-invoice/evaluations/decision-cases.json").read_text()
)

SNAKE_TO_SCHEMA = {
    "po_matched": "POMatched",
    "approval_needed": "ApprovalNeeded",
    "gl_account": "GLAccount",
    "cost_center": "CostCenter",
    "approver": "Approver",
    "payment_terms": "PaymentTerms",
    "vendor_risk_score": "VendorRiskScore",
    "receipt_reference": "ReceiptReference",
    "invoice_line_summary": "InvoiceLineSummary",
    "total_amount": "TotalAmount",
    "currency": "Currency",
    "invoice_reference": "InvoiceNumber",
}


class FakeIO:
    def __init__(self, monkeypatch, record=None, read_error=None):
        self.record, self.read_error = record, read_error
        self.writes: list[tuple[str, dict]] = []
        self.narratives = 0
        monkeypatch.setattr(main, "read_invoice_record", self.read)
        monkeypatch.setattr(main, "write_agent_outputs", self.write)
        monkeypatch.setattr(main, "generate_narrative", self.narrate)

    def read(self, record_id):
        if self.read_error:
            raise self.read_error
        return normalize_record({**self.record, "Id": record_id})

    def write(self, record_id, fields):
        self.writes.append((record_id, fields))

    def narrate(self, facts):
        self.narratives += 1
        assert "VendorTaxId" not in facts
        return {"summary": "ok", "risk_flags": [], "source": "test"}


async def run(record_id="rec-1"):
    return await main.graph.ainvoke({"recordId": record_id})


@pytest.mark.parametrize("case", CASES, ids=[c["invoice_data"]["invoice_reference"] for c in CASES])
async def test_decision_cases(monkeypatch, case):
    record = {SNAKE_TO_SCHEMA[k]: v for k, v in case["invoice_data"].items()}
    record["VendorTaxId"] = "SECRET"
    io = FakeIO(monkeypatch, record)
    out = await run()
    exp = case["expected"]
    assert out["approvalEvidenceState"] == exp["approval_evidence_state"]
    assert out["missingApprovalFields"] == exp["missing_approval_fields"]
    assert out["recommendation"] == exp["recommendation"]
    assert out["invoiceLifecycleState"] == exp["invoice_lifecycle_state"]
    assert out["wasAlreadyPrepared"] is False and out["errorType"] is None
    assert io.narratives == (1 if exp["recommendation"] == "READY_FOR_APPROVAL" else 0)
    (rid, fields), = io.writes
    assert rid == "rec-1" and set(fields) == set(AGENT_OUTPUT_FIELDS)
    assert "SECRET" not in json.dumps(fields)


@pytest.mark.parametrize("state", ["AUTO_APPROVED", "READY_FOR_APPROVAL", "APPROVED", "REJECTED", "POSTED"])
async def test_retry_guard_with_package(monkeypatch, state):
    io = FakeIO(monkeypatch, {"POMatched": True, "ApprovalNeeded": True, "ApprovalPackageJson": "{}",
                              "InvoiceLifecycleState": state, "AgentRecommendation": "READY_FOR_APPROVAL",
                              "ApprovalEvidenceState": "COMPLETE", "MissingApprovalFields": ""})
    out = await run()
    assert out["wasAlreadyPrepared"] is True and out["invoiceLifecycleState"] == state
    assert io.writes == [] and io.narratives == 0


@pytest.mark.parametrize("state", ["APPROVED", "REJECTED", "POSTED"])
async def test_never_downgrade_without_package(monkeypatch, state):
    io = FakeIO(monkeypatch, {"POMatched": False, "InvoiceLifecycleState": state})
    out = await run()
    assert out["wasAlreadyPrepared"] is True and out["invoiceLifecycleState"] == state and io.writes == []


async def test_needs_review_with_package_is_reprocessed(monkeypatch):
    io = FakeIO(monkeypatch, {"POMatched": True, "ApprovalNeeded": True, "ApprovalPackageJson": "{}",
                              "InvoiceLifecycleState": "NEEDS_AP_REVIEW", "GLAccount": "g", "CostCenter": "c",
                              "Approver": "a", "ReceiptReference": "r"})
    out = await run()
    assert out["recommendation"] == "READY_FOR_APPROVAL" and len(io.writes) == 1


async def test_case_insensitive_cli_spelling(monkeypatch):
    FakeIO(monkeypatch, {"PoMatched": True, "approvalneeded": True, "GlAccount": "g", "costcenter": "c",
                         "APPROVER": "a", "ReceiptReference": "r"})
    assert (await run())["recommendation"] == "READY_FOR_APPROVAL"


async def test_record_not_found(monkeypatch):
    io = FakeIO(monkeypatch, read_error=RecordNotFoundError("missing"))
    out = await run()
    assert out["errorType"] == "RecordNotFound" and out["recordId"] == "rec-1" and io.writes == []


async def test_blank_record_id(monkeypatch):
    FakeIO(monkeypatch, {})
    assert (await run("  "))["errorType"] == "InvalidInput"


def test_vendor_tax_id_dropped():
    assert "VendorTaxId" not in normalize_record({"VendorTaxId": "x", "vendortaxid": "y"})


def test_sanitize_strips_tokens():
    msg = main.sanitize("GET https://h/x?access_token=abc failed eyJabcdefghijkl.abc.def")
    assert "access_token=abc" not in msg and "eyJ" not in msg and "https://" not in msg
