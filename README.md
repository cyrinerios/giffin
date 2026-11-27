# Giffin forms portal

One-page web app for Project Manager declarations and estimates.

- **Login as Project Manager** (Eyad, Johnpaul, Wael): create a Project Manager Declaration, submit it to the Estimator, revise it (‑R1, ‑R2 …), and follow its status and history on your dashboard.
- **Login as Estimator**: see declarations received from each Project Manager, view them, estimate them in the Estimation Form, save estimates and revisions, and review the revision history (who, when, what changed). Export any revision to PDF.
- **Login as Estimate Approver**: see estimates waiting for approval, view them, Approve or Return for revision (with a reason), and see returned and approved estimates. Approval status shows on every dashboard and in the history.
- Exports: Excel (.xlsx) and PDF (A4 portrait) for both forms.

## Sign-in

Each role signs in with a username and password. The check runs on the server
(`api/login.js`); usernames and passwords are **not** in this repo. They are kept in
the Vercel project's sensitive environment variables:

- `PORTAL_USERS`: JSON list of users, e.g. `[{"u":"Name","r":"pm","p":"password"}]` (roles: `pm`, `est`, `apr`)
- `SESSION_SECRET`: random string used to sign session tokens (sessions last 12 hours)

To add a user or change a password, edit `PORTAL_USERS` in Vercel (Settings → Environment
Variables) and redeploy. Sign-in only works on the hosted site, not when the file is opened from a computer.

## Files

| Path | What it is |
|---|---|
| `index.html` | The whole portal (login, dashboards, both forms) in one file |
| `api/login.js` | Server-side sign-in (Vercel Function) |
| `db/schema.sql` | PostgreSQL tables for moving the data into a shared Neon database |

## Where the data lives today

The portal currently saves declarations, estimates and history in each user's
browser (localStorage). Hosting it on Vercel gives everyone the same link, but the
data is still per browser until the portal is connected to the database.

## Database (Prisma Postgres via Vercel)

The Vercel team already has the Prisma Postgres integration (free plan), so the
portal uses it as its PostgreSQL database.

1. Vercel → project **giffin** → **Storage** → **Create Database** → **Prisma Postgres**
   (name it `giffin-db`) → connect it to the **giffin** project for Production, Preview and Development.
   Vercel adds `DATABASE_URL` (and related) environment variables automatically.
2. Run `db/schema.sql` once against the database to create the tables
   (Prisma Console query editor, or `psql "$DATABASE_URL" -f db/schema.sql`).
3. Next step: add API routes that read and write these tables, and switch the portal's
   save/load calls from the browser to the API.
