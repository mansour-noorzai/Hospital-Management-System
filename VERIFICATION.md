# Verification report

Verification was executed in the delivery environment on 2026-08-12 with Node.js 24 and MongoDB 7.0.14.

## Passed

| Check | Result |
|---|---|
| Backend Jest suites | 14 suites, 216 tests passed |
| Frontend Vitest suites | 3 suites, 9 tests passed |
| Backend TypeScript | `tsc --noEmit` passed |
| Frontend TypeScript | `tsc --noEmit` passed |
| Backend production build | passed |
| Frontend Vite production build | passed |
| Backend ESLint | 0 errors (18 intentional console warnings in CLI migration/server code) |
| Frontend ESLint | 0 errors (3 Fast Refresh export warnings) |
| Source contract verifier | 15/15 passed |

The backend integration suites run against MongoDB Memory Server 7 with a real Mongoose database. They cover authentication, refresh/logout/reset behavior, immediate access-token revocation, RBAC, patients, staff, appointments, billing, labs, pharmacy/dispensing, inventory/movements, documents/PDF authorization, analytics/settings, health behavior, centralized user provisioning, forced password change, role-profile conversion, branding image validation, audit retrieval and two-hospital isolation. Frontend tests render User Management and its create dialog plus Departments, Roles/Permissions, Audit Logs and My Profile using real React Query state.

## Live smoke test passed

A separate MongoDB 7 process and the compiled backend were started. The one-time administrator command created a Hospital and platform administrator. The following live checks passed:

- API health
- bootstrap administrator did not receive a route-blocking forced-password flag
- initial administrator login
- authenticated tenant-scoped User Management list
- public Patient-only registration
- hospital name/color/language/theme update
- tenant-scoped audit-log list
- administrator recovery command
- rejection of the old access token after recovery (401)
- authenticated Socket.IO connection

Redis was intentionally absent during the live test; the backend continued in its documented optional/fail-open local mode without unhandled Redis events.

## Not runtime-verified here

- SMTP delivery, AWS Secrets Manager/S3, Redis adapter behavior and a replicated production MongoDB cluster.
- Multi-browser visual regression, mobile device testing, screen-reader certification and a full human E2E pass of every screen.
- Load, soak, penetration and disaster-recovery tests.

The Vite build reports a non-blocking warning that the main JavaScript chunk is about 1.21 MB (321.68 KB gzip); route-level code splitting is recommended before high-scale deployment.
