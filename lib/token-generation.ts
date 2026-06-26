/**
 * Secure token generation utilities
 * Provides cryptographically secure tokens for authentication flows
 */

import crypto from 'crypto'

/**
 * Generate a secure verification code
 * Uses cryptographic randomness for better security than Math.random()
 * 
 * @param length - Length of the code (default: 6 digits for user-friendly codes)
 * @returns A random numeric code as string
 * 
 * Security note: 6-digit codes have ~1M combinations. For production security,
 * consider using higher length (8 digits = ~100M combinations) or migrating to
 * cryptographic tokens for password reset flows.
 */
export function generateVerificationCode(length: number = 6): string {
  // Use crypto.getRandomValues for true randomness instead of Math.random()
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  
  // Convert each byte to a digit 0-9
  return Array.from(array)
    .map((byte) => byte % 10)
    .join('')
}

/**
 * Generate a cryptographically secure token
 * Suitable for password reset, email verification, and other sensitive flows
 * 
 * @param length - Length of token in bytes (default: 32 = 256 bits)
 * @returns Hex-encoded random token
 * 
 * Example: "a3f8e9b2c1d4e5f6..." (64 character hex string for 32 bytes)
 * Provides ~2^256 possible values (effectively unguessable)
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Generate a URL-safe token
 * Uses base64url encoding for tokens that can appear in URLs
 * 
 * @param length - Length of random bytes to generate (default: 32)
 * @returns Base64url-encoded token
 * 
 * Safe for URLs and doesn't require additional encoding
 */
export function generateUrlSafeToken(length: number = 32): string {
  return crypto
    .randomBytes(length)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Hash a token for storage
 * Use this when storing tokens in database to prevent full token exposure in db dumps
 * 
 * @param token - The token to hash
 * @returns SHA256 hash of the token
 */
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
}

/**
 * Verify a token against its hash
 * 
 * @param token - The token to verify
 * @param hash - The stored hash
 * @returns true if token matches the hash
 */
export function verifyTokenHash(token: string, hash: string): boolean {
  const tokenHash = hashToken(token)
  return crypto.timingSafeEqual(
    Buffer.from(tokenHash),
    Buffer.from(hash)
  )
}
