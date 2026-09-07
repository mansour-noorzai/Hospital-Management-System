# Vercel deployment

The repository root contains the deployment configuration. One project serves the
Vite frontend, Express API and Socket.IO server on the same HTTPS origin. Use
Node.js 22 and the **Express** framework preset; `vercel.json` supplies the commands.
Keep Fluid compute enabled for WebSocket support.
The root HTTP server preserves API paths and the frontend build is staged into
`public/` for Vercel's CDN. Only frontend routes are rewritten to `index.html`.

## Environment

Set secrets through Vercel environment settings, never in source code or build logs.

| Key | Production value |
| --- | --- |
| NODE_ENV | production |
| SECRETS_PROVIDER | env (AWS Secrets Manager is available with `aws`) |
| MONGODB_URI | MongoDB Atlas connection URI with a dedicated database and database user |
| REDIS_URL | TLS Redis connection URI beginning with `rediss://` |
| JWT_SECRET | Independently generated random secret, at least 32 characters |
| JWT_REFRESH_SECRET | Different random secret, at least 32 characters |
| CRON_SECRET | Random secret, at least 32 characters |
| FRONTEND_URL | Canonical HTTPS production origin |
| CORS_ORIGINS | Exact allowed HTTPS origins, comma-separated |
| DEMO_MODE | true for the dedicated demonstration deployment |
| ALLOW_DEMO_SEED | true for the dedicated demonstration deployment |
| DEMO_PASSWORD | Private demo password of at least 16 characters |

Preview deployments require their own database and `ALLOW_PREVIEW_DATABASE=true`.
Do not copy the production database credentials into the preview environment.
The default preview guard stops database preparation until that explicit setting exists.

SMTP (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`) is required to actually
deliver password resets or documents by email. Demo `.demo` addresses are fictional;
email delivery is not a working demo feature without real addresses and an SMTP service.
PDF downloads are generated from MongoDB records and do not depend on local disk storage.

## Build and demo data

`npm run build:vercel` builds both applications, checks services, creates missing
indexes, and runs the demo seed when enabled. It fails if database preparation
fails, so an empty or misconfigured application is not promoted successfully.

The seed creates six accounts (admin, doctor, nurse, receptionist and two patients),
departments, inventory categories, appointments, invoices/payments, prescriptions,
drugs, stock movements, laboratory results and a medical certificate.
The account addresses are `admin@medicore.demo`, `doctor@medicore.demo`,
`nurse@medicore.demo`, `receptionist@medicore.demo`, `patient@medicore.demo`, and
`patient2@medicore.demo`. Passwords are hashed and never printed by the seed.

Stable record IDs and a database completion marker make reruns and interrupted
attempts non-destructive. Successful reruns preserve edits, passwords and records.
The seed does not reset existing databases. An older dataset containing the same
demo emails under other IDs needs a separate demo database or an explicitly planned
migration; the script fails instead of deleting or replacing those accounts.

## Scheduled work and realtime updates

The protected maintenance endpoint runs once daily at 01:00 UTC under the included
Hobby-compatible schedule. It cancels unconfirmed appointments older than 24 hours,
marks unpaid issued invoices overdue, and emits inventory expiry notifications.
Cancellation can therefore occur at the next daily run, up to 48 hours after creation.
An hourly schedule requires an appropriate Vercel plan; no plan upgrade is automatic.

Socket.IO uses WebSocket transport and a Redis adapter for events across instances.
Clients reconnect and refresh cached data after a function connection expires.

## Verification and release

1. Run `npm ci --prefix backend` and `npm ci --prefix frontend`.
2. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
3. Import this repository into Vercel using the root directory and configure services.
4. Deploy production; confirm build-time seed completion without secret values in logs.
5. Verify `/api/v1/health` returns 200; missing services return 503.
6. Sign in with each demo role, inspect seeded modules, download a PDF, test a record
   edit and refresh, and confirm WebSocket updates between two authenticated sessions.
7. Redeploy and verify the edit remains and no duplicate demo records appear.

The repository configuration alone does not establish a live production deployment.
Database provisioning, SMTP, Git integration and live checks must be recorded after
they actually succeed. This demo deployment is not a clinical or regulatory certification.
