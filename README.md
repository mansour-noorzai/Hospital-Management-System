
## Windows local development (without Docker)

The backend now loads `backend/.env` automatically. Copy `backend/.env.example` to `backend/.env` and use a local MongoDB instance. Redis is optional; the API fails open when Redis is unavailable.

For Vite development, both `http://localhost:5173` and `http://127.0.0.1:5173` are allowed by the default CORS configuration.

# MediCore Hospital Management System

A redesigned full-stack hospital management system built with React, TypeScript, Express, MongoDB, Redis and Socket.IO.

## What is included

- Tenant-scoped role-based access for **platform admin, hospital admin, doctor, nurse, receptionist and patient**, with per-user permission grants/denials.
- Authentication: registration, login, refresh-token rotation, logout, password reset and session restoration.
- Patient and staff management.
- Appointment booking, status workflow and role/ownership enforcement.
- Billing, payments and revenue analytics.
- Laboratory orders and results.
- Pharmacy, prescriptions, dispensing and stock protection.
- Inventory items, stock movements and low-stock workflows.
- Medical documents with authenticated PDF download.
- Central user management, safe role conversion, staff profile provisioning and session revocation.
- Data-driven hospital identity, branding, language/theme defaults, currency, time zone and document footers.
- Authenticated, hospital-scoped Socket.IO rooms and React Query cache synchronization.
- Responsive redesigned application shell.
- **English, Dari and Pashto** UI with automatic LTR/RTL switching.
- **Light and dark themes** with persisted user preference.

## Main architecture

```text
frontend/   React + TypeScript + Vite + Redux Toolkit + React Query + Tailwind
backend/    Express + TypeScript + MongoDB/Mongoose + Redis + Socket.IO
scripts/    dependency-free source contract verification
docker-compose.yml
```

The maintained implementation is TypeScript (`frontend/src` and `backend/src`). Obsolete duplicate JavaScript application files were removed.

## Local setup

### Option 1 — Docker

Requirements: Docker Desktop / Docker Engine with Compose.

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

Frontend: `http://localhost:5173`  
API health: `http://localhost:4451/api/v1/health`

### Option 2 — Run services manually

Requirements: Node.js 20+ (22 recommended) and MongoDB 7+. Redis 7+ is optional for multi-instance Socket.IO/rate-limit coordination.

```bash
cp backend/.env.example backend/.env
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run create-admin
npm --prefix backend run dev
npm --prefix frontend run dev
```

Before `create-admin`, set the `FIRST_ADMIN_*` and `FIRST_HOSPITAL_*` values in `backend/.env`. The command refuses to create a second platform administrator. Remove the bootstrap password from `.env` after success. Public registration always creates a Patient account in the initialized hospital.

If the administrator already exists, `create-admin` intentionally refuses to overwrite it. To recover an existing administrator that is locked, suspended, or stuck on the forced-password screen, set a new `ADMIN_RECOVERY_EMAIL` and `ADMIN_RECOVERY_PASSWORD` in `backend/.env`, then run:

```bash
npm --prefix backend run recover-admin
```

The recovery command activates that existing admin, clears lockout state, revokes old sessions, and removes the forced-password flag. Remove both recovery values from `.env` immediately afterward.

For an existing database, audit first and only then apply safe repairs:

```bash
npm --prefix backend run audit-profiles
npm --prefix backend run repair-profiles
```

The repair command never deletes medical/profile records and leaves ambiguous Doctor repairs for manual review. See [`MIGRATION.md`](./MIGRATION.md).


### Load complete demo data

After MongoDB is running and `backend/.env` is configured, populate a dedicated `medicore-demo` hospital with users and sample records for every major module:

```bash
npm --prefix backend run seed-demo
```

The seed is idempotent for the dedicated demo tenant and creates these login accounts:

| Role | Email |
| --- | --- |
| Admin | `admin@medicore.demo` |
| Doctor | `doctor@medicore.demo` |
| Nurse | `nurse@medicore.demo` |
| Receptionist | `receptionist@medicore.demo` |
| Patient | `patient@medicore.demo` |

Default password: `DemoPass123!` (override with `DEMO_PASSWORD`). The seed also creates departments, staff profiles, two patients, appointments, medicines, prescriptions, inventory and stock movement data, invoices/payments, lab orders/results, and a medical document.

## Verification

Dependency-free source checks:

```bash
npm run verify:source
```

Full verification after dependencies are installed:

```bash
npm run verify
```

That command runs backend/frontend type checks, tests, production builds and linting.

Backend has integration/unit suites covering authentication, authorization, appointments, patients, staff, billing, lab, pharmacy, inventory, documents, analytics and health behavior. Frontend includes i18n behavior tests.

See [`UPGRADE_IMPLEMENTATION.md`](./UPGRADE_IMPLEMENTATION.md), [`MIGRATION.md`](./MIGRATION.md), and [`VERIFICATION.md`](./VERIFICATION.md) for API/model changes, limitations, migration and the exact verification status.

## Important security behavior

- Access tokens are sent as Bearer tokens; refresh tokens use credentialed HTTP cookies.
- Client 401 handling performs one coordinated refresh and retries the failed request instead of immediately logging out.
- RBAC and own-record restrictions are enforced server-side.
- Every authenticated request is checked against the current user, account state, role, hospital and session version; role/permission/password/status changes revoke refresh sessions.
- Mongoose tenant scoping is applied centrally to hospital-owned models; socket rooms are hospital/user/hospital-role scoped.
- Doctor-authored prescriptions/documents are bound to the authenticated doctor profile.
- Appointment status changes use an explicit state transition policy.
- Invalid ObjectIds, validation failures, malformed JSON and duplicate-key conflicts return controlled 4xx responses.

## Environment variables

Use `backend/.env.example` as the reference. SMTP values are optional for reset/document email delivery in development. Production secret loading supports AWS Secrets Manager.
