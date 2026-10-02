"""Runtime configuration for Invoice_Approval_Agent_Carlos.

Everything is read from environment variables so the same code runs locally
(`uip codedagent run`), in evaluations, and as a deployed process. No
credentials live here: the UiPath SDK uses the session that `uip login`
established (the `uip codedagent` wrapper injects it).
"""

from __future__ import annotations

import os
from dataclasses import dataclass

AGENT_NAME = "Invoice_Approval_Agent_Carlos"
PACKAGE_VERSION = "1.0"

# Tenant-scoped entity; resolved to its Id once per run (never passed to the SDK by name).
DEFAULT_ENTITY_NAME = "AP_Invoice_Carlos"
DEFAULT_LLM_MODEL = "gpt-4.1-mini-2025-04-14"

ENV_ENTITY_NAME = "AP_INVOICE_ENTITY_NAME"
ENV_ENTITY_ID = "AP_INVOICE_ENTITY_ID"  # when set, skips retrieve_by_name
ENV_LLM_MODEL = "AP_INVOICE_LLM_MODEL"


@dataclass(frozen=True)
class Settings:
    entity_name: str
    entity_id: str | None
    llm_model: str


def load_settings() -> Settings:
    return Settings(
        entity_name=(os.getenv(ENV_ENTITY_NAME) or DEFAULT_ENTITY_NAME).strip(),
        entity_id=(os.getenv(ENV_ENTITY_ID) or "").strip() or None,
        llm_model=(os.getenv(ENV_LLM_MODEL) or DEFAULT_LLM_MODEL).strip(),
    )
