// GET /api/health -> checks the database connection and creates the tables if needed. Returns no data.
const { db, ensureSchema, send } = require('./_lib');

module.exports = async (req, res) => {
  try {
    await ensureSchema();
    const { rows } = await db().query("select count(*)::int as n from portal_docs");
    return send(res, 200, { ok: true, database: 'connected', records: rows[0].n });
  } catch (err) {
    console.error('api/health error:', err && err.message);
    return send(res, 500, { ok: false, database: 'not connected' });
  }
};
