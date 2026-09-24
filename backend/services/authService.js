const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const SALT_ROUNDS  = 12;
const JWT_SECRET   = process.env.JWT_SECRET   || 'dev-fallback-secret-change-me';
const JWT_EXPIRES  = process.env.JWT_EXPIRES   || '7d';

// ─── Password Utilities ──────────────────────────────────────────────────────

/**
 * Hashes a plain-text password with bcrypt.
 * @param  {string} plain
 * @returns {Promise<string>}
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a bcrypt hash.
 * @param  {string} plain
 * @param  {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ─── JWT Utilities ────────────────────────────────────────────────────────────

/**
 * Signs a JWT containing the user's id, email, and referral_code.
 * @param  {{ id: string, email: string, referral_code: string }} user
 * @returns {string} – Signed JWT
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, referral_code: user.referral_code },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

/**
 * Verifies and decodes a JWT.
 * @param  {string} token
 * @returns {Object} – Decoded payload
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ─── Referral Validation ──────────────────────────────────────────────────────

/**
 * Extracts the domain portion of an email address.
 * @param  {string} email
 * @returns {string}
 */
function emailDomain(email) {
  return (email || '').split('@')[1]?.toLowerCase() || '';
}

/**
 * Pure-function self-referral check.
 *
 * Returns `{ blocked: true, reason }` when the referral should be
 * rejected, or `{ blocked: false }` when it's legitimate.
 *
 * Rules:
 *   1. Referrer email === new user email  →  same_email
 *   2. Referrer email domain === new user email domain  →  same_domain
 *   3. Referral code === the new user's own generated code  →  code_collision
 *
 * @param {Object}  opts
 * @param {string}  opts.referrerEmail   – Email of the person who shared the code
 * @param {string}  opts.newUserEmail    – Email of the person registering
 * @param {string}  [opts.referralCode]  – The code that was submitted
 * @param {string}  [opts.newUserCode]   – The code just generated for the new user
 * @returns {{ blocked: boolean, reason?: string }}
 */
function checkSelfReferral({ referrerEmail, newUserEmail, referralCode, newUserCode }) {
  // Rule 1 – exact same email
  if (referrerEmail.toLowerCase() === newUserEmail.toLowerCase()) {
    return { blocked: true, reason: 'self_referral_same_email' };
  }

  // Rule 2 – same email domain
  const referrerDom = emailDomain(referrerEmail);
  const newUserDom  = emailDomain(newUserEmail);
  if (referrerDom && newUserDom && referrerDom === newUserDom) {
    return { blocked: true, reason: 'self_referral_same_domain' };
  }

  // Rule 3 – code collision (extremely unlikely but worth guarding)
  if (referralCode && newUserCode && referralCode === newUserCode) {
    return { blocked: true, reason: 'referral_code_collision' };
  }

  return { blocked: false };
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  checkSelfReferral,
  emailDomain,
};
