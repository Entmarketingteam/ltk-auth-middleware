/**
 * AES-256-GCM Encryption Utilities
 *
 * Used to encrypt LTK tokens before storing in database.
 * Each encryption generates a unique IV for security.
 */
export interface EncryptedData {
    ciphertext: string;
    iv: string;
    authTag: string;
}
/**
 * Encrypt a string using AES-256-GCM
 */
export declare function encrypt(plaintext: string): EncryptedData;
/**
 * Decrypt data encrypted with AES-256-GCM
 */
export declare function decrypt(encrypted: EncryptedData): string;
/**
 * Encrypt token for database storage
 * Returns a single string that contains all components
 */
export declare function encryptToken(token: string): string;
/**
 * Decrypt token from database storage
 */
export declare function decryptToken(storedValue: string): string;
//# sourceMappingURL=encryption.d.ts.map