-- Giffin forms portal: PostgreSQL schema (Prisma Postgres on Vercel)
-- Mirrors what the portal currently keeps in the browser, so the data can move
-- into a shared database. Run once against the database
-- (psql "$DATABASE_URL" -f db/schema.sql, or the Prisma Console query editor).

create extension if not exists pgcrypto;

-- People who sign in: Project Managers and Estimators
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique,
  role        text not null check (role in ('pm', 'estimator', 'approver')),
  created_at  timestamptz not null default now()
);

-- One row per declaration (PMD-<PM>-<YYYYMMDD>-<NN>); the latest revision number is kept here
create table if not exists declarations (
  id            uuid primary key default gen_random_uuid(),
  dec_no        text not null unique,              -- base number, e.g. PMD-JOHNPAUL-20261127-01
  pm_name       text not null,
  pm_user_id    uuid references users(id),
  dec_date      date not null,
  current_rev   integer not null default 0,        -- 0 = first submission, 1 = -R1, ...
  status        text not null default 'sub'
                check (status in ('sub', 'ip', 'drev', 'created')),
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Every submitted version of a declaration (R0, R1, R2 ...), with its jobs and items
create table if not exists declaration_revisions (
  id              uuid primary key default gen_random_uuid(),
  declaration_id  uuid not null references declarations(id) on delete cascade,
  rev             integer not null,
  rev_no          text not null,                   -- e.g. PMD-JOHNPAUL-20261127-01-R1
  jobs            jsonb not null,                  -- [{ name, rows:[{ s, d, h, q, y, u }] }]
  submitted_by    text not null,
  submitted_at    timestamptz not null default now(),
  unique (declaration_id, rev)
);

-- One estimate per declaration (or a blank estimate with no declaration)
create table if not exists estimates (
  id              uuid primary key default gen_random_uuid(),
  est_no          text not null unique,            -- e.g. EST-JOHNPAUL-20261127-01
  declaration_id  uuid unique references declarations(id) on delete set null,
  pm_name         text not null,
  created_by      text not null,
  created_at      timestamptz not null default now()
);

-- Every saved version of an estimate (Rev 0, Rev 1 ...), with the full form data and totals
create table if not exists estimate_revisions (
  id            uuid primary key default gen_random_uuid(),
  estimate_id   uuid not null references estimates(id) on delete cascade,
  rev           integer not null,
  based_on_dec_rev integer,                        -- which declaration revision it was estimated from
  data          jsonb not null,                    -- the Estimation Form state (rates, jobs, prices)
  total_cost    numeric(14,2) not null,
  grand_total   numeric(14,2) not null,
  currency      text not null default 'AED',
  saved_by      text not null,
  saved_at      timestamptz not null default now(),
  unique (estimate_id, rev)
);

-- Approver decisions on estimate revisions (only the latest revision can be acted on)
create table if not exists estimate_approvals (
  id            uuid primary key default gen_random_uuid(),
  estimate_id   uuid not null references estimates(id) on delete cascade,
  rev           integer not null,
  action        text not null check (action in ('approved', 'returned')),
  comment       text,                              -- required when returned
  decided_by    text not null,
  decided_at    timestamptz not null default now()
);

create index if not exists declarations_pm_idx on declarations (pm_name);
create index if not exists declarations_status_idx on declarations (status);
create index if not exists estimate_revisions_estimate_idx on estimate_revisions (estimate_id, rev desc);
