/**
 * Unit & Integration Tests – User API (/api/user/qrcode and /api/user/stats)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key-for-user-tests';

const { generateToken } = require('../services/authService');
const supabase = require('../config/supabase');

// Mock req / res helpers
function createMockReqRes(options = {}) {
  const req = {
    headers: options.headers || {},
    query: options.query || {},
    user: options.user || null,
    body: options.body || {},
  };

  const res = {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
  };

  return { req, res };
}

// ─── Direct Handler Tests for QRCode and User Stats ──────────────────────────

describe('User API Handler - GET /api/user/qrcode', () => {
  const userRoutes = require('../routes/user');

  // Find handler matching route path '/qrcode'
  const qrcodeLayer = userRoutes.stack.find(s => s.route && s.route.path === '/qrcode');
  const qrcodeHandler = qrcodeLayer.route.stack[0].handle;

  it('should generate a Base64 & SVG QR Code for explicit referral_code query param', async () => {
    const { req, res } = createMockReqRes({
      query: { referral_code: 'REF-TEST-123' }
    });

    await qrcodeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.referralCode).toBe('REF-TEST-123');
    expect(res.body.referralLink).toContain('?ref=REF-TEST-123');
    expect(res.body.qrCode).toBeDefined();
    expect(res.body.qrCodeSvg).toBeDefined();
    expect(res.body.qrCode.startsWith('data:image/')).toBe(true);
  });

  it('should generate SVG format when format=svg parameter is passed', async () => {
    const { req, res } = createMockReqRes({
      query: { referral_code: 'REF-TEST-456', format: 'svg' }
    });

    await qrcodeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.format).toBe('svg');
    expect(res.body.qrCode.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('should return 400 error when referral code and token are missing', async () => {
    const { req, res } = createMockReqRes({});

    await qrcodeHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Referral code is required');
  });

  it('should derive referral code from authenticated user token in Authorization header', async () => {
    const token = generateToken({ id: 'user-123', email: 'test@example.com' });

    // Mock Supabase call inside route
    const originalFrom = supabase.from;
    supabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { referral_code: 'REF-AUTH-999' },
            error: null
          })
        })
      })
    });

    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` }
    });

    await qrcodeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.referralCode).toBe('REF-AUTH-999');
    expect(res.body.referralLink).toContain('?ref=REF-AUTH-999');

    // Restore
    supabase.from = originalFrom;
  });
});

describe('User API Handler - GET /api/user/stats', () => {
  const userRoutes = require('../routes/user');

  // Find handler matching route path '/stats'
  const statsLayer = userRoutes.stack.find(s => s.route && s.route.path === '/stats');
  const statsHandler = statsLayer.route.stack[statsLayer.route.stack.length - 1].handle;

  it('should return real-time stats for authenticated user', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'user-777', email: 'stats@example.com' }
    });

    // Mock count calls
    const originalFrom = supabase.from;
    supabase.from = vi.fn().mockImplementation((table) => {
      return {
        select: vi.fn().mockImplementation((cols, opts) => {
          return {
            eq: vi.fn().mockImplementation((col, val) => {
              return {
                eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
                count: 10,
                error: null,
                then: (cb) => cb({ count: table === 'referrals' ? 12 : 8, error: null })
              };
            })
          };
        })
      };
    });

    await statsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.totalInvites).toBeDefined();
    expect(res.body.stats.pendingReferrals).toBeDefined();
    expect(res.body.stats.unlockedVouchers).toBeDefined();

    supabase.from = originalFrom;
  });
});
