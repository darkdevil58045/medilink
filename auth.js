/**
 * OAuth 2.0 and Multi-Factor Authentication (MFA) utilities for MediLink backend.
 * This module will handle OAuth flows, token validation, and MFA verification.
 */

const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// Generate MFA secret for a user
function generateMfaSecret() {
  const secret = speakeasy.generateSecret({ length: 20 });
  return secret;
}

// Generate QR code data URL for MFA setup
async function generateMfaQrCode(secret, userEmail) {
  const otpauthUrl = speakeasy.otpauthURL({
    secret: secret.base32,
    label: `MediLink (${userEmail})`,
    issuer: 'MediLink',
  });
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
  return qrCodeDataUrl;
}

// Verify MFA token
function verifyMfaToken(secret, token) {
  return speakeasy.totp.verify({
    secret: secret.base32,
    encoding: 'base32',
    token,
    window: 1,
  });
}

module.exports = {
  generateMfaSecret,
  generateMfaQrCode,
  verifyMfaToken,
};
