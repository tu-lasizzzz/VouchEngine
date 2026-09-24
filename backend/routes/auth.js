const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');

const { generateReferralCode }                    = require('../utils/codeGenerator');
const { hashPassword, comparePassword,
        generateToken, checkSelfReferral }         = require('../services/authService');
const { requireAuth }                              = require('../middleware/auth');
const { getRefSourceFromCookie, COOKIE_NAME }      = require('../middleware/referralTracker');
const { sendWelcomeEmail }                         = require('../services/emailService');

// ─── POST /api/auth/register ─────────────────────────────────────────────────
/**
 * Register a new user with JWT-based authentication.
 *
 * Body:
 *   { name, email, password, referralCode? }
 *
 * Referral attribution priority:
 *   1. `referralCode` in the request body   (explicit deep-link)
 *   2. `ref_source` HTTP-only cookie        (set by referralTracker middleware)
 *
 * Self-referral prevention:
 *   - Same email as referrer            → rejected
 *   - Same email domain as referrer     → rejected
 *   - Generated code collides w/ referral code → rejected
 */
router.post('/register', async (req, res) => {
  const { name, email, password, referralCode: bodyRefCode } = req.body;

  // ── Input validation ────────────────────────────────────────────────────
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Resolve referral attribution: body param > cookie
  const referralCode = bodyRefCode || getRefSourceFromCookie(req);

  try {
    // ── Check for existing email ──────────────────────────────────────────
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    // ── Hash password & generate referral code ────────────────────────────
    const password_hash  = await hashPassword(password);
    const referral_code  = generateReferralCode(7);

    // ── Insert user into Supabase ─────────────────────────────────────────
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ name, email: email.toLowerCase(), referral_code, password_hash }])
      .select()
      .single();

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    // ── Referral attribution ──────────────────────────────────────────────
    let referralResult = null;

    if (referralCode) {
      // 1. Look up who owns this referral code
      const { data: referrer } = await supabase
        .from('users')
        .select('id, email')
        .eq('referral_code', referralCode)
        .single();

      if (!referrer) {
        referralResult = { attributed: false, reason: 'referral_code_not_found' };
      } else {
        // 2. Self-referral guard
        const selfCheck = checkSelfReferral({
          referrerEmail: referrer.email,
          newUserEmail:  user.email,
          referralCode,
          newUserCode:   user.referral_code,
        });

        if (selfCheck.blocked) {
          referralResult = { attributed: false, reason: selfCheck.reason };
        } else {
          // 3. Create the referral record
          const { error: refError } = await supabase
            .from('referrals')
            .insert([{
              referrer_id: referrer.id,
              referee_id:  user.id,
              status:      'PENDING',
            }]);

          referralResult = refError
            ? { attributed: false, reason: refError.message }
            : { attributed: true,  referrer_id: referrer.id };
        }
      }
    }

    // ── Fire-and-forget welcome email ─────────────────────────────────────
    sendWelcomeEmail({
      name:          user.name,
      email:         user.email,
      referral_code: user.referral_code,
    }).catch((err) => console.error('Welcome email error:', err));

    // ── Clear tracking cookie after attribution ───────────────────────────
    if (getRefSourceFromCookie(req)) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
    }

    // ── Generate JWT & respond ────────────────────────────────────────────
    const token = generateToken(user);

    // Strip password_hash from response
    const { password_hash: _, ...safeUser } = user;

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: safeUser,
      referral: referralResult,
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
/**
 * Authenticate an existing user and return a JWT.
 *
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordValid = await comparePassword(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    // Strip password_hash from response
    const { password_hash: _, ...safeUser } = user;

    return res.json({
      message: 'Login successful',
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
/**
 * Returns the currently authenticated user's profile,
 * including their referrals and rewards.
 *
 * Requires: Bearer token in Authorization header.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, name, email, referral_code, created_at,
        referrals:referrals!referrer_id(id, referee_id, status, created_at),
        rewards(id, voucher_code, discount_amount, is_redeemed, created_at)
      `)
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('/me error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
