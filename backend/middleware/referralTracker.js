/**
 * Referral Tracking Middleware
 *
 * Captures `?ref=CODE` from incoming URL query parameters and
 * persists it in an HTTP-only cookie named `ref_source`.
 *
 * Attribution model: first-touch — if the cookie already exists
 * and the request doesn't carry a new `?ref`, the original
 * referrer is preserved.
 */

const COOKIE_NAME   = 'ref_source';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

/**
 * Express middleware – mount before route handlers.
 *
 * Requires `cookie-parser` to be loaded upstream so that
 * `req.cookies` is available.
 */
function referralTracker(req, res, next) {
  const refCode = req.query.ref;

  if (refCode && typeof refCode === 'string' && refCode.trim().length > 0) {
    // Sanitise: allow only alphanumeric characters (matches our code alphabet)
    const sanitised = refCode.trim().replace(/[^A-Za-z0-9]/g, '');

    if (sanitised.length > 0) {
      res.cookie(COOKIE_NAME, sanitised, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   COOKIE_MAX_AGE,
        path:     '/',
      });
    }
  }

  next();
}

/**
 * Reads the stored referral code from the tracking cookie.
 *
 * @param  {import('express').Request} req
 * @returns {string|null} – The referral code, or null if absent.
 */
function getRefSourceFromCookie(req) {
  return req.cookies?.[COOKIE_NAME] || null;
}

module.exports = {
  referralTracker,
  getRefSourceFromCookie,
  COOKIE_NAME,
};
