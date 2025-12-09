"use strict";
/**
 * AES-256-GCM Encryption Utilities
 *
 * Used to encrypt LTK tokens before storing in database.
 * Each encryption generates a unique IV for security.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
/**
 * Get encryption key from environment
 * Key must be 32 bytes (64 hex characters)
 */
function getEncryptionKey() {
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
/**
 * Encrypt a string using AES-256-GCM
 */
function encrypt(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv, {
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
function decrypt(encrypted) {
    const key = getEncryptionKey();
    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv, {
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
function encryptToken(token) {
    const encrypted = encrypt(token);
    // Combine into single string: iv.authTag.ciphertext
    return `${encrypted.iv}.${encrypted.authTag}.${encrypted.ciphertext}`;
}
/**
 * Decrypt token from database storage
 */
function decryptToken(storedValue) {
    const parts = storedValue.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format');
    }
    const [iv, authTag, ciphertext] = parts;
    return decrypt({ iv, authTag, ciphertext });
}
//# sourceMappingURL=encryption.js.map