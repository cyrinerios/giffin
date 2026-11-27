-- Giffin forms portal: database tables in giffin-db (Prisma Postgres on Vercel)
--
-- You do not need to run this by hand: api/_lib.js creates these tables automatically
-- the first time the portal (or /api/health) connects. It is kept here for reference.
--
-- portal_docs  : the current version of every declaration and estimate, stored as JSON
--                (declarations hold their R0/R1… revisions; estimates hold Rev 0/1… and approvals)
-- portal_audit : a copy of every save (who, role, when, what), as a permanent audit trail

create table if not exists portal_docs (
  kind        text not null check (kind in ('declaration', 'estimate')),
  id          text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (kind, id)
);

create table if not exists portal_audit (
  id         bigserial primary key,
  kind       text not null,
  doc_id     text not null,
  saved_by   text not null,
  saved_role text not null,
  saved_at   timestamptz not null default now(),
  data       jsonb not null
);

create index if not exists portal_audit_doc_idx on portal_audit (kind, doc_id, saved_at desc);

-- Handy queries
--   All declarations:            select data from portal_docs where kind = 'declaration' order by updated_at desc;
--   One estimate's save history: select saved_at, saved_by, saved_role from portal_audit where doc_id = '<id>' order by saved_at;
