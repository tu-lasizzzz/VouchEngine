const crypto   = require('crypto');
const supabase = require('../config/supabase');
const { sendVoucherNotification } = require('./emailService');

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_DISCOUNT_AMOUNT = 10.00; // $10 off per successful referral

// ─── Voucher Code Generator ──────────────────────────────────────────────────

/**
 * Generates a promo voucher code in the format `REF-{amount}-{random}`.
 * Example: `REF-10-X892A`
 *
 * @param  {number} [discountAmount=10]
 * @returns {string}
 */
function generateVoucherCode(discountAmount = DEFAULT_DISCOUNT_AMOUNT) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes    = crypto.randomBytes(5);
  let suffix     = '';

  for (let i = 0; i < 5; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }

  return `REF-${Math.round(discountAmount)}-${suffix}`;
}

// ─── Core Pipeline ────────────────────────────────────────────────────────────

/**
 * Processes the reward issuance pipeline for a referred user who has
 * completed their qualifying action.
 *
 * Steps:
 *   1. Look up the PENDING referral entry for this referee.
 *   2. Transition its status to COMPLETED (or FLAGGED if fraud-flagged).
 *   3. Mint a Reward record for the referrer with a generated voucher.
 *   4. Fire-and-forget a voucher notification email to the referrer.
 *
 * @param {Object}  opts
 * @param {string}  opts.refereeId   – ID of the user who completed the action
 * @param {boolean} [opts.flagged=false] – Whether fraud checks flagged this pair
 * @param {Object}  [opts._deps]     – Dependency overrides (for testing only)
 * @returns {Promise<{ success: boolean, referral?: Object, reward?: Object, error?: string }>}
 */
async function issueReward({ refereeId, flagged = false, _deps = {} }) {
  const db     = _deps.supabase              || supabase;
  const notify = _deps.sendVoucherNotification || sendVoucherNotification;

  try {
    // ── 1. Find the PENDING referral ──────────────────────────────────────
    const { data: referral, error: lookupErr } = await db
      .from('referrals')
      .select('id, referrer_id, referee_id, status')
      .eq('referee_id', refereeId)
      .eq('status', 'PENDING')
      .single();

    if (lookupErr || !referral) {
      return {
        success: false,
        error: 'no_pending_referral',
      };
    }

    // ── 2. Transition status ──────────────────────────────────────────────
    const newStatus = flagged ? 'FLAGGED' : 'COMPLETED';

    const { error: updateErr } = await db
      .from('referrals')
      .update({ status: newStatus })
      .eq('id', referral.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // If flagged, do NOT mint a reward — just mark and return
    if (flagged) {
      return {
        success: true,
        referral: { ...referral, status: 'FLAGGED' },
        reward:   null,
      };
    }

    // ── 3. Mint the Reward ────────────────────────────────────────────────
    const voucherCode    = generateVoucherCode(DEFAULT_DISCOUNT_AMOUNT);
    const discountAmount = DEFAULT_DISCOUNT_AMOUNT;

    const { data: reward, error: rewardErr } = await db
      .from('rewards')
      .insert([{
        user_id:         referral.referrer_id,
        voucher_code:    voucherCode,
        discount_amount: discountAmount,
        is_redeemed:     false,
      }])
      .select()
      .single();

    if (rewardErr) {
      return { success: false, error: rewardErr.message };
    }

    // ── 4. Notify the referrer (fire-and-forget) ──────────────────────────
    // Look up referrer details for the email
    const { data: referrer } = await db
      .from('users')
      .select('name, email')
      .eq('id', referral.referrer_id)
      .single();

    if (referrer) {
      notify({
        name:            referrer.name,
        email:           referrer.email,
        voucher_code:    voucherCode,
        discount_amount: discountAmount,
      }).catch((err) => console.error('Voucher notification error:', err));
    }

    return {
      success: true,
      referral: { ...referral, status: 'COMPLETED' },
      reward,
    };
  } catch (err) {
    console.error('Reward issuance error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  generateVoucherCode,
  issueReward,
  DEFAULT_DISCOUNT_AMOUNT,
};
