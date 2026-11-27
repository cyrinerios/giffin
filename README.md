# Giffin forms portal

One-page web app for Project Manager declarations and estimates.

- **Login as Project Manager** (Eyad, Johnpaul, Wael): create a Project Manager Declaration, submit it to the Estimator, revise it (‑R1, ‑R2 …), and follow its status and history on your dashboard.
- **Login as Estimator**: see declarations received from each Project Manager, view them, estimate them in the Estimation Form, save estimates and revisions, and review the revision history (who, when, what changed). Export any revision to PDF.
- **Login as Estimate Approver**: see estimates waiting for approval, view them, Approve or Return for revision (with a reason), and see returned and approved estimates. Approval status shows on every dashboard and in the history.
- **Login as Sales**: search an estimate or declaration reference to see its status. Once approved, view and print a summary PDF showing only each job's section totals, sub totals and the grand total (the server never sends Sales the detailed breakdown).
- Exports: Excel (.xlsx) and PDF (A4 portrait) for both forms.

## Sign-in

Each role signs in with a username and password. The check runs on the server
(`api/login.js`); usernames and passwords are **not** in this repo. They are kept in
the Vercel project's sensitive environment variables:

- `PORTAL_USERS`: JSON list of users, e.g. `[{"u":"Name","r":"pm","p":"password"}]` (roles: `pm`, `est`, `apr`, `sal`)
- `SESSION_SECRET`: random string used to sign session tokens (sessions last 12 hours)

To add a user or change a password, edit `PORTAL_USERS` in Vercel (Settings → Environment
Variables) and redeploy. Sign-in only works on the hosted site, not when the file is opened from a computer.

## Files

| Path | What it is |
|---|---|
| `index.html` | The whole portal (login, dashboards, both forms) in one file |
| `api/login.js` | Server-side sign-in (Vercel Function) |
| `api/data.js`, `api/_lib.js` | Read and save portal data in giffin-db |
| `api/health.js` | Database connection check |
| `package.json` | Server dependency (`pg`) |
| `db/schema.sql` | PostgreSQL tables for moving the data into a shared Neon database |

## Database (giffin-db, Prisma Postgres via Vercel)

All declarations, estimates, revisions, approvals and history are saved in the shared
**giffin-db** database, so every user sees the same data from any computer.

- `api/data.js`: reads and saves data. Every request must carry the signed session token from sign-in.
  Project Managers can only save their own declarations; only Estimators and Approvers can change estimates.
- `api/health.js`: open `/api/health` to check the database connection.
- The tables (`portal_docs`, `portal_audit`) are created automatically on first use; see `db/schema.sql`.
- The database connection string (`POSTGRES_URL`) was added to the project by the Prisma Postgres integration.
- Every save is also copied to `portal_audit` (who, role, when, what) as a permanent audit trail.
- Data that an earlier version saved inside a browser is moved into the database automatically the next time that browser signs in.
- Unfinished form drafts still stay in each browser until they are submitted or saved.
