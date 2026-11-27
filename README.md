# Giffin forms portal

One-page web app for Project Manager declarations and estimates.

- **Login as Project Manager** (Eyad, Johnpaul, Wael): create a Project Manager Declaration, submit it to the Estimator, revise it (‑R1, ‑R2 …), and follow its status and history on your dashboard.
- **Login as Estimator**: see declarations received from each Project Manager, view them, estimate them in the Estimation Form, save estimates and revisions, and review the revision history (who, when, what changed). Export any revision to PDF.
- Exports: Excel (.xlsx) and PDF (A4 portrait) for both forms.

## Files

| Path | What it is |
|---|---|
| `index.html` | The whole portal (login, dashboards, both forms) in one file |
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
