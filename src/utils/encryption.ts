/**
 * AES-256-GCM Encryption Utilities
 * 
 * Used to encrypt LTK tokens before storing in database.
 * Each encryption generates a unique IV for security.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment
 * Key must be 32 bytes (64 hex characters)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  
  // Key should be 64 hex chars = 32 bytes
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32');
  }
  
  return Buffer.from(key, 'hex');
}

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string;         // Base64 encoded
  authTag: string;    // Base64 encoded
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt data encrypted with AES-256-GCM
 */
export function decrypt(encrypted: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  
  return plaintext;
}

/**
 * Encrypt token for database storage
 * Returns a single string that contains all components
 */
export function encryptToken(token: string): string {
  const encrypted = encrypt(token);
  // Combine into single string: iv.authTag.ciphertext
  return `${encrypted.iv}.${encrypted.authTag}.${encrypted.ciphertext}`;
}

/**
 * Decrypt token from database storage
 */
export function decryptToken(storedValue: string): string {
  const parts = storedValue.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  
  const [iv, authTag, ciphertext] = parts;
  return decrypt({ iv, authTag, ciphertext });
}
