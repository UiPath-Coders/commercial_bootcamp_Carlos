<!-- discovery-metadata: cs=0 xaml=4 deps=2 -->
<!-- PROJECT-CONTEXT:START -->
# Invoice_Intake_RPA_Carlos — project context

- Type: Process, XAML, VisualBasic, targetFramework Portable (runs on the Serverless runtime). Built from `../reference/Invoice_Intake_RPA_Reference`.
- Dependencies: UiPath.System.Activities [26.8.2], UiPath.DataService.Activities 25.9.10. Data Fabric entity `AP_Invoice_Carlos` (tenant scope, id `1a1f4d42-d7bd-f111-a6a9-6045bddc9767`) installed via `uip rpa data-fabric-entities install` → `.entities/EntitiesStore.json`, namespace `Invoice_Intake_RPA_Carlos`.
- Flow: `Main.xaml` lists bucket → per file `ProcessInvoiceFile.xaml` (download → `ExtractInvoiceData.xaml` Run Job of the agent → Valid? gate on PONumber + numeric TotalAmount → `CreateInvoiceRecord.xaml` idempotent on InvoiceNumber → optional queue item with Reference = record Id).
- Main contract (unprefixed on purpose; analyzer naming warnings expected): in `FileName` (blank = batch mode over the whole bucket), `CreateQueueItem` (default True; honoured only when FileName is set, batch mode always queues new records); out `ProcessedCount`, `CreatedCount`, `RejectedCount`, `RecordId`, `IsValid`, `WasDuplicate`, `ErrorMessage` (last processed file). Bucket/queue/agent names and the agent folder path are Main variables, not arguments. Counters are `num*` variables because VB is case-insensitive: a `processedCount` variable would shadow the `ProcessedCount` out argument.
- New records get InvoiceLifecycleState = EXTRACTED; POMatched/ApprovalNeeded/PostedToERP stay unset.
- Tenant resources: folder `Agentic Bootcamp/APAutomation_Carlos` (bucket `InvoiceInbox_Carlos`, queue `InvoiceQueue_Carlos` unique refs); agent `Invoice_Extraction_Agent_Carlos` in subfolder `Agentic Bootcamp/APAutomation_Carlos/Invoice_Extraction_Agent_Carlos`.
- Gotcha: per-file `uip rpa validate` can report "Cannot create unknown type" for package/entity types when the headless Studio session is stale (started before packages/entities were installed) — restart that instance; `uip rpa build` is unaffected.
<!-- PROJECT-CONTEXT:END -->
