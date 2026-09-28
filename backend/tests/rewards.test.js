/**
 * Integration Tests – Event Verification & Reward Distribution Engine (Day 3)
 *
 * Tests cover:
 *   1. Fraud Prevention — velocity limits, IP detection, device-hash detection
 *   2. Reward Issuance — voucher generation, pipeline flow, FLAGGED vs COMPLETED
 *   3. End-to-End — vouchers ONLY dispatched after successful action completion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set env before importing modules
process.env.JWT_SECRET = 'test-secret-key-for-vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// Module imports (pure functions — no Supabase dependency)
// ═══════════════════════════════════════════════════════════════════════════════

const {
  checkVelocity,
  detectDuplicateSignals,
  runFraudChecks,
  _resetVelocityLedger,
  VELOCITY_MAX_ACTIONS,
} = require('../services/fraudService');

const {
  generateVoucherCode,
  issueReward,
  DEFAULT_DISCOUNT_AMOUNT,
} = require('../services/rewardService');

const { generateToken } = require('../services/authService');

// ═══════════════════════════════════════════════════════════════════════════════
// Shared mock helpers — fluent Supabase chain & email notification spy
// ═══════════════════════════════════════════════════════════════════════════════

function createMockSupabase() {
  const mock = {
    from:   vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq:     vi.fn(),
    single: vi.fn(),
  };
  // Wire every method to return the mock (fluent chain)
  Object.values(mock).forEach((fn) => fn.mockReturnValue(mock));
  return mock;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Voucher Code Generation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Voucher Code Generation', () => {
  it('should generate codes in REF-{amount}-{5chars} format', () => {
    const code = generateVoucherCode(10);
    expect(code).toMatch(/^REF-10-[A-Z0-9]{5}$/);
  });

  it('should embed the discount amount in the code', () => {
    const code25 = generateVoucherCode(25);
    expect(code25).toMatch(/^REF-25-/);

    const code50 = generateVoucherCode(50);
    expect(code50).toMatch(/^REF-50-/);
  });

  it('should generate unique codes across multiple calls', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateVoucherCode(10));
    }
    // With 5-char alphanumeric suffix, collisions in 100 calls are near-impossible
    expect(codes.size).toBe(100);
  });

  it('should use the default discount when called without args', () => {
    const code = generateVoucherCode();
    expect(code).toMatch(new RegExp(`^REF-${DEFAULT_DISCOUNT_AMOUNT}-`));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Fraud Prevention — Velocity Limiter
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fraud Prevention — Velocity Limiter', () => {
  beforeEach(() => {
    _resetVelocityLedger();
  });

  it('should ALLOW actions under the velocity limit', () => {
    const userId = 'user-vel-ok';

    for (let i = 0; i < VELOCITY_MAX_ACTIONS; i++) {
      const result = checkVelocity(userId);
      expect(result.allowed).toBe(true);
    }
  });

  it('should BLOCK the (limit + 1)th action within the window', () => {
    const userId = 'user-vel-exceeded';

    for (let i = 0; i < VELOCITY_MAX_ACTIONS; i++) {
      checkVelocity(userId);
    }

    const result = checkVelocity(userId);
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(VELOCITY_MAX_ACTIONS);
  });

  it('should track users independently', () => {
    const userA = 'user-a';
    const userB = 'user-b';

    for (let i = 0; i < VELOCITY_MAX_ACTIONS; i++) {
      checkVelocity(userA);
    }

    const result = checkVelocity(userB);
    expect(result.allowed).toBe(true);
  });

  it('should return count and limit in the result', () => {
    const userId = 'user-count';
    const result = checkVelocity(userId);

    expect(result.count).toBe(1);
    expect(result.limit).toBe(VELOCITY_MAX_ACTIONS);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Fraud Prevention — IP & Device-Hash Duplicate Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fraud Prevention — IP & Device-Hash Detection', () => {
  it('should flag matching IP addresses', () => {
    const result = detectDuplicateSignals({
      referrerIp: '192.168.1.100',
      refereeIp:  '192.168.1.100',
    });
    expect(result.suspicious).toBe(true);
    expect(result.reasons).toContain('same_ip_address');
  });

  it('should flag matching device hashes', () => {
    const result = detectDuplicateSignals({
      referrerIp: '10.0.0.1', refereeIp: '10.0.0.2',
      referrerDevice: 'abc123hash', refereeDevice: 'abc123hash',
    });
    expect(result.suspicious).toBe(true);
    expect(result.reasons).toContain('same_device_hash');
  });

  it('should flag BOTH when IP and device hash both match', () => {
    const result = detectDuplicateSignals({
      referrerIp: '192.168.1.1', refereeIp: '192.168.1.1',
      referrerDevice: 'samedevice', refereeDevice: 'samedevice',
    });
    expect(result.suspicious).toBe(true);
    expect(result.reasons).toContain('same_ip_address');
    expect(result.reasons).toContain('same_device_hash');
    expect(result.reasons).toHaveLength(2);
  });

  it('should NOT flag when IP and device are different', () => {
    const result = detectDuplicateSignals({
      referrerIp: '10.0.0.1', refereeIp: '172.16.0.1',
      referrerDevice: 'device-a', refereeDevice: 'device-b',
    });
    expect(result.suspicious).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it('should NOT flag when optional fields are missing', () => {
    const result = detectDuplicateSignals({
      referrerIp: '10.0.0.1', refereeIp: '10.0.0.2',
    });
    expect(result.suspicious).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Fraud Prevention — Composite runFraudChecks()
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fraud Prevention — Composite Checks', () => {
  beforeEach(() => {
    _resetVelocityLedger();
  });

  it('should PASS with no suspicious signals', () => {
    const result = runFraudChecks({
      userId: 'referee-1', referrerId: 'referrer-1',
      refereeIp: '10.0.0.1', referrerIp: '172.16.0.1',
    });
    expect(result.passed).toBe(true);
    expect(result.flagged).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it('should HARD BLOCK on velocity limit breach', () => {
    const userId = 'referee-blocked';
    const referrerId = 'referrer-safe';

    for (let i = 0; i < VELOCITY_MAX_ACTIONS; i++) {
      runFraudChecks({ userId, referrerId, refereeIp: '10.0.0.1' });
    }

    const result = runFraudChecks({ userId, referrerId, refereeIp: '10.0.0.1' });
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => r.includes('velocity_limit_exceeded'))).toBe(true);
  });

  it('should SOFT FLAG (but pass) on same-IP referral pair', () => {
    const result = runFraudChecks({
      userId: 'referee-ip', referrerId: 'referrer-ip',
      refereeIp: '192.168.1.1', referrerIp: '192.168.1.1',
    });
    expect(result.passed).toBe(true);
    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain('same_ip_address');
  });

  it('should HARD BLOCK on referrer velocity breach', () => {
    const referrerId = 'referrer-spammer';

    for (let i = 0; i < VELOCITY_MAX_ACTIONS; i++) {
      runFraudChecks({
        userId: `referee-${i}`, referrerId, refereeIp: `10.0.0.${i}`,
      });
    }

    const result = runFraudChecks({
      userId: 'referee-next', referrerId, refereeIp: '10.0.0.99',
    });
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => r.includes('referrer_velocity_limit_exceeded'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Reward Issuance Pipeline (using dependency injection)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Reward Issuance Pipeline', () => {
  let mockSB;
  let mockNotify;

  beforeEach(() => {
    mockSB     = createMockSupabase();
    mockNotify = vi.fn().mockResolvedValue({ success: true });
  });

  it('should return no_pending_referral when no PENDING entry exists', async () => {
    mockSB.single.mockReturnValueOnce({ data: null, error: { message: 'No rows' } });

    const result = await issueReward({
      refereeId: 'user-no-referral',
      _deps: { supabase: mockSB, sendVoucherNotification: mockNotify },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('no_pending_referral');
  });

  it('should transition referral to COMPLETED and mint a reward', async () => {
    const mockReferral = {
      id: 'ref-001', referrer_id: 'referrer-001',
      referee_id: 'referee-001', status: 'PENDING',
    };
    const mockReward = {
      id: 'reward-001', user_id: 'referrer-001',
      voucher_code: 'REF-10-ABCDE', discount_amount: 10, is_redeemed: false,
    };
    const mockReferrer = { name: 'Alice', email: 'alice@example.com' };

    // Chain: single (referral lookup) → single (reward insert) → single (referrer lookup)
    mockSB.single
      .mockReturnValueOnce({ data: mockReferral, error: null })
      .mockReturnValueOnce({ data: mockReward, error: null })
      .mockReturnValueOnce({ data: mockReferrer, error: null });

    const result = await issueReward({
      refereeId: 'referee-001',
      _deps: { supabase: mockSB, sendVoucherNotification: mockNotify },
    });

    expect(result.success).toBe(true);
    expect(result.referral.status).toBe('COMPLETED');
    expect(result.reward).toBeDefined();
    expect(result.reward.voucher_code).toBe('REF-10-ABCDE');
  });

  it('should transition to FLAGGED and withhold reward when flagged', async () => {
    const mockReferral = {
      id: 'ref-002', referrer_id: 'referrer-002',
      referee_id: 'referee-002', status: 'PENDING',
    };

    mockSB.single.mockReturnValueOnce({ data: mockReferral, error: null });

    const result = await issueReward({
      refereeId: 'referee-002',
      flagged: true,
      _deps: { supabase: mockSB, sendVoucherNotification: mockNotify },
    });

    expect(result.success).toBe(true);
    expect(result.referral.status).toBe('FLAGGED');
    expect(result.reward).toBeNull();
    // No voucher email for flagged referrals
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. End-to-End: Vouchers ONLY dispatched after successful action completion
// ═══════════════════════════════════════════════════════════════════════════════

describe('End-to-End — Voucher dispatch gating', () => {
  let mockSB;
  let mockNotify;

  beforeEach(() => {
    _resetVelocityLedger();
    mockSB     = createMockSupabase();
    mockNotify = vi.fn().mockResolvedValue({ success: true });
  });

  it('should NOT issue a voucher when no PENDING referral exists', async () => {
    mockSB.single.mockReturnValueOnce({ data: null, error: { message: 'No rows' } });

    const result = await issueReward({
      refereeId: 'orphan-user',
      _deps: { supabase: mockSB, sendVoucherNotification: mockNotify },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('no_pending_referral');
    expect(result.reward).toBeUndefined();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('should NOT issue a voucher when the referral is already COMPLETED', async () => {
    // The query filters for status='PENDING', so an already-COMPLETED record won't match
    mockSB.single.mockReturnValueOnce({ data: null, error: { message: 'No rows' } });

    const result = await issueReward({
      refereeId: 'already-completed-user',
      _deps: { supabase: mockSB, sendVoucherNotification: mockNotify },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('no_pending_referral');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('should NOT issue a voucher when fraud check flags the pair', async () => {
    const mockReferral = {
      id: 'ref-flagged', referrer_id: 'referrer-flagged',
      referee_id: 'referee-flagged', status: 'PENDING',
    };

    mockSB.single.mockReturnValueOnce({ data: mockReferral, error: null });

    const result = await issueReward({
      refereeId: 'referee-flagged',
      flagged: true,
      _deps: { supabase: mockSB, sendVoucherNotification: mockNotify },
    });

    expect(result.success).toBe(true);
    expect(result.referral.status).toBe('FLAGGED');
    expect(result.reward).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('should ONLY issue a voucher after a clean, successful pipeline run', async () => {
    const mockReferral = {
      id: 'ref-clean', referrer_id: 'referrer-clean',
      referee_id: 'referee-clean', status: 'PENDING',
    };
    const mockReward = {
      id: 'reward-clean', user_id: 'referrer-clean',
      voucher_code: 'REF-10-ZZZZZ', discount_amount: 10, is_redeemed: false,
    };
    const mockReferrer = { name: 'Bob', email: 'bob@example.com' };

    mockSB.single
      .mockReturnValueOnce({ data: mockReferral, error: null })   // referral lookup
      .mockReturnValueOnce({ data: mockReward, error: null })     // reward insert
      .mockReturnValueOnce({ data: mockReferrer, error: null });  // referrer lookup

    const result = await issueReward({
      refereeId: 'referee-clean',
      flagged: false,
      _deps: { supabase: mockSB, sendVoucherNotification: mockNotify },
    });

    expect(result.success).toBe(true);
    expect(result.referral.status).toBe('COMPLETED');
    expect(result.reward).toBeDefined();
    expect(result.reward.voucher_code).toBe('REF-10-ZZZZZ');

    // Voucher notification SHOULD have been sent
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        email:           'bob@example.com',
        discount_amount: 10,
      }),
    );
  });

  it('should prevent velocity abuse: 11th action is blocked, no reward issued', () => {
    const userId     = 'bot-user';
    const referrerId = 'referrer-bot';

    // First 10 actions should pass
    for (let i = 0; i < 10; i++) {
      const check = runFraudChecks({
        userId, referrerId, refereeIp: `10.0.0.${i}`,
      });
      expect(check.passed).toBe(true);
    }

    // 11th should be blocked
    const blocked = runFraudChecks({
      userId, referrerId, refereeIp: '10.0.0.99',
    });
    expect(blocked.passed).toBe(false);
    expect(blocked.reasons.length).toBeGreaterThan(0);
  });
});
