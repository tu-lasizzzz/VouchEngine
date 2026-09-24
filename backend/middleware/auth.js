const { verifyToken } = require('../services/authService');
const supabase        = require('../config/supabase');

/**
 * Express middleware – JWT Authentication Guard.
 *
 * Expects an `Authorization: Bearer <token>` header.
 * On success, attaches the full user row (from Supabase) to `req.user`.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = verifyToken(token);

    // Hydrate the full user record from the database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, referral_code, created_at')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    req.user = user;
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'  ? 'Token has expired' :
      err.name === 'JsonWebTokenError'  ? 'Invalid token' :
      'Authentication failed';

    return res.status(401).json({ error: message });
  }
}

module.exports = { requireAuth };
