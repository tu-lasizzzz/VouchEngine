const crypto = require('crypto');

/**
 * Generates a short, cryptographically secure 7-character referral code.
 * @param {number} length - Length of code to generate (default 7).
 * @returns {string} - Cryptographically secure referral code.
 */
function generateReferralCode(length = 7) {
  // Disambiguated alphabet (avoiding 0/O, 1/l/I)
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

module.exports = {
  generateReferralCode
};
