const { PrismaClient } = require('@prisma/client');
const { generateReferralCode } = require('../utils/codeGenerator');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Helper to mock a password hash
const hashPassword = (password) => crypto.createHash('sha256').update(password).digest('hex');

async function main() {
  console.log('Seeding database...');

  // Create mock users
  const user1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      name: 'Alice',
      email: 'alice@example.com',
      passwordHash: hashPassword('password123'),
      referralCode: generateReferralCode(),
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      name: 'Bob',
      email: 'bob@example.com',
      passwordHash: hashPassword('password123'),
      referralCode: generateReferralCode(),
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      name: 'Charlie',
      email: 'charlie@example.com',
      passwordHash: hashPassword('password123'),
      referralCode: generateReferralCode(),
    },
  });

  // Create a mock referral (Alice referred Bob)
  await prisma.referral.create({
    data: {
      referrerId: user1.id,
      refereeId: user2.id,
      status: 'COMPLETED',
    },
  });

  // Create a mock reward for Alice
  await prisma.reward.create({
    data: {
      userId: user1.id,
      voucherCode: `VOUCHER-${generateReferralCode(5)}`,
      discountAmount: 10.0, // $10 off
      isRedeemed: false,
    },
  });

  console.log('Database seeded successfully!');
  console.log({ user1, user2, user3 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
