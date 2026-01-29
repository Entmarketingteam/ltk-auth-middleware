/**
 * Platform Storage Service
 *
 * Generic service for storing encrypted tokens for multiple platforms:
 * - LTK
 * - Mavely
 * - Amazon Creator
 * - ShopMY
 */
export type Platform = 'LTK' | 'MAVELY' | 'AMAZON' | 'SHOPMY';
export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
export interface PlatformTokens {
    accessToken: string;
    idToken?: string;
    sessionCookie?: string;
    expiresAt: number;
    metadata?: Record<string, unknown>;
}
/**
 * Store platform tokens for a user (encrypted)
 */
export declare function storePlatformTokens(userId: string, platform: Platform, tokens: PlatformTokens): Promise<void>;
/**
 * Retrieve platform tokens for a user (decrypted)
 */
export declare function getPlatformTokens(userId: string, platform: Platform): Promise<PlatformTokens | null>;
/**
 * Get connection status for a user
 */
export declare function getPlatformConnectionStatus(userId: string, platform: Platform): Promise<{
    connected: boolean;
    status: ConnectionStatus | 'NOT_FOUND';
    expiresAt?: Date;
    lastRefresh?: Date;
    error?: string;
}>;
/**
 * Disconnect platform (remove tokens)
 */
export declare function disconnectPlatform(userId: string, platform: Platform): Promise<void>;
/**
 * Mark connection as having an error
 */
export declare function markPlatformError(userId: string, platform: Platform, errorMessage: string): Promise<void>;
/**
 * Update metadata for a platform connection
 */
export declare function updatePlatformMetadata(userId: string, platform: Platform, metadata: Record<string, unknown>): Promise<void>;
//# sourceMappingURL=platformStorage.d.ts.map