# Vercel preparation verification — 2026-09-07

Local verification completed:

- Backend: 16 suites, 224 tests passed.
- Frontend: 5 suites, 11 tests passed.
- Both TypeScript builds and the Vite production build passed.
- Lint passed with existing console warnings and no errors.
- Production dependency audits: zero reported vulnerabilities in both packages.
- Seed tests cover concurrent initialization, repeated runs, interrupted-run recovery,
  preservation of account edits/passwords, all five login roles and seeded API modules.
- Health checks report 503 when backing services are disconnected.
- Unauthenticated maintenance requests are rejected.
- MongoDB counters handle concurrent requests, separate windows and clients, HTTP
  rejection at the limit, and fail closed on production store errors.
- A replica-set integration test verifies live events across two Socket.IO servers
  while restricting delivery to the intended hospital room. Temporary data has TTL indexes.

Deployment is **not yet verified live**. The dedicated MongoDB Atlas Free cluster
has been provisioned. The app now defaults to MongoDB for shared state and does not
require a paid Redis service. Dashboard access and the GitHub import are in progress.

Still required: Git repository import, environment variables, production deployment, and live browser/API/
WebSocket/PDF/redeployment checks. SMTP delivery also requires an SMTP service.
Local tests are not evidence that these external services are configured or operational.
