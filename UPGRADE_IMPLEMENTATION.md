# Production-oriented upgrade

## Implemented foundations

- Hospital/Tenant model and centralized Mongoose tenant scoping for users, role profiles, departments, appointments, labs, pharmacy, inventory, billing, documents, audit logs and permission overrides.
- Central Admin User Management API/UI: paginated search/filter, create, view/update, soft delete/suspend/reactivate, password reset, safe role conversion and permission overrides.
- Public signup is Patient-only. Staff provisioning creates its required profile and returns a generated temporary password once; first login requires a password change.
- Access/refresh/session hardening: live user validation on API/socket authentication, refresh rotation, session-version checks, account state enforcement and revocation after security-sensitive changes.
- Hospital profile and branding API/UI with file-size, declared MIME and binary-signature validation for logo/favicon upload (2 MB), live title/logo/color refresh and user → hospital → platform preference precedence.
- Explicit application routes and responsive navigation for User Management, Staff, Departments, Roles/Permissions, Audit Logs and My Profile, with an error boundary so a page failure cannot silently render a blank workspace.
- Authenticated Socket.IO rooms: `hospital:{hospitalId}`, `user:{userId}` and `role:{role}:{hospitalId}`. Events carry identifiers/status rather than confidential records; the client invalidates consistent React Query keys.
- Audit records for administrative and legacy mutation routes, with changed-field metadata and no plaintext passwords/tokens.
- One-time platform administrator bootstrap and non-destructive legacy profile audit/repair scripts.

## New API surface

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/v1/users` | List/filter or provision users |
| GET/PATCH/DELETE | `/api/v1/users/:id` | View, edit, or soft-deactivate |
| PATCH | `/api/v1/users/:id/role` | Validated role/profile conversion |
| PATCH | `/api/v1/users/:id/status` | Suspend/reactivate and revoke sessions |
| POST | `/api/v1/users/:id/reset-password` | One-time temporary password |
| PUT | `/api/v1/users/:id/permissions` | Per-user grants/denials |
| GET | `/api/v1/users/permissions/catalog` | Server permission catalog |
| GET | `/api/v1/users/permissions/matrix` | Server-enforced default role matrix |
| GET | `/api/v1/audit-logs` | Tenant-scoped paginated audit records |
| GET | `/api/v1/hospital/public` | Public login branding |
| GET | `/api/v1/hospital/branding` | Current tenant branding |
| GET/PATCH | `/api/v1/hospital` | Hospital settings management |
| PATCH | `/api/v1/auth/preferences` | Persist user language/theme |
| GET/PATCH | `/api/v1/auth/me` | Read/update the authenticated profile |
| POST | `/api/v1/auth/change-password` | Required/voluntary password change |

## Permission model

The existing least-privilege resource/action matrix remains the default. A hospital administrator may add or deny catalog permissions only within server-validated capabilities; explicit denial wins. Platform-only administrator creation and platform-admin demotion/suspension are protected. Ownership and tenant checks remain independent of UI visibility.

## Real-time events

`user.created`, `user.updated`, `user.deactivated`, `user.reactivated`, `user.roleChanged`, `permission.updated`, `hospital.settings.updated`, appointment lifecycle events, lab order/result events, prescription/dispensing events, `inventory.updated`, `inventory.lowStock`, `invoice.updated`, and `payment.received` invalidate the relevant cached resources.

## Deliberate limitations

- This release is tenant-ready and isolates configured hospitals, but it does not include a platform-owner UI for onboarding additional hospitals.
- Role conversion uses validated compensating writes (including restoration of previous and target profile state) so it works on standalone local MongoDB. A replica-set deployment should upgrade this workflow to native multi-document transactions for the strongest atomic guarantee.
- Logo persistence uses a validated MongoDB data URL for self-contained local operation. Commercial production should use private object storage/CDN plus malware scanning.
- Existing document PDF generation is branded. The baseline did not contain dedicated invoice/prescription PDF generators, so those new generators are not claimed.
- No browser E2E harness existed; API/unit/integration and frontend component tests are used. Full cross-browser and accessibility certification remains deployment QA work.
- Translation infrastructure and direction switching cover English, Dari and Pashto, including saved preferences; not every domain-generated backend message has a curated human translation.
