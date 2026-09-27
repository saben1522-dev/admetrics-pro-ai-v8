# AdMetrics Pro AI V8 — Production Workspace

V8 is the final major-version target for turning the V6 Growth Intelligence prototype into a team-operable workspace.

## Included
- V6 metrics, CSV import, anomaly/opportunity signals, learning and snapshots
- V8 workspace roles: Owner, Admin, Digital Marketing, Content Creator, Viewer
- Task management and execution status
- Decision queue with approval-required markers
- Owner brief
- Automation rule state
- Connector readiness panel without pretending live marketplace access exists
- Server persistence via JSON database (`admetrics-v8-db.json`)
- Server-side session authentication with PBKDF2 password hashing
- Backend role checks for workspace sync, metrics import and task creation
- Audit log
- Health endpoint

## Demo accounts
All seeded demo users use the password `ChangeMe123!` and should be changed before real deployment.

Usernames:
- owner
- admin
- marketer
- creator
- viewer

## Run
```bash
node server-v8.js
```
Open `http://localhost:8787/`.

## Production notes
This V8 package is a production-oriented foundation, not a claim that TikTok/Shopee/Meta/Google APIs are already connected. Real connectors require platform OAuth/API credentials and should be implemented one by one.

Before public deployment, add HTTPS/reverse proxy, external database with backups, secret management, CSRF protection, stronger session lifecycle, rate limiting, account management/password reset, structured logs, monitoring, and connector-specific OAuth scopes.
