const express  = require('express');
const router   = express.Router();

const { requireAuth }    = require('../middleware/auth');
const { runFraudChecks } = require('../services/fraudService');
const { issueReward }    = require('../services/rewardService');

// ─── Shared handler for qualifying-action endpoints ──────────────────────────
/**
 * Both /complete-order and /verify-email run the same pipeline:
 *   1. Look up pending referral for the authenticated referee.
 *   2. Run fraud-prevention checks.
 *   3. Issue reward (or flag / block).
 *
 * @param {string} actionLabel – Human-readable label for response messages.
 */
function createActionHandler(actionLabel) {
  return async (req, res) => {
    const refereeId = req.user.id;
    const { referrerIp, referrerDevice, deviceHash } = req.body;

    // Extract referee IP from request
    const currentIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                   || req.socket?.remoteAddress
                   || 'unknown';

    try {
      // ── Step 1: Look up whether this user has a pending referral ──────
      const supabase = require('../config/supabase');
      const { data: pendingRef } = await supabase
        .from('referrals')
        .select('referrer_id')
        .eq('referee_id', refereeId)
        .eq('status', 'PENDING')
        .single();

      if (!pendingRef) {
        return res.status(404).json({
          error: 'No pending referral found for this user',
        });
      }

      // ── Step 2: Fraud prevention ──────────────────────────────────────
      const fraudResult = runFraudChecks({
        userId:         refereeId,
        referrerId:     pendingRef.referrer_id,
        refereeIp:      currentIp,
        referrerIp:     referrerIp || null,
        refereeDevice:  deviceHash || null,
        referrerDevice: referrerDevice || null,
      });

      if (!fraudResult.passed) {
        return res.status(429).json({
          error:   'Action blocked by fraud prevention',
          reasons: fraudResult.reasons,
        });
      }

      // ── Step 3: Issue the reward ──────────────────────────────────────
      const result = await issueReward({
        refereeId,
        flagged: fraudResult.flagged,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const statusCode = fraudResult.flagged ? 202 : 200;

      return res.status(statusCode).json({
        message:  fraudResult.flagged
          ? `${actionLabel} completed but flagged for review — reward withheld`
          : `${actionLabel} completed — referral reward issued!`,
        referral: result.referral,
        reward:   result.reward,
        fraud:    fraudResult.flagged
          ? { flagged: true, reasons: fraudResult.reasons }
          : undefined,
      });
    } catch (err) {
      console.error(`${actionLabel} error:`, err);
      return res.status(500).json({ error: err.message });
    }
  };
}

// ─── POST /api/actions/complete-order ─────────────────────────────────────────
/**
 * Simulated conversion trigger — a referred user completes a purchase.
 *
 * Requires: Bearer token (the referee completing the order).
 *
 * Optional body params for fraud detection:
 *   { referrerIp?, referrerDevice?, deviceHash? }
 */
router.post('/complete-order', requireAuth, createActionHandler('Order'));

// ─── POST /api/actions/verify-email ───────────────────────────────────────────
/**
 * Simulated conversion trigger — a referred user verifies their email.
 *
 * In production this would be invoked by an email-verification callback,
 * not a direct API call.
 *
 * Requires: Bearer token (the referee verifying their email).
 */
router.post('/verify-email', requireAuth, createActionHandler('Email verification'));

module.exports = router;
