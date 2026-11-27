// POST /api/login  { role: 'pm' | 'est' | 'apr', username, password }
// Roles: pm, est, apr, sal. Users and passwords live only in the Vercel environment variable PORTAL_USERS (never in this repo):
//   [{"u":"Eyad","r":"pm","p":"..."}, {"u":"Cyrine","r":"est","p":"..."}, {"u":"Merwin","r":"apr","p":"..."}]
// On success it returns a signed session token (HMAC with SESSION_SECRET) that later API routes can verify.
const crypto = require('crypto');

const ROLES = { pm: 'Project Manager', est: 'Estimator', apr: 'Estimate Approver', sal: 'Sales' };
const SESSION_HOURS = 12;

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + mac;
}

function loadUsers() {
  try {
    const list = JSON.parse(process.env.PORTAL_USERS || '[]');
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }
  const secret = process.env.SESSION_SECRET;
  const users = loadUsers();
  if (!secret || !users.length) {
    return res.status(500).json({ ok: false, error: 'Sign-in is not set up on the server yet.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const role = String((body && body.role) || '');
  const username = String((body && body.username) || '').trim().slice(0, 60);
  const password = String((body && body.password) || '').slice(0, 200);

  if (!ROLES[role] || !username || !password) {
    return res.status(400).json({ ok: false, error: 'Choose a role and enter your username and password.' });
  }

  const user = users.find(x => x && x.r === role && String(x.u).toLowerCase() === username.toLowerCase());
  // always compare something so a wrong username takes as long as a wrong password
  const ok = safeEqual(password, user ? user.p : crypto.randomBytes(16).toString('hex')) && !!user;

  if (!ok) {
    await new Promise(r => setTimeout(r, 600));
    return res.status(401).json({ ok: false, error: 'Wrong username or password for ' + ROLES[role] + '.' });
  }

  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const token = sign({ n: user.u, r: role, exp }, secret);
  return res.status(200).json({ ok: true, name: user.u, role, exp, token });
};
