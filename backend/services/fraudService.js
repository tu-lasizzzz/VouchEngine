const supabase = require('../config/supabase');

// ─── Configuration ────────────────────────────────────────────────────────────

const VELOCITY_WINDOW_MS   = 5 * 60 * 1000;  // 5-minute sliding window
const VELOCITY_MAX_ACTIONS = 10;              // max qualifying actions per window

/**
 * In-memory sliding-window tracker.
 * Maps  userId → [timestamp, timestamp, …]
 *
 * Production note: swap for a Redis sorted-set for multi-instance deploys.
 */
const velocityLedger = new Map();

// ─── Velocity Limiter ─────────────────────────────────────────────────────────

/**
 * Checks whether a user has exceeded the velocity limit for
 * referral-qualifying actions within the sliding window.
 *
 * Side-effect: prunes expired timestamps from the ledger.
 *
 * @param  {string}  userId
 * @returns {{ allowed: boolean, count: number, limit: number }}
 */
function checkVelocity(userId) {
  const now    = Date.now();
  const cutoff = now - VELOCITY_WINDOW_MS;

  let timestamps = velocityLedger.get(userId) || [];

  // Prune entries outside the window
  timestamps = timestamps.filter((ts) => ts > cutoff);

  if (timestamps.length >= VELOCITY_MAX_ACTIONS) {
    velocityLedger.set(userId, timestamps);
    return { allowed: false, count: timestamps.length, limit: VELOCITY_MAX_ACTIONS };
  }

  // Record this action
  timestamps.push(now);
  velocityLedger.set(userId, timestamps);

  return { allowed: true, count: timestamps.length, limit: VELOCITY_MAX_ACTIONS };
}

// ─── IP & Device-Hash Duplicate Detection ─────────────────────────────────────

/**
 * Flags a referral pair as suspicious when the referrer and referee
 * share the same IP address or device fingerprint hash.
 *
 * Returns an object with the detection results so the caller can
 * decide to flag or block the action.
 *
 * @param {Object}  opts
 * @param {string}  opts.referrerIp      – IP of the original referrer (at registration)
 * @param {string}  opts.refereeIp       – IP of the referee performing the action now
 * @param {string}  [opts.referrerDevice] – Device hash of the referrer
 * @param {string}  [opts.refereeDevice]  – Device hash of the referee
 * @returns {{ suspicious: boolean, reasons: string[] }}
 */
function detectDuplicateSignals({ referrerIp, refereeIp, referrerDevice, refereeDevice }) {
  const reasons = [];

  if (referrerIp && refereeIp && referrerIp === refereeIp) {
    reasons.push('same_ip_address');
  }

  if (referrerDevice && refereeDevice && referrerDevice === refereeDevice) {
    reasons.push('same_device_hash');
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

// ─── Composite Fraud Check ────────────────────────────────────────────────────

/**
 * Runs all fraud-prevention checks for a qualifying-action attempt.
 *
 * @param {Object}  opts
 * @param {string}  opts.userId        – The user completing the action (referee)
 * @param {string}  opts.referrerId    – The referrer who will receive the reward
 * @param {string}  opts.refereeIp     – Current IP of the referee
 * @param {string}  [opts.referrerIp]  – IP of the referrer (stored at registration)
 * @param {string}  [opts.refereeDevice]  – Device hash of the referee
 * @param {string}  [opts.referrerDevice] – Device hash of the referrer
 * @returns {{ passed: boolean, flagged: boolean, reasons: string[] }}
 */
function runFraudChecks({ userId, referrerId, refereeIp, referrerIp, refereeDevice, referrerDevice }) {
  const reasons = [];

  // 1. Velocity check on the referee (prevent mass-action bots)
  const velocity = checkVelocity(userId);
  if (!velocity.allowed) {
    reasons.push(`velocity_limit_exceeded (${velocity.count}/${velocity.limit} in 5 min)`);
  }

  // 2. Velocity check on the referrer (prevent reward-farming rings)
  const referrerVelocity = checkVelocity(referrerId);
  if (!referrerVelocity.allowed) {
    reasons.push(`referrer_velocity_limit_exceeded (${referrerVelocity.count}/${referrerVelocity.limit} in 5 min)`);
  }

  // 3. IP / device-hash duplicate detection
  const duplicates = detectDuplicateSignals({
    referrerIp,
    refereeIp,
    referrerDevice,
    refereeDevice,
  });

  if (duplicates.suspicious) {
    reasons.push(...duplicates.reasons);
  }

  // Determine outcome:
  //   • velocity failures → hard block (passed = false)
  //   • IP/device matches → soft flag  (flagged = true, passed = true)
  const hardBlock = !velocity.allowed || !referrerVelocity.allowed;

  return {
    passed:  !hardBlock,
    flagged: duplicates.suspicious,
    reasons,
  };
}

// ─── Test Helpers ─────────────────────────────────────────────────────────────

/** Resets the in-memory velocity ledger (for testing). */
function _resetVelocityLedger() {
  velocityLedger.clear();
}

module.exports = {
  checkVelocity,
  detectDuplicateSignals,
  runFraudChecks,
  _resetVelocityLedger,
  // Expose constants for tests
  VELOCITY_WINDOW_MS,
  VELOCITY_MAX_ACTIONS,
};
