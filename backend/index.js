require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const supabase     = require('./config/supabase');
const { generateReferralCode } = require('./utils/codeGenerator');
const { referralTracker, getRefSourceFromCookie } = require('./middleware/referralTracker');
const { sendWelcomeEmail, sendVoucherNotification } = require('./services/emailService');
const authRoutes = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(referralTracker);   // captures ?ref=CODE → HTTP-only cookie

// ─── Route Modules ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

/**
 * Health Check Endpoint
 * Checks server status and tests Supabase database connectivity.
 */
app.get('/api/health', async (req, res) => {
  try {
    // Attempt a light query to test database connectivity
    const { data, error, status } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    if (error && status !== 406) {
      return res.status(503).json({
        status: 'error',
        message: 'Database connection check failed',
        database: 'disconnected',
        error: error.message
      });
    }

    return res.status(200).json({
      status: 'ok',
      message: 'Viral Referral & Loyalty Engine API is operational',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Unexpected health check failure',
      error: err.message
    });
  }
});

/**
 * @deprecated Use POST /api/auth/register instead.
 *
 * Legacy Register User Endpoint (kept for backward compatibility).
 * Does NOT require a password and does NOT return a JWT.
 */
app.post('/api/users/register', async (req, res) => {
  const { name, email, referrer_code: bodyRefCode } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  // Resolve referral attribution: body param takes precedence over cookie
  const referrer_code = bodyRefCode || getRefSourceFromCookie(req);

  try {
    // Auto-generate 7-character referral code
    const referral_code = generateReferralCode(7);

    // Insert user into Supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ name, email, referral_code }])
      .select()
      .single();

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    // Handle referrer attribution
    if (referrer_code) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('referral_code', referrer_code)
        .single();

      if (referrer) {
        await supabase.from('referrals').insert([{
          referrer_id: referrer.id,
          referee_id: user.id,
          status: 'PENDING'
        }]);
      }
    }

    // Fire-and-forget: send the Welcome Email with the new user's referral link
    sendWelcomeEmail({
      name:          user.name,
      email:         user.email,
      referral_code: user.referral_code,
    }).catch((err) => console.error('Welcome email fire-and-forget error:', err));

    // Clear the tracking cookie after successful attribution
    if (getRefSourceFromCookie(req)) {
      res.clearCookie('ref_source', { path: '/' });
    }

    return res.status(201).json({
      message: 'User registered successfully',
      user,
      referral_attributed: !!referrer_code,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Get User Details Endpoint
 */
app.get('/api/users/:id', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        referrals:referrals!referrer_id(*),
        rewards(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
