require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./config/supabase');
const { generateReferralCode } = require('./utils/codeGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
 * Register User Endpoint
 * Auto-generates a unique 7-character referral code upon user creation.
 */
app.post('/api/users/register', async (req, res) => {
  const { name, email, referrer_code } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

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

    // Handle referrer if referral_code was provided
    if (referrer_code) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id')
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

    return res.status(201).json({
      message: 'User registered successfully',
      user
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
