# Redesign and Fix Summary

## UI / UX
- Rebuilt responsive application shell, sidebar and top bar.
- Added persisted English, Dari and Pashto language selection.
- Added automatic LTR/RTL document direction and RTL-safe spacing/alignment.
- Added persisted light/dark theme support.
- Redesigned authentication pages and shared UI primitives.
- Added dedicated receptionist dashboard and appointment management UI.
- Removed fabricated dashboard metrics/alerts and wired dashboards to real APIs.

## Authentication / security
- Fixed frontend/backend password-policy mismatch.
- Implemented password reset flow and email normalization.
- Fixed refresh-token retry behavior and React Strict Mode refresh race.
- Enforced appointment, patient, document and prescription ownership rules server-side.
- Bound doctor-authored prescription/document operations to the authenticated doctor profile.
- Added explicit appointment status transition validation.
- Improved global 4xx handling for invalid ObjectIds, duplicate keys and malformed JSON.

## Data integrity / API fixes
- Replaced race-prone count-based human IDs with atomic counters.
- Made registration roll back the user if patient-profile creation fails.
- Fixed dead dashboard API paths and response-shape mismatches.
- Fixed billing overpayment handling and payment-state validation.
- Fixed revenue analytics to sum actual payments instead of invoice totals.
- Fixed pharmacy partial stock deductions with compensating rollback.
- Fixed inventory adjust-to-zero and movement rollback behavior.
- Fixed settings working-hours request/response mismatch.
- Added authenticated on-demand medical-document PDF download.
- Added collection endpoint for lab results and corrected nested population where needed.

## Verification assets
- Added `npm run verify:source` dependency-free source contract checks.
- Added root `npm run verify` orchestration for typecheck, tests, builds and lint once dependencies are installed.
- Added `VERIFICATION.md` with the exact tested/not-tested boundary for this delivery environment.
