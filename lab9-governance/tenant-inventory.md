# Lab 9 Step 3: tenant and service inventory

Read-only inventory on 2026-10-05. Nothing was created, changed or removed.

Organization: **CustomerSuccessAmer** (`customersuccessamer`), region United States, status Active.

## Tenants

| Tenant | Status | Region | Environment | Services provisioned | Enabled | Disabled |
|---|---|---|---|---|---|---|
| Training (bootcamp tenant) | Enabled | United States | Production | 49 | 49 | none |
| Development | Enabled | United States | Development | 48 | 45 | AI Center, Document Understanding (legacy `du`), IXP (`reinfer`) |
| Staging | Enabled | United States | Production | 50 | 47 | AI Center, Document Understanding (legacy `du`), IXP (`reinfer`) |
| Production | Enabled | United States | Production | 48 | 45 | AI Center, Document Understanding (legacy `du`), IXP (`reinfer`) |
| External | Enabled | United States | Production | 50 | 47 | AI Center, Document Understanding (legacy `du`), IXP (`reinfer`) |

Status comes from `uip admin tenants get` (`TenantServiceInstances[].Status`); `tenants services list` has no status.

## Provisioned services and their status

Enabled on all 5 tenants (44): Actions, AgentHub, Agentic Orchestration, AgentsRuntime, AI Metering,
Automation Solutions, Automation Tracker, Autopilot For Everyone, Autopilot Studio, BupProxyService,
Business Rules, Computer Use, Integration Service, Connector Builder, Resolve, Data Service, Autopilot
Delegate, UiPath Documents, EnterpriseContextService, Elements Service, Event Queue, hypervisor, Insights,
InsightsLogExportCustomerDataConfig, InsightsRealTimeMonitoring, LLM Gateway, LLM Ops Tenant, messagebus,
MLS, UiPath OCR, Orchestrator, Process Instance Management Service, Processes, Process Mining,
Provisioning Service, Relay Service, Resource Catalog, SAP Proxy, Semantic Proxy, Serverless Control
Plane, Storage Service, Task Mining, tenantaudit, Vertical Solution Service.

Services that differ (— = not provisioned):

| Service | Training | Development | Staging | Production | External |
|---|---|---|---|---|---|
| AI Center | — | Disabled | Disabled | Disabled | Disabled |
| Automation Hub | Enabled | — | Enabled | Enabled | Enabled |
| Automation Store | Enabled | — | Enabled | — | Enabled |
| Document Understanding | Enabled | Disabled | Disabled | Disabled | Disabled |
| IXP (Reinfer) | Enabled | Disabled | Disabled | Disabled | Disabled |
| Test Manager | Enabled | Enabled | Enabled | — | Enabled |

## Pending or failed provisioning

None. Across all 245 provisioned service instances the only statuses are Enabled (233) and Disabled (12);
no instance is pending, provisioning or failed, and every tenant's lifecycle status is Enabled.

## Available catalog (United States)

AI Center, AI Metering, Actions, AgentHub, AgentsRuntime, Automation Hub, Automation Solutions, Automation
Store, Automation Tracker, Autopilot Delegate, Autopilot For Everyone, Autopilot Studio, BupProxyService,
Business Rules, Connector Builder, Data Service, Document Understanding, Elements Service,
EnterpriseContextService, Event Queue, Insights, InsightsLogExportCustomerDataConfig,
InsightsRealTimeMonitoring, Integration Service, LLM Gateway, LLM Ops Tenant, Orchestrator, Processes,
Provisioning Service, Reinfer, Resolve, Resource Catalog, SAP Proxy, Semantic Proxy, Storage Service, Task
Mining, UiPath Documents, UiPath OCR, messagebus, tenantaudit (40).

## Provisioned vs available

The catalog (`uip admin tenants services list-available --region UnitedStates`) lists 50 services. It is
not region-filtered, so it was filtered on `SupportedRegions`: 40 list United States.

| Tenant | Available in the US catalog but not provisioned |
|---|---|
| Training | AI Center |
| Development | Automation Hub, Automation Store |
| Production | Automation Store |
| Staging | none |
| External | none |

Also of note:

- **Training is the only tenant where IXP and Document Understanding are enabled.** Lab 1 (IXP) and Lab 2
  depend on this.
- Production has no Test Manager; the other four tenants do.
- 10 services are provisioned on the tenants but do not list United States in `SupportedRegions`
  (Agentic Orchestration, Computer Use, Process Mining, Test Manager, Serverless Control Plane, Relay, MLS,
  hypervisor, Process Instance Management, Vertical Solution). This is catalog metadata: the services run
  here (Maestro and serverless robots are used in Labs 2-10), so the region list is incomplete, not wrong
  provisioning.
