# Validation Notes

## Completed
- Inspected backend models, routes, controllers/services structure, authorization middleware, tenant scoping, auth flows, and role-specific frontend routes/pages.
- Verified frontend route/sidebar coverage and core API module mounting with the repository source verifier: 15/15 checks pass.
- Reviewed RBAC matrix for Admin, Doctor, Nurse, Receptionist, and Patient.
- Confirmed shared UI pages hide write-only controls for read-only roles where applicable.
- Added `npm --prefix backend run seed-demo`.
- Added comprehensive demo data for users, profiles, departments, patients, appointments, drugs, prescriptions, inventory, stock movements, billing/payments, lab orders/results, and documents.
- Seed is blocked in production unless `ALLOW_DEMO_SEED=true`.

## Environment limitation
This execution environment does not contain MongoDB and cannot install all npm dependencies from the network (`npm ci --offline` reports uncached packages). Therefore a real database-backed browser/API runtime test could not be truthfully completed here. The repository's dependency-free source verification passes after the changes.
