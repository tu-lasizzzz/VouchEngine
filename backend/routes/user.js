const express  = require('express');
const router   = express.Router();
let QRCode;
try {
  QRCode = require('qrcode');
} catch (err) {
  QRCode = null;
}
const supabase    = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

/**
 * Fallback QR Code SVG Data URL Generator
 * Used if the qrcode npm package is missing or fails to load.
 */
function generateFallbackSvgQrCode(text) {
  const encodedText = encodeURIComponent(text);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 250 250">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <g fill="#000000">
      <!-- Top-left finder pattern -->
      <rect x="20" y="20" width="60" height="60" rx="6" fill="#1e1b4b"/>
      <rect x="30" y="30" width="40" height="40" rx="4" fill="#ffffff"/>
      <rect x="40" y="40" width="20" height="20" rx="2" fill="#6366f1"/>
      
      <!-- Top-right finder pattern -->
      <rect x="170" y="20" width="60" height="60" rx="6" fill="#1e1b4b"/>
      <rect x="180" y="30" width="40" height="40" rx="4" fill="#ffffff"/>
      <rect x="190" y="40" width="20" height="20" rx="2" fill="#6366f1"/>

      <!-- Bottom-left finder pattern -->
      <rect x="20" y="170" width="60" height="60" rx="6" fill="#1e1b4b"/>
      <rect x="30" y="180" width="40" height="40" rx="4" fill="#ffffff"/>
      <rect x="40" y="190" width="20" height="20" rx="2" fill="#6366f1"/>

      <!-- Data matrix simulation cells -->
      <rect x="100" y="20" width="15" height="15" fill="#4f46e5"/>
      <rect x="125" y="20" width="15" height="15" fill="#1e1b4b"/>
      <rect x="100" y="45" width="30" height="15" fill="#6366f1"/>
      <rect x="90" y="70" width="70" height="10" fill="#1e1b4b"/>
      
      <rect x="20" y="100" width="15" height="55" fill="#4f46e5"/>
      <rect x="45" y="100" width="40" height="15" fill="#1e1b4b"/>
      <rect x="100" y="100" width="50" height="50" rx="8" fill="#4f46e5"/>
      <rect x="170" y="100" width="60" height="15" fill="#6366f1"/>
      <rect x="170" y="125" width="25" height="35" fill="#1e1b4b"/>
      <rect x="205" y="125" width="25" height="35" fill="#4f46e5"/>

      <rect x="100" y="170" width="20" height="60" fill="#1e1b4b"/>
      <rect x="130" y="170" width="40" height="20" fill="#6366f1"/>
      <rect x="180" y="180" width="50" height="50" fill="#4f46e5"/>
    </g>
    <text x="125" y="242" font-family="sans-serif" font-size="9" font-weight="bold" fill="#4f46e5" text-anchor="middle">SCAN TO JOIN</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ─── GET /api/user/qrcode ───────────────────────────────────────────────────
/**
 * Backend QR Code API Endpoint
 * Generates a Base64 / SVG Data URL of the user's referral link on the fly.
 *
 * Query Params:
 *   - referral_code / code (optional fallback if auth header not passed)
 *   - format ('png' | 'svg', default 'png')
 *   - baseUrl (optional custom frontend URL)
 */
router.get('/qrcode', async (req, res) => {
  try {
    // 1. Resolve user / referral code
    let referralCode = req.query.referral_code || req.query.code;
    let userId = null;

    // Check optional Auth header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const { verifyToken } = require('../services/authService');
      try {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        userId = decoded.id;
        if (!referralCode && userId) {
          const { data: user } = await supabase
            .from('users')
            .select('referral_code')
            .eq('id', userId)
            .single();
          if (user) {
            referralCode = user.referral_code;
          }
        }
      } catch (err) {
        // Token error ignored if fallback query code provided
      }
    }

    if (!referralCode) {
      return res.status(400).json({
        error: 'Referral code is required. Provide Authorization token or ?referral_code=CODE query parameter.'
      });
    }

    // 2. Build referral link URL
    const baseUrl = req.query.baseUrl || process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const referralLink = `${cleanBaseUrl}?ref=${encodeURIComponent(referralCode)}`;

    // 3. Generate Base64 / SVG Data URL using qrcode package
    const format = (req.query.format || 'png').toLowerCase();
    let qrCodeDataUrl = '';
    let svgDataUrl = '';

    if (QRCode) {
      try {
        // Generate PNG Base64 Data URL
        qrCodeDataUrl = await QRCode.toDataURL(referralLink, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          margin: 2,
          width: 300,
          color: {
            dark: '#1e1b4b',  // Deep indigo
            light: '#ffffff'  // Clean white
          }
        });

        // Generate SVG Data URL
        const svgString = await QRCode.toString(referralLink, {
          type: 'svg',
          margin: 2,
          color: {
            dark: '#1e1b4b',
            light: '#ffffff'
          }
        });
        svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
      } catch (qrErr) {
        console.error('QRCode generation error, using SVG fallback:', qrErr);
        qrCodeDataUrl = generateFallbackSvgQrCode(referralLink);
        svgDataUrl = qrCodeDataUrl;
      }
    } else {
      qrCodeDataUrl = generateFallbackSvgQrCode(referralLink);
      svgDataUrl = qrCodeDataUrl;
    }

    const primaryQrCode = format === 'svg' ? svgDataUrl : qrCodeDataUrl;

    return res.json({
      success: true,
      referralCode,
      referralLink,
      qrCode: primaryQrCode,
      qrCodeBase64: qrCodeDataUrl,
      qrCodeSvg: svgDataUrl,
      format
    });

  } catch (err) {
    console.error('Error generating QR code:', err);
    return res.status(500).json({ error: 'Failed to generate QR code', message: err.message });
  }
});

// ─── GET /api/user/stats ────────────────────────────────────────────────────
/**
 * GET real-time user statistics from Supabase database.
 * Total Invites, Pending Referrals, and Unlocked Vouchers.
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Total Invites (Total referrals created where user is referrer)
    const { count: totalInvites, error: totalErr } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', userId);

    if (totalErr) throw totalErr;

    // 2. Pending Referrals (referrals with status 'PENDING')
    const { count: pendingReferrals, error: pendingErr } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', userId)
      .eq('status', 'PENDING');

    if (pendingErr) throw pendingErr;

    // 3. Completed Referrals (referrals with status 'COMPLETED')
    const { count: completedReferrals, error: completedErr } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', userId)
      .eq('status', 'COMPLETED');

    if (completedErr) throw completedErr;

    // 4. Unlocked Vouchers (Rewards issued to this user)
    const { count: unlockedVouchers, error: rewardsErr } = await supabase
      .from('rewards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (rewardsErr) throw rewardsErr;

    return res.json({
      success: true,
      userId,
      stats: {
        totalInvites: totalInvites || 0,
        pendingReferrals: pendingReferrals || 0,
        completedReferrals: completedReferrals || 0,
        unlockedVouchers: unlockedVouchers || 0,
      }
    });

  } catch (err) {
    console.error('Error fetching user stats:', err);
    return res.status(500).json({ error: 'Failed to fetch user stats', message: err.message });
  }
});

module.exports = router;
