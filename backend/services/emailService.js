const { Resend } = require('resend');
require('dotenv').config();

// ─── Resend Client ────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.EMAIL_FROM || 'VouchEngine <noreply@yourapp.com>';
const APP_URL     = process.env.APP_URL    || 'https://yourapp.com';

// ─── Welcome Email ────────────────────────────────────────────────────────────
/**
 * Sends a Welcome Email to a newly registered user containing
 * their unique referral link.
 *
 * @param {Object}  user
 * @param {string}  user.name          – Display name
 * @param {string}  user.email         – Recipient email address
 * @param {string}  user.referral_code – Unique 7-char referral code
 * @returns {Promise<Object>}          – Resend API response
 */
async function sendWelcomeEmail({ name, email, referral_code }) {
  const referralLink = `${APP_URL}/signup?ref=${referral_code}`;

  try {
    const { data, error } = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      email,
      subject: `Welcome to VouchEngine, ${name}! 🎉`,
      html: `
        <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f0f0f;border-radius:12px;color:#e0e0e0;">
          <h1 style="color:#a78bfa;margin-bottom:8px;">Welcome aboard, ${name}!</h1>
          <p style="font-size:16px;line-height:1.6;">
            Your account is all set. Share your personal referral link with
            friends and start earning exclusive rewards.
          </p>

          <div style="background:#1a1a2e;border:1px solid #a78bfa;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
            <p style="margin:0 0 12px;font-size:14px;color:#94a3b8;">Your Referral Link</p>
            <a href="${referralLink}"
               style="font-size:18px;font-weight:700;color:#a78bfa;text-decoration:none;word-break:break-all;">
              ${referralLink}
            </a>
          </div>

          <p style="font-size:14px;color:#94a3b8;">
            Every friend who signs up through your link gets you one step
            closer to unlocking a voucher. 🚀
          </p>

          <hr style="border:none;border-top:1px solid #2d2d44;margin:24px 0;" />
          <p style="font-size:12px;color:#64748b;text-align:center;">
            © ${new Date().getFullYear()} VouchEngine · Built with ❤️
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('📧 Welcome email failed:', error);
      return { success: false, error };
    }

    console.log(`📧 Welcome email sent to ${email} (id: ${data?.id})`);
    return { success: true, data };
  } catch (err) {
    console.error('📧 Welcome email exception:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Voucher Notification Email ───────────────────────────────────────────────
/**
 * Sends a notification when a referral action completes and the
 * referrer has unlocked a voucher.
 *
 * @param {Object}  params
 * @param {string}  params.name           – Referrer's display name
 * @param {string}  params.email          – Referrer's email address
 * @param {string}  params.voucher_code   – The unlocked voucher code
 * @param {number}  params.discount_amount – Discount value (e.g. 15.00)
 * @returns {Promise<Object>}             – Resend API response
 */
async function sendVoucherNotification({ name, email, voucher_code, discount_amount }) {
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      email,
      subject: `You unlocked a voucher! 🎁`,
      html: `
        <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f0f0f;border-radius:12px;color:#e0e0e0;">
          <h1 style="color:#34d399;margin-bottom:8px;">Congratulations, ${name}!</h1>
          <p style="font-size:16px;line-height:1.6;">
            One of your referrals just completed their sign-up.
            As a thank you, here's an exclusive voucher just for you:
          </p>

          <div style="background:#1a1a2e;border:1px solid #34d399;border-radius:8px;padding:24px;margin:24px 0;text-align:center;">
            <p style="margin:0 0 4px;font-size:14px;color:#94a3b8;">Your Voucher Code</p>
            <p style="margin:0;font-size:28px;font-weight:800;letter-spacing:4px;color:#34d399;">
              ${voucher_code}
            </p>
            <p style="margin:12px 0 0;font-size:16px;color:#e0e0e0;">
              Worth <strong>$${Number(discount_amount).toFixed(2)}</strong> off your next purchase
            </p>
          </div>

          <p style="font-size:14px;color:#94a3b8;">
            Keep sharing your referral link to earn even more rewards. 🔥
          </p>

          <hr style="border:none;border-top:1px solid #2d2d44;margin:24px 0;" />
          <p style="font-size:12px;color:#64748b;text-align:center;">
            © ${new Date().getFullYear()} VouchEngine · Built with ❤️
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('🎁 Voucher notification failed:', error);
      return { success: false, error };
    }

    console.log(`🎁 Voucher notification sent to ${email} (id: ${data?.id})`);
    return { success: true, data };
  } catch (err) {
    console.error('🎁 Voucher notification exception:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendWelcomeEmail,
  sendVoucherNotification,
};
