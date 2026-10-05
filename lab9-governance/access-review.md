# Lab 9 Step 2: effective tenant access review

Read-only review on 2026-10-05 of the participant account (Carlos Portillo) on organization
`customersuccessamer`, tenant `Training`. Nothing was created, changed or removed.

The account belongs to 3 groups: **Agentic Bootcamp Participants**, **Automation Developers** and **Everyone**.

## Basis of this review

The effective-access check (`uip admin authorization check-access`) is not available to participant
accounts; it returns 403 at Tenant and Folder scope, as expected. This review is therefore based on the
visible role assignments:

- the role-assignment catalog for the account and its 3 groups, and
- Orchestrator's own role views (`uip or roles user-roles list`, `uip or users list-in-folder --include-inherited`)
  for tenant and folder roles.

Services outside the bootcamp were not reviewed. The assignments below are the full review.

## Roles found

"From group" means the same role is granted to that group, and the account has it only through the group.

| Service | Role | Scope | How granted |
|---|---|---|---|
| Orchestrator | Orchestrator Administrator | Tenant (Training) | **Direct** (no group of the account has it) |
| Orchestrator | Solutions Administrator | Tenant (Training) | **Direct** (likely the grant an admin made in Lab 2 to unblock the solution deploy) |
| Orchestrator | Allow to be Automation Developer | Tenant (Training) | From group Automation Developers |
| Orchestrator | Automation Developer | Folder: Agentic Bootcamp (inherited by APAutomation_Carlos) | From group Agentic Bootcamp Participants |
| Orchestrator | Folder Administrator | Folder: Agentic Bootcamp (inherited by APAutomation_Carlos) | From group Agentic Bootcamp Participants |
| Orchestrator | Automation Developer, Folder Administrator | Folder: Shared/BootCampSmoke | From group Agentic Bootcamp Participants |
| Orchestrator | Automation Developer | Folder: Shared | From group Automation Developers |
| Orchestrator | Folder Administrator | Folder: Invoice_Extraction_Agent_Carlos (Lab 2 solution folder) | Direct (given to the deployer) |
| Orchestrator | Personal Workspace Administrator | Own personal workspace | Direct (automatic) |
| IXP | IXP Project Creator, IXP Package Reader, IXP Package Publisher, IXP Package Admin, IXP Audit Log Viewer | Tenant (Training) | Direct |
| Document Understanding | DU Developer | Organization | From group Automation Developers |
| Process Mining | Developer | Tenant (Training) | From group Automation Developers |
| Studio Web | Studio Web Contributor | Organization | From groups Automation Developers and Everyone |
| Apps | App Creator | Organization | From group Everyone |

## Folder access

| Folder | Roles | Origin |
|---|---|---|
| Agentic Bootcamp | Automation Developer, Folder Administrator | Assigned on this folder to group Agentic Bootcamp Participants |
| Agentic Bootcamp/APAutomation_Carlos | Automation Developer, Folder Administrator | Inherited from Agentic Bootcamp (same group) |

## Broader than necessary

| Grant | Why it stands out | Verdict |
|---|---|---|
| Orchestrator Administrator, tenant-wide, direct | Full control of every folder, process, robot and setting in Training, including other participants' folders. The labs only need rights in APAutomation_Carlos. | **Broadest grant; flag for the facilitator** |
| Solutions Administrator, tenant-wide, direct | Can manage every solution deployment in the tenant, not only your own. | Flag; narrow after the bootcamp |
| IXP Package Admin and IXP Audit Log Viewer, tenant-wide, direct | More than the IXP create/publish work in Lab 1 needs. | Flag (low) |
| Folder Administrator on Agentic Bootcamp, via group | Admin over every participant's sub-folder. | **Expected and accepted**: Lab 2 creates your sub-folder under it |
| Org-wide DU Developer, Studio Web Contributor, App Creator | Standard developer defaults from shared groups. | Normal |
