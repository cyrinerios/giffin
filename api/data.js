// GET  /api/data                      -> { ok, declarations:[...], estimates:[...] }
// POST /api/data { kind, docs:[...] } -> upserts the given documents (each needs a string id)
// Every request needs "Authorization: Bearer <token>" from /api/login.
//
// Who may write what:
//   declaration: Project Managers (only their own) and Estimators (status / estimate links)
//   estimate:    Estimators (create / revise) and Estimate Approvers (approve / return)
const { verifyToken, db, ensureSchema, send } = require('./_lib');

const MAX_DOC_BYTES = 2_000_000;

module.exports = async (req, res) => {
  const user = verifyToken(req);
  if (!user) return send(res, 401, { ok: false, error: 'Please sign in again.' });

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { rows } = await db().query('select kind, data from portal_docs order by updated_at');
      return send(res, 200, {
        ok: true,
        declarations: rows.filter(r => r.kind === 'declaration').map(r => r.data),
        estimates: rows.filter(r => r.kind === 'estimate').map(r => r.data),
      });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      const kind = body && body.kind;
      const docs = Array.isArray(body && body.docs) ? body.docs : [];
      if (!['declaration', 'estimate'].includes(kind) || !docs.length) {
        return send(res, 400, { ok: false, error: 'Nothing to save.' });
      }

      const allowed =
        kind === 'declaration' ? (user.role === 'pm' || user.role === 'est')
                               : (user.role === 'est' || user.role === 'apr');
      if (!allowed) return send(res, 403, { ok: false, error: 'Your role cannot change this.' });

      for (const d of docs) {
        if (!d || typeof d.id !== 'string' || !d.id || d.id.length > 80) {
          return send(res, 400, { ok: false, error: 'Invalid document.' });
        }
        if (kind === 'declaration' && user.role === 'pm' && d.pm !== user.name) {
          return send(res, 403, { ok: false, error: 'Project Managers can only save their own declarations.' });
        }
        if (JSON.stringify(d).length > MAX_DOC_BYTES) {
          return send(res, 413, { ok: false, error: 'Document is too large.' });
        }
      }

      const client = await db().connect();
      try {
        await client.query('begin');
        for (const d of docs) {
          await client.query(
            `insert into portal_docs (kind, id, data, updated_at, updated_by)
             values ($1, $2, $3, now(), $4)
             on conflict (kind, id) do update set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by`,
            [kind, d.id, d, user.name]
          );
          await client.query(
            'insert into portal_audit (kind, doc_id, saved_by, saved_role, data) values ($1, $2, $3, $4, $5)',
            [kind, d.id, user.name, user.role, d]
          );
        }
        await client.query('commit');
      } catch (err) {
        await client.query('rollback').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      return send(res, 200, { ok: true, saved: docs.length });
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { ok: false, error: 'Use GET or POST.' });
  } catch (err) {
    console.error('api/data error:', err && err.message);
    return send(res, 500, { ok: false, error: 'The database could not be reached. Please try again.' });
  }
};
