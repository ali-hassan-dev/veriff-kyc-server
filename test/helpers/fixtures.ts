import crypto from 'crypto';

// Fake configuration used by every test. None of these are real credentials.
export const BASE_URL = 'https://veriff.test/v1';
export const VERSION = '1.0.0';
export const KEY_PAIRS = [
  { apiKey: 'test-api-key-1', sharedSecretKey: 'test-shared-secret-1' },
  { apiKey: 'test-api-key-2', sharedSecretKey: 'test-shared-secret-2' },
  { apiKey: 'test-api-key-3', sharedSecretKey: 'test-shared-secret-3' },
];

/**
 * HMAC-SHA256 hex digest, the way Veriff signs webhooks and API requests.
 * @param {string} data - The raw body or resource ID to sign.
 * @param {string} secret - The shared secret key.
 * @returns {string} - The hex-encoded signature.
 */
export const hmac = (data: string, secret: string) => crypto.createHmac('sha256', secret).update(data).digest('hex');
