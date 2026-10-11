# Roles (Phase 1)

Stored on `profiles.role`. Database check constraint + RLS. Frontend only chooses the portal.

| Role | Portal | Meaning |
| --- | --- | --- |
| `super_admin` | `/admin` | Platform operator (KD). All organizations. |
| `admin` | `/admin` | Tenant administrator for one FM company. |
| `operations_manager` | `/admin` | Tenant operations lead. Same admin console, org-scoped. |
| `supervisor` | `/supervisor` | Site supervisor (mobile-first). |
| `worker` | `/worker` | Housekeeping / facility staff (mobile-first). |
| `security_guard` | `/security` | Guard check-in, patrols, incidents, visitors. |
| `client_admin` | `/client` | Client facility manager (full client portal). |
| `client_user` | `/client` | Read-leaning client user (same portal, RLS still org+client scoped). |
| `client` | `/client` | Legacy alias kept so existing demo users keep working. |

## Capability sketch (UI)

| Capability | super_admin | admin / ops | supervisor | worker / guard | client* |
| --- | --- | --- | --- | --- | --- |
| Manage organizations | yes | no | no | no | no |
| Edit own org settings | yes | yes | no | no | no |
| CRUD clients / sites / staff | yes | yes | no | no | no |
| Mark site attendance | yes | yes | yes | own punch | view |
| Manage shifts / roster | yes | yes | site roster | view own | no |
| Create tasks / apply checklists | yes | yes | yes (managed sites) | tick own | view |
| Submit inspections + photos | yes | yes | yes | no | view |
| Raise / comment on complaints | yes | yes | site issues | no | yes |
| Generate / print monthly reports | yes | yes | no | no | own client |
| Raise complaint | — | — | maintenance | no | yes |
| Security patrols / incidents / visitors | yes | yes | site view | guard write | view |
| Inventory / assets | yes | yes | issue stock | no | no |

Fine-grained module RBAC (inventory, invoices, …) is added with those phases.
