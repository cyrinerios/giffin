// GET  /api/data                      -> { ok, declarations:[...], estimates:[...] }
// POST /api/data { kind, docs:[...] } -> upserts the given documents (each needs a string id)
// Every request needs "Authorization: Bearer <token>" from /api/login.
//
// Who may write what:
//   declaration: Project Managers (only their own) and Estimators (status / estimate links)
//   estimate:    Estimators (create / revise) and Estimate Approvers (approve / return)
const { verifyToken, db, ensureSchema, send } = require('./_lib');

const MAX_DOC_BYTES = 2_000_000;

// ---------- Sales view (summaries only) ----------
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const cellV = c => (c && typeof c === 'object' ? c.v : c);

// reads the saved estimate rows: "JOB / SCOPE n: name" bands, "<Section> subtotal" rows, "Job n total" and "GRAND TOTAL"
function summarize(rows) {
  const jobs = []; let cur = null, grand = null;
  for (const r of rows || []) {
    const label = String(cellV(r && r[1]) ?? '');
    let m;
    if ((m = label.match(/^JOB \/ SCOPE (\d+):?\s*(.*)$/i))) { cur = { no: +m[1], name: m[2] || '', sections: [], subtotal: 0 }; jobs.push(cur); continue; }
    if (cur && / subtotal$/i.test(label)) { cur.sections.push({ name: label.replace(/ subtotal$/i, ''), total: num(cellV(r[8])) }); continue; }
    if (cur && /^Job \d+ total/i.test(label)) { cur.subtotal = num(cellV(r[8])); continue; }
    if (grand == null && /^GRAND TOTAL/i.test(label) && r[8] != null && cellV(r[8]) !== '') grand = num(cellV(r[8]));
  }
  if (grand == null) grand = jobs.reduce((a, j) => a + j.subtotal, 0);
  return { jobs, grand };
}

function salesEstimate(e) {
  const revs = Array.isArray(e.revisions) ? e.revisions : [];
  const L = revs[revs.length - 1] || {};
  const a = (e.approvals || []).filter(x => x.rev === L.rev).slice(-1)[0];
  const status = a ? (a.action === 'approved' ? 'approved' : 'returned') : 'pending';
  const out = { id: e.id, estNo: e.estNo, decNo: e.decNo || null, decId: e.decId || null, pm: e.pm, createdAt: e.createdAt, rev: L.rev ?? 0, savedAt: L.at || null, status, cur: L.cur || 'AED' };
  if (status === 'approved') { out.approvedAt = a.at; out.approvedBy = a.by; out.summary = summarize(L.rows); }
  return out;
}

function salesDeclaration(d) {
  const rev = d.decRev || 0;
  return { id: d.id, decNo: d.decNo + (rev ? '-R' + rev : ''), pm: d.pm, status: d.status, submittedAt: d.submittedAt, jobs: (d.jobs || []).map(j => j.name || '') };
}

module.exports = async (req, res) => {
  const user = verifyToken(req);
  if (!user) return send(res, 401, { ok: false, error: 'Please sign in again.' });

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { rows } = await db().query('select kind, data from portal_docs order by updated_at');
      if (user.role === 'sal') {
        // Sales never receives estimate details: only references, status, and for approved
        // estimates the per-section and per-job totals plus the grand total.
        return send(res, 200, {
          ok: true,
          declarations: rows.filter(r => r.kind === 'declaration').map(r => salesDeclaration(r.data)),
          estimates: rows.filter(r => r.kind === 'estimate').map(r => salesEstimate(r.data)),
        });
      }
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
