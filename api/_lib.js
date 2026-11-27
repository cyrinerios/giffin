// Shared helpers for the API routes (files starting with "_" are not routes on Vercel).
const crypto = require('crypto');
const { Pool } = require('pg');

// ---- session tokens (issued by /api/login) ----
function verifyToken(req) {
  const secret = process.env.SESSION_SECRET;
  const h = String(req.headers.authorization || '');
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [body, mac] = tok.split('.');
  if (!secret || !body || !mac) return null;
  const want = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p || !p.n || !p.r || !(p.exp > Date.now())) return null;
    return { name: p.n, role: p.r, exp: p.exp };
  } catch (e) {
    return null;
  }
}

// ---- database (Prisma Postgres; direct Postgres connection string from the Vercel integration) ----
let pool = null;
function db() {
  if (!pool) {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url || !/^postgres(ql)?:\/\//.test(url)) throw new Error('No Postgres connection string (POSTGRES_URL) is set.');
    pool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

let ready = null;
// Creates the tables on first use, so there is nothing to run by hand.
function ensureSchema() {
  if (!ready) {
    ready = db().query(`
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
    `).catch(err => { ready = null; throw err; });
  }
  return ready;
}

function send(res, code, obj) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json(obj);
}

module.exports = { verifyToken, db, ensureSchema, send };
